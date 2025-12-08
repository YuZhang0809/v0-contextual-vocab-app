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
      <div className="space-y-3" ref={containerRef}>
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
              
              {/* 英文原文 - 支持选择短语或点击单词 */}
              <p 
                className="text-base leading-relaxed select-text cursor-text"
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
              
              {/* 提示文字 */}
              {isActive && (
                <div className="text-[10px] text-muted-foreground/50 mt-1">
                  点击单词查词 · 拖拽选择短语
                </div>
              )}
              
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
