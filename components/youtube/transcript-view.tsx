"use client"

import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onWordClick: (word: string, context: string) => void;
}

export function TranscriptView({ transcript, currentTime, onWordClick }: TranscriptViewProps) {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]); // Simple dependency on currentTime might cause too much scrolling, but let's try.
  // Optimization: Only scroll if the active segment index changes.
  
  // Find active segment index
  const activeIndex = transcript.findIndex(
    (seg, i) => {
        const nextSeg = transcript[i + 1];
        const start = seg.offset / 1000; // Library usually returns ms? No, verify. youtube-transcript returns ms.
        // Wait, let's verify return format of youtube-transcript.
        // It returns 'offset' in number (ms) and 'duration' in number (ms).
        
        // currentTime is in seconds from YouTube Player API.
        const segStart = seg.offset / 1000;
        const segEnd = (seg.offset + seg.duration) / 1000;
        
        return currentTime >= segStart && currentTime < segEnd + 0.5; // Buffer
    }
  );

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
          
          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              className={cn(
                "transition-colors duration-300 rounded px-2 py-1",
                isActive ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50"
              )}
            >
              <p className="text-lg leading-relaxed">
                {(segment.text || '').split(' ').map((word, wIndex) => (
                  <span
                    key={wIndex}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Clean word from punctuation for better lookup
                        const cleanWord = word.replace(/[^\w\s'-]/g, '');
                        onWordClick(cleanWord, segment.text);
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
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

