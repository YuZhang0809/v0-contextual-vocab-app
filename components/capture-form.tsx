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
  example_sentence_translation?: string  // 新增：例句翻译
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

// 保存状态：新建 or 追加
type SaveStatus = { type: "new" } | { type: "appended"; contextCount: number }

export function CaptureForm() {
  const { addCard } = useCards()
  const [inputText, setInputText] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  
  // Track saved state for each item index
  const [savedStatuses, setSavedStatuses] = useState<Map<number, SaveStatus>>(new Map())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)

  // Local state for editing items before saving
  const [editedItems, setEditedItems] = useState<AnalysisItem[]>([])
  
  // Track processing state for assistive lookup per item
  const [lookupIndices, setLookupIndices] = useState<Set<number>>(new Set())

  // Track selected tags for each item
  const [itemTags, setItemTags] = useState<Map<number, string[]>>(new Map())

  // Refs for focusing inputs
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
      const result = await addCard({
        word: item.term,
        sentence: item.example_sentence,
        meaning_cn: item.meaning,
        sentence_translation: item.example_sentence_translation,  // 传递翻译
        source: "capture",
        tags: tags.length > 0 ? tags : undefined,
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

    // Check if there is already an empty card (empty term)
    const emptyIndex = editedItems.findIndex(item => !item.term.trim())
    
    if (!selectedText && emptyIndex !== -1) {
      // If adding empty card but one already exists, focus it instead
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
    
    // Assume sentence mode if manually adding context
    if (!analysisResult) {
      setAnalysisResult({
        is_sentence: true,
        items: [],
      })
    }

    // Focus the new item after render (microtask)
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
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            智能录入
          </CardTitle>
          <CardDescription>
            输入单词、词组或完整句子，AI 将自动分析并生成卡片。重复单词会自动追加语境。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="input-text">输入内容</Label>
            <Textarea
              id="input-text"
              placeholder="例如: 'ephemeral' 或者 'Fashions are ephemeral, changing with every season.'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="resize-none font-medium"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleAddCustom} disabled={!inputText} className="mr-auto">
              <Plus className="h-4 w-4 mr-2" />
              添加选中/自定义
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={!inputText && !analysisResult}>
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </Button>
            <Button onClick={handleAnalyze} disabled={!inputText.trim() || isAnalyzing} className="min-w-[100px]">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  分析中
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  智能分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(analysisResult || editedItems.length > 0) && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              分析结果
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({analysisResult?.is_sentence ? "句子模式" : "单词模式"})
              </span>
            </h3>
          </div>

          {analysisResult?.is_sentence && (
            <div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-border/50">
              {analysisResult.sentence_translation && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">中文翻译</h4>
                  <p className="text-lg font-serif">{analysisResult.sentence_translation}</p>
                </div>
              )}
              
              {analysisResult.sentence_analysis && (
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">语法分析</h4>
                    <p className="leading-relaxed text-muted-foreground/90">{analysisResult.sentence_analysis.grammar}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">深度解读</h4>
                    <p className="leading-relaxed text-muted-foreground/90">{analysisResult.sentence_analysis.nuance}</p>
                  </div>
                  {analysisResult.sentence_analysis.cultural_background && (
                    <div className="space-y-1 sm:col-span-2 border-t border-border/50 pt-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">背景知识</h4>
                      <p className="leading-relaxed text-muted-foreground/90">{analysisResult.sentence_analysis.cultural_background}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4">
            {editedItems.map((item, index) => {
              const saveStatus = getSaveStatus(index)
              const isSaved = saveStatus !== null
              
              return (
                <Card 
                  key={index} 
                  className={cn(
                    "border-l-4 transition-all", 
                    isSaved 
                      ? saveStatus.type === "appended" 
                        ? "border-l-blue-500 opacity-70" 
                        : "border-l-green-500 opacity-70"
                      : "border-l-primary"
                  )}
                >
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>目标单词 (Term)</Label>
                        <Input 
                          ref={el => { itemRefs.current[index] = el }}
                          value={item.term} 
                          onChange={(e) => handleItemChange(index, 'term', e.target.value)}
                          className="font-bold"
                          placeholder="输入单词..."
                          disabled={isSaved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center justify-between">
                            中文释义 (Meaning)
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 text-muted-foreground hover:text-primary"
                              onClick={() => handleAssistiveLookup(index)}
                              disabled={!item.term || lookupIndices.has(index) || isSaved}
                              title="AI 自动填义"
                            >
                                {lookupIndices.has(index) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            </Button>
                        </Label>
                        <Input 
                          value={item.meaning} 
                          onChange={(e) => handleItemChange(index, 'meaning', e.target.value)}
                          placeholder="点击右上方按钮自动填充"
                          disabled={isSaved}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>例句 / 语境 (Context)</Label>
                      <Textarea 
                        value={item.example_sentence} 
                        onChange={(e) => handleItemChange(index, 'example_sentence', e.target.value)}
                        className="font-mono text-sm bg-muted/20"
                        rows={2}
                        disabled={isSaved}
                      />
                      {/* 显示翻译（如果有） */}
                      {item.example_sentence_translation && (
                        <p className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                          {item.example_sentence_translation}
                        </p>
                      )}
                    </div>

                    {/* 标签选择器 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        标签（可选）
                      </Label>
                      <TagSelector
                        selectedTags={itemTags.get(index) || []}
                        onChange={(tags) => handleItemTagsChange(index, tags)}
                        disabled={isSaved}
                        compact
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-secondary/10 py-3 flex justify-end gap-2">
                    {/* 保存状态提示 */}
                    {saveStatus?.type === "appended" && (
                      <Badge variant="secondary" className="gap-1 mr-auto">
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
                          <Check className="h-4 w-4 mr-2" />
                          {saveStatus?.type === "appended" ? "已追加" : "已保存"}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
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
