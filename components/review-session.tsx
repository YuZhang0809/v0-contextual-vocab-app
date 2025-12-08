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

  // Initialize session with due contexts
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

    // 复习当前语境
    await reviewContext(currentUnit.card.id, currentUnit.contextIndex, grade)
    setReviewedCount((prev) => prev + 1)

    if (grade === "again") {
      // Move unit to end of queue
      setSessionUnits((prev) => {
        const newUnits = [...prev]
        const [removed] = newUnits.splice(currentIndex, 1)
        newUnits.push(removed)
        return newUnits
      })
    } else {
      // Move to next unit
      if (currentIndex < sessionUnits.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        // Session complete
        setSessionUnits([])
      }
    }

    // Refresh data
    refreshAll()
    refreshDue()
  }

  // Session complete state
  if (sessionUnits.length === 0 || currentIndex >= sessionUnits.length) {
    return (
      <Card className="max-w-md mx-auto border-success/30 bg-gradient-to-br from-success/10 to-transparent">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 flex items-center justify-center shadow-lg shadow-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">复习完成！</h2>
            <p className="text-muted-foreground">你已完成 <span className="text-success font-medium">{reviewedCount}</span> 个语境的复习</p>
          </div>
          <Button onClick={onExit} className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
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
        <Button variant="ghost" onClick={onExit} className="gap-2 hover:bg-secondary/50">
          <ArrowLeft className="h-4 w-4" />
          退出复习
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/30">
            <Switch
              id="review-mode"
              checked={mode === "flashcard"}
              onCheckedChange={(checked) => setMode(checked ? "flashcard" : "cloze")}
            />
            <Label htmlFor="review-mode" className="text-sm cursor-pointer">
              {mode === "cloze" ? (
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  挖空模式
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-accent" />
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
            进度: <span className="text-foreground font-medium">{currentIndex + 1}</span> / {totalUnits}
          </span>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">已复习: {reviewedCount}</Badge>
        </div>
        <Progress value={progress} className="h-2 bg-secondary" />
      </div>

      {/* Review Card - 传递 ReviewUnit */}
      <ReviewCard unit={currentUnit} mode={mode} onGrade={handleGrade} />
    </div>
  )
}
