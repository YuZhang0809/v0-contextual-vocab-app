"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { WordCard, WordContext, ReviewGrade, AddCardInput, ReviewUnit } from "@/lib/types"
import { calculateNextReview, getDueContexts, initContextSRS } from "@/lib/sm2"

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

  /**
   * 添加卡片 - 支持去重和追加语境
   * 如果单词已存在，将新语境追加到现有卡片
   * 如果单词不存在，创建新卡片
   */
  const addCard = async (cardData: AddCardInput): Promise<{ isNew: boolean; card: WordCard }> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error("用户未登录")
    }

    // 创建新的语境对象（包含独立的 SRS 字段）
    const newContext: WordContext = {
      sentence: cardData.sentence,
      meaning_cn: cardData.meaning_cn,
      sentence_translation: cardData.sentence_translation,
      source: cardData.source || "manual",
      tags: cardData.tags,
      added_at: Date.now(),
      // 初始化 SRS 字段
      ...initContextSRS(),
    }

    // 检查是否已存在相同单词（不区分大小写）
    const { data: existing, error: queryError } = await supabase
      .from("word_cards")
      .select("*")
      .eq("user_id", user.id)
      .ilike("word", cardData.word)
      .single()

    if (queryError && queryError.code !== "PGRST116") {
      // PGRST116 表示没有找到记录，其他错误需要抛出
      console.error("查询卡片失败:", queryError)
      throw queryError
    }

    if (existing) {
      // 单词已存在，追加新语境
      const updatedContexts = [...(existing.contexts || []), newContext]
      
      const { data: updatedCard, error: updateError } = await supabase
        .from("word_cards")
        .update({ contexts: updatedContexts })
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) {
        console.error("追加语境失败:", updateError)
        throw updateError
      }

      mutate()
      return { isNew: false, card: updatedCard }
    } else {
      // 单词不存在，创建新卡片
      const newCard = {
        user_id: user.id,
        word: cardData.word,
        contexts: [newContext],
        created_at: Date.now(),
      }

      const { data: insertedCard, error: insertError } = await supabase
        .from("word_cards")
        .insert(newCard)
        .select()
        .single()

      if (insertError) {
        console.error("添加卡片失败:", insertError)
        throw insertError
      }

      mutate()
      return { isNew: true, card: insertedCard }
    }
  }

  /**
   * 更新卡片（更新 contexts 数组）
   */
  const updateCard = async (card: WordCard) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("word_cards")
      .update({
        word: card.word,
        contexts: card.contexts,
        mnemonics: card.mnemonics,
      })
      .eq("id", card.id)

    if (error) {
      console.error("更新卡片失败:", error)
      throw error
    }

    mutate()
  }

  /**
   * 删除卡片
   */
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

  /**
   * 删除单个语境
   */
  const removeContext = async (cardId: string, contextIndex: number) => {
    const card = cards?.find(c => c.id === cardId)
    if (!card) return

    const updatedContexts = card.contexts.filter((_, i) => i !== contextIndex)
    
    if (updatedContexts.length === 0) {
      // 如果删除后没有语境了，删除整个卡片
      await removeCard(cardId)
    } else {
      await updateCard({ ...card, contexts: updatedContexts })
    }
  }

  /**
   * 复习特定语境
   * @param cardId 卡片 ID
   * @param contextIndex 语境索引
   * @param grade 评分
   */
  const reviewContext = async (cardId: string, contextIndex: number, grade: ReviewGrade) => {
    const card = cards?.find(c => c.id === cardId)
    if (!card || !card.contexts[contextIndex]) {
      throw new Error("卡片或语境不存在")
    }

    const context = card.contexts[contextIndex]
    const updates = calculateNextReview(context, grade)
    
    // 更新特定语境的 SRS 字段
    const updatedContexts = [...card.contexts]
    updatedContexts[contextIndex] = { ...context, ...updates }
    
    const updatedCard = { ...card, contexts: updatedContexts }
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
    removeContext,
    reviewContext,
    refresh: mutate,
  }
}

/**
 * 获取待复习的语境列表
 */
export function useDueContexts() {
  const { cards, isLoading, error, refresh } = useCards()
  
  // 从所有卡片中提取待复习的语境
  const dueContexts: ReviewUnit[] = getDueContexts(cards)

  return {
    dueContexts,
    dueCount: dueContexts.length,
    isLoading,
    error,
    refresh,
  }
}

// 保留旧的 useDueCards 用于兼容，但标记为废弃
/** @deprecated 请使用 useDueContexts */
export function useDueCards() {
  const { cards, isLoading, error, refresh } = useCards()
  const dueContexts = getDueContexts(cards)
  
  // 提取唯一的卡片（去重）
  const uniqueCardIds = new Set<string>()
  const dueCards: WordCard[] = []
  
  for (const unit of dueContexts) {
    if (!uniqueCardIds.has(unit.card.id)) {
      uniqueCardIds.add(unit.card.id)
      dueCards.push(unit.card)
    }
  }

  return {
    dueCards,
    isLoading,
    error,
    refresh,
  }
}
