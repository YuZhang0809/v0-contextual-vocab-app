"use client"

import { Button } from "@/components/ui/button"
import { BookOpen, Plus, LayoutDashboard } from "lucide-react"

type View = "dashboard" | "capture" | "review"

interface AppHeaderProps {
  currentView: View
  onViewChange: (view: View) => void
  dueCount: number
}

export function AppHeader({ currentView, onViewChange, dueCount }: AppHeaderProps) {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">ContextVocab</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">语境化生词记忆</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Button
            variant={currentView === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("dashboard")}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">仪表盘</span>
            {dueCount > 0 && currentView !== "dashboard" && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">{dueCount}</span>
            )}
          </Button>
          <Button
            variant={currentView === "capture" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("capture")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">添加生词</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}
