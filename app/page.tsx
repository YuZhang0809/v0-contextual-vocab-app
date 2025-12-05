"use client"

import { useState } from "react"
import { AppHeader } from "@/components/app-header"
import { Dashboard } from "@/components/dashboard"
import { CaptureForm } from "@/components/capture-form"
import { ReviewSession } from "@/components/review-session"
import { LoginForm } from "@/components/auth/login-form"
import { YouTubeSession } from "@/components/youtube-session"
import { VocabularyList } from "@/components/vocabulary-list"
import { useDueContexts } from "@/hooks/use-cards"
import { useAuth } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

type View = "dashboard" | "capture" | "review" | "youtube" | "vocabulary"

export default function HomePage() {
  const [currentView, setCurrentView] = useState<View>("dashboard")
  const { dueCount } = useDueContexts()
  const { user, loading: authLoading } = useAuth()

  const handleStartReview = () => {
    if (dueCount > 0) {
      setCurrentView("review")
    }
  }

  const handleExitReview = () => {
    setCurrentView("dashboard")
  }

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 未登录，显示登录页
  if (!user) {
    return <LoginForm />
  }

  // 已登录，显示主应用
  return (
    <div className="min-h-screen bg-background">
      {currentView !== "review" && (
        <AppHeader currentView={currentView} onViewChange={setCurrentView} dueCount={dueCount} />
      )}

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {currentView === "dashboard" && <Dashboard onStartReview={handleStartReview} />}
        {currentView === "capture" && (
          <div className="max-w-2xl mx-auto">
            <CaptureForm />
          </div>
        )}
        {currentView === "vocabulary" && <VocabularyList />}
        {currentView === "youtube" && <YouTubeSession />}
        {currentView === "review" && <ReviewSession onExit={handleExitReview} />}
      </main>
    </div>
  )
}
