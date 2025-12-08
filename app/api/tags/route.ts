import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserTag } from '@/lib/types'

// GET: 获取用户的自定义标签列表
export async function GET() {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_tags')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Fetch tags error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tags: data as UserTag[] })

  } catch (error) {
    console.error('Tags GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 创建新的自定义标签
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, color } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // 创建新标签
    const { data, error } = await supabase
      .from('user_tags')
      .insert({
        user_id: user.id,
        name: trimmedName,
        color: color || null,
      })
      .select()
      .single()

    if (error) {
      // 检查是否是唯一约束冲突
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 409 }
        )
      }
      console.error('Create tag error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tag: data as UserTag })

  } catch (error) {
    console.error('Tags POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 删除自定义标签
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tagId = searchParams.get('id')

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', user.id) // 确保只能删除自己的标签

    if (error) {
      console.error('Delete tag error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Tags DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

