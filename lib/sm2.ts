// SM2 Algorithm Implementation for Spaced Repetition
// 基于语境级别的复习系统
import type { WordCard, WordContext, ReviewGrade, ReviewUnit } from "./types"

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

// Grade multipliers and configurations
const GRADE_CONFIG = {
  again: { intervalMultiplier: 0, minInterval: 1 * MINUTE, easeDelta: -0.2 },
  hard: { intervalMultiplier: 1.2, minInterval: 10 * MINUTE, easeDelta: -0.15 },
  good: { intervalMultiplier: 2.5, minInterval: 1 * DAY, easeDelta: 0 },
  easy: { intervalMultiplier: 3.5, minInterval: 4 * DAY, easeDelta: 0.15 },
}

/**
 * 计算语境的下次复习时间
 * @param context 当前语境
 * @param grade 用户评分
 * @returns 更新后的 SRS 字段
 */
export function calculateNextReview(context: WordContext, grade: ReviewGrade): Partial<WordContext> {
  const config = GRADE_CONFIG[grade]
  const now = Date.now()

  let newInterval: number
  let newRepetition = context.repetition
  const newEaseFactor = Math.max(1.3, context.ease_factor + config.easeDelta)
  let newStatus = context.review_status

  if (grade === "again") {
    // Reset to learning state
    newRepetition = 0
    newInterval = config.minInterval
    newStatus = "learning"
  } else {
    newRepetition = context.repetition + 1

    if (context.review_status === "new" || context.review_status === "learning") {
      // First successful review
      newInterval = config.minInterval
      newStatus = "learning"

      if (newRepetition >= 2) {
        newStatus = "review"
        newInterval = 1 * DAY
      }
    } else {
      // Calculate new interval based on previous interval
      const currentIntervalDays = context.interval / DAY
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

/**
 * 获取所有待复习的语境（ReviewUnit 列表）
 * @param cards 所有单词卡片
 * @returns 待复习的 ReviewUnit 数组，按 next_review_at 排序
 */
export function getDueContexts(cards: WordCard[]): ReviewUnit[] {
  const now = Date.now()
  const dueUnits: ReviewUnit[] = []

  for (const card of cards) {
    if (!card.contexts) continue
    
    card.contexts.forEach((context, index) => {
      if (context.next_review_at <= now) {
        dueUnits.push({
          card,
          contextIndex: index,
        })
      }
    })
  }

  // 按 next_review_at 排序
  return dueUnits.sort((a, b) => {
    const aTime = a.card.contexts[a.contextIndex].next_review_at
    const bTime = b.card.contexts[b.contextIndex].next_review_at
    return aTime - bTime
  })
}

/**
 * 获取所有语境的统计数据
 */
export function getContextStats(cards: WordCard[]): {
  total: number
  newCount: number
  learningCount: number
  reviewCount: number
  graduatedCount: number
} {
  let total = 0
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0
  let graduatedCount = 0

  for (const card of cards) {
    if (!card.contexts) continue
    
    for (const context of card.contexts) {
      total++
      switch (context.review_status) {
        case "new":
          newCount++
          break
        case "learning":
          learningCount++
          break
        case "review":
          reviewCount++
          break
        case "graduated":
          graduatedCount++
          break
      }
    }
  }

  return { total, newCount, learningCount, reviewCount, graduatedCount }
}

// 保留旧函数名的兼容性包装（基于语境统计）
export function getNewCardsCount(cards: WordCard[]): number {
  return getContextStats(cards).newCount
}

export function getLearningCardsCount(cards: WordCard[]): number {
  return getContextStats(cards).learningCount
}

export function getReviewCardsCount(cards: WordCard[]): number {
  const stats = getContextStats(cards)
  return stats.reviewCount + stats.graduatedCount
}

/**
 * 初始化新语境的 SRS 字段
 */
export function initContextSRS(): Pick<WordContext, 'review_status' | 'interval' | 'ease_factor' | 'repetition' | 'next_review_at'> {
  return {
    review_status: "new",
    interval: 0,
    ease_factor: 2.5,
    repetition: 0,
    next_review_at: Date.now(),
  }
}
