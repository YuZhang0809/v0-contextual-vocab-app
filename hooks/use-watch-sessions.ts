"use client"

import useSWR, { mutate } from 'swr'
import { WatchSession } from '@/lib/types'

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json())

// 获取观看会话列表
export function useWatchSessions(options?: {
  startDate?: number
  endDate?: number
  videoId?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (options?.startDate) params.set('start_date', options.startDate.toString())
  if (options?.endDate) params.set('end_date', options.endDate.toString())
  if (options?.videoId) params.set('video_id', options.videoId)
  if (options?.limit) params.set('limit', options.limit.toString())
  
  const queryString = params.toString()
  const url = `/api/watch-sessions${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading } = useSWR<{ sessions: WatchSession[] }>(url, fetcher)

  return {
    sessions: data?.sessions || [],
    isLoading,
    error,
  }
}

// 创建新的观看会话
export async function createWatchSession(data: {
  video_id: string
  video_title?: string
  channel_name?: string
  thumbnail_url?: string
  video_duration?: number
  notes?: string
}): Promise<WatchSession> {
  const response = await fetch('/api/watch-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create session')
  }

  const result = await response.json()
  
  // 刷新缓存
  mutate((key: string) => typeof key === 'string' && key.startsWith('/api/watch-sessions'))
  
  return result.session
}

// 更新观看会话
export async function updateWatchSession(data: {
  session_id: string
  ended_at?: number
  words_saved?: number
  notes?: string
}): Promise<WatchSession> {
  const response = await fetch('/api/watch-sessions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update session')
  }

  const result = await response.json()
  
  // 刷新缓存
  mutate((key: string) => typeof key === 'string' && key.startsWith('/api/watch-sessions'))
  
  return result.session
}

// 获取视频元数据
export async function fetchVideoMetadata(videoId: string): Promise<{
  video_id: string
  title: string
  channel_name: string
  channel_url: string
  thumbnail_url: string
}> {
  const response = await fetch(`/api/youtube/metadata?video_id=${videoId}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch metadata')
  }

  return response.json()
}

// 按日期分组会话（用于日历视图）
export function groupSessionsByDate(sessions: WatchSession[]): Map<string, WatchSession[]> {
  const grouped = new Map<string, WatchSession[]>()
  
  sessions.forEach(session => {
    const date = new Date(session.started_at)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(session)
  })
  
  return grouped
}

// 获取某月有学习记录的日期
export function getDatesWithSessions(sessions: WatchSession[], year: number, month: number): Set<number> {
  const dates = new Set<number>()
  
  sessions.forEach(session => {
    const date = new Date(session.started_at)
    if (date.getFullYear() === year && date.getMonth() === month) {
      dates.add(date.getDate())
    }
  })
  
  return dates
}

