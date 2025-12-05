"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Volume2,
  Trash2,
  BookOpen,
  CheckCircle2,
  MoreVertical,
  Calendar,
  Layers,
  X,
  Youtube,
  ExternalLink,
  Clock,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useCards } from "@/hooks/use-cards"
import type { WordCard, CardStatus, SourceType } from "@/lib/types"
import { isVideoSource, getYouTubeLink } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export function VocabularyList() {
  const { cards, removeCard, removeContext } = useCards()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Filter cards - search across all contexts
  const filteredCards = cards.filter((card) => {
    const query = searchQuery.toLowerCase()
    if (card.word.toLowerCase().includes(query)) return true
    
    // Search in all contexts
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts.some(
        (ctx) =>
          ctx.sentence.toLowerCase().includes(query) ||
          ctx.meaning_cn.includes(searchQuery)
      )
    }
    return false
  })

  // Get selected card object
  const selectedCard = cards.find((c) => c.id === selectedCardId) || filteredCards[0]

  // Get the first context's meaning for display in list
  const getFirstMeaning = (card: WordCard): string => {
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts[0].meaning_cn
    }
    return ""
  }

  // Get the "dominant" status of a card based on its contexts
  const getCardDominantStatus = (card: WordCard): CardStatus => {
    if (!card.contexts || card.contexts.length === 0) return "new"
    
    const statuses = card.contexts.map(ctx => ctx.review_status)
    if (statuses.includes("new")) return "new"
    if (statuses.includes("learning")) return "learning"
    if (statuses.includes("review")) return "review"
    return "graduated"
  }

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  const speakSentence = (sentence: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = "en-US"
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
    }
  }

  const getStatusColor = (status: CardStatus) => {
    switch (status) {
      case "new": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "learning": return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "review": return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      case "graduated": return "bg-green-500/10 text-green-500 border-green-500/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusLabel = (status: CardStatus) => {
    switch (status) {
      case "new": return "新"
      case "learning": return "学习中"
      case "review": return "复习中"
      case "graduated": return "已掌握"
      default: return status
    }
  }

  const getSourceLabel = (source?: SourceType): string => {
    if (!source) return "手动"
    if (isVideoSource(source)) return "YouTube"
    if (typeof source === 'string') {
      if (source.startsWith("youtube:")) return "YouTube"
      if (source === "capture") return "智能录入"
      return source
    }
    return "未知"
  }

  // 格式化时间戳为 MM:SS 格式
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
      {/* Left Sidebar: List */}
      <Card className="lg:col-span-4 flex flex-col h-full border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              我的单词本
            </h2>
            <Badge variant="secondary">{cards.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                未找到相关单词
              </div>
            ) : (
              filteredCards.map((card) => {
                const dominantStatus = getCardDominantStatus(card)
                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all duration-200 group
                      hover:bg-muted/50 border border-transparent
                      ${selectedCard?.id === card.id ? "bg-primary/5 border-primary/20 shadow-sm" : ""}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${selectedCard?.id === card.id ? "text-primary" : ""}`}>
                          {card.word}
                        </span>
                        {card.contexts && card.contexts.length > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                            <Layers className="h-2.5 w-2.5" />
                            {card.contexts.length}
                          </Badge>
                        )}
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 h-5 ${getStatusColor(dominantStatus)}`}>
                        {getStatusLabel(dominantStatus)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {getFirstMeaning(card)}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Right Side: Detail View */}
      <div className="lg:col-span-8 h-full flex flex-col">
        {selectedCard ? (
          <Card className="h-full border-border/50 flex flex-col overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 pb-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">{selectedCard.word}</h1>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full hover:bg-primary/10 hover:text-primary"
                      onClick={() => speakWord(selectedCard.word)}
                    >
                      <Volume2 className="h-5 w-5" />
                    </Button>
                    {selectedCard.contexts && selectedCard.contexts.length > 1 && (
                      <Badge variant="secondary" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {selectedCard.contexts.length} 个语境
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除单词
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除单词 &quot;{selectedCard.word}&quot; 及其所有语境吗？此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              removeCard(selectedCard.id)
                              setSelectedCardId(null)
                            }}
                            className="bg-destructive text-destructive-foreground"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Contexts Section - 每个语境显示独立的 SRS 状态 */}
                <section className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    语境列表
                  </h3>
                  <div className="space-y-4">
                    {selectedCard.contexts && selectedCard.contexts.length > 0 ? (
                      selectedCard.contexts.map((context, index) => (
                        <div 
                          key={index} 
                          className="bg-muted/30 p-5 rounded-xl border border-border/50 relative overflow-hidden group"
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                            context.review_status === "graduated" ? "bg-green-500" :
                            context.review_status === "review" ? "bg-purple-500" :
                            context.review_status === "learning" ? "bg-amber-500" :
                            "bg-blue-500"
                          }`} />
                          
{/* Context header */}
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge variant="secondary" className="text-xs">
                                                {context.meaning_cn}
                                              </Badge>
                                              <Badge className={`text-[10px] ${getStatusColor(context.review_status)}`}>
                                                {getStatusLabel(context.review_status)}
                                              </Badge>
                                              {/* 来源标签 - 如果是 YouTube，显示可点击的链接 */}
                                              {(() => {
                                                const youtubeLink = getYouTubeLink(context.source)
                                                if (youtubeLink) {
                                                  return (
                                                    <a 
                                                      href={youtubeLink}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex"
                                                    >
                                                      <Badge 
                                                        variant="outline" 
                                                        className="text-[10px] gap-1 cursor-pointer hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors"
                                                      >
                                                        <Youtube className="h-3 w-3" />
                                                        YouTube
                                                        {isVideoSource(context.source) && (
                                                          <span className="flex items-center gap-0.5">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatTimestamp(context.source.timestamp)}
                                                          </span>
                                                        )}
                                                        <ExternalLink className="h-2.5 w-2.5" />
                                                      </Badge>
                                                    </a>
                                                  )
                                                }
                                                return (
                                                  <Badge variant="outline" className="text-[10px]">
                                                    {getSourceLabel(context.source)}
                                                  </Badge>
                                                )
                                              })()}
                                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => speakSentence(context.sentence)}
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                              {selectedCard.contexts.length > 1 && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>删除此语境？</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        确定要删除这个语境吗？此操作无法撤销。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => removeContext(selectedCard.id, index)}
                                        className="bg-destructive text-destructive-foreground"
                                      >
                                        删除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          
                          {/* Sentence */}
                          <p className="text-lg leading-relaxed font-serif text-foreground/90 italic pl-3 mb-3">
                            &quot;{context.sentence}&quot;
                          </p>

                          {/* Translation */}
                          {context.sentence_translation && (
                            <p className="text-sm text-muted-foreground pl-3 mb-3 border-l-2 border-muted">
                              {context.sentence_translation}
                            </p>
                          )}
                          
                          {/* Context SRS Info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-3 pt-2 border-t border-border/30">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              复习 {context.repetition} 次
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(context.next_review_at, { addSuffix: true, locale: zhCN })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        没有语境数据
                      </div>
                    )}
                  </div>
                </section>

                {/* Additional Info (Mnemonics etc) */}
                {selectedCard.mnemonics && (
                   <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      助记/备注
                    </h3>
                    <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm">
                      {selectedCard.mnemonics}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-muted/10">
            <BookOpen className="h-12 w-12 mb-4 opacity-20" />
            <p>选择左侧单词查看详情</p>
          </div>
        )}
      </div>
    </div>
  )
}
