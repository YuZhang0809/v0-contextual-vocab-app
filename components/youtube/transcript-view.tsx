"use client"

import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play } from "lucide-react";

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  translation?: string;  // 中文翻译
}

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onWordClick: (word: string, context: string) => void;
  onSeek?: (timeInSeconds: number) => void;  // 跳转到指定时间点
  showTranslation?: boolean;  // 是否显示翻译
}

export function TranscriptView({ transcript, currentTime, onWordClick, onSeek, showTranslation = false }: TranscriptViewProps) {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  // Find active segment index
  const activeIndex = transcript.findIndex(
    (seg, i) => {
        const nextSeg = transcript[i + 1];
        const segStart = seg.offset / 1000;
        const segEnd = (seg.offset + seg.duration) / 1000;
        
        // Calculate the effective end time.
        // It includes a buffer (0.5s) to keep highlight during short pauses, 
        // but is capped by the start of the next segment to prevent overlap delay.
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
  }, [activeIndex]); // Only scroll when the active line changes

  const getContext = (currentIndex: number) => {
    const prev = transcript[currentIndex - 1]?.text || "";
    const current = transcript[currentIndex].text || "";
    const next = transcript[currentIndex + 1]?.text || "";
    
    return `${prev} ${current} ${next}`.trim();
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border border-border/50 bg-card/50 p-4">
      <div className="space-y-4">
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
          
          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              className={cn(
                "transition-colors duration-300 rounded px-2 py-1 group",
                isActive ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50"
              )}
            >
              {/* 时间戳和跳转按钮 */}
              <div className="flex items-center gap-2 mb-1">
                {onSeek && (
                  <button
                    onClick={() => onSeek(timeInSeconds)}
                    className={cn(
                      "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors",
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
              
              <p className="text-lg leading-relaxed">
                {(segment.text || '').split(' ').map((word, wIndex) => (
                  <span
                    key={wIndex}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Clean word from punctuation for better lookup
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
              {showTranslation && segment.translation && (
                <p className={cn(
                  "text-sm mt-1 leading-relaxed",
                  isActive ? "text-primary/80" : "text-muted-foreground/70"
                )}>
                  {segment.translation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

