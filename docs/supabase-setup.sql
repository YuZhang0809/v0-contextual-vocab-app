-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- SINGLE SOURCE OF TRUTH (SSOT) FOR DATABASE SCHEMA
-- DO NOT MODIFY DATABASE STRUCTURE WITHOUT UPDATING THIS FILE
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- ContextVocab 数据库初始化脚本 (v6 - Translation Cache)
-- 在 Supabase SQL Editor 中运行此脚本
-- 注意：如果你已有旧版表结构，请先删除旧表：
--   DROP TABLE IF EXISTS user_tags;
--   DROP TABLE IF EXISTS watch_sessions;
--   DROP TABLE IF EXISTS word_cards;

-- 1. 创建 word_cards 表
-- 注意：SRS 字段现在存储在 contexts JSONB 中的每个语境对象里
CREATE TABLE IF NOT EXISTS word_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  -- contexts: JSONB 数组，每个元素包含独立的 SRS 进度
  -- 结构: { sentence, meaning_cn, sentence_translation?, source?, tags?, added_at, 
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

-- ============================================================
-- 9. 创建 user_tags 表 (用户自定义标签)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- 标签名称
  color TEXT,                               -- 可选：标签颜色 (hex 格式，如 #FF5733)
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  -- 每个用户的标签名唯一
  UNIQUE(user_id, name)
);

-- 10. 创建 user_tags 索引
CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags(user_id);

-- 11. 启用 user_tags 的 RLS
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

-- 12. 创建 user_tags 的 RLS 策略
CREATE POLICY "Users can view own tags" ON user_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON user_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON user_tags
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON user_tags
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 13. 创建 video_translations 表 (视频翻译缓存)
-- ============================================================
CREATE TABLE IF NOT EXISTS video_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,                     -- YouTube Video ID
  translations JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 翻译结果数组
  segment_count INT NOT NULL DEFAULT 0,       -- 字幕段落数量
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  -- 每个用户每个视频一条缓存记录
  UNIQUE(user_id, video_id)
);

-- 14. 创建 video_translations 索引
CREATE INDEX IF NOT EXISTS idx_video_translations_user_id ON video_translations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_translations_video_id ON video_translations(user_id, video_id);

-- 15. 启用 video_translations 的 RLS
ALTER TABLE video_translations ENABLE ROW LEVEL SECURITY;

-- 16. 创建 video_translations 的 RLS 策略
CREATE POLICY "Users can view own translations" ON video_translations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own translations" ON video_translations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own translations" ON video_translations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own translations" ON video_translations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 17. 创建 video_transcripts 表 (视频字幕缓存)
-- ============================================================
CREATE TABLE IF NOT EXISTS video_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,                       -- YouTube Video ID (全局共享)
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb, -- 字幕数据 [{text, offset, duration}]
  language TEXT DEFAULT 'en',                   -- 字幕语言
  segment_count INT NOT NULL DEFAULT 0,         -- 字幕段落数量
  source TEXT DEFAULT 'youtube-transcript',     -- 数据来源: youtube-transcript, transcriptapi
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  -- 每个视频一条缓存记录 (全局共享，不按用户区分)
  UNIQUE(video_id)
);

-- 18. 创建 video_transcripts 索引
CREATE INDEX IF NOT EXISTS idx_video_transcripts_video_id ON video_transcripts(video_id);

-- 19. 启用 video_transcripts 的 RLS
ALTER TABLE video_transcripts ENABLE ROW LEVEL SECURITY;

-- 20. 创建 video_transcripts 的 RLS 策略
-- 字幕数据可以被所有登录用户读取（全局共享）
CREATE POLICY "Authenticated users can view transcripts" ON video_transcripts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 任何登录用户都可以插入新的字幕缓存
CREATE POLICY "Authenticated users can insert transcripts" ON video_transcripts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 任何登录用户都可以更新字幕缓存
CREATE POLICY "Authenticated users can update transcripts" ON video_transcripts
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 完成！
-- 
-- ============================================================
-- 数据示例
-- ============================================================
--
-- contexts 字段示例 (v5 - 支持 Tags):
-- [
--   {
--     "sentence": "I need to go to the bank to deposit money.",
--     "meaning_cn": "银行",
--     "sentence_translation": "我需要去银行存钱。",
--     "source": "capture",
--     "tags": ["Business"],
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
--     "tags": ["Academic", "Geography"],
--     "added_at": 1701936000000,
--     "review_status": "new",
--     "interval": 0,
--     "ease_factor": 2.5,
--     "repetition": 0,
--     "next_review_at": 1701936000000
--   }
-- ]
--
-- user_tags 示例:
-- {
--   "id": "tag-uuid",
--   "user_id": "user-uuid",
--   "name": "Geography",
--   "color": "#3B82F6",
--   "created_at": 1701936000000
-- }
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

