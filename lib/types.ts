// ContextVocab Data Types

export type CardStatus = "new" | "learning" | "review" | "graduated"

// 单个语境/上下文 - 每个语境拥有独立的 SRS 复习进度
export interface WordContext {
  sentence: string              // 例句
  meaning_cn: string            // 该语境下的中文释义
  sentence_translation?: string // 句子翻译
  source?: string               // 来源，如 "youtube:VIDEO_ID", "capture", "manual"
  added_at: number              // 添加时间戳
  // 独立 SRS 字段 - 每个语境单独追踪复习进度
  review_status: CardStatus
  interval: number              // 当前间隔（毫秒）
  ease_factor: number           // 难度系数，初始 2.5
  repetition: number            // 连续正确次数
  next_review_at: number        // 下次复习的时间戳 (Unix Timestamp)
}

export interface WordCard {
  id: string
  user_id: string               // 用户 ID (Supabase auth.users.id)
  word: string                  // 目标单词
  contexts: WordContext[]       // 语境数组，每个语境有独立 SRS 进度
  mnemonics?: string            // 助记（可选，适用于整个单词）
  created_at: number
}

// 用于复习的单元：单词卡片 + 语境索引
export interface ReviewUnit {
  card: WordCard
  contextIndex: number
}

export type ReviewGrade = "again" | "hard" | "good" | "easy"

export type ReviewMode = "cloze" | "flashcard"

export interface AIAnalysisResult {
  meaning: string
  mnemonic: string
}

// 添加卡片时的输入数据结构
export interface AddCardInput {
  word: string
  sentence: string
  meaning_cn: string
  sentence_translation?: string
  source?: string
}
