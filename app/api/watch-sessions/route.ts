import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WatchSession } from '@/lib/types'

// GET: 获取用户的观看会话列表
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start_date') // Unix timestamp
    const endDate = searchParams.get('end_date')     // Unix timestamp
    const videoId = searchParams.get('video_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    // 构建查询
    let query = supabase
      .from('watch_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(limit)

    // 应用过滤条件
    if (startDate) {
      query = query.gte('started_at', parseInt(startDate))
    }
    if (endDate) {
      query = query.lte('started_at', parseInt(endDate))
    }
    if (videoId) {
      query = query.eq('video_id', videoId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Fetch sessions error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions: data as WatchSession[] })

  } catch (error) {
    console.error('Watch sessions GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 创建新的观看会话
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { video_id, video_title, channel_name, thumbnail_url, video_duration, notes } = body

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 })
    }

    // 创建新会话
    const { data, error } = await supabase
      .from('watch_sessions')
      .insert({
        user_id: user.id,
        video_id,
        video_title,
        channel_name,
        thumbnail_url,
        video_duration,
        notes,
        words_saved: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Create session error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session: data as WatchSession })

  } catch (error) {
    console.error('Watch sessions POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: 更新观看会话（如结束时间、保存单词数）
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, ended_at, words_saved, notes } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // 构建更新对象
    const updates: Partial<WatchSession> = {}
    if (ended_at !== undefined) updates.ended_at = ended_at
    if (words_saved !== undefined) updates.words_saved = words_saved
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('watch_sessions')
      .update(updates)
      .eq('id', session_id)
      .eq('user_id', user.id) // 确保只能更新自己的会话
      .select()
      .single()

    if (error) {
      console.error('Update session error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session: data as WatchSession })

  } catch (error) {
    console.error('Watch sessions PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

