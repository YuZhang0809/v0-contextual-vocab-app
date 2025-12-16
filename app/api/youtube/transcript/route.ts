import { NextResponse } from 'next/server';
import { getSubtitles } from 'youtube-caption-extractor';

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
      // 使用 youtube-caption-extractor npm 包获取字幕
      // 优先尝试英文，如果没有则尝试不指定语言（获取默认字幕）
      let subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });

      // 如果没有英文字幕，尝试获取任意可用字幕
      if (!subtitles || subtitles.length === 0) {
        subtitles = await getSubtitles({ videoID: videoId });
      }

      if (!subtitles || subtitles.length === 0) {
        return NextResponse.json(
          { error: '该视频没有可用的字幕' },
          { status: 404 }
        );
      }

      // 转换为我们的格式
      const transcript = subtitles.map((item) => ({
        text: item.text,
        offset: Math.round(parseFloat(item.start) * 1000),
        duration: Math.round(parseFloat(item.dur) * 1000)
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

      if (errorMessage.includes('not found') || errorMessage.includes('No captions')) {
        return NextResponse.json(
          { error: '该视频没有可用的字幕' },
          { status: 404 }
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
