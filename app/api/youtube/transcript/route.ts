import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    try {
      // 使用 youtube-transcript 包获取字幕
      // 这个库使用 YouTube 的内部 API，在 Vercel 上更稳定
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });

      if (!transcriptItems || transcriptItems.length === 0) {
        return NextResponse.json(
          { error: '该视频没有可用的字幕' },
          { status: 404 }
        );
      }

      // 转换为我们的格式
      const transcript = transcriptItems.map((item) => ({
        text: item.text,
        offset: Math.round(item.offset),
        duration: Math.round(item.duration)
      }));

      return NextResponse.json({ transcript });

    } catch (error: any) {
      console.error('Transcript fetch error:', error);

      const errorMessage = error.message || '';

      // 检查常见错误
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

      // 如果是 YouTube 封锁错误，提供更明确的信息
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

  } catch (error) {
    console.error('Route handler error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
