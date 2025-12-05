import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
      // Use the CLI directly which is more robust and avoids python import issues in this environment
      // We ask for JSON format and English languages
      const command = `youtube_transcript_api "${videoId}" --format json --languages en en-US en-GB`;
      
      const { stdout, stderr } = await execAsync(command);
      
      // CLI outputs JSON directly to stdout
      const data = JSON.parse(stdout);
      
      // Transform to our format
      // The CLI JSON output is a nested array: [[{text, start, duration}, ...]]
      // We need to take the first element since we only query one video at a time
      const transcriptData = Array.isArray(data[0]) ? data[0] : data;
      
      const transcript = transcriptData.map((item: any) => ({
          text: item.text,
          offset: Math.round(item.start * 1000),
          duration: Math.round(item.duration * 1000)
      }));

      return NextResponse.json({ transcript });

    } catch (error: any) {
        console.error('CLI execution error:', error);
        
        // Check for specific error messages in stderr
        const errorMessage = error.stderr || error.message || '';
        
        if (errorMessage.includes('NoTranscriptFound')) {
             return NextResponse.json({ error: 'No transcript found for this video (English)' }, { status: 404 });
        }
        if (errorMessage.includes('TranscriptsDisabled')) {
             return NextResponse.json({ error: 'Transcripts are disabled for this video' }, { status: 403 });
        }

        return NextResponse.json(
            { error: 'Failed to fetch transcript', details: errorMessage }, 
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
