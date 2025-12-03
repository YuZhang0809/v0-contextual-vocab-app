"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Loader2, Sparkles, Save, RotateCcw, Check, Plus } from "lucide-react"
import { useCards } from "@/hooks/use-cards"
import { cn } from "@/lib/utils"

interface AnalysisItem {
  term: string
  context_segment: string
  meaning: string
  example_sentence: string
}

interface AnalysisResult {
  is_sentence: boolean
  sentence_translation?: string
  items: AnalysisItem[]
}

export function CaptureForm() {
  const { addCard } = useCards()
  const [inputText, setInputText] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  
  // Track saved state for each item index
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)

  // Local state for editing items before saving
  const [editedItems, setEditedItems] = useState<AnalysisItem[]>([])
  
  // Track processing state for assistive lookup per item
  const [lookupIndices, setLookupIndices] = useState<Set<number>>(new Set())

  // Refs for focusing inputs
  const itemRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleAnalyze = async () => {
    if (!inputText.trim()) return

    setIsAnalyzing(true)
    setAnalysisResult(null)
    setSavedIndices(new Set())
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
      await addCard({
        word: item.term,
        sentence: item.example_sentence,
        meaning_cn: item.meaning,
        mnemonics: "", 
      })

      setSavedIndices((prev) => {
        const next = new Set(prev)
        next.add(index)
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
    setSavedIndices(new Set())
    setEditedItems([])
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
        // Optional: Add a visual flash effect here if needed
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
        // Mode: Specific Lookup
        // We pass 'focus_term' to tell the API exactly what we are looking for.
        // 'text' serves as the context.
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
        // The API returns a list, we take the first relevant one
        if (result.items && result.items.length > 0) {
            // Find the best match or just take the first
            const bestMatch = result.items[0]
            handleItemChange(index, 'meaning', bestMatch.meaning)
            // If example sentence was empty, fill it
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

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            智能录入
          </CardTitle>
          <CardDescription>
            输入单词、词组或完整句子，AI 将自动分析并生成卡片。
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
            {analysisResult?.sentence_translation && (
              <span className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
                 {analysisResult.sentence_translation}
              </span>
            )}
          </div>

          <div className="grid gap-4">
            {editedItems.map((item, index) => (
              <Card key={index} className={cn("border-l-4 transition-all", savedIndices.has(index) ? "border-l-green-500 opacity-60" : "border-l-primary")}>
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
                            disabled={!item.term || lookupIndices.has(index)}
                            title="AI 自动填义"
                          >
                              {lookupIndices.has(index) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          </Button>
                      </Label>
                      <Input 
                        value={item.meaning} 
                        onChange={(e) => handleItemChange(index, 'meaning', e.target.value)}
                        placeholder="点击右上方按钮自动填充"
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
                    />
                  </div>
                </CardContent>
                <CardFooter className="bg-secondary/10 py-3 flex justify-end">
                  <Button 
                    size="sm" 
                    onClick={() => handleSaveItem(index)} 
                    disabled={savedIndices.has(index) || savingIndex === index || !item.term || !item.meaning}
                    variant={savedIndices.has(index) ? "outline" : "default"}
                  >
                    {savingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedIndices.has(index) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        已保存
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
