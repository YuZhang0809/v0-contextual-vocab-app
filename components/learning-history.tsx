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
import { WatchSession, isVideoSource } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  
  return (
    <div className="space-y-4">
      <div className="text-center text-sm font-medium">
        {year}年 {monthNames[month]}
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekDays.map(day => (
          <div key={day} className="py-1.5">{day}</div>
        ))}
      </div>
      
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
                "aspect-square rounded-md flex flex-col items-center justify-center text-sm transition-colors relative",
                hasSession && "bg-primary/10 hover:bg-primary/15",
                !hasSession && "hover:bg-secondary/50",
                isSelected && "ring-1 ring-primary bg-primary/15",
                isToday && "font-medium"
              )}
            >
              <span>{day}</span>
              {hasSession && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
    <div className="bg-secondary/30 rounded-md p-4">
      <div className="flex gap-4">
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
              className="w-28 h-16 object-cover rounded hover:opacity-80 transition-opacity"
            />
          </a>
        )}
        
        <div className="flex-1 min-w-0">
          <a 
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:text-primary transition-colors line-clamp-2 flex items-start gap-1"
          >
            {session.video_title || session.video_id}
            <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
          </a>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {session.channel_name && (
              <span className="flex items-center gap-1">
                <Youtube className="h-3 w-3" />
                {session.channel_name}
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {duration}分钟
              </span>
            )}
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {wordsFromSession.length}词
            </span>
          </div>
          
          {wordsFromSession.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {wordsFromSession.slice(0, 5).map((item, i) => (
                <Badge 
                  key={i} 
                  variant="secondary" 
                  className="text-[10px] cursor-pointer font-normal"
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
                <Badge variant="outline" className="text-[10px] font-normal">
                  +{wordsFromSession.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function LearningHistory() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const startOfMonth = new Date(year, month, 1).getTime()
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
  
  const { sessions, isLoading } = useWatchSessions({
    startDate: startOfMonth,
    endDate: endOfMonth,
    limit: 100,
  })
  
  const { cards } = useCards()
  
  const datesWithSessions = useMemo(() => 
    getDatesWithSessions(sessions, year, month), 
    [sessions, year, month]
  )
  
  const groupedSessions = useMemo(() => 
    groupSessionsByDate(sessions),
    [sessions]
  )
  
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
    return groupedSessions.get(dateKey) || []
  }, [selectedDate, year, month, groupedSessions])
  
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
          words.push({
            word: card.word,
            meaning: context.meaning_cn,
          })
        }
      })
    })
    
    return words
  }
  
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
  
  const totalSessions = sessions.length
  const totalWords = sessions.reduce((sum, s) => sum + s.words_saved, 0)
  const uniqueDays = datesWithSessions.size
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-medium">学习记录</h2>
            <p className="text-sm text-muted-foreground">
              本月: {uniqueDays}天 · {totalSessions}视频 · {totalWords}词
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          今天
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-sm font-medium">日历</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
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
        
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {selectedDate 
                ? `${month + 1}月${selectedDate}日` 
                : '选择日期'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : selectedDateSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {selectedDate ? '当天没有学习记录' : '点击日期查看详情'}
              </div>
            ) : (
              <ScrollArea className="h-[380px] pr-4">
                <div className="space-y-3">
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
