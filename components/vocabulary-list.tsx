"use client"

import { useState, useCallback, useMemo, useRef } from "react"
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
  Headphones,
  Play,
  ArrowUpDown,
  Filter,
  RotateCcw,
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
import type { WordCard, CardStatus, SourceType, WordContext } from "@/lib/types"
import { isVideoSource, getYouTubeLink, getPodwiseLink, VideoSource } from "@/lib/types"
import { VideoPlayer } from "@/components/youtube/video-player"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TagDisplay } from "@/components/ui/tag-selector"

// 筛选类型
type FilterType = "all" | "due" | "graduated"
// 排序类型
type SortType = "newest" | "oldest" | "alphabetical" | "due_first"

export function VocabularyList() {
  const { cards, removeCard, removeContext } = useCards()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [playingContextIndex, setPlayingContextIndex] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [sortType, setSortType] = useState<SortType>("newest")
  const playerRef = useRef<any>(null)
  const currentVideoSourceRef = useRef<VideoSource | null>(null)

  // 当播放器准备好时，跳转到指定时间并播放（提前1秒确保覆盖语境）
  const handlePlayerReady = useCallback((event: any, videoSource: VideoSource) => {
    playerRef.current = event.target
    currentVideoSourceRef.current = videoSource
    const seekTime = Math.max(0, videoSource.timestamp - 1)
    event.target.seekTo(seekTime, true)
    event.target.playVideo()
  }, [])

  // 重播功能
  const handleReplay = useCallback(() => {
    if (playerRef.current && currentVideoSourceRef.current) {
      const seekTime = Math.max(0, currentVideoSourceRef.current.timestamp - 1)
      playerRef.current.seekTo(seekTime, true)
      playerRef.current.playVideo()
    }
  }, [])

  // 筛选和排序逻辑
  const filteredAndSortedCards = useMemo(() => {
    const now = Date.now()
    
    // 第一步：搜索过滤
    let result = cards.filter((card) => {
      const query = searchQuery.toLowerCase()
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

    // 第二步：状态筛选
    if (filterType !== "all") {
      result = result.filter((card) => {
        if (!card.contexts || card.contexts.length === 0) return false
        
        switch (filterType) {
          case "due":
            // 有任何一个语境到期待学习（包括新词和复习到期的）
            return card.contexts.some((ctx) => ctx.next_review_at <= now)
          case "graduated":
            // 所有语境都已掌握
            return card.contexts.every((ctx) => ctx.review_status === "graduated")
          default:
            return true
        }
      })
    }

    // 第三步：排序
    result = [...result].sort((a, b) => {
      switch (sortType) {
        case "newest":
          return b.created_at - a.created_at
        case "oldest":
          return a.created_at - b.created_at
        case "alphabetical":
          return a.word.toLowerCase().localeCompare(b.word.toLowerCase())
        case "due_first":
          // 按最早到期时间排序
          const getEarliestDue = (card: WordCard) => {
            if (!card.contexts || card.contexts.length === 0) return Infinity
            return Math.min(...card.contexts.map((ctx) => ctx.next_review_at))
          }
          return getEarliestDue(a) - getEarliestDue(b)
        default:
          return 0
      }
    })

    return result
  }, [cards, searchQuery, filterType, sortType])

  // 兼容旧变量名
  const filteredCards = filteredAndSortedCards

  // 统计数据
  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total: cards.length,
      due: cards.filter((c) => c.contexts?.some((ctx) => ctx.next_review_at <= now)).length,
      graduated: cards.filter((c) => c.contexts?.every((ctx) => ctx.review_status === "graduated")).length,
    }
  }, [cards])

  const selectedCard = cards.find((c) => c.id === selectedCardId) || filteredCards[0]

  // 当切换单词时，关闭播放器
  const handleSelectCard = (cardId: string) => {
    setSelectedCardId(cardId)
    setPlayingContextIndex(null) // 重置播放器状态
  }

  const getFirstMeaning = (card: WordCard): string => {
    if (card.contexts && card.contexts.length > 0) {
      return card.contexts[0].meaning_cn
    }
    return ""
  }

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
      case "new": return "bg-secondary text-secondary-foreground"
      case "learning": return "bg-warning/15 text-warning"
      case "review": return "bg-primary/15 text-primary"
      case "graduated": return "bg-success/15 text-success"
      default: return "bg-secondary text-secondary-foreground"
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

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
      {/* Left Sidebar */}
      <Card className="lg:col-span-4 flex flex-col h-full overflow-hidden min-h-0">
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              词库
            </h2>
            <Badge variant="secondary" className="font-normal">{filteredCards.length}/{cards.length}</Badge>
          </div>
          
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* 筛选 Tabs */}
          <div className="flex gap-1">
            <Button
              variant={filterType === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 flex-1"
              onClick={() => setFilterType("all")}
            >
              全部
            </Button>
            <Button
              variant={filterType === "due" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 flex-1"
              onClick={() => setFilterType("due")}
            >
              待学习 {stats.due > 0 && <span className="ml-1 text-primary font-medium">{stats.due}</span>}
            </Button>
            <Button
              variant={filterType === "graduated" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 flex-1"
              onClick={() => setFilterType("graduated")}
            >
              已掌握
            </Button>
          </div>

          {/* 排序下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-between">
                <span className="flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  {sortType === "newest" && "最新添加"}
                  {sortType === "oldest" && "最早添加"}
                  {sortType === "alphabetical" && "按字母"}
                  {sortType === "due_first" && "待复习优先"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuItem onClick={() => setSortType("newest")}>
                最新添加
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortType("oldest")}>
                最早添加
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortType("alphabetical")}>
                按字母 A-Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortType("due_first")}>
                待复习优先
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5 pb-8">
            {filteredCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                未找到相关单词
              </div>
            ) : (
              filteredCards.map((card) => {
                const dominantStatus = getCardDominantStatus(card)
                const isSelected = selectedCard?.id === card.id
                return (
                  <div
                    key={card.id}
                    onClick={() => handleSelectCard(card.id)}
                    className={`
                      p-3 rounded-md cursor-pointer transition-colors group
                      ${isSelected 
                        ? "bg-primary/10" 
                        : "hover:bg-secondary/50"
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm ${isSelected ? "text-foreground" : ""}`}>
                          {card.word}
                        </span>
                        {card.contexts && card.contexts.length > 1 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 font-normal border-border/50">
                            <Layers className="h-2.5 w-2.5" />
                            {card.contexts.length}
                          </Badge>
                        )}
                      </div>
                      <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 ${getStatusColor(dominantStatus)}`}>
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

      {/* Right Detail */}
      <div className="lg:col-span-8 h-full flex flex-col min-h-0 overflow-hidden">
        {selectedCard ? (
          <Card className="h-full flex flex-col overflow-hidden min-h-0">
            <CardHeader className="border-b border-border/50 pb-5">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-mono font-semibold tracking-tight">{selectedCard.word}</h1>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => speakWord(selectedCard.word)}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                    {selectedCard.contexts && selectedCard.contexts.length > 1 && (
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Layers className="h-3 w-3" />
                        {selectedCard.contexts.length} 语境
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除 &quot;{selectedCard.word}&quot; 及其所有语境吗？
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
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-6 pb-12">
                <section className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    语境
                  </h3>
                  <div className="space-y-3">
                    {selectedCard.contexts && selectedCard.contexts.length > 0 ? (
                      selectedCard.contexts.map((context, index) => (
                        <div 
                          key={index} 
                          className="bg-secondary/30 p-5 rounded-md relative group"
                        >
                          {/* Status indicator */}
                          <div className={`absolute top-0 left-0 w-0.5 h-full rounded-l-md ${
                            context.review_status === "graduated" ? "bg-success" :
                            context.review_status === "review" ? "bg-primary" :
                            context.review_status === "learning" ? "bg-warning" :
                            "bg-muted-foreground"
                          }`} />
                          
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs font-normal">
                                {context.meaning_cn}
                              </Badge>
                              <Badge className={`text-[9px] border-0 ${getStatusColor(context.review_status)}`}>
                                {getStatusLabel(context.review_status)}
                              </Badge>
                              {(() => {
                                const youtubeLink = getYouTubeLink(context.source)
                                const podwiseLink = getPodwiseLink(context.source)
                                
                                if (youtubeLink) {
                                  return (
                                    <a 
                                      href={youtubeLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Badge 
                                        variant="outline" 
                                        className="text-[9px] gap-1 font-normal border-border/50 hover:bg-secondary cursor-pointer"
                                      >
                                        <Youtube className="h-2.5 w-2.5" />
                                        YouTube
                                        {isVideoSource(context.source) && (
                                          <span className="flex items-center gap-0.5">
                                            <Clock className="h-2 w-2" />
                                            {formatTimestamp(context.source.timestamp)}
                                          </span>
                                        )}
                                        <ExternalLink className="h-2 w-2" />
                                      </Badge>
                                    </a>
                                  )
                                }
                                
                                if (podwiseLink) {
                                  return (
                                    <a 
                                      href={podwiseLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Badge 
                                        variant="outline" 
                                        className="text-[9px] gap-1 font-normal border-border/50 hover:bg-secondary cursor-pointer"
                                      >
                                        <Headphones className="h-2.5 w-2.5" />
                                        Podwise
                                        <ExternalLink className="h-2 w-2" />
                                      </Badge>
                                    </a>
                                  )
                                }
                                
                                return (
                                  <Badge variant="outline" className="text-[9px] font-normal border-border/50">
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
                                      <AlertDialogTitle>删除语境</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        确定要删除这个语境吗？
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
                          <p className="text-base leading-relaxed mb-3 pl-3">
                            &quot;{context.sentence}&quot;
                          </p>

                          {/* Translation */}
                          {context.sentence_translation && (
                            <p className="text-sm text-muted-foreground pl-3 mb-3 border-l-2 border-border">
                              {context.sentence_translation}
                            </p>
                          )}

                          {/* Grammar Analysis */}
                          {context.grammar_analysis && (context.grammar_analysis.grammar || context.grammar_analysis.nuance) && (
                            <div className="pl-3 mb-3 p-3 bg-primary/5 rounded-md border border-primary/10">
                              <div className="flex items-center gap-2 text-xs text-primary mb-2 uppercase tracking-wide font-medium">
                                <BookOpen className="h-3 w-3" />
                                语法分析
                              </div>
                              <div className="space-y-2 text-sm text-muted-foreground">
                                {context.grammar_analysis.grammar && (
                                  <p><span className="font-medium text-foreground/70">结构：</span>{context.grammar_analysis.grammar}</p>
                                )}
                                {context.grammar_analysis.nuance && (
                                  <p><span className="font-medium text-foreground/70">解读：</span>{context.grammar_analysis.nuance}</p>
                                )}
                                {context.grammar_analysis.cultural_background && (
                                  <p><span className="font-medium text-foreground/70">背景：</span>{context.grammar_analysis.cultural_background}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          {context.tags && context.tags.length > 0 && (
                            <div className="pl-3 mb-3">
                              <TagDisplay tags={context.tags} />
                            </div>
                          )}
                          
                          {/* YouTube Player */}
                          {isVideoSource(context.source) && (
                            <div className="pl-3 mb-3">
                              {playingContextIndex === index ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      从 {formatTimestamp(Math.max(0, context.source.timestamp - 1))} 开始播放
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs gap-1"
                                        onClick={handleReplay}
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        重播
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => setPlayingContextIndex(null)}
                                      >
                                        关闭
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="rounded-lg overflow-hidden border border-border/50">
                                    <VideoPlayer
                                      videoId={context.source.video_id}
                                      onReady={(e) => handlePlayerReady(e, context.source as VideoSource)}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPlayingContextIndex(index)}
                                  className="gap-1.5 text-xs border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                  <Play className="h-3 w-3" />
                                  播放语境 ({formatTimestamp(context.source.timestamp)})
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-3 pt-3 border-t border-border/30">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {context.repetition} 次复习
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(context.next_review_at, { addSuffix: true, locale: zhCN })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无语境
                      </div>
                    )}
                  </div>
                </section>

                {selectedCard.mnemonics && (
                   <section className="space-y-2">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider">备注</h3>
                    <div className="p-4 rounded-md bg-secondary/30 text-sm">
                      {selectedCard.mnemonics}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
            <BookOpen className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">选择词汇查看详情</p>
          </div>
        )}
      </div>
    </div>
  )
}
