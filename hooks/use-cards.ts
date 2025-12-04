"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { WordCard, ReviewGrade } from "@/lib/types"
import { calculateNextReview } from "@/lib/sm2"

// Supabase 数据库获取器
async function fetchAllCards(): Promise<WordCard[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []
  
  const { data, error } = await supabase
    .from("word_cards")
    .select("*")
    .order("created_at", { ascending: false })
  
  if (error) {
    console.error("获取卡片失败:", error)
    return []
  }
  
  return data || []
}

async function fetchDueCards(): Promise<WordCard[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []
  
  const now = Date.now()
  const { data, error } = await supabase
    .from("word_cards")
    .select("*")
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
  
  if (error) {
    console.error("获取待复习卡片失败:", error)
    return []
  }
  
  return data || []
}

export function useCards() {
  const {
    data: cards,
    error,
    isLoading,
    mutate,
  } = useSWR<WordCard[]>("all-cards", fetchAllCards, {
    revalidateOnFocus: false,
    fallbackData: [],
  })

  const addCard = async (
    cardData: Omit<
      WordCard,
      "id" | "created_at" | "review_status" | "interval" | "repetition" | "ease_factor" | "next_review_at" | "user_id"
    >,
  ) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error("用户未登录")
    }

    const newCard = {
      user_id: user.id,
      ...cardData,
      review_status: "new" as const,
      interval: 0,
      repetition: 0,
      ease_factor: 2.5,
      next_review_at: Date.now(),
      created_at: Date.now(),
    }

    const { data, error } = await supabase
      .from("word_cards")
      .insert(newCard)
      .select()
      .single()

    if (error) {
      console.error("添加卡片失败:", error)
      throw error
    }

    mutate()
    return data
  }

  const updateCard = async (card: WordCard) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("word_cards")
      .update({
        word: card.word,
        sentence: card.sentence,
        meaning_cn: card.meaning_cn,
        mnemonics: card.mnemonics,
        sentence_translation: card.sentence_translation,
        review_status: card.review_status,
        interval: card.interval,
        repetition: card.repetition,
        ease_factor: card.ease_factor,
        next_review_at: card.next_review_at,
      })
      .eq("id", card.id)

    if (error) {
      console.error("更新卡片失败:", error)
      throw error
    }

    mutate()
  }

  const removeCard = async (id: string) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("word_cards")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("删除卡片失败:", error)
      throw error
    }

    mutate()
  }

  const reviewCard = async (card: WordCard, grade: ReviewGrade) => {
    const updates = calculateNextReview(card, grade)
    const updatedCard = { ...card, ...updates }
    await updateCard(updatedCard)
    return updatedCard
  }

  return {
    cards: cards || [],
    isLoading,
    error,
    addCard,
    updateCard,
    removeCard,
    reviewCard,
    refresh: mutate,
  }
}

export function useDueCards() {
  const {
    data: dueCards,
    error,
    isLoading,
    mutate,
  } = useSWR<WordCard[]>("due-cards", fetchDueCards, {
    revalidateOnFocus: false,
    refreshInterval: 60000,
    fallbackData: [],
  })

  return {
    dueCards: dueCards || [],
    isLoading,
    error,
    refresh: mutate,
  }
}
