"use client"

import { Button } from "@/components/ui/button"
import { BookOpen, Plus, LayoutDashboard, LogOut, Youtube, History } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

type View = "dashboard" | "capture" | "review" | "youtube" | "vocabulary" | "history"

interface AppHeaderProps {
  currentView: View
  onViewChange: (view: View) => void
  dueCount: number
}

export function AppHeader({ currentView, onViewChange, dueCount }: AppHeaderProps) {
  const { user, signOut } = useAuth()

  const navItems = [
    { id: "dashboard" as View, label: "首页", icon: LayoutDashboard },
    { id: "vocabulary" as View, label: "词库", icon: BookOpen },
    { id: "capture" as View, label: "添加", icon: Plus },
    { id: "youtube" as View, label: "YouTube", icon: Youtube },
    { id: "history" as View, label: "记录", icon: History },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm hidden sm:inline">ContextVocab</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => onViewChange(item.id)}
                className={`
                  gap-2 h-8 px-3 text-sm font-normal transition-colors
                  ${isActive 
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
                {item.id === "dashboard" && dueCount > 0 && !isActive && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {dueCount}
                  </span>
                )}
              </Button>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="text-xs text-muted-foreground hidden lg:inline max-w-[140px] truncate">
              {user.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="gap-2 h-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-normal">退出</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
