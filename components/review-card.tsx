"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, Eye } from "lucide-react"
import type { ReviewGrade, ReviewMode, ReviewUnit } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReviewCardProps {
  unit: ReviewUnit
  mode: ReviewMode
  onGrade: (grade: ReviewGrade) => void
}

export function ReviewCard({ unit, mode, onGrade }: ReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  const { card, contextIndex } = unit

  // 当前语境
  const currentContext = useMemo(() => {
    if (card.contexts && card.contexts.length > contextIndex) {
      return card.contexts[contextIndex]
    }
    return null
  }, [card.contexts, contextIndex])

  // 获取当前例句、释义和翻译
  const currentSentence = currentContext?.sentence || ""
  const currentMeaning = currentContext?.meaning_cn || ""
  const currentTranslation = currentContext?.sentence_translation || ""

  // Reset flip state when unit changes
  useEffect(() => {
    setIsFlipped(false)
  }, [card.id, contextIndex])

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

  // Keyboard shortcuts
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

  // Create cloze text
  const getClozeText = useCallback(() => {
    if (!currentSentence) return ""
    const regex = new RegExp(`\\b${card.word}\\b`, "gi")
    return currentSentence.replace(regex, "______")
  }, [currentSentence, card.word])

  // 如果没有语境，显示错误状态
  if (!currentContext) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="border-border/30 overflow-hidden">
          <CardContent className="p-6 sm:p-8 text-center text-muted-foreground">
            该卡片没有可用的语境数据
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-border/30 overflow-hidden bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6 sm:p-8">
          {/* Front of card */}
          <div className="space-y-6">
            {/* Word display (only in flashcard mode or when flipped) */}
            {(mode === "flashcard" || isFlipped) && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl sm:text-4xl font-bold font-mono bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{card.word}</h2>
                  <Button variant="ghost" size="icon" onClick={speakWord} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                    <Volume2 className="h-4 w-4" />
                    <span className="sr-only">朗读单词</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Sentence display */}
            <div className="relative">
              <div className="flex items-start gap-2">
                <p
                  className={cn(
                    "text-lg sm:text-xl leading-relaxed flex-1",
                    mode === "cloze" && !isFlipped ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {mode === "cloze" && !isFlipped ? getClozeText() : currentSentence}
                </p>
                <Button variant="ghost" size="icon" onClick={speakSentence} className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors">
                  <Volume2 className="h-4 w-4" />
                  <span className="sr-only">朗读句子</span>
                </Button>
              </div>
            </div>

            {/* Flip button or Answer section */}
            {!isFlipped ? (
              <div className="flex justify-center pt-4">
                <Button onClick={() => setIsFlipped(true)} size="lg" className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl">
                  <Eye className="h-4 w-4" />
                  显示答案
                  <kbd className="ml-2 text-xs bg-primary-foreground/20 px-1.5 py-0.5 rounded">Space</kbd>
                </Button>
              </div>
            ) : (
              <div className="space-y-6 pt-4 border-t border-border/30">
                {/* Meaning */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">释义</Badge>
                    <span className="text-lg">{currentMeaning}</span>
                  </div>
                  
                  {/* Sentence Translation */}
                  {currentTranslation && (
                    <div className="bg-secondary/50 p-4 rounded-xl border border-border/30">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        句子翻译
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {currentTranslation}
                      </p>
                    </div>
                  )}
                  
                  {/* Mnemonic */}
                  {card.mnemonics && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-accent/30 text-accent">助记</Badge>
                      <span className="text-muted-foreground">{card.mnemonics}</span>
                    </div>
                  )}
                </div>

                {/* Grading buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onGrade("again")}
                    className="flex-col h-auto py-3 border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
                  >
                    <span className="text-sm font-medium">重来</span>
                    <kbd className="text-xs text-muted-foreground mt-1">1</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("hard")}
                    className="flex-col h-auto py-3 border-accent/30 hover:bg-accent/10 hover:text-accent hover:border-accent/50 transition-all"
                  >
                    <span className="text-sm font-medium">困难</span>
                    <kbd className="text-xs text-muted-foreground mt-1">2</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("good")}
                    className="flex-col h-auto py-3 border-success/30 hover:bg-success/10 hover:text-success hover:border-success/50 transition-all"
                  >
                    <span className="text-sm font-medium">一般</span>
                    <kbd className="text-xs text-muted-foreground mt-1">3</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("easy")}
                    className="flex-col h-auto py-3 border-primary/30 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                  >
                    <span className="text-sm font-medium">简单</span>
                    <kbd className="text-xs text-muted-foreground mt-1">4</kbd>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
