import { createClient } from "@/lib/supabase/server"
import { initContextSRS } from "@/lib/sm2"
import type { AddCardInput, WordContext, WordCard } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const input: AddCardInput = await req.json()

    if (!input.word || !input.sentence || !input.meaning_cn) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Prepare new context
    const newContext: WordContext = {
      sentence: input.sentence,
      meaning_cn: input.meaning_cn,
      sentence_translation: input.sentence_translation,
      source: input.source || "manual",
      tags: input.tags,
      added_at: Date.now(),
      ...initContextSRS(),
    }

    // Check for existing card
    const { data: existing, error: queryError } = await supabase
      .from("word_cards")
      .select("*")
      .eq("user_id", user.id)
      .ilike("word", input.word)
      .single()

    if (queryError && queryError.code !== "PGRST116") {
      console.error("Database query error:", queryError)
      return Response.json({ error: "Database error" }, { status: 500 })
    }

    if (existing) {
      // Check for duplicates
      const isDuplicate = (existing.contexts || []).some((existingCtx: WordContext) => {
        // 1. Exact match
        if (existingCtx.sentence === newContext.sentence) return true

        // 2. Substring match
        const existingSentence = existingCtx.sentence.toLowerCase().trim()
        const newSentence = newContext.sentence.toLowerCase().trim()
        if (existingSentence.includes(newSentence) || newSentence.includes(existingSentence)) {
          return true
        }
        
        // 3. YouTube/Podwise timestamp deduplication could go here if needed
        return false
      })

      if (isDuplicate) {
        return Response.json({ message: "Context already exists", card: existing })
      }

      // Append new context
      const updatedContexts = [...(existing.contexts || []), newContext]
      const { data: updatedCard, error: updateError } = await supabase
        .from("word_cards")
        .update({ contexts: updatedContexts })
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) {
        return Response.json({ error: "Failed to update card" }, { status: 500 })
      }

      return Response.json({ message: "Context added", card: updatedCard })
    } else {
      // Create new card
      const newCard = {
        user_id: user.id,
        word: input.word,
        contexts: [newContext],
        created_at: Date.now(),
      }

      const { data: insertedCard, error: insertError } = await supabase
        .from("word_cards")
        .insert(newCard)
        .select()
        .single()

      if (insertError) {
        return Response.json({ error: "Failed to create card" }, { status: 500 })
      }

      return Response.json({ message: "Card created", card: insertedCard })
    }

  } catch (error) {
    console.error("API Error:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


