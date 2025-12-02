"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, Eye } from "lucide-react"
import type { WordCard, ReviewGrade, ReviewMode } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReviewCardProps {
  card: WordCard
  mode: ReviewMode
  onGrade: (grade: ReviewGrade) => void
}

export function ReviewCard({ card, mode, onGrade }: ReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false)
  }, [card.id])

  const speakWord = useCallback(() => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(card.word)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }, [card.word])

  const speakSentence = useCallback(() => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(card.sentence)
      utterance.lang = "en-US"
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
    }
  }, [card.sentence])

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
  const getClozeText = () => {
    const regex = new RegExp(`\\b${card.word}\\b`, "gi")
    return card.sentence.replace(regex, "______")
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          {/* Front of card */}
          <div className="space-y-6">
            {/* Word display (only in flashcard mode or when flipped) */}
            {(mode === "flashcard" || isFlipped) && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl sm:text-4xl font-bold font-mono text-foreground">{card.word}</h2>
                  <Button variant="ghost" size="icon" onClick={speakWord} className="h-8 w-8">
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
                  {mode === "cloze" && !isFlipped ? getClozeText() : card.sentence}
                </p>
                <Button variant="ghost" size="icon" onClick={speakSentence} className="h-8 w-8 shrink-0">
                  <Volume2 className="h-4 w-4" />
                  <span className="sr-only">朗读句子</span>
                </Button>
              </div>
            </div>

            {/* Flip button or Answer section */}
            {!isFlipped ? (
              <div className="flex justify-center pt-4">
                <Button onClick={() => setIsFlipped(true)} size="lg" className="gap-2">
                  <Eye className="h-4 w-4" />
                  显示答案
                  <kbd className="ml-2 text-xs bg-primary-foreground/20 px-1.5 py-0.5 rounded">Space</kbd>
                </Button>
              </div>
            ) : (
              <div className="space-y-6 pt-4 border-t border-border/50">
                {/* Meaning and Mnemonic */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">释义</Badge>
                    <span className="text-lg">{card.meaning_cn}</span>
                  </div>
                  {card.mnemonics && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">助记</Badge>
                      <span className="text-muted-foreground">{card.mnemonics}</span>
                    </div>
                  )}
                </div>

                {/* Grading buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onGrade("again")}
                    className="flex-col h-auto py-3 border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <span className="text-sm font-medium">重来</span>
                    <kbd className="text-xs text-muted-foreground mt-1">1</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("hard")}
                    className="flex-col h-auto py-3 border-warning/50 hover:bg-warning/10 hover:text-warning"
                  >
                    <span className="text-sm font-medium">困难</span>
                    <kbd className="text-xs text-muted-foreground mt-1">2</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("good")}
                    className="flex-col h-auto py-3 border-success/50 hover:bg-success/10 hover:text-success"
                  >
                    <span className="text-sm font-medium">一般</span>
                    <kbd className="text-xs text-muted-foreground mt-1">3</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGrade("easy")}
                    className="flex-col h-auto py-3 border-primary/50 hover:bg-primary/10 hover:text-primary"
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
