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
import { useCards, useDueContexts } from "@/hooks/use-cards"
import type { ReviewGrade, ReviewMode, ReviewUnit } from "@/lib/types"

interface ReviewSessionProps {
  onExit: () => void
}

export function ReviewSession({ onExit }: ReviewSessionProps) {
  const { reviewContext, refresh: refreshAll } = useCards()
  const { dueContexts, refresh: refreshDue } = useDueContexts()
  const [mode, setMode] = useState<ReviewMode>("cloze")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionUnits, setSessionUnits] = useState<ReviewUnit[]>([])
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    if (dueContexts.length > 0 && sessionUnits.length === 0) {
      setSessionUnits([...dueContexts])
    }
  }, [dueContexts, sessionUnits.length])

  const currentUnit = sessionUnits[currentIndex]
  const totalUnits = sessionUnits.length
  const progress = totalUnits > 0 ? (reviewedCount / totalUnits) * 100 : 0

  const handleGrade = async (grade: ReviewGrade) => {
    if (!currentUnit) return

    await reviewContext(currentUnit.card.id, currentUnit.contextIndex, grade)
    setReviewedCount((prev) => prev + 1)

    if (grade === "again") {
      setSessionUnits((prev) => {
        const newUnits = [...prev]
        const [removed] = newUnits.splice(currentIndex, 1)
        newUnits.push(removed)
        return newUnits
      })
    } else {
      if (currentIndex < sessionUnits.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        setSessionUnits([])
      }
    }

    refreshAll()
    refreshDue()
  }

  // Session complete
  if (sessionUnits.length === 0 || currentIndex >= sessionUnits.length) {
    return (
      <div className="max-w-md mx-auto animate-fade-in">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success/10">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-medium">复习完成</h2>
              <p className="text-muted-foreground">
                你已完成 <span className="text-foreground font-medium">{reviewedCount}</span> 个语境的复习
              </p>
            </div>
            <Button onClick={onExit} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={onExit} 
          className="gap-2 text-muted-foreground hover:text-foreground"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4" />
          退出
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md">
            <Switch
              id="review-mode"
              checked={mode === "flashcard"}
              onCheckedChange={(checked) => setMode(checked ? "flashcard" : "cloze")}
              className="scale-90"
            />
            <Label htmlFor="review-mode" className="text-xs cursor-pointer flex items-center gap-1.5">
              {mode === "cloze" ? (
                <>
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  挖空
                </>
              ) : (
                <>
                  <BookOpen className="h-3.5 w-3.5 text-accent" />
                  闪卡
                </>
              )}
            </Label>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{currentIndex + 1}</span> / {totalUnits}
          </span>
          <Badge variant="secondary" className="font-normal">已复习 {reviewedCount}</Badge>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Review Card */}
      <ReviewCard unit={currentUnit} mode={mode} onGrade={handleGrade} />
    </div>
  )
}
