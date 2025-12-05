import { NextResponse } from 'next/server'

// YouTube oEmbed API 响应类型
interface OEmbedResponse {
  title: string
  author_name: string
  author_url: string
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('video_id')

    if (!videoId) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 })
    }

    // 使用 YouTube oEmbed API（无需 API Key）
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    
    const response = await fetch(oEmbedUrl)
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }
      throw new Error(`oEmbed API failed: ${response.status}`)
    }

    const data: OEmbedResponse = await response.json()

    // 构建高清缩略图 URL（oEmbed 返回的可能不是最高清的）
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

    return NextResponse.json({
      video_id: videoId,
      title: data.title,
      channel_name: data.author_name,
      channel_url: data.author_url,
      thumbnail_url: thumbnailUrl,
    })

  } catch (error) {
    console.error('YouTube metadata error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch video metadata', details: errorMessage },
      { status: 500 }
    )
  }
}

