"use client"

import { useState, useEffect } from "react"
import { ReviewCard } from "./review-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { BookOpen, Layers, CheckCircle2, ArrowLeft } from "lucide-react"
import { useCards, useDueCards } from "@/hooks/use-cards"
import type { ReviewGrade, ReviewMode, WordCard } from "@/lib/types"

interface ReviewSessionProps {
  onExit: () => void
}

export function ReviewSession({ onExit }: ReviewSessionProps) {
  const { reviewCard, refresh: refreshAll } = useCards()
  const { dueCards, refresh: refreshDue } = useDueCards()
  const [mode, setMode] = useState<ReviewMode>("cloze")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionCards, setSessionCards] = useState<WordCard[]>([])
  const [reviewedCount, setReviewedCount] = useState(0)

  // Initialize session cards
  useEffect(() => {
    if (dueCards.length > 0 && sessionCards.length === 0) {
      setSessionCards([...dueCards])
    }
  }, [dueCards, sessionCards.length])

  const currentCard = sessionCards[currentIndex]
  const totalCards = sessionCards.length
  const progress = totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0

  const handleGrade = async (grade: ReviewGrade) => {
    if (!currentCard) return

    await reviewCard(currentCard, grade)
    setReviewedCount((prev) => prev + 1)

    if (grade === "again") {
      // Move card to end of queue
      setSessionCards((prev) => {
        const newCards = [...prev]
        const [removed] = newCards.splice(currentIndex, 1)
        newCards.push(removed)
        return newCards
      })
    } else {
      // Move to next card
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        // Session complete
        setSessionCards([])
      }
    }

    // Refresh data
    refreshAll()
    refreshDue()
  }

  // Session complete state
  if (sessionCards.length === 0 || currentIndex >= sessionCards.length) {
    return (
      <Card className="max-w-md mx-auto border-border/50">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">复习完成！</h2>
            <p className="text-muted-foreground">你已完成 {reviewedCount} 张卡片的复习</p>
          </div>
          <Button onClick={onExit} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          退出复习
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="review-mode"
              checked={mode === "flashcard"}
              onCheckedChange={(checked) => setMode(checked ? "flashcard" : "cloze")}
            />
            <Label htmlFor="review-mode" className="text-sm cursor-pointer">
              {mode === "cloze" ? (
                <span className="flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  挖空模式
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  闪卡模式
                </span>
              )}
            </Label>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            进度: {currentIndex + 1} / {totalCards}
          </span>
          <Badge variant="secondary">已复习: {reviewedCount}</Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Review Card */}
      <ReviewCard card={currentCard} mode={mode} onGrade={handleGrade} />
    </div>
  )
}
