"use client"

import useSWR from "swr"
import { getAllCards, saveCard, deleteCard, getDueCards, generateId } from "@/lib/db"
import type { WordCard, ReviewGrade } from "@/lib/types"
import { calculateNextReview } from "@/lib/sm2"

export function useCards() {
  const {
    data: cards,
    error,
    isLoading,
    mutate,
  } = useSWR<WordCard[]>("all-cards", getAllCards, {
    revalidateOnFocus: false,
    fallbackData: [],
  })

  const addCard = async (
    cardData: Omit<
      WordCard,
      "id" | "created_at" | "review_status" | "interval" | "repetition" | "ease_factor" | "next_review_at"
    >,
  ) => {
    const newCard: WordCard = {
      ...cardData,
      id: generateId(),
      review_status: "new",
      interval: 0,
      repetition: 0,
      ease_factor: 2.5,
      next_review_at: Date.now(), // Due immediately
      created_at: Date.now(),
    }

    await saveCard(newCard)
    mutate()
    return newCard
  }

  const updateCard = async (card: WordCard) => {
    await saveCard(card)
    mutate()
  }

  const removeCard = async (id: string) => {
    await deleteCard(id)
    mutate()
  }

  const reviewCard = async (card: WordCard, grade: ReviewGrade) => {
    const updates = calculateNextReview(card, grade)
    const updatedCard = { ...card, ...updates }
    await saveCard(updatedCard)
    mutate()
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
  } = useSWR<WordCard[]>("due-cards", getDueCards, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // Refresh every minute
    fallbackData: [],
  })

  return {
    dueCards: dueCards || [],
    isLoading,
    error,
    refresh: mutate,
  }
}
