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
import { BookOpen, Clock, GraduationCap, Trash2, Search, Volume2 } from "lucide-react"
import { useCards, useDueCards } from "@/hooks/use-cards"
import { getNewCardsCount, getLearningCardsCount, getReviewCardsCount } from "@/lib/sm2"
import type { WordCard } from "@/lib/types"

interface DashboardProps {
  onStartReview: () => void
}

export function Dashboard({ onStartReview }: DashboardProps) {
  const { cards, removeCard } = useCards()
  const { dueCards } = useDueCards()
  const [searchQuery, setSearchQuery] = useState("")

  const newCount = getNewCardsCount(cards)
  const learningCount = getLearningCardsCount(cards)
  const reviewCount = getReviewCardsCount(cards)
  const dueCount = dueCards.length

  const filteredCards = cards.filter(
    (card) =>
      card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.sentence.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.meaning_cn.includes(searchQuery),
  )

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  const getStatusBadge = (card: WordCard) => {
    switch (card.review_status) {
      case "new":
        return <Badge variant="secondary">新词</Badge>
      case "learning":
        return <Badge className="bg-warning/10 text-warning border-warning/30">学习中</Badge>
      case "review":
        return <Badge className="bg-primary/10 text-primary border-primary/30">复习中</Badge>
      case "graduated":
        return <Badge className="bg-success/10 text-success border-success/30">已掌握</Badge>
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
      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dueCount}</p>
                <p className="text-sm text-muted-foreground">待复习</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <BookOpen className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{newCount}</p>
                <p className="text-sm text-muted-foreground">新词</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <BookOpen className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{learningCount}</p>
                <p className="text-sm text-muted-foreground">学习中</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <GraduationCap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewCount}</p>
                <p className="text-sm text-muted-foreground">复习/已掌握</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Start Review Button */}
      {dueCount > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">开始复习</h3>
              <p className="text-muted-foreground">你有 {dueCount} 张卡片需要复习</p>
            </div>
            <Button onClick={onStartReview} size="lg" className="gap-2">
              <BookOpen className="h-5 w-5" />
              开始复习
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Word List */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>词库管理</CardTitle>
            <Badge variant="outline">{cards.length} 词</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索单词、句子或释义..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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
                  {filteredCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{card.word}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => speakWord(card.word)}>
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground line-clamp-1">{card.sentence}</p>
                          <p className="text-sm font-medium">{card.meaning_cn}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(card)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatNextReview(card.next_review_at)}
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
                                确定要删除单词 "{card.word}" 吗？此操作无法撤销。
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
