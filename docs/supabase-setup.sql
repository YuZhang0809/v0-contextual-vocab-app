-- ContextVocab 数据库初始化脚本
-- 在 Supabase SQL Editor 中运行此脚本

-- 1. 创建 word_cards 表
CREATE TABLE IF NOT EXISTS word_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  sentence TEXT NOT NULL,
  meaning_cn TEXT NOT NULL,
  mnemonics TEXT,
  sentence_translation TEXT,
  review_status TEXT NOT NULL DEFAULT 'new' CHECK (review_status IN ('new', 'learning', 'review', 'graduated')),
  interval BIGINT NOT NULL DEFAULT 0,
  repetition INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  next_review_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_word_cards_user_id ON word_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_word_cards_next_review ON word_cards(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_word_cards_word ON word_cards(user_id, word);

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

-- 完成！现在你的数据库已经配置好了多用户隔离的安全策略

