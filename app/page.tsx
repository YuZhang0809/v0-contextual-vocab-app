"use client"

import { useState } from "react"
import { AppHeader } from "@/components/app-header"
import { Dashboard } from "@/components/dashboard"
import { CaptureForm } from "@/components/capture-form"
import { ReviewSession } from "@/components/review-session"
import { useDueCards } from "@/hooks/use-cards"

type View = "dashboard" | "capture" | "review"

export default function HomePage() {
  const [currentView, setCurrentView] = useState<View>("dashboard")
  const { dueCards } = useDueCards()

  const handleStartReview = () => {
    if (dueCards.length > 0) {
      setCurrentView("review")
    }
  }

  const handleExitReview = () => {
    setCurrentView("dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {currentView !== "review" && (
        <AppHeader currentView={currentView} onViewChange={setCurrentView} dueCount={dueCards.length} />
      )}

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {currentView === "dashboard" && <Dashboard onStartReview={handleStartReview} />}
        {currentView === "capture" && (
          <div className="max-w-2xl mx-auto">
            <CaptureForm />
          </div>
        )}
        {currentView === "review" && <ReviewSession onExit={handleExitReview} />}
      </main>
    </div>
  )
}
