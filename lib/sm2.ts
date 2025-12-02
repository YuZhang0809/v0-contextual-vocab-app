// SM2 Algorithm Implementation for Spaced Repetition
import type { WordCard, ReviewGrade } from "./types"

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

// Grade multipliers and configurations
const GRADE_CONFIG = {
  again: { intervalMultiplier: 0, minInterval: 1 * MINUTE, easeDelta: -0.2 },
  hard: { intervalMultiplier: 1.2, minInterval: 10 * MINUTE, easeDelta: -0.15 },
  good: { intervalMultiplier: 2.5, minInterval: 1 * DAY, easeDelta: 0 },
  easy: { intervalMultiplier: 3.5, minInterval: 4 * DAY, easeDelta: 0.15 },
}

export function calculateNextReview(card: WordCard, grade: ReviewGrade): Partial<WordCard> {
  const config = GRADE_CONFIG[grade]
  const now = Date.now()

  let newInterval: number
  let newRepetition = card.repetition
  const newEaseFactor = Math.max(1.3, card.ease_factor + config.easeDelta)
  let newStatus = card.review_status

  if (grade === "again") {
    // Reset to learning state
    newRepetition = 0
    newInterval = config.minInterval
    newStatus = "learning"
  } else {
    newRepetition = card.repetition + 1

    if (card.review_status === "new" || card.review_status === "learning") {
      // First successful review
      newInterval = config.minInterval
      newStatus = "learning"

      if (newRepetition >= 2) {
        newStatus = "review"
        newInterval = 1 * DAY
      }
    } else {
      // Calculate new interval based on previous interval
      const currentIntervalDays = card.interval / DAY
      const newIntervalDays = (currentIntervalDays * newEaseFactor * config.intervalMultiplier) / 2.5
      newInterval = Math.max(config.minInterval, newIntervalDays * DAY)

      if (newIntervalDays >= 21) {
        newStatus = "graduated"
      }
    }
  }

  return {
    interval: newInterval,
    repetition: newRepetition,
    ease_factor: newEaseFactor,
    review_status: newStatus,
    next_review_at: now + newInterval,
  }
}

export function getDueCards(cards: WordCard[]): WordCard[] {
  const now = Date.now()
  return cards.filter((card) => card.next_review_at <= now).sort((a, b) => a.next_review_at - b.next_review_at)
}

export function getNewCardsCount(cards: WordCard[]): number {
  return cards.filter((card) => card.review_status === "new").length
}

export function getLearningCardsCount(cards: WordCard[]): number {
  return cards.filter((card) => card.review_status === "learning").length
}

export function getReviewCardsCount(cards: WordCard[]): number {
  return cards.filter((card) => card.review_status === "review" || card.review_status === "graduated").length
}
