"use client"

import React, { useEffect, useRef } from 'react';
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

export function TranscriptView({ transcript, currentTime, onWordClick, onSeek, showTranslation = false }: TranscriptViewProps) {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

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
  const getContext = (currentIndex: number) => {
    const MIN_CONTEXT_LENGTH = 80;  // 最小字符数
    const MAX_CONTEXT_LENGTH = 350; // 最大字符数
    const MAX_BLOCKS_EACH_SIDE = 5; // 每侧最多扩展的块数
    
    // 句子结束标点（包括中英文）
    const sentenceEnders = /[.!?。！？][\s"'）)]*$/;
    
    let startIdx = currentIndex;
    let endIdx = currentIndex;
    
    // 向前扩展，找到句子开始（前一块以句子结束符结尾）
    while (startIdx > 0 && startIdx > currentIndex - MAX_BLOCKS_EACH_SIDE) {
      const prevText = transcript[startIdx - 1]?.text?.trim() || "";
      if (sentenceEnders.test(prevText)) {
        break; // 前一块是句子结尾，当前位置是新句子开始
      }
      startIdx--;
    }
    
    // 向后扩展，找到句子结束
    while (endIdx < transcript.length - 1 && endIdx < currentIndex + MAX_BLOCKS_EACH_SIDE) {
      const currentText = transcript[endIdx]?.text?.trim() || "";
      if (sentenceEnders.test(currentText)) {
        break; // 当前块是句子结尾，停止扩展
      }
      endIdx++;
    }
    
    // 拼接语境
    const buildContext = (start: number, end: number) => {
      let result = "";
      for (let i = start; i <= end; i++) {
        const text = transcript[i]?.text || "";
        result += text + " ";
      }
      return result.trim();
    };
    
    let context = buildContext(startIdx, endIdx);
    
    // 如果语境太短，继续向两侧扩展直到满足最小长度
    while (context.length < MIN_CONTEXT_LENGTH) {
      const canExpandBack = startIdx > 0;
      const canExpandForward = endIdx < transcript.length - 1;
      
      if (!canExpandBack && !canExpandForward) break;
      
      // 优先向后扩展（更符合阅读习惯）
      if (canExpandForward && (!canExpandBack || endIdx - currentIndex <= currentIndex - startIdx)) {
        endIdx++;
      } else if (canExpandBack) {
        startIdx--;
      }
      
      context = buildContext(startIdx, endIdx);
      
      // 防止超出最大长度
      if (context.length > MAX_CONTEXT_LENGTH) {
        // 截断到最后一个完整句子
        const lastSentenceEnd = context.search(/[.!?。！？][^.!?。！？]*$/);
        if (lastSentenceEnd > MIN_CONTEXT_LENGTH) {
          context = context.substring(0, lastSentenceEnd + 1);
        }
        break;
      }
    }
    
    return context;
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
      <div className="space-y-3">
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
          
          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              className={cn(
                "transition-all duration-300 rounded-lg px-3 py-2 group",
                isActive 
                  ? "bg-primary/10 border-l-2 border-primary shadow-sm" 
                  : "hover:bg-secondary/50"
              )}
            >
              {/* 时间戳和跳转按钮 */}
              <div className="flex items-center gap-2 mb-1">
                {onSeek && (
                  <button
                    onClick={() => onSeek(timeInSeconds)}
                    className={cn(
                      "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-all",
                      isActive 
                        ? "bg-primary/20 text-primary" 
                        : "text-muted-foreground/60 hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100"
                    )}
                    title={`跳转到 ${timeLabel}`}
                  >
                    <Play className="h-3 w-3" />
                    <span>{timeLabel}</span>
                  </button>
                )}
              </div>
              
              {/* 英文原文 */}
              <p className="text-base leading-relaxed">
                {(segment.text || '').split(' ').map((word, wIndex) => (
                  <span
                    key={wIndex}
                    onClick={(e) => {
                      e.stopPropagation();
                      const cleanWord = word.replace(/[^\w\s'-]/g, '');
                      onWordClick(cleanWord, getContext(index));
                    }}
                    className={cn(
                      "cursor-pointer hover:bg-primary/20 hover:text-primary rounded px-0.5 transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {word}{' '}
                  </span>
                ))}
              </p>
              
              {/* 翻译区域 */}
              {showTranslation && (
                <div className={cn(
                  "mt-1.5 min-h-[1.25rem] transition-all duration-200",
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
                    <p className="text-sm leading-relaxed animate-in fade-in duration-300">
                      {segment.translation}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">等待翻译...</span>
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
