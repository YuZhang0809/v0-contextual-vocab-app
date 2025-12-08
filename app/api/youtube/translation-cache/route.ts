import { createClient } from "@/lib/supabase/server"

interface TranslationCache {
  video_id: string
  translations: Record<string, string> | string[]  // 支持对象和数组格式
  segment_count: number
}

// GET: 获取缓存的翻译
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
      .from("video_translations")
      .select("translations, segment_count, updated_at")
      .eq("user_id", user.id)
      .eq("video_id", videoId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // 没有找到缓存
        return Response.json({ cached: false })
      }
      console.error("Cache fetch error:", error)
      return Response.json({ error: "Failed to fetch cache" }, { status: 500 })
    }

    return Response.json({
      cached: true,
      translations: data.translations,
      segment_count: data.segment_count,
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error("Translation cache GET error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: 保存翻译到缓存
export async function POST(req: Request) {
  try {
    const body = await req.json() as TranslationCache

    // 验证：translations 可以是数组或对象
    if (!body.video_id || !body.translations) {
      return Response.json({ error: "Invalid request body: missing video_id or translations" }, { status: 400 })
    }

    const isArray = Array.isArray(body.translations)
    const isObject = typeof body.translations === 'object' && !isArray

    if (!isArray && !isObject) {
      return Response.json({ error: "Invalid request body: translations must be array or object" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = Date.now()

    // 计算翻译数量
    const translationCount = isArray 
      ? (body.translations as string[]).filter(t => t).length
      : Object.keys(body.translations).length

    // 使用 upsert 来插入或更新缓存
    const { error } = await supabase
      .from("video_translations")
      .upsert({
        user_id: user.id,
        video_id: body.video_id,
        translations: body.translations,
        segment_count: body.segment_count || translationCount,
        updated_at: now,
      }, {
        onConflict: "user_id,video_id",
      })

    if (error) {
      console.error("Cache save error:", error)
      return Response.json({ error: "Failed to save cache", details: error.message }, { status: 500 })
    }

    return Response.json({ 
      success: true, 
      updated_at: now,
      cached_count: translationCount,
    })
  } catch (error) {
    console.error("Translation cache POST error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
