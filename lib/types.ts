// ContextVocab Data Types

export type CardStatus = "new" | "learning" | "review" | "graduated"

// ============================================================
// 标签相关类型
// ============================================================

// 预设标签常量
export const PRESET_TAGS = [
  "Business",
  "Academic", 
  "IT/Tech",
  "Medical",
  "Legal"
] as const

export type PresetTag = typeof PRESET_TAGS[number]

// 用户自定义标签
export interface UserTag {
  id: string
  user_id: string
  name: string
  color?: string  // 可选：标签颜色（hex 格式）
  created_at: number
}

// ============================================================
// YouTube 视频归档相关类型
// ============================================================

// 视频来源详情（用于追踪单词在视频中的具体位置）
export interface VideoSource {
  type: "youtube"
  session_id: string      // watch_sessions.id
  video_id: string        // YouTube Video ID
  timestamp: number       // 视频内时间点（秒）
}

// 观看会话（记录用户的视频学习历史）
export interface WatchSession {
  id: string
  user_id: string
  video_id: string
  video_title?: string
  channel_name?: string
  thumbnail_url?: string
  video_duration?: number
  started_at: number
  ended_at?: number
  words_saved: number
  notes?: string
}

// 来源类型：简单字符串或详细的视频来源
export type SourceType = string | VideoSource

// ============================================================
// 词汇卡片相关类型
// ============================================================

// 语法分析结构
export interface GrammarAnalysis {
  grammar?: string              // 语法结构分析
  nuance?: string               // 语义细微差别
  cultural_background?: string  // 文化背景
}

// 单个语境/上下文 - 每个语境拥有独立的 SRS 复习进度
export interface WordContext {
  sentence: string              // 例句
  meaning_cn: string            // 该语境下的中文释义
  sentence_translation?: string // 句子翻译
  source?: SourceType           // 来源：字符串或 VideoSource 对象
  tags?: string[]               // 标签数组（预设或自定义）
  added_at: number              // 添加时间戳
  
  // 语法分析（可选）
  grammar_analysis?: GrammarAnalysis
  
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
  source?: SourceType           // 支持字符串或 VideoSource
  tags?: string[]               // 标签数组
  grammar_analysis?: GrammarAnalysis  // 语法分析（可选）
}

// ============================================================
// 工具函数类型
// ============================================================

// 判断 source 是否为 VideoSource 类型
export const isVideoSource = (source: SourceType | undefined): source is VideoSource => {
  return typeof source === 'object' && source !== null && source.type === 'youtube'
}

// 获取 YouTube 视频跳转链接
export const getYouTubeLink = (source: SourceType | undefined): string | null => {
  if (isVideoSource(source)) {
    return `https://www.youtube.com/watch?v=${source.video_id}&t=${source.timestamp}s`
  }
  // 兼容旧格式 "youtube:VIDEO_ID"
  if (typeof source === 'string' && source.startsWith('youtube:')) {
    const videoId = source.split(':')[1]
    return `https://www.youtube.com/watch?v=${videoId}`
  }
  return null
}

// 判断 source 是否为 Podwise 链接
export const isPodwiseLink = (source: SourceType | undefined): boolean => {
  return typeof source === 'string' && source.includes('podwise.ai')
}

// 获取 Podwise 跳转链接（如果是 Podwise URL 则直接返回）
export const getPodwiseLink = (source: SourceType | undefined): string | null => {
  if (typeof source === 'string' && source.includes('podwise.ai')) {
    return source
  }
  return null
}
