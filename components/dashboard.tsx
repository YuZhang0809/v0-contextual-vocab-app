"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  Clock, 
  BookOpen, 
  GraduationCap, 
  Trash2, 
  Search, 
  Volume2, 
  Layers, 
  Tag, 
  X,
  Sparkles,
  ArrowRight
} from "lucide-react"
import { useCards, useDueContexts } from "@/hooks/use-cards"
import { useTags } from "@/hooks/use-tags"
import { getContextStats } from "@/lib/sm2"
import type { WordCard } from "@/lib/types"
import { TagDisplay } from "@/components/ui/tag-selector"

interface DashboardProps {
  onStartReview: () => void
}

export function Dashboard({ onStartReview }: DashboardProps) {
  const { cards, removeCard } = useCards()
  const { dueCount } = useDueContexts()
  const { allTags } = useTags()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null)

  const stats = getContextStats(cards)

  const getFirstContext = (card: WordCard) => {
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts[0]
    }
    return null
  }

  const getEarliestReviewTime = (card: WordCard): number => {
    if (!card.contexts || card.contexts.length === 0) return Date.now()
    return Math.min(...card.contexts.map(ctx => ctx.next_review_at))
  }

  const getCardStatus = (card: WordCard): { label: string; variant: string } => {
    if (!card.contexts || card.contexts.length === 0) {
      return { label: "无语境", variant: "secondary" }
    }
    
    const statuses = card.contexts.map(ctx => ctx.review_status)
    
    if (statuses.includes("new")) {
      return { label: "新", variant: "secondary" }
    }
    if (statuses.includes("learning")) {
      return { label: "学习中", variant: "warning" }
    }
    if (statuses.every(s => s === "graduated")) {
      return { label: "已掌握", variant: "success" }
    }
    return { label: "复习中", variant: "primary" }
  }

  const usedTags = new Map<string, number>()
  cards.forEach(card => {
    card.contexts?.forEach(ctx => {
      ctx.tags?.forEach(tag => {
        usedTags.set(tag, (usedTags.get(tag) || 0) + 1)
      })
    })
  })

  const filteredCards = cards.filter((card) => {
    if (selectedFilterTag) {
      const hasTag = card.contexts?.some(ctx => ctx.tags?.includes(selectedFilterTag))
      if (!hasTag) return false
    }
    
    const query = searchQuery.toLowerCase()
    if (!query) return true
    
    if (card.word.toLowerCase().includes(query)) return true
    
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts.some(
        (ctx) =>
          ctx.sentence.toLowerCase().includes(query) ||
          ctx.meaning_cn.includes(searchQuery)
      )
    }
    return false
  })

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  const getStatusBadge = (status: { label: string; variant: string }) => {
    const baseClasses = "text-[10px] font-medium"
    switch (status.variant) {
      case "secondary":
        return <Badge variant="secondary" className={baseClasses}>{status.label}</Badge>
      case "warning":
        return <Badge className={`${baseClasses} bg-warning/15 text-warning border-0`}>{status.label}</Badge>
      case "primary":
        return <Badge className={`${baseClasses} bg-primary/15 text-primary border-0`}>{status.label}</Badge>
      case "success":
        return <Badge className={`${baseClasses} bg-success/15 text-success border-0`}>{status.label}</Badge>
      default:
        return <Badge variant="secondary" className={baseClasses}>{status.label}</Badge>
    }
  }

  const formatNextReview = (timestamp: number) => {
    const now = Date.now()
    const diff = timestamp - now

    if (diff <= 0) return "现在"

    const minutes = Math.floor(diff / (60 * 1000))
    const hours = Math.floor(diff / (60 * 60 * 1000))
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))

    if (days > 0) return `${days}天后`
    if (hours > 0) return `${hours}小时后`
    if (minutes > 0) return `${minutes}分钟后`
    return "即将"
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">待复习</p>
                <p className="text-2xl font-semibold tracking-tight">{dueCount}</p>
              </div>
              <div className="p-2.5 rounded-md bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">新语境</p>
                <p className="text-2xl font-semibold tracking-tight">{stats.newCount}</p>
              </div>
              <div className="p-2.5 rounded-md bg-secondary">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">学习中</p>
                <p className="text-2xl font-semibold tracking-tight">{stats.learningCount}</p>
              </div>
              <div className="p-2.5 rounded-md bg-warning/10">
                <BookOpen className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">已掌握</p>
                <p className="text-2xl font-semibold tracking-tight">{stats.graduatedCount}</p>
              </div>
              <div className="p-2.5 rounded-md bg-success/10">
                <GraduationCap className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review CTA */}
      {dueCount > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-medium">准备好复习了吗？</h3>
              <p className="text-sm text-muted-foreground">
                你有 <span className="text-primary font-medium">{dueCount}</span> 个语境需要复习
              </p>
            </div>
            <Button 
              onClick={onStartReview} 
              className="gap-2 shrink-0"
            >
              开始复习
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Word List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>词库管理</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-normal">{cards.length} 词</Badge>
              <Badge variant="secondary" className="font-normal">{stats.total} 语境</Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索单词、句子或释义..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Tag Filter */}
          {usedTags.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                筛选:
              </span>
              {Array.from(usedTags.entries()).map(([tag, count]) => (
                <Badge
                  key={tag}
                  variant={selectedFilterTag === tag ? "default" : "outline"}
                  className="cursor-pointer text-xs font-normal transition-colors"
                  onClick={() => setSelectedFilterTag(selectedFilterTag === tag ? null : tag)}
                >
                  {tag}
                  <span className="opacity-60 ml-1">({count})</span>
                </Badge>
              ))}
              {selectedFilterTag && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setSelectedFilterTag(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  清除
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {filteredCards.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {cards.length === 0 ? "词库为空，添加你的第一个单词吧" : "没有找到匹配的单词"}
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px]">单词</TableHead>
                    <TableHead>语境/释义</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[90px]">下次复习</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((card) => {
                    const firstContext = getFirstContext(card)
                    const contextCount = card.contexts?.length || 0
                    const cardStatus = getCardStatus(card)
                    const earliestReview = getEarliestReviewTime(card)
                    
                    return (
                      <TableRow key={card.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{card.word}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                              onClick={() => speakWord(card.word)}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </Button>
                            {contextCount > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
                                <Layers className="h-2.5 w-2.5" />
                                {contextCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {firstContext?.sentence || "无例句"}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm">
                                {firstContext?.meaning_cn || "无释义"}
                              </p>
                              {firstContext?.tags && firstContext.tags.length > 0 && (
                                <TagDisplay tags={firstContext.tags} className="opacity-70" />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(cardStatus)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatNextReview(earliestReview)}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除单词 &quot;{card.word}&quot; 及其所有 {contextCount} 个语境吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeCard(card.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
