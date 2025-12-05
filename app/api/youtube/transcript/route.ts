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
      // 使用 npm 包获取字幕（自动选择可用的字幕语言）
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
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
      if (errorMessage.includes('disabled') || errorMessage.includes('Transcript is disabled')) {
        return NextResponse.json(
          { error: '该视频已禁用字幕功能' }, 
          { status: 403 }
        );
      }
      
      if (errorMessage.includes('No transcript') || errorMessage.includes('not found')) {
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
