// ContextVocab Data Types

export type CardStatus = "new" | "learning" | "review" | "graduated"

export interface WordCard {
  id: string
  word: string
  sentence: string
  meaning_cn: string
  mnemonics: string
  review_status: CardStatus
  interval: number // 当前间隔天数
  repetition: number // 连续正确次数
  ease_factor: number // 难度系数，初始 2.5
  next_review_at: number // 下次复习的时间戳 (Unix Timestamp)
  created_at: number
}

export type ReviewGrade = "again" | "hard" | "good" | "easy"

export type ReviewMode = "cloze" | "flashcard"

export interface AIAnalysisResult {
  meaning: string
  mnemonic: string
}
