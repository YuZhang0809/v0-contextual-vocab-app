"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoPlayer } from '@/components/youtube/video-player';
import { TranscriptView } from '@/components/youtube/transcript-view';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Youtube, Plus, Check, X, Layers, Languages, Eye, EyeOff, Tag } from 'lucide-react';
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

// 保存状态类型
type SaveStatus = { type: "new" } | { type: "appended"; contextCount: number } | null;

// 翻译范围配置
const TRANSLATE_AHEAD = 30;  // 向前翻译30条
const TRANSLATE_BEHIND = 10; // 向后翻译10条

export function YouTubeSession() {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  
  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisItem | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // Translation State
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'checking' | 'cached' | 'none' | null>(null);
  const translatingRangeRef = useRef<Set<number>>(new Set()); // 正在翻译的索引
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Watch Session State
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

  // 检查是否有翻译
  const hasAnyTranslation = transcript.some(seg => seg.translation);

  // 获取当前播放位置的索引
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

  // 流式翻译指定范围
  const translateRange = useCallback(async (startIdx: number, endIdx: number) => {
    if (transcript.length === 0) return;
    
    // 过滤掉已翻译或正在翻译的索引
    const indicesToTranslate: number[] = [];
    for (let i = startIdx; i < endIdx && i < transcript.length; i++) {
      if (i >= 0 && !transcript[i].translation && !translatingRangeRef.current.has(i)) {
        indicesToTranslate.push(i);
        translatingRangeRef.current.add(i);
      }
    }
    
    if (indicesToTranslate.length === 0) return;
    
    // 只发送需要翻译的段落（不是全部 transcript）
    const segmentsToTranslate = indicesToTranslate.map(idx => transcript[idx]);
    
    // 标记为加载中
    setTranscript(prev => prev.map((seg, idx) => 
      indicesToTranslate.includes(idx) 
        ? { ...seg, translationStatus: 'loading' as const }
        : seg
    ));
    
    // 用于追踪已接收的翻译数量
    let translationsReceived = 0;
    
    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/youtube/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segmentsToTranslate,  // 只发送需要翻译的段落
          startIndex: 0,  // 从 0 开始，因为 segmentsToTranslate 是独立的数组
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
                // 使用 indicesToTranslate 数组正确映射翻译结果
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
                // 标记为错误
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
        // 标记为错误并清理
        setTranscript(prev => prev.map((seg, idx) => 
          indicesToTranslate.includes(idx) && seg.translationStatus === 'loading'
            ? { ...seg, translationStatus: 'error' as const }
            : seg
        ));
      }
    } finally {
      // 清理翻译中的标记
      indicesToTranslate.forEach(idx => translatingRangeRef.current.delete(idx));
      setTranslationProgress(null);
    }
  }, [transcript]);

  // 按需翻译：基于当前播放位置
  const translateAroundCurrentPosition = useCallback(() => {
    const currentIdx = getCurrentSegmentIndex();
    if (currentIdx < 0) return;
    
    const startIdx = Math.max(0, currentIdx - TRANSLATE_BEHIND);
    const endIdx = Math.min(transcript.length, currentIdx + TRANSLATE_AHEAD);
    
    translateRange(startIdx, endIdx);
  }, [getCurrentSegmentIndex, transcript.length, translateRange]);

  // 检查翻译缓存（支持部分缓存）
  const checkTranslationCache = useCallback(async (vid: string): Promise<Record<string, string> | null> => {
    try {
      setCacheStatus('checking');
      const res = await fetch(`/api/youtube/translation-cache?video_id=${vid}`);
      if (!res.ok) return null;
      
      const data = await res.json();
      if (data.cached && data.translations) {
        // 兼容旧格式（数组）和新格式（对象）
        if (Array.isArray(data.translations)) {
          // 转换数组为对象格式
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

  // 保存翻译到缓存（支持部分缓存）
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

  // 翻译全部字幕
  const handleTranslateAll = async () => {
    if (transcript.length === 0 || translating || !videoId) return;
    
    setTranslating(true);
    setShowTranslation(true);
    
    await translateRange(0, transcript.length);
    
    setTranslating(false);
  };

  // 智能翻译：从当前位置开始
  const handleSmartTranslate = () => {
    setShowTranslation(true);
    translateAroundCurrentPosition();
  };

  // 监听播放位置变化，自动加载更多翻译
  useEffect(() => {
    if (!showTranslation || transcript.length === 0) return;
    
    const currentIdx = getCurrentSegmentIndex();
    if (currentIdx < 0) return;
    
    // 检查前方是否需要更多翻译
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

  // 定期保存部分缓存（防抖）
  const lastSaveRef = useRef<number>(0);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!videoId || transcript.length === 0) return;
    
    // 收集已翻译的段落
    const translationsMap: Record<string, string> = {};
    transcript.forEach((seg, idx) => {
      if (seg.translation && seg.translation !== '[翻译失败]' && seg.translation !== '[翻译缺失]') {
        translationsMap[String(idx)] = seg.translation;
      }
    });
    
    const translatedCount = Object.keys(translationsMap).length;
    if (translatedCount === 0) return;
    
    // 防抖：2秒后保存
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }
    
    pendingSaveRef.current = setTimeout(() => {
      // 只有当有新翻译时才保存
      if (translatedCount > lastSaveRef.current) {
        saveTranslationCache(videoId, translationsMap, transcript.length);
        lastSaveRef.current = translatedCount;
        
        // 如果全部翻译完成，更新状态
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
  
  // 离开页面前立即保存
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
        // 使用 sendBeacon 确保离开前发送
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
    
    // 取消正在进行的翻译
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
      // 并行获取字幕、元数据和缓存
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
      
      // 应用部分缓存（如果有）- 不自动显示，让用户选择
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
        // 方案C：不自动显示翻译，让用户主动选择
        // setShowTranslation(true);
        console.log(`Loaded ${cachedCount}/${transcriptData.transcript.length} translations from cache (not auto-shown)`);
      } else {
        // 初始化字幕状态（无翻译）
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
  
  // 离开页面时更新会话结束时间
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

  // 计算翻译进度
  const translatedCount = transcript.filter(seg => seg.translation).length;
  const totalCount = transcript.length;
  const overallProgress = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {!videoId ? (
        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-6 rounded-full border border-red-500/20">
            <Youtube className="h-16 w-16 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold">YouTube 沉浸式学习</h2>
          <div className="flex w-full max-w-lg gap-2">
            <Input 
              placeholder="粘贴 YouTube 视频链接..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-12 text-lg bg-secondary/50 border-border/50"
            />
            <Button size="lg" onClick={handleLoadVideo} disabled={loading} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            支持带字幕的英文视频，点击字幕单词即可即时查词。<br/>
            翻译采用流式加载，长视频也能快速开始阅读。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left: Video Player */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => {
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
              }} className="hover:bg-secondary/50">
                &larr; 返回搜索
              </Button>
              {videoMetadata && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate max-w-[300px]" title={videoMetadata.title}>
                    {videoMetadata.title}
                  </span>
                  {videoMetadata.channel_name && (
                    <>
                      <span>·</span>
                      <span>{videoMetadata.channel_name}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <VideoPlayer 
              videoId={videoId} 
              onReady={(e) => setPlayer(e.target)}
              onTimeUpdate={setCurrentTime}
            />
            <Card className="bg-card/50 border-border/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-2">学习提示</h3>
                    <p className="text-sm text-muted-foreground">
                      视频播放时，右侧字幕会同步滚动。遇到生词，直接点击字幕中的单词，视频会自动暂停并为您解析。
                    </p>
                  </div>
                  {wordsSavedRef.current > 0 && (
                    <Badge variant="secondary" className="ml-4 shrink-0 bg-primary/10 text-primary">
                      已保存 {wordsSavedRef.current} 词
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Transcript */}
          <div className="lg:col-span-1 h-full overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">CC</span>
                字幕原文
              </h3>
              <div className="flex items-center gap-1">
                {!hasAnyTranslation ? (
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSmartTranslate}
                      disabled={translating || transcript.length === 0}
                      className="gap-1 text-xs border-primary/30 hover:bg-primary/10"
                    >
                      <Languages className="h-3 w-3" />
                      智能翻译
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleTranslateAll}
                      disabled={translating || transcript.length === 0}
                      className="gap-1 text-xs"
                      title="翻译全部字幕"
                    >
                      全部
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* 缓存数量提示 */}
                    {cacheStatus === 'cached' && translatedCount > 0 && !showTranslation && (
                      <span className="text-[10px] text-muted-foreground">
                        已缓存 {translatedCount} 条
                      </span>
                    )}
                    {/* 完全缓存标识 */}
                    {cacheStatus === 'cached' && translatedCount === totalCount && showTranslation && (
                      <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-500 bg-green-500/5">
                        已缓存
                      </Badge>
                    )}
                    {/* 翻译进度（显示翻译时） */}
                    {showTranslation && translatedCount < totalCount && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{translatedCount}/{totalCount}</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${overallProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <Button 
                      variant={showTranslation ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTranslation(!showTranslation)}
                      className="gap-1 text-xs"
                    >
                      {showTranslation ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          隐藏
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          显示
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 翻译进度指示器 */}
            {translationProgress && (
              <div className="mb-2 p-2 bg-primary/5 rounded-lg border border-primary/20 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-primary font-medium flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    正在翻译...
                  </span>
                  <span className="text-muted-foreground">
                    {translationProgress.current}/{translationProgress.total} 批
                  </span>
                </div>
                <Progress value={translationProgress.percentage} className="h-1.5" />
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
              <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                <Card className="w-full max-w-md shadow-2xl border-primary/20 bg-card/95 backdrop-blur animate-in slide-in-from-bottom-10 duration-300">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex items-baseline gap-2">
                      <CardTitle className="text-xl font-bold text-primary">
                        {analyzing ? "AI 分析中..." : analysisResult?.term}
                      </CardTitle>
                      {!analyzing && analysisResult?.part_of_speech && (
                        <span className="text-sm text-muted-foreground font-normal">
                          {analysisResult.part_of_speech}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-secondary/50" onClick={handleCloseAnalysis}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analyzing ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : analysisResult ? (
                      <>
                        {/* 如果原始形式与原型不同，显示变形说明 */}
                        {analysisResult.original_form && 
                         analysisResult.original_form.toLowerCase() !== analysisResult.term.toLowerCase() && (
                          <div className="text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded inline-block">
                            {analysisResult.original_form} → {analysisResult.term}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-muted-foreground">释义</div>
                          <div className="text-lg font-medium">{analysisResult.meaning}</div>
                        </div>
                        
                        {/* 背景知识（仅当有专业术语需要解释时显示） */}
                        {analysisResult.background_info && (
                          <div className="space-y-1.5 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <span>💡</span> 背景知识
                            </div>
                            <div className="text-sm text-foreground/80 leading-relaxed">
                              {analysisResult.background_info}
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2 bg-secondary/50 p-3 rounded-lg border border-border/30">
                          <div className="text-xs font-medium text-muted-foreground uppercase">Context</div>
                          <div className="text-sm font-serif italic leading-relaxed">
                            &quot;{analysisResult.example_sentence}&quot;
                          </div>
                          {analysisResult.example_sentence_translation && (
                            <div className="text-sm text-muted-foreground pt-2 border-t border-border/30">
                              {analysisResult.example_sentence_translation}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            标签（可选）
                          </div>
                          <TagSelector
                            selectedTags={selectedTags}
                            onChange={setSelectedTags}
                            disabled={saveStatus !== null}
                            compact
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-destructive">分析失败，请重试</div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-2 flex-col gap-2">
                    {saveStatus?.type === "appended" && (
                      <Badge variant="secondary" className="gap-1 w-full justify-center py-1 bg-primary/10 text-primary">
                        <Layers className="h-3 w-3" />
                        已追加到现有单词（共 {saveStatus.contextCount} 个语境）
                      </Badge>
                    )}
                    
                    {analysisResult && !analyzing && (
                      <Button 
                        className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                        onClick={handleSaveCard}
                        disabled={saveStatus !== null}
                        variant={saveStatus !== null ? "secondary" : "default"}
                      >
                        {saveStatus !== null ? (
                          <>
                            <Check className="h-4 w-4" /> 
                            {saveStatus.type === "appended" ? "已追加" : "已保存"}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> 加入生词本
                          </>
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
