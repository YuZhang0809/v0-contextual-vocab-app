"use client"

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from "@/lib/utils";
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

// 单个字幕段落组件 - 使用 React.memo 避免不必要的重渲染
const TranscriptSegmentItem = React.memo(function TranscriptSegmentItem({
  segment,
  index,
  isActive,
  isNewSentence,
  endsSentence,
  showTranslation,
  onSeek,
  onTextInteraction,
}: {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  isNewSentence: boolean;
  endsSentence: boolean;
  showTranslation: boolean;
  onSeek?: (timeInSeconds: number) => void;
  onTextInteraction: (e: React.MouseEvent, segmentIndex: number) => void;
}) {
  const timeInSeconds = Math.floor(segment.offset / 1000);
  const mins = Math.floor(timeInSeconds / 60);
  const secs = timeInSeconds % 60;
  const timeLabel = `${mins}:${String(secs).padStart(2, '0')}`;
  
  const isLoading = segment.translationStatus === 'loading';
  const hasTranslation = !!segment.translation;
  const isError = segment.translationStatus === 'error';
  
  const continuesSentence = !isNewSentence;

  return (
    <div
      className={cn(
        "group",
        continuesSentence ? "pt-0.5" : "pt-3",
        !endsSentence ? "pb-0.5" : "pb-2",
        "px-3",
        isActive 
          ? "bg-primary/10 border-l-2 border-primary shadow-sm rounded-lg transition-colors duration-200" 
          : "hover:bg-secondary/30 rounded-lg"
      )}
    >
      {/* 时间戳 */}
      <div className="flex items-center gap-2 mb-0.5">
        {onSeek && (
          <button
            onClick={() => onSeek(timeInSeconds)}
            className={cn(
              "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
              isActive 
                ? "bg-primary/20 text-primary" 
                : "text-muted-foreground/60 hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100",
              isNewSentence && !isActive && "opacity-60 group-hover:opacity-100"
            )}
            title={`跳转到 ${timeLabel}`}
          >
            <Play className="h-3 w-3" />
            <span>{timeLabel}</span>
          </button>
        )}
      </div>
      
      {/* 英文原文 */}
      <p 
        className={cn(
          "text-base leading-relaxed select-text cursor-text",
          continuesSentence && "pl-0"
        )}
        onMouseUp={(e) => onTextInteraction(e, index)}
      >
        {(segment.text || '').split(' ').map((word, wIndex) => (
          <span
            key={wIndex}
            data-word={word}
            className={cn(
              "hover:bg-primary/20 hover:text-primary rounded px-0.5 cursor-pointer",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {word}{' '}
          </span>
        ))}
      </p>
      
      {/* 提示文字 */}
      {isActive && isNewSentence && (
        <div className="text-[10px] text-muted-foreground/50 mt-1">
          点击单词查词 · 拖拽选择短语
        </div>
      )}
      
      {/* 翻译区域 */}
      {showTranslation && (
        <div className={cn(
          "min-h-[1rem]",
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
              "text-sm leading-relaxed",
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
});

export function TranscriptView({ transcript, currentTime, onWordClick, onSeek, showTranslation = false }: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 预计算句子边界（只在 transcript 变化时计算一次）
  const sentenceBoundaries = useMemo(() => {
    return transcript.map((seg, index) => {
      const isNewSentence = index === 0 || endsWithSentence(transcript[index - 1]?.text || '');
      const endsSentence = endsWithSentence(seg.text || '');
      return { isNewSentence, endsSentence };
    });
  }, [transcript]);

  // 计算当前活跃段落索引
  const activeIndex = useMemo(() => {
    return transcript.findIndex((seg, i) => {
      const nextSeg = transcript[i + 1];
      const segStart = seg.offset / 1000;
      const segEnd = (seg.offset + seg.duration) / 1000;
      const nextStart = nextSeg ? nextSeg.offset / 1000 : Infinity;
      const effectiveEnd = Math.min(segEnd + 0.5, nextStart);
      return currentTime >= segStart && currentTime < effectiveEnd;
    });
  }, [transcript, currentTime]);

  // 虚拟列表配置
  const virtualizer = useVirtualizer({
    count: transcript.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback((index: number) => {
      // 根据是否显示翻译和句子边界估计高度
      const segment = transcript[index];
      const boundary = sentenceBoundaries[index];
      
      // 基础高度：时间戳行 + 文本行
      let height = 60;
      
      // 句首额外顶部间距
      if (boundary?.isNewSentence) height += 12;
      
      // 句尾额外底部间距
      if (boundary?.endsSentence) height += 8;
      
      // 翻译行高度
      if (showTranslation) height += 24;
      
      // 长文本需要更多高度（估计每40字符一行）
      const textLength = segment?.text?.length || 0;
      if (textLength > 40) height += Math.ceil((textLength - 40) / 40) * 20;
      
      return height;
    }, [transcript, sentenceBoundaries, showTranslation]),
    overscan: 10, // 预渲染可见区域外10行
  });

  // 记录上一次的活跃索引，用于判断跳转距离
  const prevActiveIndexRef = useRef<number>(-1);

  // 当活跃段落变化时，滚动到视图中
  useEffect(() => {
    if (activeIndex >= 0) {
      const prevIndex = prevActiveIndexRef.current;
      const distance = Math.abs(activeIndex - prevIndex);
      
      // 如果跳转距离大于 20 个段落，使用即时滚动；否则使用平滑滚动
      const behavior = distance > 20 || prevIndex === -1 ? 'auto' : 'smooth';
      
      virtualizer.scrollToIndex(activeIndex, { 
        align: 'center',
        behavior
      });
      
      prevActiveIndexRef.current = activeIndex;
    }
  }, [activeIndex, virtualizer]);

  // 智能语境截取
  const getContext = useCallback((currentIndex: number) => {
    const MIN_CONTEXT_LENGTH = 80;
    const MAX_CONTEXT_LENGTH = 350;
    const MAX_BLOCKS_EACH_SIDE = 5;
    
    const sentenceEnders = /[.!?。！？][\s"'）)]*$/;
    
    let startIdx = currentIndex;
    let endIdx = currentIndex;
    
    while (startIdx > 0 && startIdx > currentIndex - MAX_BLOCKS_EACH_SIDE) {
      const prevText = transcript[startIdx - 1]?.text?.trim() || "";
      if (sentenceEnders.test(prevText)) break;
      startIdx--;
    }
    
    while (endIdx < transcript.length - 1 && endIdx < currentIndex + MAX_BLOCKS_EACH_SIDE) {
      const currentText = transcript[endIdx]?.text?.trim() || "";
      if (sentenceEnders.test(currentText)) break;
      endIdx++;
    }
    
    const buildContext = (start: number, end: number) => {
      let result = "";
      for (let i = start; i <= end; i++) {
        result += (transcript[i]?.text || "") + " ";
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
    
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 0) {
      const cleanPhrase = selectedText.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanPhrase.length > 0) {
        onWordClick(cleanPhrase, getContext(segmentIndex));
        selection?.removeAllRanges();
      }
    } else {
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
    <div 
      ref={containerRef}
      className="h-[400px] w-full rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-auto"
    >
      {transcript.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          暂无字幕或正在加载...
        </div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index;
            const segment = transcript[index];
            const boundary = sentenceBoundaries[index];
            
            return (
              <div
                key={virtualRow.key}
                data-index={index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TranscriptSegmentItem
                  segment={segment}
                  index={index}
                  isActive={index === activeIndex}
                  isNewSentence={boundary?.isNewSentence ?? false}
                  endsSentence={boundary?.endsSentence ?? false}
                  showTranslation={showTranslation}
                  onSeek={onSeek}
                  onTextInteraction={handleTextInteraction}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
