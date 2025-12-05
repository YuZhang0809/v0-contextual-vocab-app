"use client"

import React, { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from '@/components/youtube/video-player';
import { TranscriptView } from '@/components/youtube/transcript-view';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Search, Youtube, Plus, Check, X, Layers, Languages, Eye, EyeOff } from 'lucide-react';
import { useCards } from '@/hooks/use-cards';
import { createWatchSession, updateWatchSession, fetchVideoMetadata } from '@/hooks/use-watch-sessions';
import { WatchSession, VideoSource } from '@/lib/types';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  translation?: string;  // 中文翻译
}

interface AnalysisItem {
  term: string;
  context_segment: string;
  meaning: string;
  example_sentence: string;
  example_sentence_translation?: string;  // 新增：例句翻译
}

interface AnalysisResult {
  is_sentence: boolean;
  items: AnalysisItem[];
}

// 保存状态类型
type SaveStatus = { type: "new" } | { type: "appended"; contextCount: number } | null;

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
  const [hasTranslation, setHasTranslation] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  
  // Watch Session State (视频归档)
  const [watchSession, setWatchSession] = useState<WatchSession | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    title?: string;
    channel_name?: string;
    thumbnail_url?: string;
  } | null>(null);
  const wordsSavedRef = useRef(0); // 追踪本次保存的单词数
  
  const { addCard } = useCards();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);

  const extractVideoId = (inputUrl: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const handleLoadVideo = async () => {
    const id = extractVideoId(url);
    if (!id) {
        alert("Invalid YouTube URL");
        return;
    }
    
    setVideoId(id);
    setLoading(true);
    setTranscript([]);
    setHasTranslation(false);
    setShowTranslation(false);
    setWatchSession(null);
    setVideoMetadata(null);
    wordsSavedRef.current = 0;
    
    try {
        // 并行获取字幕和视频元数据
        const [transcriptRes, metadata] = await Promise.all([
            fetch('/api/youtube/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            }),
            fetchVideoMetadata(id).catch(err => {
                console.warn('Failed to fetch metadata:', err);
                return null;
            })
        ]);
        
        if (!transcriptRes.ok) {
            const errorData = await transcriptRes.json();
            throw new Error(errorData.details || errorData.error || "Failed to load transcript");
        }
        
        const transcriptData = await transcriptRes.json();
        setTranscript(transcriptData.transcript);
        
        // 保存视频元数据（延迟创建会话：只有保存单词时才创建）
        if (metadata) {
            setVideoMetadata({
                title: metadata.title,
                channel_name: metadata.channel_name,
                thumbnail_url: metadata.thumbnail_url,
            });
        }
        
        // 注意：不在此处创建 watch_session
        // 只有用户实际保存单词时才创建，避免产生"0 词"的无效记录
        
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
      if (watchSession) {
        updateWatchSession({
          session_id: watchSession.id,
          ended_at: Date.now(),
          words_saved: wordsSavedRef.current,
        }).catch(console.error);
      }
    };
  }, [watchSession]);

  const handleTranslate = async () => {
    if (transcript.length === 0 || translating) return;
    
    setTranslating(true);
    
    try {
        const res = await fetch('/api/youtube/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segments: transcript })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.details || errorData.error || "Translation failed");
        }
        
        const data = await res.json();
        
        // 将翻译合并到 transcript 中
        const updatedTranscript = transcript.map((seg, index) => ({
            ...seg,
            translation: data.translations[index] || "[翻译缺失]"
        }));
        
        setTranscript(updatedTranscript);
        setHasTranslation(true);
        setShowTranslation(true);
    } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "翻译失败，请重试";
        alert(errorMessage);
    } finally {
        setTranslating(false);
    }
  };

  const handleWordClick = async (word: string, context: string) => {
      // Pause video
      if (player) player.pauseVideo();
      
      setAnalyzing(true);
      setShowAnalysis(true);
      setSaveStatus(null);
      setAnalysisResult(null);

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
          setShowAnalysis(false); // Close on error
      } finally {
          setAnalyzing(false);
      }
  };

  const handleSaveCard = async () => {
      if (!analysisResult || !videoId) return;
      
      let currentSession = watchSession;
      
      // 延迟创建会话：只有在第一次保存单词时才创建
      if (!currentSession) {
        try {
          currentSession = await createWatchSession({
            video_id: videoId,
            video_title: videoMetadata?.title,
            channel_name: videoMetadata?.channel_name,
            thumbnail_url: videoMetadata?.thumbnail_url,
          });
          setWatchSession(currentSession);
          console.log('Watch session created on first save:', currentSession.id);
        } catch (sessionErr) {
          console.warn('Failed to create watch session:', sessionErr);
          // 会话创建失败不影响保存单词
        }
      }
      
      // 构建来源：如果有会话，使用详细的 VideoSource 格式
      const source: VideoSource | string = currentSession
        ? {
            type: "youtube",
            session_id: currentSession.id,
            video_id: videoId,
            timestamp: Math.floor(currentTime), // 当前播放时间（秒）
          }
        : `youtube:${videoId}`; // 兼容：无会话时使用简单格式
      
      try {
          const result = await addCard({
              word: analysisResult.term,
              sentence: analysisResult.example_sentence,
              meaning_cn: analysisResult.meaning,
              sentence_translation: analysisResult.example_sentence_translation,
              source,
          });
          
          if (result.isNew) {
            setSaveStatus({ type: "new" });
          } else {
            setSaveStatus({ type: "appended", contextCount: result.card.contexts?.length || 1 });
          }
          
          // 更新保存计数
          wordsSavedRef.current += 1;
          
          // 异步更新会话的 words_saved（不阻塞 UI）
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

  // 跳转到指定时间点
  const handleSeek = (timeInSeconds: number) => {
      if (player) {
          player.seekTo(timeInSeconds, true);
          player.playVideo();
      }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Input Section */}
      {!videoId ? (
        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-primary/10 p-6 rounded-full">
                <Youtube className="h-16 w-16 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold">YouTube 沉浸式学习</h2>
            <div className="flex w-full max-w-lg gap-2">
                <Input 
                    placeholder="粘贴 YouTube 视频链接..." 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 text-lg"
                />
                <Button size="lg" onClick={handleLoadVideo} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </div>
            <p className="text-muted-foreground text-sm">
                支持带字幕的英文视频，点击字幕单词即可即时查词。重复单词会自动追加语境。
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left: Video Player */}
            <div className="lg:col-span-2 flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => {
                        // 离开时更新会话
                        if (watchSession) {
                          updateWatchSession({
                            session_id: watchSession.id,
                            ended_at: Date.now(),
                            words_saved: wordsSavedRef.current,
                          }).catch(console.error);
                        }
                        setVideoId(null);
                    }}>
                        &larr; 返回搜索
                    </Button>
                    {/* 显示视频元数据 */}
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
                 <Card className="bg-card/50 border-border/50">
                     <CardContent className="p-4">
                         <div className="flex items-center justify-between">
                           <div>
                             <h3 className="font-semibold mb-2">学习提示</h3>
                             <p className="text-sm text-muted-foreground">
                                 视频播放时，右侧字幕会同步滚动。遇到生词，直接点击字幕中的单词，视频会自动暂停并为您解析。
                             </p>
                           </div>
                           {/* 显示本次学习统计 */}
                           {wordsSavedRef.current > 0 && (
                             <Badge variant="secondary" className="ml-4 shrink-0">
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
                        {!hasTranslation ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleTranslate}
                                disabled={translating || transcript.length === 0}
                                className="gap-1 text-xs"
                            >
                                {translating ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        翻译中...
                                    </>
                                ) : (
                                    <>
                                        <Languages className="h-3 w-3" />
                                        翻译字幕
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button 
                                variant={showTranslation ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowTranslation(!showTranslation)}
                                className="gap-1 text-xs"
                            >
                                {showTranslation ? (
                                    <>
                                        <EyeOff className="h-3 w-3" />
                                        隐藏翻译
                                    </>
                                ) : (
                                    <>
                                        <Eye className="h-3 w-3" />
                                        显示翻译
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
                <TranscriptView 
                    transcript={transcript} 
                    currentTime={currentTime}
                    onWordClick={handleWordClick}
                    onSeek={handleSeek}
                    showTranslation={showTranslation}
                />

                {/* Analysis Overlay / Modal */}
                {showAnalysis && (
                    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <Card className="w-full max-w-md shadow-2xl border-primary/20 animate-in slide-in-from-bottom-10 duration-300">
                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                <CardTitle className="text-xl font-bold text-primary">
                                    {analyzing ? "AI 分析中..." : analysisResult?.term}
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCloseAnalysis}>
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
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium text-muted-foreground">释义</div>
                                            <div className="text-lg font-medium">{analysisResult.meaning}</div>
                                        </div>
                                        <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                                            <div className="text-xs font-medium text-muted-foreground uppercase">Context</div>
                                            <div className="text-sm font-serif italic leading-relaxed">
                                                &quot;{analysisResult.example_sentence}&quot;
                                            </div>
                                            {/* 显示翻译 */}
                                            {analysisResult.example_sentence_translation && (
                                                <div className="text-sm text-muted-foreground pt-2 border-t border-border/30">
                                                    {analysisResult.example_sentence_translation}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-red-500">分析失败，请重试</div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-2 flex-col gap-2">
                                {/* 追加提示 */}
                                {saveStatus?.type === "appended" && (
                                  <Badge variant="secondary" className="gap-1 w-full justify-center py-1">
                                    <Layers className="h-3 w-3" />
                                    已追加到现有单词（共 {saveStatus.contextCount} 个语境）
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
