import { createClient } from "@/lib/supabase/server"

interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

interface TranscriptCache {
  video_id: string
  transcript: TranscriptSegment[]
  language?: string
  source?: string
}

// GET: 获取缓存的字幕
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get("video_id")

    if (!videoId) {
      return Response.json({ error: "video_id is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("video_transcripts")
      .select("transcript, language, segment_count, source, updated_at")
      .eq("video_id", videoId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // 没有找到缓存
        return Response.json({ cached: false })
      }
      console.error("Transcript cache fetch error:", error)
      return Response.json({ error: "Failed to fetch cache" }, { status: 500 })
    }

    return Response.json({
      cached: true,
      transcript: data.transcript,
      language: data.language,
      segment_count: data.segment_count,
      source: data.source,
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error("Transcript cache GET error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: 保存字幕到缓存
export async function POST(req: Request) {
  try {
    const body = await req.json() as TranscriptCache

    if (!body.video_id || !body.transcript || !Array.isArray(body.transcript)) {
      return Response.json(
        { error: "Invalid request body: missing video_id or transcript array" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = Date.now()

    // 使用 upsert 来插入或更新缓存
    const { error } = await supabase
      .from("video_transcripts")
      .upsert({
        video_id: body.video_id,
        transcript: body.transcript,
        language: body.language || 'en',
        segment_count: body.transcript.length,
        source: body.source || 'youtube-transcript',
        updated_at: now,
      }, {
        onConflict: "video_id",
      })

    if (error) {
      console.error("Transcript cache save error:", error)
      return Response.json(
        { error: "Failed to save cache", details: error.message },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      updated_at: now,
      segment_count: body.transcript.length,
    })
  } catch (error) {
    console.error("Transcript cache POST error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: 清除字幕缓存 (同时删除翻译缓存)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get("video_id")

    if (!videoId) {
      return Response.json({ error: "video_id is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 同时删除字幕缓存和翻译缓存
    const [transcriptResult, translationResult] = await Promise.all([
      supabase
        .from("video_transcripts")
        .delete()
        .eq("video_id", videoId),
      supabase
        .from("video_translations")
        .delete()
        .eq("user_id", user.id)
        .eq("video_id", videoId),
    ])

    if (transcriptResult.error) {
      console.error("Transcript cache delete error:", transcriptResult.error)
      return Response.json({ error: "Failed to delete transcript cache" }, { status: 500 })
    }

    if (translationResult.error) {
      console.error("Translation cache delete error:", translationResult.error)
      // 翻译缓存删除失败不影响主流程，只记录警告
      console.warn("Translation cache deletion failed but transcript cache cleared")
    }

    return Response.json({ 
      success: true, 
      message: "Transcript and translation caches cleared" 
    })
  } catch (error) {
    console.error("Transcript cache DELETE error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}


