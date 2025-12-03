import { deepseek } from "@ai-sdk/deepseek"
import { generateObject } from "ai"
import { z } from "zod"

// Define a more flexible Schema
const analysisSchema = z.object({
  is_sentence: z.boolean().describe("True if the input is a complete sentence, false if it is a word or phrase"),
  sentence_translation: z.string().optional().describe("Full sentence translation if the input is a sentence"),
  items: z.array(
    z.object({
      term: z.string().describe("The target word or phrase (Lemma/Base form)"),
      context_segment: z.string().describe("The actual segment in the sentence that matches the term"),
      meaning: z.string().describe("Precise Chinese meaning in this specific context (max 15 chars)"),
      example_sentence: z.string().describe("If input was a word: a generated example sentence. If input was a sentence: the original sentence."),
    })
  ).describe("List of learning items analyzed from the text"),
})

export async function POST(req: Request) {
  // Accept unified 'text' field, and optional 'focus_term' for specific lookup
  const { text, focus_term } = await req.json()

  if (!text && !focus_term) {
    return Response.json({ error: "Text input is required" }, { status: 400 })
  }

  // Construct Prompt based on mode
  let prompt = ""
  
  if (focus_term) {
    // Mode: Specific Lookup (Assistive Mode)
    // User wants to know the meaning of 'focus_term', possibly within 'text' (context)
    prompt = `You are an expert English language tutor. 
    
Task: Explain the meaning of the specific term "${focus_term}".

Context provided: "${text || 'None'}"

Requirements:
1. If context is provided, explain the meaning of "${focus_term}" specifically within that context.
2. If context is missing or irrelevant, generate a new example sentence for "${focus_term}" and explain it.
3. **OUTPUT**:
   - Return exactly ONE item in the 'items' array.
   - 'term': must be "${focus_term}".
   - 'meaning': concise Chinese meaning (max 15 chars).
   - 'example_sentence': the provided context (if valid) or the generated sentence.
   - 'sentence_translation': optional.
`
  } else {
    // Mode: General Analysis (Original Logic)
    prompt = `You are an expert English language tutor. Analyze the user's input.

User Input: "${text}"

Logic:
1. Determine if the input is a "Single Word/Phrase" or a "Complete Sentence".
2. **If Single Word/Phrase**:
   - Generate a high-quality, natural English example sentence containing the word.
   - The 'example_sentence' must be this generated sentence.
   - Explain the word's meaning in this generated context.
3. **If Complete Sentence**:
   - Identify 1-3 difficult words or collocations worth learning from the sentence.
   - Extract them as 'items'.
   - 'example_sentence' must be the original user input sentence for all items.
   - Provide the full sentence translation.

Constraints:
- NO mnemonics.
- Meaning must be concise (Chinese).
- 'context_segment' should be the exact text from the sentence.
`
  }

  try {
    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: analysisSchema,
      prompt: prompt,
      maxOutputTokens: 1000,
    })

    return Response.json(object)
  } catch (error) {
    console.error("AI analysis error:", error)
    const errorDetails = error instanceof Error ? error.message : "Unknown error"
    return Response.json(
      { error: "Failed to analyze text", details: errorDetails },
      { status: 500 },
    )
  }
}
