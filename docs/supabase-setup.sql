-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- SINGLE SOURCE OF TRUTH (SSOT) FOR DATABASE SCHEMA
-- DO NOT MODIFY DATABASE STRUCTURE WITHOUT UPDATING THIS FILE
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- ContextVocab 数据库初始化脚本 (v4 - YouTube Archive)
-- 在 Supabase SQL Editor 中运行此脚本
-- 注意：如果你已有旧版表结构，请先删除旧表：
--   DROP TABLE IF EXISTS watch_sessions;
--   DROP TABLE IF EXISTS word_cards;

-- 1. 创建 word_cards 表
-- 注意：SRS 字段现在存储在 contexts JSONB 中的每个语境对象里
CREATE TABLE IF NOT EXISTS word_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  -- contexts: JSONB 数组，每个元素包含独立的 SRS 进度
  -- 结构: { sentence, meaning_cn, sentence_translation?, source?, added_at, 
  --         review_status, interval, ease_factor, repetition, next_review_at }
  contexts JSONB NOT NULL DEFAULT '[]'::jsonb,
  mnemonics TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  -- 每个用户的单词唯一约束，防止重复
  UNIQUE(user_id, word)
);

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_word_cards_user_id ON word_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_word_cards_word ON word_cards(user_id, word);
-- GIN 索引用于 JSONB 查询（用于在 contexts 中搜索和过滤）
CREATE INDEX IF NOT EXISTS idx_word_cards_contexts ON word_cards USING GIN (contexts);

-- 3. 启用 Row Level Security (RLS)
ALTER TABLE word_cards ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略：用户只能访问自己的数据
-- 策略：SELECT - 用户只能查询自己的卡片
CREATE POLICY "Users can view own cards" ON word_cards
  FOR SELECT
  USING (auth.uid() = user_id);

-- 策略：INSERT - 用户只能插入自己的卡片
CREATE POLICY "Users can insert own cards" ON word_cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略：UPDATE - 用户只能更新自己的卡片
CREATE POLICY "Users can update own cards" ON word_cards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 策略：DELETE - 用户只能删除自己的卡片
CREATE POLICY "Users can delete own cards" ON word_cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. 创建 watch_sessions 表 (YouTube 视频观看记录)
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,                -- YouTube Video ID
  video_title TEXT,                       -- 视频标题
  channel_name TEXT,                      -- 频道名称
  thumbnail_url TEXT,                     -- 缩略图 URL
  video_duration INT,                     -- 时长（秒）
  started_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  ended_at BIGINT,                        -- 结束观看时间戳
  words_saved INT DEFAULT 0,              -- 本次保存单词数
  notes TEXT,                             -- 用户笔记
  -- 防止同一用户同一时间重复创建会话
  UNIQUE(user_id, video_id, started_at)
);

-- 6. 创建 watch_sessions 索引
CREATE INDEX IF NOT EXISTS idx_watch_sessions_user_id ON watch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_video_id ON watch_sessions(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_started_at ON watch_sessions(user_id, started_at DESC);

-- 7. 启用 watch_sessions 的 RLS
ALTER TABLE watch_sessions ENABLE ROW LEVEL SECURITY;

-- 8. 创建 watch_sessions 的 RLS 策略
CREATE POLICY "Users can view own sessions" ON watch_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON watch_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON watch_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON watch_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 完成！
-- 
-- ============================================================
-- 数据示例
-- ============================================================
--
-- contexts 字段示例 (v4 - 支持 VideoSource 格式):
-- [
--   {
--     "sentence": "I need to go to the bank to deposit money.",
--     "meaning_cn": "银行",
--     "sentence_translation": "我需要去银行存钱。",
--     "source": "capture",
--     "added_at": 1701849600000,
--     "review_status": "learning",
--     "interval": 86400000,
--     "ease_factor": 2.5,
--     "repetition": 1,
--     "next_review_at": 1701936000000
--   },
--   {
--     "sentence": "We walked along the bank of the river.",
--     "meaning_cn": "河岸",
--     "sentence_translation": "我们沿着河岸散步。",
--     "source": {
--       "type": "youtube",
--       "session_id": "550e8400-e29b-41d4-a716-446655440000",
--       "video_id": "dQw4w9WgXcQ",
--       "timestamp": 125
--     },
--     "added_at": 1701936000000,
--     "review_status": "new",
--     "interval": 0,
--     "ease_factor": 2.5,
--     "repetition": 0,
--     "next_review_at": 1701936000000
--   }
-- ]
--
-- watch_sessions 示例:
-- {
--   "id": "550e8400-e29b-41d4-a716-446655440000",
--   "user_id": "user-uuid",
--   "video_id": "dQw4w9WgXcQ",
--   "video_title": "TED: How to Learn Anything Fast",
--   "channel_name": "TED-Ed",
--   "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
--   "video_duration": 600,
--   "started_at": 1701936000000,
--   "ended_at": 1701937200000,
--   "words_saved": 5,
--   "notes": "关于学习方法的视频"
-- }

