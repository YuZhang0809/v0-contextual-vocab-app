"use client"

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Youtube, 
  BookOpen,
  Clock,
  ExternalLink
} from 'lucide-react'
import { useWatchSessions, groupSessionsByDate, getDatesWithSessions } from '@/hooks/use-watch-sessions'
import { useCards } from '@/hooks/use-cards'
import { WatchSession, isVideoSource, getYouTubeLink } from '@/lib/types'
import { cn } from '@/lib/utils'

// 日历组件
function LearningCalendar({ 
  year, 
  month, 
  datesWithSessions,
  selectedDate,
  onSelectDate 
}: {
  year: number
  month: number
  datesWithSessions: Set<number>
  selectedDate: number | null
  onSelectDate: (date: number | null) => void
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                      '七月', '八月', '九月', '十月', '十一月', '十二月']
  
  const days: (number | null)[] = []
  
  // 填充月初空白
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  
  // 填充日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  
  return (
    <div className="space-y-4">
      <div className="text-center font-semibold text-lg">
        {year}年 {monthNames[month]}
      </div>
      
      {/* 星期头 */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-muted-foreground">
        {weekDays.map(day => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>
      
      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }
          
          const hasSession = datesWithSessions.has(day)
          const isSelected = selectedDate === day
          const isToday = new Date().getDate() === day && 
                         new Date().getMonth() === month && 
                         new Date().getFullYear() === year
          
          return (
            <button
              key={day}
              onClick={() => onSelectDate(isSelected ? null : day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative",
                hasSession && "bg-primary/10 hover:bg-primary/20",
                !hasSession && "hover:bg-muted/50",
                isSelected && "ring-2 ring-primary bg-primary/20",
                isToday && "font-bold"
              )}
            >
              <span>{day}</span>
              {hasSession && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 单个会话卡片
function SessionCard({ 
  session, 
  wordsFromSession 
}: { 
  session: WatchSession
  wordsFromSession: Array<{ word: string; meaning: string; timestamp?: number }>
}) {
  const duration = session.ended_at 
    ? Math.round((session.ended_at - session.started_at) / 60000) 
    : null
    
  const videoUrl = `https://www.youtube.com/watch?v=${session.video_id}`
  
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* 缩略图 */}
          {session.thumbnail_url && (
            <a 
              href={videoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img 
                src={session.thumbnail_url} 
                alt={session.video_title || 'Video thumbnail'}
                className="w-32 h-20 object-cover rounded-md hover:opacity-80 transition-opacity"
              />
            </a>
          )}
          
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <a 
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-primary transition-colors line-clamp-2 flex items-start gap-1"
            >
              {session.video_title || session.video_id}
              <ExternalLink className="h-3 w-3 shrink-0 mt-1" />
            </a>
            
            {/* 频道和时间 */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {session.channel_name && (
                <span className="flex items-center gap-1">
                  <Youtube className="h-3 w-3" />
                  {session.channel_name}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {duration} 分钟
                </span>
              )}
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {wordsFromSession.length} 词
              </span>
            </div>
            
            {/* 学到的单词 */}
            {wordsFromSession.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {wordsFromSession.slice(0, 5).map((item, i) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-secondary/80"
                    title={item.meaning}
                    onClick={() => {
                      if (item.timestamp !== undefined) {
                        window.open(`${videoUrl}&t=${item.timestamp}s`, '_blank')
                      }
                    }}
                  >
                    {item.word}
                    {item.timestamp !== undefined && (
                      <span className="ml-1 text-muted-foreground">
                        {Math.floor(item.timestamp / 60)}:{String(item.timestamp % 60).padStart(2, '0')}
                      </span>
                    )}
                  </Badge>
                ))}
                {wordsFromSession.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{wordsFromSession.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 主组件
export function LearningHistory() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  // 获取当月的开始和结束时间戳
  const startOfMonth = new Date(year, month, 1).getTime()
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
  
  const { sessions, isLoading } = useWatchSessions({
    startDate: startOfMonth,
    endDate: endOfMonth,
    limit: 100,
  })
  
  const { cards } = useCards()
  
  // 有学习记录的日期
  const datesWithSessions = useMemo(() => 
    getDatesWithSessions(sessions, year, month), 
    [sessions, year, month]
  )
  
  // 按日期分组的会话
  const groupedSessions = useMemo(() => 
    groupSessionsByDate(sessions),
    [sessions]
  )
  
  // 获取选中日期的会话
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
    return groupedSessions.get(dateKey) || []
  }, [selectedDate, year, month, groupedSessions])
  
  // 从卡片中提取与会话相关的单词
  const getWordsForSession = (session: WatchSession) => {
    const words: Array<{ word: string; meaning: string; timestamp?: number }> = []
    
    cards.forEach(card => {
      card.contexts.forEach(context => {
        if (isVideoSource(context.source)) {
          if (context.source.session_id === session.id) {
            words.push({
              word: card.word,
              meaning: context.meaning_cn,
              timestamp: context.source.timestamp,
            })
          }
        } else if (typeof context.source === 'string' && context.source === `youtube:${session.video_id}`) {
          // 兼容旧格式
          words.push({
            word: card.word,
            meaning: context.meaning_cn,
          })
        }
      })
    })
    
    return words
  }
  
  // 月份导航
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date().getDate())
  }
  
  // 计算统计
  const totalSessions = sessions.length
  const totalWords = sessions.reduce((sum, s) => sum + s.words_saved, 0)
  const uniqueDays = datesWithSessions.size
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-full">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">学习记录</h2>
            <p className="text-sm text-muted-foreground">
              本月: {uniqueDays} 天 · {totalSessions} 个视频 · {totalWords} 个单词
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          今天
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 日历 */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">选择日期</CardTitle>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <LearningCalendar
              year={year}
              month={month}
              datesWithSessions={datesWithSessions}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </CardContent>
        </Card>
        
        {/* 详情 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedDate 
                ? `${month + 1}月${selectedDate}日 学习记录` 
                : '选择日期查看详情'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : selectedDateSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedDate ? '当天没有学习记录' : '点击日历上的日期查看详情'}
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {selectedDateSessions.map(session => (
                    <SessionCard 
                      key={session.id} 
                      session={session}
                      wordsFromSession={getWordsForSession(session)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

