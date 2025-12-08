"use client"

import React, { useEffect, useRef, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Loader2 } from "lucide-react";

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  translation?: string;
  translationStatus?: 'pending' | 'loading' | 'done' | 'error';
}

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onWordClick: (word: string, context: string) => void;
  onSeek?: (timeInSeconds: number) => void;
  showTranslation?: boolean;
}

// 检测文本是否以句末标点结尾
const endsWithSentence = (text: string): boolean => {
  const trimmed = text.trim();
  return /[.!?。！？][\s"'）)]*$/.test(trimmed);
};

// 检测文本是否以句首开始（前一个块以句末结尾，或是第一个块）
const startsNewSentence = (transcript: TranscriptSegment[], index: number): boolean => {
  if (index === 0) return true;
  const prevText = transcript[index - 1]?.text || '';
  return endsWithSentence(prevText);
};

export function TranscriptView({ transcript, currentTime, onWordClick, onSeek, showTranslation = false }: TranscriptViewProps) {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Find active segment index
  const activeIndex = transcript.findIndex(
    (seg, i) => {
        const nextSeg = transcript[i + 1];
        const segStart = seg.offset / 1000;
        const segEnd = (seg.offset + seg.duration) / 1000;
        const nextStart = nextSeg ? nextSeg.offset / 1000 : Infinity;
        const effectiveEnd = Math.min(segEnd + 0.5, nextStart);
        return currentTime >= segStart && currentTime < effectiveEnd;
    }
  );

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  // 智能语境截取：基于句子边界 + 最小长度保证
  const getContext = useCallback((currentIndex: number) => {
    const MIN_CONTEXT_LENGTH = 80;
    const MAX_CONTEXT_LENGTH = 350;
    const MAX_BLOCKS_EACH_SIDE = 5;
    
    const sentenceEnders = /[.!?。！？][\s"'）)]*$/;
    
    let startIdx = currentIndex;
    let endIdx = currentIndex;
    
    while (startIdx > 0 && startIdx > currentIndex - MAX_BLOCKS_EACH_SIDE) {
      const prevText = transcript[startIdx - 1]?.text?.trim() || "";
      if (sentenceEnders.test(prevText)) {
        break;
      }
      startIdx--;
    }
    
    while (endIdx < transcript.length - 1 && endIdx < currentIndex + MAX_BLOCKS_EACH_SIDE) {
      const currentText = transcript[endIdx]?.text?.trim() || "";
      if (sentenceEnders.test(currentText)) {
        break;
      }
      endIdx++;
    }
    
    const buildContext = (start: number, end: number) => {
      let result = "";
      for (let i = start; i <= end; i++) {
        const text = transcript[i]?.text || "";
        result += text + " ";
      }
      return result.trim();
    };
    
    let context = buildContext(startIdx, endIdx);
    
    while (context.length < MIN_CONTEXT_LENGTH) {
      const canExpandBack = startIdx > 0;
      const canExpandForward = endIdx < transcript.length - 1;
      
      if (!canExpandBack && !canExpandForward) break;
      
      if (canExpandForward && (!canExpandBack || endIdx - currentIndex <= currentIndex - startIdx)) {
        endIdx++;
      } else if (canExpandBack) {
        startIdx--;
      }
      
      context = buildContext(startIdx, endIdx);
      
      if (context.length > MAX_CONTEXT_LENGTH) {
        const lastSentenceEnd = context.search(/[.!?。！？][^.!?。！？]*$/);
        if (lastSentenceEnd > MIN_CONTEXT_LENGTH) {
          context = context.substring(0, lastSentenceEnd + 1);
        }
        break;
      }
    }
    
    return context;
  }, [transcript]);

  // 处理文本选择或单词点击
  const handleTextInteraction = useCallback((e: React.MouseEvent, segmentIndex: number) => {
    e.stopPropagation();
    
    // 获取选中的文本
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 0) {
      // 用户选择了文本（短语）
      const cleanPhrase = selectedText.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanPhrase.length > 0) {
        onWordClick(cleanPhrase, getContext(segmentIndex));
        // 清除选择
        selection?.removeAllRanges();
      }
    } else {
      // 用户点击了单个位置，尝试获取点击的单词
      const target = e.target as HTMLElement;
      if (target.dataset.word) {
        const cleanWord = target.dataset.word.replace(/[^\w\s'-]/g, '');
        if (cleanWord.length > 0) {
          onWordClick(cleanWord, getContext(segmentIndex));
        }
      }
    }
  }, [getContext, onWordClick]);

  return (
    <ScrollArea className="h-[400px] w-full rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
      <div className="flex flex-col" ref={containerRef}>
        {transcript.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            暂无字幕或正在加载...
          </div>
        )}
        {transcript.map((segment, index) => {
          const isActive = index === activeIndex;
          const timeInSeconds = Math.floor(segment.offset / 1000);
          const mins = Math.floor(timeInSeconds / 60);
          const secs = timeInSeconds % 60;
          const timeLabel = `${mins}:${String(secs).padStart(2, '0')}`;
          
          const isLoading = segment.translationStatus === 'loading';
          const hasTranslation = !!segment.translation;
          const isError = segment.translationStatus === 'error';
          
          // 视觉连接逻辑
          const isNewSentence = startsNewSentence(transcript, index);
          const continuesSentence = !isNewSentence;
          const endsSentence = endsWithSentence(segment.text || '');
          
          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              className={cn(
                "transition-all duration-300 group",
                // 如果是句子延续，减少顶部间距
                continuesSentence ? "mt-0 pt-0.5" : "mt-3 first:mt-0",
                // 如果不是句子结尾，减少底部间距
                !endsSentence ? "mb-0 pb-0.5" : "mb-0 pb-2",
                // 左侧边距保持一致
                "px-3",
                // 当前活跃段落高亮
                isActive 
                  ? "bg-primary/10 border-l-2 border-primary shadow-sm rounded-lg" 
                  : "hover:bg-secondary/30 rounded-lg"
              )}
            >
              {/* 时间戳 - 只在新句子开头显示，或者当前活跃时显示 */}
              {(isNewSentence || isActive) && (
                <div className="flex items-center gap-2 mb-0.5">
                  {onSeek && (
                    <button
                      onClick={() => onSeek(timeInSeconds)}
                      className={cn(
                        "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-all",
                        isActive 
                          ? "bg-primary/20 text-primary" 
                          : "text-muted-foreground/60 hover:bg-primary/10 hover:text-primary",
                        // 非句首的时间戳更透明
                        !isNewSentence && "opacity-50"
                      )}
                      title={`跳转到 ${timeLabel}`}
                    >
                      <Play className="h-3 w-3" />
                      <span>{timeLabel}</span>
                    </button>
                  )}
                </div>
              )}
              
              {/* 英文原文 - 支持选择短语或点击单词 */}
              <p 
                className={cn(
                  "text-base leading-relaxed select-text cursor-text",
                  // 非句首的文本稍微缩进，视觉上表示延续
                  continuesSentence && "pl-0"
                )}
                onMouseUp={(e) => handleTextInteraction(e, index)}
              >
                {(segment.text || '').split(' ').map((word, wIndex) => (
                  <span
                    key={wIndex}
                    data-word={word}
                    className={cn(
                      "hover:bg-primary/20 hover:text-primary rounded px-0.5 transition-colors cursor-pointer",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {word}{' '}
                  </span>
                ))}
              </p>
              
              {/* 提示文字 - 只在活跃且是句子开头时显示 */}
              {isActive && isNewSentence && (
                <div className="text-[10px] text-muted-foreground/50 mt-1">
                  点击单词查词 · 拖拽选择短语
                </div>
              )}
              
              {/* 翻译区域 - 只在句子结尾显示完整翻译，中间段落显示省略 */}
              {showTranslation && (
                <div className={cn(
                  "min-h-[1rem] transition-all duration-200",
                  endsSentence ? "mt-1" : "mt-0.5",
                  isActive ? "text-primary/80" : "text-muted-foreground/70"
                )}>
                  {isLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>翻译中...</span>
                    </div>
                  ) : isError ? (
                    <span className="text-xs text-destructive/70">翻译失败</span>
                  ) : hasTranslation ? (
                    <p className={cn(
                      "text-sm leading-relaxed animate-in fade-in duration-300",
                      // 非句子结尾的翻译稍微透明
                      !endsSentence && "text-muted-foreground/50 text-xs"
                    )}>
                      {segment.translation}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">
                      {endsSentence ? "等待翻译..." : "..."}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
