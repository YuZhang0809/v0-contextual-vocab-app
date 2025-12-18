"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, Eye, Lightbulb, Play, X } from "lucide-react"
import type { ReviewGrade, ReviewMode, ReviewUnit } from "@/lib/types"
import { isVideoSource } from "@/lib/types"
import { VideoPlayer } from "@/components/youtube/video-player"
import { cn } from "@/lib/utils"

interface ReviewCardProps {
  unit: ReviewUnit
  mode: ReviewMode
  onGrade: (grade: ReviewGrade) => void
}

export function ReviewCard({ unit, mode, onGrade }: ReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)

  const { card, contextIndex } = unit

  const currentContext = useMemo(() => {
    if (card.contexts && card.contexts.length > contextIndex) {
      return card.contexts[contextIndex]
    }
    return null
  }, [card.contexts, contextIndex])

  const currentSentence = currentContext?.sentence || ""
  const currentMeaning = currentContext?.meaning_cn || ""
  const currentTranslation = currentContext?.sentence_translation || ""

  useEffect(() => {
    setIsFlipped(false)
    setShowVideoPlayer(false)
    setPlayerReady(false)
  }, [card.id, contextIndex])

  // 获取 YouTube 视频信息
  const videoSource = isVideoSource(currentContext?.source) ? currentContext?.source : null

  // 格式化时间戳
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  // 当播放器准备好时，跳转到指定时间并播放
  const handlePlayerReady = useCallback((event: any) => {
    setPlayerReady(true)
    if (videoSource) {
      event.target.seekTo(videoSource.timestamp, true)
      event.target.playVideo()
    }
  }, [videoSource])

  const speakWord = useCallback(() => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(card.word)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }, [card.word])

  const speakSentence = useCallback(() => {
    if ("speechSynthesis" in window && currentSentence) {
      const utterance = new SpeechSynthesisUtterance(currentSentence)
      utterance.lang = "en-US"
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
    }
  }, [currentSentence])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFlipped) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          setIsFlipped(true)
        }
      } else {
        switch (e.key) {
          case "1":
            onGrade("again")
            break
          case "2":
            onGrade("hard")
            break
          case "3":
            onGrade("good")
            break
          case "4":
            onGrade("easy")
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFlipped, onGrade])

  const getClozeText = useCallback(() => {
    if (!currentSentence) return ""
    const regex = new RegExp(`\\b${card.word}\\b`, "gi")
    return currentSentence.replace(regex, "______")
  }, [currentSentence, card.word])

  if (!currentContext) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          该卡片没有可用的语境数据
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="animate-fade-in-scale">
      <CardContent className="p-6 sm:p-8">
        <div className="space-y-6">
          {/* Word display - show after flip, or always in flashcard mode */}
          {(mode === "flashcard" || isFlipped) && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-mono font-semibold tracking-tight">{card.word}</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={speakWord} 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Sentence */}
          <div className="flex items-start gap-3">
            <p
              className={cn(
                "text-lg leading-relaxed flex-1",
                mode === "cloze" && !isFlipped ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {mode === "cloze" && !isFlipped ? getClozeText() : currentSentence}
            </p>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={speakSentence} 
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Hint: Show Chinese meaning BEFORE flip in cloze mode */}
          {mode === "cloze" && !isFlipped && (
            <div className="flex items-center gap-2 text-primary bg-primary/5 px-4 py-3 rounded-md border border-primary/10">
              <Lightbulb className="h-4 w-4 shrink-0" />
              <span className="text-base font-medium">{currentMeaning}</span>
            </div>
          )}

          {/* Flip button or Answer section */}
          {!isFlipped ? (
            <div className="flex justify-center pt-2">
              <Button 
                onClick={() => setIsFlipped(true)} 
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {mode === "cloze" ? "想到了，看答案" : "显示答案"}
                <kbd className="ml-1 text-xs opacity-70 bg-primary-foreground/20 px-1.5 py-0.5 rounded">Space</kbd>
              </Button>
            </div>
          ) : (
            <div className="space-y-5 pt-5 border-t border-border/50">
              {/* Meaning - only show in flashcard mode since cloze already shows it */}
              {mode === "flashcard" && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">释义</Badge>
                  <span className="text-base">{currentMeaning}</span>
                </div>
              )}
              
              {/* Sentence translation */}
              {currentTranslation && (
                <div className="bg-secondary/50 p-4 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">句子翻译</p>
                  <p className="text-sm leading-relaxed">{currentTranslation}</p>
                </div>
              )}
              
              {/* Mnemonic */}
              {card.mnemonics && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">助记</Badge>
                  <span className="text-sm text-muted-foreground">{card.mnemonics}</span>
                </div>
              )}

              {/* YouTube Context Player */}
              {videoSource && (
                <div className="space-y-3">
                  {!showVideoPlayer ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowVideoPlayer(true)}
                      className="w-full gap-2 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Play className="h-4 w-4" />
                      播放语境 ({formatTimestamp(videoSource.timestamp)})
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          从 {formatTimestamp(videoSource.timestamp)} 开始播放
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setShowVideoPlayer(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-border/50">
                        <VideoPlayer
                          videoId={videoSource.video_id}
                          onReady={handlePlayerReady}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grading */}
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  onClick={() => onGrade("again")}
                  className="flex-col h-auto py-3 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <span className="text-sm">重来</span>
                  <kbd className="text-[10px] text-muted-foreground mt-1">1</kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onGrade("hard")}
                  className="flex-col h-auto py-3 border-border/50 hover:bg-warning/10 hover:text-warning hover:border-warning/30"
                >
                  <span className="text-sm">困难</span>
                  <kbd className="text-[10px] text-muted-foreground mt-1">2</kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onGrade("good")}
                  className="flex-col h-auto py-3 border-border/50 hover:bg-success/10 hover:text-success hover:border-success/30"
                >
                  <span className="text-sm">一般</span>
                  <kbd className="text-[10px] text-muted-foreground mt-1">3</kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onGrade("easy")}
                  className="flex-col h-auto py-3 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <span className="text-sm">简单</span>
                  <kbd className="text-[10px] text-muted-foreground mt-1">4</kbd>
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
