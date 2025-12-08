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
import { BookOpen, Clock, GraduationCap, Trash2, Search, Volume2, Layers, Tag, X } from "lucide-react"
import { useCards, useDueContexts } from "@/hooks/use-cards"
import { useTags } from "@/hooks/use-tags"
import { getContextStats } from "@/lib/sm2"
import type { WordCard, CardStatus } from "@/lib/types"
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

  // 基于语境的统计
  const stats = getContextStats(cards)

  // 获取第一个语境的信息（用于搜索和显示）
  const getFirstContext = (card: WordCard) => {
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts[0]
    }
    return null
  }

  // 获取卡片中最近需要复习的时间
  const getEarliestReviewTime = (card: WordCard): number => {
    if (!card.contexts || card.contexts.length === 0) return Date.now()
    return Math.min(...card.contexts.map(ctx => ctx.next_review_at))
  }

  // 获取卡片的综合状态（基于所有语境）
  const getCardStatus = (card: WordCard): { label: string; variant: string } => {
    if (!card.contexts || card.contexts.length === 0) {
      return { label: "无语境", variant: "secondary" }
    }
    
    const statuses = card.contexts.map(ctx => ctx.review_status)
    
    // 如果有新的语境，显示新
    if (statuses.includes("new")) {
      return { label: "有新语境", variant: "secondary" }
    }
    // 如果有学习中的，显示学习中
    if (statuses.includes("learning")) {
      return { label: "学习中", variant: "warning" }
    }
    // 如果全部已掌握
    if (statuses.every(s => s === "graduated")) {
      return { label: "已掌握", variant: "success" }
    }
    // 否则复习中
    return { label: "复习中", variant: "primary" }
  }

  // 获取所有使用过的标签（统计）
  const usedTags = new Map<string, number>()
  cards.forEach(card => {
    card.contexts?.forEach(ctx => {
      ctx.tags?.forEach(tag => {
        usedTags.set(tag, (usedTags.get(tag) || 0) + 1)
      })
    })
  })

  const filteredCards = cards.filter((card) => {
    // 标签筛选
    if (selectedFilterTag) {
      const hasTag = card.contexts?.some(ctx => ctx.tags?.includes(selectedFilterTag))
      if (!hasTag) return false
    }
    
    // 搜索
    const query = searchQuery.toLowerCase()
    if (!query) return true
    
    if (card.word.toLowerCase().includes(query)) return true
    
    // 搜索所有语境
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
    switch (status.variant) {
      case "secondary":
        return <Badge variant="secondary">{status.label}</Badge>
      case "warning":
        return <Badge className="bg-warning/10 text-warning border-warning/30">{status.label}</Badge>
      case "primary":
        return <Badge className="bg-primary/10 text-primary border-primary/30">{status.label}</Badge>
      case "success":
        return <Badge className="bg-success/10 text-success border-success/30">{status.label}</Badge>
      default:
        return <Badge variant="secondary">{status.label}</Badge>
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
    <div className="space-y-6">
      {/* Stats Overview - 基于语境统计 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 hover:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{dueCount}</p>
                <p className="text-sm text-muted-foreground">待复习语境</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-secondary to-secondary/50 border border-border/30">
                <BookOpen className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.newCount}</p>
                <p className="text-sm text-muted-foreground">新语境</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/20 hover:border-accent/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
                <BookOpen className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-accent">{stats.learningCount}</p>
                <p className="text-sm text-muted-foreground">学习中</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/20 hover:border-success/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20">
                <GraduationCap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.graduatedCount}</p>
                <p className="text-sm text-muted-foreground">已掌握</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Start Review Button */}
      {dueCount > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-primary">开始复习</h3>
              <p className="text-muted-foreground">你有 <span className="text-primary font-medium">{dueCount}</span> 个语境需要复习</p>
            </div>
            <Button onClick={onStartReview} size="lg" className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30">
              <BookOpen className="h-5 w-5" />
              开始复习
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Word List */}
      <Card className="border-border/30">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">词库管理</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-primary/30 text-primary">{cards.length} 词</Badge>
              <Badge variant="secondary" className="bg-secondary/80">{stats.total} 语境</Badge>
            </div>
          </div>
          
          {/* 搜索和筛选 */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索单词、句子或释义..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* 标签筛选器 */}
            {usedTags.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  标签筛选:
                </span>
                {Array.from(usedTags.entries()).map(([tag, count]) => (
                  <Badge
                    key={tag}
                    variant={selectedFilterTag === tag ? "default" : "outline"}
                    className="cursor-pointer text-xs gap-1 transition-all hover:scale-105"
                    onClick={() => setSelectedFilterTag(selectedFilterTag === tag ? null : tag)}
                  >
                    {tag}
                    <span className="opacity-60">({count})</span>
                  </Badge>
                ))}
                {selectedFilterTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setSelectedFilterTag(null)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    清除筛选
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {cards.length === 0 ? "词库为空，添加你的第一个单词吧！" : "没有找到匹配的单词"}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">单词</TableHead>
                    <TableHead>语境/释义</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[100px]">下次复习</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((card) => {
                    const firstContext = getFirstContext(card)
                    const contextCount = card.contexts?.length || 0
                    const cardStatus = getCardStatus(card)
                    const earliestReview = getEarliestReviewTime(card)
                    
                    return (
                      <TableRow key={card.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{card.word}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => speakWord(card.word)}>
                              <Volume2 className="h-3 w-3" />
                            </Button>
                            {contextCount > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
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
                              <p className="text-sm font-medium">
                                {firstContext?.meaning_cn || "无释义"}
                              </p>
                              {firstContext?.tags && firstContext.tags.length > 0 && (
                                <TagDisplay tags={firstContext.tags} className="opacity-80" />
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
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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
