"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, RotateCcw, Check, Plus, Layers, Tag } from "lucide-react"
import { useCards } from "@/hooks/use-cards"
import { cn } from "@/lib/utils"
import { TagSelector } from "@/components/ui/tag-selector"

interface AnalysisItem {
  term: string
  context_segment: string
  meaning: string
  example_sentence: string
  example_sentence_translation?: string
}

interface AnalysisResult {
  is_sentence: boolean
  sentence_translation?: string
  sentence_analysis?: {
    grammar: string
    nuance: string
    cultural_background?: string
  }
  items: AnalysisItem[]
}

type SaveStatus = { type: "new" } | { type: "appended"; contextCount: number }

export function CaptureForm() {
  const { addCard } = useCards()
  const [inputText, setInputText] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [savedStatuses, setSavedStatuses] = useState<Map<number, SaveStatus>>(new Map())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [editedItems, setEditedItems] = useState<AnalysisItem[]>([])
  const [lookupIndices, setLookupIndices] = useState<Set<number>>(new Set())
  const [itemTags, setItemTags] = useState<Map<number, string[]>>(new Map())
  const itemRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleAnalyze = async () => {
    if (!inputText.trim()) return

    setIsAnalyzing(true)
    setAnalysisResult(null)
    setSavedStatuses(new Map())
    setEditedItems([])

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || "Analysis failed")
      }

      const result: AnalysisResult = await response.json()
      setAnalysisResult(result)
      setEditedItems(result.items)
    } catch (error) {
      console.error("Analysis error:", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveItem = async (index: number) => {
    const item = editedItems[index]
    if (!item) return

    setSavingIndex(index)
    try {
      const tags = itemTags.get(index) || []
      
      // 如果是句子模式且有语法分析，一并保存
      const grammarAnalysis = analysisResult?.is_sentence && analysisResult?.sentence_analysis
        ? {
            grammar: analysisResult.sentence_analysis.grammar,
            nuance: analysisResult.sentence_analysis.nuance,
            cultural_background: analysisResult.sentence_analysis.cultural_background,
          }
        : undefined
      
      const result = await addCard({
        word: item.term,
        sentence: item.example_sentence,
        meaning_cn: item.meaning,
        sentence_translation: item.example_sentence_translation,
        source: "capture",
        tags: tags.length > 0 ? tags : undefined,
        grammar_analysis: grammarAnalysis,
      })

      setSavedStatuses((prev) => {
        const next = new Map(prev)
        if (result.isNew) {
          next.set(index, { type: "new" })
        } else {
          next.set(index, { type: "appended", contextCount: result.card.contexts?.length || 1 })
        }
        return next
      })
    } catch (error) {
      console.error("Failed to save card:", error)
    } finally {
      setSavingIndex(null)
    }
  }

  const handleReset = () => {
    setInputText("")
    setAnalysisResult(null)
    setSavedStatuses(new Map())
    setEditedItems([])
    setItemTags(new Map())
  }

  const handleItemTagsChange = (index: number, tags: string[]) => {
    setItemTags(prev => {
      const next = new Map(prev)
      next.set(index, tags)
      return next
    })
  }

  const handleItemChange = (index: number, field: keyof AnalysisItem, value: string) => {
    setEditedItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddCustom = () => {
    const textarea = document.getElementById("input-text") as HTMLTextAreaElement
    let selectedText = ""
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      if (start !== end) {
        selectedText = textarea.value.substring(start, end)
      }
    }

    const emptyIndex = editedItems.findIndex(item => !item.term.trim())
    
    if (!selectedText && emptyIndex !== -1) {
      const inputEl = itemRefs.current[emptyIndex]
      if (inputEl) {
        inputEl.focus()
        inputEl.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }

    const newItem: AnalysisItem = {
      term: selectedText,
      context_segment: selectedText,
      meaning: "",
      example_sentence: inputText,
    }

    setEditedItems((prev) => [...prev, newItem])
    
    if (!analysisResult) {
      setAnalysisResult({
        is_sentence: true,
        items: [],
      })
    }

    setTimeout(() => {
        const newIndex = editedItems.length
        const inputEl = itemRefs.current[newIndex]
        if (inputEl) {
            inputEl.focus()
        }
    }, 0)
  }

  const handleAssistiveLookup = async (index: number) => {
    const item = editedItems[index]
    if (!item.term.trim()) return

    setLookupIndices(prev => {
        const next = new Set(prev)
        next.add(index)
        return next
    })

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                text: item.example_sentence || "",
                focus_term: item.term
            }), 
        })

        if (!response.ok) throw new Error("Lookup failed")
        
        const result: AnalysisResult = await response.json()
        if (result.items && result.items.length > 0) {
            const bestMatch = result.items[0]
            handleItemChange(index, 'meaning', bestMatch.meaning)
            if (bestMatch.example_sentence_translation) {
                handleItemChange(index, 'example_sentence_translation', bestMatch.example_sentence_translation)
            }
            if (!item.example_sentence && bestMatch.example_sentence) {
                handleItemChange(index, 'example_sentence', bestMatch.example_sentence)
            }
        }
    } catch (e) {
        console.error("Assistive lookup error", e)
    } finally {
        setLookupIndices(prev => {
            const next = new Set(prev)
            next.delete(index)
            return next
        })
    }
  }

  const getSaveStatus = (index: number): SaveStatus | null => {
    return savedStatuses.get(index) || null
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            智能录入
          </CardTitle>
          <CardDescription>
            输入单词、词组或完整句子，AI 将自动分析并生成卡片
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="input-text" className="text-sm">输入内容</Label>
            <Textarea
              id="input-text"
              placeholder="例如: 'ephemeral' 或者 'Fashions are ephemeral, changing with every season.'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleAddCustom} 
              disabled={!inputText} 
              className="mr-auto"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              手动添加
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleReset} 
              disabled={!inputText && !analysisResult}
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              重置
            </Button>
            <Button 
              onClick={handleAnalyze} 
              disabled={!inputText.trim() || isAnalyzing}
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  分析中
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  智能分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(analysisResult || editedItems.length > 0) && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              分析结果
              <span className="font-normal text-muted-foreground">
                ({analysisResult?.is_sentence ? "句子模式" : "单词模式"})
              </span>
            </h3>
          </div>

          {analysisResult?.is_sentence && (
            <Card className="bg-secondary/30 border-border/30">
              <CardContent className="p-5 space-y-4">
                {analysisResult.sentence_translation && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">翻译</p>
                    <p className="text-base leading-relaxed">{analysisResult.sentence_translation}</p>
                  </div>
                )}
                
                {analysisResult.sentence_analysis && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/30">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">语法</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.sentence_analysis.grammar}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">解读</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.sentence_analysis.nuance}</p>
                    </div>
                    {analysisResult.sentence_analysis.cultural_background && (
                      <div className="space-y-1 sm:col-span-2 pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">背景</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.sentence_analysis.cultural_background}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {editedItems.map((item, index) => {
              const saveStatus = getSaveStatus(index)
              const isSaved = saveStatus !== null
              
              return (
                <Card 
                  key={index} 
                  className={cn(
                    "transition-opacity duration-300", 
                    isSaved && "opacity-60"
                  )}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">单词</Label>
                        <Input 
                          ref={el => { itemRefs.current[index] = el }}
                          value={item.term} 
                          onChange={(e) => handleItemChange(index, 'term', e.target.value)}
                          className="font-mono"
                          placeholder="输入单词..."
                          disabled={isSaved}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center justify-between">
                          释义
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => handleAssistiveLookup(index)}
                            disabled={!item.term || lookupIndices.has(index) || isSaved}
                          >
                            {lookupIndices.has(index) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI填充
                              </>
                            )}
                          </Button>
                        </Label>
                        <Input 
                          value={item.meaning} 
                          onChange={(e) => handleItemChange(index, 'meaning', e.target.value)}
                          placeholder="中文释义"
                          disabled={isSaved}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">语境</Label>
                      <Textarea 
                        value={item.example_sentence} 
                        onChange={(e) => handleItemChange(index, 'example_sentence', e.target.value)}
                        className="text-sm resize-none"
                        rows={2}
                        disabled={isSaved}
                      />
                      {item.example_sentence_translation && (
                        <p className="text-xs text-muted-foreground pl-3 border-l-2 border-border">
                          {item.example_sentence_translation}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        标签
                      </Label>
                      <TagSelector
                        selectedTags={itemTags.get(index) || []}
                        onChange={(tags) => handleItemTagsChange(index, tags)}
                        disabled={isSaved}
                        compact
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-secondary/20 p-4 flex justify-end gap-2">
                    {saveStatus?.type === "appended" && (
                      <Badge variant="secondary" className="gap-1 mr-auto font-normal">
                        <Layers className="h-3 w-3" />
                        已追加（共 {saveStatus.contextCount} 个语境）
                      </Badge>
                    )}
                    
                    <Button 
                      size="sm" 
                      onClick={() => handleSaveItem(index)} 
                      disabled={isSaved || savingIndex === index || !item.term || !item.meaning}
                      variant={isSaved ? "outline" : "default"}
                    >
                      {savingIndex === index ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSaved ? (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          {saveStatus?.type === "appended" ? "已追加" : "已保存"}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1.5" />
                          添加到词库
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
