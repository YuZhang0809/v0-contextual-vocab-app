"use client"

import React, { useRef, useEffect } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  onReady?: (event: any) => void;
  onStateChange?: (event: any) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export function VideoPlayer({ videoId, onReady, onStateChange, onTimeUpdate }: VideoPlayerProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  const handleReady = (event: any) => {
    playerRef.current = event.target;
    if (onReady) onReady(event);
  };

  const handleStateChange = (event: any) => {
    // 1 = Playing
    if (event.data === 1) {
        startTimer();
    } else {
        stopTimer();
    }
    
    if (onStateChange) onStateChange(event);
  };

  const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
          if (playerRef.current && onTimeUpdate) {
              const currentTime = playerRef.current.getCurrentTime();
              onTimeUpdate(currentTime);
          }
      }, 500); // Update every 500ms
  };

  const stopTimer = () => {
      if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
      }
  };

  useEffect(() => {
      return () => stopTimer();
  }, []);

  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-lg">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onStateChange={handleStateChange}
        className="h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}

