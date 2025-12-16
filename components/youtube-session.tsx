"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoPlayer } from '@/components/youtube/video-player';
import { TranscriptView } from '@/components/youtube/transcript-view';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Youtube, Plus, Check, X, Layers, Languages, Eye, EyeOff, Tag, ArrowLeft, Trash2 } from 'lucide-react';
import { useCards } from '@/hooks/use-cards';
import { createWatchSession, updateWatchSession, fetchVideoMetadata } from '@/hooks/use-watch-sessions';
import { WatchSession, VideoSource } from '@/lib/types';
import { TagSelector } from '@/components/ui/tag-selector';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  translation?: string;
  translationStatus?: 'pending' | 'loading' | 'done' | 'error';
}

interface AnalysisItem {
  term: string;
  original_form?: string;
  part_of_speech?: string;
  context_segment: string;
  meaning: string;
  background_info?: string;
  example_sentence: string;
  example_sentence_translation?: string;
}

type SaveStatus = { type: "new" } | { type: "appended"; contextCount: number } | null;

const TRANSLATE_AHEAD = 30;
const TRANSLATE_BEHIND = 10;

export function YouTubeSession() {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [player, setPlayer] = useState<any>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisItem | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'checking' | 'cached' | 'none' | null>(null);
  const translatingRangeRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const [watchSession, setWatchSession] = useState<WatchSession | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    title?: string;
    channel_name?: string;
    thumbnail_url?: string;
  } | null>(null);
  const wordsSavedRef = useRef(0);

  const { addCard } = useCards();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const extractVideoId = (inputUrl: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const hasAnyTranslation = transcript.some(seg => seg.translation);

  const getCurrentSegmentIndex = useCallback(() => {
    return transcript.findIndex((seg, i) => {
      const nextSeg = transcript[i + 1];
      const segStart = seg.offset / 1000;
      const segEnd = (seg.offset + seg.duration) / 1000;
      const nextStart = nextSeg ? nextSeg.offset / 1000 : Infinity;
      const effectiveEnd = Math.min(segEnd + 0.5, nextStart);
      return currentTime >= segStart && currentTime < effectiveEnd;
    });
  }, [transcript, currentTime]);

  const translateRange = useCallback(async (startIdx: number, endIdx: number) => {
    if (transcript.length === 0) return;

    const indicesToTranslate: number[] = [];
    for (let i = startIdx; i < endIdx && i < transcript.length; i++) {
      if (i >= 0 && !transcript[i].translation && !translatingRangeRef.current.has(i)) {
        indicesToTranslate.push(i);
        translatingRangeRef.current.add(i);
      }
    }

    if (indicesToTranslate.length === 0) return;

    const segmentsToTranslate = indicesToTranslate.map(idx => transcript[idx]);

    setTranscript(prev => prev.map((seg, idx) =>
      indicesToTranslate.includes(idx)
        ? { ...seg, translationStatus: 'loading' as const }
        : seg
    ));

    let translationsReceived = 0;

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/youtube/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segmentsToTranslate,
          startIndex: 0,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Translation request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'progress') {
                setTranslationProgress({
                  current: event.batch,
                  total: event.totalBatches,
                  percentage: Math.round((event.batch / event.totalBatches) * 100),
                });
              } else if (event.type === 'data') {
                const batchStartOffset = translationsReceived;
                setTranscript(prev => {
                  const newTranscript = [...prev];
                  event.translations.forEach((translation: string, i: number) => {
                    const actualIdx = indicesToTranslate[batchStartOffset + i];
                    if (actualIdx !== undefined && newTranscript[actualIdx]) {
                      newTranscript[actualIdx] = {
                        ...newTranscript[actualIdx],
                        translation,
                        translationStatus: 'done' as const,
                      };
                    }
                  });
                  return newTranscript;
                });
                translationsReceived += event.translations.length;
              } else if (event.type === 'done') {
                console.log(`Translation complete: ${event.totalTranslated} segments`);
              } else if (event.type === 'error') {
                console.error('Translation error:', event.message);
                setTranscript(prev => prev.map((seg, idx) =>
                  indicesToTranslate.includes(idx) && seg.translationStatus === 'loading'
                    ? { ...seg, translationStatus: 'error' as const }
                    : seg
                ));
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Translation error:', error);
        setTranscript(prev => prev.map((seg, idx) =>
          indicesToTranslate.includes(idx) && seg.translationStatus === 'loading'
            ? { ...seg, translationStatus: 'error' as const }
            : seg
        ));
      }
    } finally {
      indicesToTranslate.forEach(idx => translatingRangeRef.current.delete(idx));
      setTranslationProgress(null);
    }
  }, [transcript]);

  const translateAroundCurrentPosition = useCallback(() => {
    const currentIdx = getCurrentSegmentIndex();
    if (currentIdx < 0) return;

    const startIdx = Math.max(0, currentIdx - TRANSLATE_BEHIND);
    const endIdx = Math.min(transcript.length, currentIdx + TRANSLATE_AHEAD);

    translateRange(startIdx, endIdx);
  }, [getCurrentSegmentIndex, transcript.length, translateRange]);

  const checkTranslationCache = useCallback(async (vid: string): Promise<Record<string, string> | null> => {
    try {
      setCacheStatus('checking');
      const res = await fetch(`/api/youtube/translation-cache?video_id=${vid}`);
      if (!res.ok) return null;

      const data = await res.json();
      if (data.cached && data.translations) {
        if (Array.isArray(data.translations)) {
          const obj: Record<string, string> = {};
          data.translations.forEach((t: string, i: number) => {
            if (t && t !== '[翻译失败]' && t !== '[翻译缺失]') {
              obj[String(i)] = t;
            }
          });
          if (Object.keys(obj).length > 0) {
            setCacheStatus('cached');
            return obj;
          }
        } else if (typeof data.translations === 'object') {
          if (Object.keys(data.translations).length > 0) {
            setCacheStatus('cached');
            return data.translations;
          }
        }
      }
      setCacheStatus('none');
      return null;
    } catch (error) {
      console.warn('Cache check failed:', error);
      setCacheStatus('none');
      return null;
    }
  }, []);

  const saveTranslationCache = useCallback(async (vid: string, translationsMap: Record<string, string>, totalCount: number) => {
    try {
      const translatedCount = Object.keys(translationsMap).length;
      if (translatedCount === 0) return;

      await fetch('/api/youtube/translation-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: vid,
          translations: translationsMap,
          segment_count: totalCount,
        }),
      });
      console.log(`Translation cache saved: ${translatedCount}/${totalCount} segments`);
    } catch (error) {
      console.warn('Failed to save translation cache:', error);
    }
  }, []);

  const handleTranslateAll = async () => {
    if (transcript.length === 0 || translating || !videoId) return;

    setTranslating(true);
    setShowTranslation(true);

    await translateRange(0, transcript.length);

    setTranslating(false);
  };

  const handleSmartTranslate = () => {
    setShowTranslation(true);
    translateAroundCurrentPosition();
  };

  const handleClearCache = async () => {
    if (!videoId) return;
    
    const confirmed = window.confirm('确定要清除当前视频的翻译缓存吗？清除后需要重新翻译。');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/youtube/translation-cache?video_id=${videoId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // 清除本地翻译状态
        setTranscript(prev => prev.map(seg => ({
          ...seg,
          translation: undefined,
          translationStatus: 'pending' as const,
        })));
        setShowTranslation(false);
        setCacheStatus('none');
        translatingRangeRef.current.clear();
        lastSaveRef.current = 0;
        console.log('Translation cache cleared');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  useEffect(() => {
    if (!showTranslation || transcript.length === 0) return;

    const currentIdx = getCurrentSegmentIndex();
    if (currentIdx < 0) return;

    const lookAheadStart = currentIdx;
    const lookAheadEnd = Math.min(currentIdx + TRANSLATE_AHEAD, transcript.length);

    let needsTranslation = false;
    for (let i = lookAheadStart; i < lookAheadEnd; i++) {
      if (!transcript[i].translation && !translatingRangeRef.current.has(i)) {
        needsTranslation = true;
        break;
      }
    }

    if (needsTranslation) {
      translateRange(lookAheadStart, lookAheadEnd);
    }
  }, [currentTime, showTranslation, transcript, getCurrentSegmentIndex, translateRange]);

  const lastSaveRef = useRef<number>(0);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!videoId || transcript.length === 0) return;

    const translationsMap: Record<string, string> = {};
    transcript.forEach((seg, idx) => {
      if (seg.translation && seg.translation !== '[翻译失败]' && seg.translation !== '[翻译缺失]') {
        translationsMap[String(idx)] = seg.translation;
      }
    });

    const translatedCount = Object.keys(translationsMap).length;
    if (translatedCount === 0) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }

    pendingSaveRef.current = setTimeout(() => {
      if (translatedCount > lastSaveRef.current) {
        saveTranslationCache(videoId, translationsMap, transcript.length);
        lastSaveRef.current = translatedCount;

        if (translatedCount === transcript.length) {
          setCacheStatus('cached');
        }
      }
    }, 2000);

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, [transcript, videoId, saveTranslationCache]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!videoId || transcript.length === 0) return;

      const translationsMap: Record<string, string> = {};
      transcript.forEach((seg, idx) => {
        if (seg.translation && seg.translation !== '[翻译失败]' && seg.translation !== '[翻译缺失]') {
          translationsMap[String(idx)] = seg.translation;
        }
      });

      if (Object.keys(translationsMap).length > 0) {
        navigator.sendBeacon(
          '/api/youtube/translation-cache',
          JSON.stringify({
            video_id: videoId,
            translations: translationsMap,
            segment_count: transcript.length,
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [videoId, transcript]);

  const handleLoadVideo = async () => {
    const id = extractVideoId(url);
    if (!id) {
      alert("Invalid YouTube URL");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setVideoId(id);
    setLoading(true);
    setTranscript([]);
    setShowTranslation(false);
    setTranslationProgress(null);
    setCacheStatus(null);
    translatingRangeRef.current.clear();
    lastSaveRef.current = 0;
    setWatchSession(null);
    setVideoMetadata(null);
    wordsSavedRef.current = 0;

    try {
      const [transcriptRes, metadata, cachedTranslations] = await Promise.all([
        fetch('/api/youtube/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        }),
        fetchVideoMetadata(id).catch(err => {
          console.warn('Failed to fetch metadata:', err);
          return null;
        }),
        checkTranslationCache(id),
      ]);

      if (!transcriptRes.ok) {
        const errorData = await transcriptRes.json();
        throw new Error(errorData.details || errorData.error || "Failed to load transcript");
      }

      const transcriptData = await transcriptRes.json();

      if (cachedTranslations && Object.keys(cachedTranslations).length > 0) {
        const cachedCount = Object.keys(cachedTranslations).length;
        setTranscript(transcriptData.transcript.map((seg: TranscriptSegment, idx: number) => {
          const cachedTranslation = cachedTranslations[String(idx)];
          if (cachedTranslation) {
            return {
              ...seg,
              translation: cachedTranslation,
              translationStatus: 'done' as const,
            };
          }
          return {
            ...seg,
            translationStatus: 'pending' as const,
          };
        }));
        console.log(`Loaded ${cachedCount}/${transcriptData.transcript.length} translations from cache`);
      } else {
        setTranscript(transcriptData.transcript.map((seg: TranscriptSegment) => ({
          ...seg,
          translationStatus: 'pending' as const,
        })));
      }

      if (metadata) {
        setVideoMetadata({
          title: metadata.title,
          channel_name: metadata.channel_name,
          thumbnail_url: metadata.thumbnail_url,
        });
      }
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Could not load subtitles.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (watchSession) {
        updateWatchSession({
          session_id: watchSession.id,
          ended_at: Date.now(),
          words_saved: wordsSavedRef.current,
        }).catch(console.error);
      }
    };
  }, [watchSession]);

  const handleWordClick = async (word: string, context: string) => {
    if (player) player.pauseVideo();

    setAnalyzing(true);
    setShowAnalysis(true);
    setSaveStatus(null);
    setAnalysisResult(null);
    setSelectedTags([]);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: context,
          focus_term: word
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || "Analysis failed");
      }

      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setAnalysisResult(data.items[0]);
      }
    } catch (e) {
      console.error(e);
      setShowAnalysis(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCard = async () => {
    if (!analysisResult || !videoId) return;

    let currentSession = watchSession;

    if (!currentSession) {
      try {
        currentSession = await createWatchSession({
          video_id: videoId,
          video_title: videoMetadata?.title,
          channel_name: videoMetadata?.channel_name,
          thumbnail_url: videoMetadata?.thumbnail_url,
        });
        setWatchSession(currentSession);
      } catch (sessionErr) {
        console.warn('Failed to create watch session:', sessionErr);
      }
    }

    const source: VideoSource | string = currentSession
      ? {
        type: "youtube",
        session_id: currentSession.id,
        video_id: videoId,
        timestamp: Math.floor(currentTime),
      }
      : `youtube:${videoId}`;

    try {
      const result = await addCard({
        word: analysisResult.term,
        sentence: analysisResult.example_sentence,
        meaning_cn: analysisResult.meaning,
        sentence_translation: analysisResult.example_sentence_translation,
        source,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });

      if (result.isNew) {
        setSaveStatus({ type: "new" });
      } else {
        setSaveStatus({ type: "appended", contextCount: result.card.contexts?.length || 1 });
      }

      wordsSavedRef.current += 1;

      if (currentSession) {
        updateWatchSession({
          session_id: currentSession.id,
          words_saved: wordsSavedRef.current,
        }).catch(console.error);
      }

      setTimeout(() => {
        setShowAnalysis(false);
        if (player) player.playVideo();
      }, 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseAnalysis = () => {
    setShowAnalysis(false);
    if (player) player.playVideo();
  };

  const handleSeek = (timeInSeconds: number) => {
    if (player) {
      player.seekTo(timeInSeconds, true);
      player.playVideo();
    }
  };

  const translatedCount = transcript.filter(seg => seg.translation).length;
  const totalCount = transcript.length;
  const overallProgress = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {!videoId ? (
        <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
          <div className="p-5 rounded-xl bg-secondary">
            <Youtube className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-medium">YouTube 学习</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              粘贴视频链接，点击字幕单词即可查词
            </p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <Input
              placeholder="粘贴 YouTube 视频链接..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11"
            />
            <Button onClick={handleLoadVideo} disabled={loading} className="h-11 px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Video Player */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  if (watchSession) {
                    updateWatchSession({
                      session_id: watchSession.id,
                      ended_at: Date.now(),
                      words_saved: wordsSavedRef.current,
                    }).catch(console.error);
                  }
                  setVideoId(null);
                }}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
              {videoMetadata && (
                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {videoMetadata.title}
                </p>
              )}
            </div>
            <VideoPlayer
              videoId={videoId}
              onReady={(e) => setPlayer(e.target)}
              onTimeUpdate={setCurrentTime}
            />
            {wordsSavedRef.current > 0 && (
              <div className="flex items-center justify-end">
                <Badge variant="secondary" className="font-normal">
                  已保存 {wordsSavedRef.current} 词
                </Badge>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="lg:col-span-1 h-full overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">字幕</h3>
              <div className="flex items-center gap-1">
                {!hasAnyTranslation ? (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSmartTranslate}
                      disabled={translating || transcript.length === 0}
                      className="gap-1.5 text-xs h-7"
                    >
                      <Languages className="h-3 w-3" />
                      翻译
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTranslateAll}
                      disabled={translating || transcript.length === 0}
                      className="text-xs h-7 text-muted-foreground"
                    >
                      全部
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {cacheStatus === 'cached' && translatedCount > 0 && !showTranslation && (
                      <span className="text-[10px] text-muted-foreground">
                        已缓存 {translatedCount}
                      </span>
                    )}
                    {showTranslation && translatedCount < totalCount && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{translatedCount}/{totalCount}</span>
                        <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${overallProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <Button
                      variant={showTranslation ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTranslation(!showTranslation)}
                      className="gap-1 text-xs h-7"
                    >
                      {showTranslation ? (
                        <><EyeOff className="h-3 w-3" /> 隐藏</>
                      ) : (
                        <><Eye className="h-3 w-3" /> 显示</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCache}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="清除翻译缓存"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {translationProgress && (
              <div className="mb-2 p-2 bg-secondary/50 rounded-md">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    翻译中
                  </span>
                  <span className="text-muted-foreground">
                    {translationProgress.current}/{translationProgress.total}
                  </span>
                </div>
                <Progress value={translationProgress.percentage} className="h-1" />
              </div>
            )}

            <TranscriptView
              transcript={transcript}
              currentTime={currentTime}
              onWordClick={handleWordClick}
              onSeek={handleSeek}
              showTranslation={showTranslation}
            />

            {/* Analysis Overlay */}
            {showAnalysis && (
              <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-fade-in">
                <Card className="w-full max-w-md animate-fade-in-scale">
                  <CardHeader className="flex flex-row items-start justify-between pb-3">
                    <div className="flex items-baseline gap-2">
                      <CardTitle className="text-lg font-mono">
                        {analyzing ? "分析中..." : analysisResult?.term}
                      </CardTitle>
                      {!analyzing && analysisResult?.part_of_speech && (
                        <span className="text-xs text-muted-foreground">
                          {analysisResult.part_of_speech}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCloseAnalysis}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analyzing ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : analysisResult ? (
                      <>
                        {analysisResult.original_form &&
                          analysisResult.original_form.toLowerCase() !== analysisResult.term.toLowerCase() && (
                            <p className="text-xs text-muted-foreground">
                              {analysisResult.original_form} → {analysisResult.term}
                            </p>
                          )}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">释义</p>
                          <p className="font-medium">{analysisResult.meaning}</p>
                        </div>

                        {analysisResult.background_info && (
                          <div className="bg-secondary/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground mb-1">背景</p>
                            <p className="text-sm">{analysisResult.background_info}</p>
                          </div>
                        )}

                        <div className="bg-secondary/30 p-3 rounded-md">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Context</p>
                          <p className="text-sm leading-relaxed">
                            &quot;{analysisResult.example_sentence}&quot;
                          </p>
                          {analysisResult.example_sentence_translation && (
                            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/30">
                              {analysisResult.example_sentence_translation}
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                            <Tag className="h-3 w-3" />
                            标签
                          </p>
                          <TagSelector
                            selectedTags={selectedTags}
                            onChange={setSelectedTags}
                            disabled={saveStatus !== null}
                            compact
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-destructive text-sm">分析失败</p>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    {saveStatus?.type === "appended" && (
                      <Badge variant="secondary" className="w-full justify-center py-1 font-normal">
                        <Layers className="h-3 w-3 mr-1" />
                        已追加（共 {saveStatus.contextCount} 语境）
                      </Badge>
                    )}

                    {analysisResult && !analyzing && (
                      <Button
                        className="w-full gap-2"
                        onClick={handleSaveCard}
                        disabled={saveStatus !== null}
                        variant={saveStatus !== null ? "secondary" : "default"}
                      >
                        {saveStatus !== null ? (
                          <><Check className="h-4 w-4" /> {saveStatus.type === "appended" ? "已追加" : "已保存"}</>
                        ) : (
                          <><Plus className="h-4 w-4" /> 添加到词库</>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
