import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { createClient } from '@/lib/supabase/server';

// TranscriptAPI.com 配置
// 获取 API Key: https://transcriptapi.com/
const TRANSCRIPT_API_KEY = process.env.TRANSCRIPT_API_KEY;
const TRANSCRIPT_API_URL = 'https://transcriptapi.com/api/v2/youtube/transcript';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

/**
 * 从数据库缓存获取字幕
 */
async function getFromCache(videoId: string): Promise<{
  transcript: TranscriptSegment[];
  source: string;
  language: string;
} | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .from('video_transcripts')
      .select('transcript, source, language')
      .eq('video_id', videoId)
      .single();

    if (error || !data) return null;

    console.log(`[Transcript] Cache HIT for video: ${videoId}`);
    return {
      transcript: data.transcript as TranscriptSegment[],
      source: data.source || 'cache',
      language: data.language || 'en',
    };
  } catch (error) {
    console.warn('Cache lookup failed:', error);
    return null;
  }
}

/**
 * 保存字幕到数据库缓存
 */
async function saveToCache(
  videoId: string,
  transcript: TranscriptSegment[],
  source: string,
  language: string = 'en'
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase
      .from('video_transcripts')
      .upsert({
        video_id: videoId,
        transcript,
        language,
        segment_count: transcript.length,
        source,
        updated_at: Date.now(),
      }, {
        onConflict: 'video_id',
      });

    console.log(`[Transcript] Cached ${transcript.length} segments for video: ${videoId}`);
  } catch (error) {
    console.warn('Failed to save to cache:', error);
  }
}

/**
 * 使用 TranscriptAPI.com 获取字幕（付费备选方案）
 * API 文档: https://transcriptapi.com/docs/api/
 */
async function fetchFromTranscriptAPI(videoId: string): Promise<TranscriptSegment[]> {
  if (!TRANSCRIPT_API_KEY) {
    throw new Error('TRANSCRIPT_API_KEY not configured');
  }

  const params = new URLSearchParams({
    video_url: videoId,
    format: 'json',
    include_timestamp: 'true',
  });

  const response = await fetch(`${TRANSCRIPT_API_URL}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TRANSCRIPT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      throw new Error('TranscriptAPI: Invalid API key');
    }
    if (response.status === 402) {
      throw new Error('TranscriptAPI: Credits exhausted');
    }
    if (response.status === 429) {
      throw new Error('TranscriptAPI: Rate limited');
    }
    
    throw new Error(error.detail || `TranscriptAPI error: ${response.status}`);
  }

  const data = await response.json();
  
  // 转换为我们的格式
  if (!data.transcript || !Array.isArray(data.transcript)) {
    throw new Error('TranscriptAPI: Invalid response format');
  }

  return data.transcript.map((item: { text: string; start: number; duration: number }) => ({
    text: item.text,
    offset: Math.round(item.start * 1000), // 转为毫秒
    duration: Math.round(item.duration * 1000),
  }));
}

/**
 * 使用 youtube-transcript 包获取字幕（免费方案）
 */
async function fetchFromYoutubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
    lang: 'en',
  });

  if (!transcriptItems || transcriptItems.length === 0) {
    throw new Error('No transcript available');
  }

  return transcriptItems.map((item) => ({
    text: item.text,
    offset: Math.round(item.offset),
    duration: Math.round(item.duration),
  }));
}

export async function POST(req: Request) {
  try {
    const { url, forceApi, skipCache } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // 1. 首先检查缓存 (除非明确跳过)
    if (!skipCache) {
      const cached = await getFromCache(videoId);
      if (cached) {
        return NextResponse.json({
          transcript: cached.transcript,
          source: 'cache',
          originalSource: cached.source,
          language: cached.language,
          cached: true,
        });
      }
    }

    let transcript: TranscriptSegment[] | null = null;
    let source: 'youtube-transcript' | 'transcriptapi' = 'youtube-transcript';
    let fallbackUsed = false;

    // 2. 如果强制使用 API 或者主方法失败，使用 TranscriptAPI
    if (forceApi && TRANSCRIPT_API_KEY) {
      try {
        transcript = await fetchFromTranscriptAPI(videoId);
        source = 'transcriptapi';
      } catch (apiError) {
        console.error('TranscriptAPI error:', apiError);
        return NextResponse.json(
          { error: 'TranscriptAPI 请求失败', details: apiError instanceof Error ? apiError.message : 'Unknown' },
          { status: 500 }
        );
      }
    } else {
      // 首先尝试免费方法
      try {
        transcript = await fetchFromYoutubeTranscript(videoId);
        source = 'youtube-transcript';
      } catch (primaryError: any) {
        console.warn('Primary method failed, trying fallback...', primaryError.message);

        // 如果配置了 TranscriptAPI，尝试备选方案
        if (TRANSCRIPT_API_KEY) {
          try {
            transcript = await fetchFromTranscriptAPI(videoId);
            source = 'transcriptapi';
            fallbackUsed = true;
            console.log('Fallback to TranscriptAPI succeeded');
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            // 继续抛出原始错误
          }
        }

        // 如果备选也失败或未配置，处理原始错误
        if (!transcript) {
          const errorMessage = primaryError.message || '';

          if (errorMessage.includes('disabled') || errorMessage.includes('Disabled')) {
            return NextResponse.json(
              { error: '该视频已禁用字幕功能' },
              { status: 403 }
            );
          }

          if (errorMessage.includes('not found') || errorMessage.includes('No captions') || errorMessage.includes('Could not find')) {
            return NextResponse.json(
              { error: '该视频没有可用的字幕' },
              { status: 404 }
            );
          }

          if (errorMessage.includes('Too Many Requests') || errorMessage.includes('429')) {
            return NextResponse.json(
              { error: 'YouTube 请求过于频繁，请稍后再试', details: errorMessage },
              { status: 429 }
            );
          }

          return NextResponse.json(
            { error: '获取字幕失败', details: errorMessage },
            { status: 500 }
          );
        }
      }
    }

    // 3. 保存到缓存 (异步，不阻塞响应)
    if (transcript) {
      saveToCache(videoId, transcript, source).catch(console.error);
    }

    return NextResponse.json({
      transcript,
      source,
      fallbackUsed,
      cached: false,
    });

  } catch (error) {
    console.error('Route handler error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
