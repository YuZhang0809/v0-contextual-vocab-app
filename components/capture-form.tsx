"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Sparkles, Save, RotateCcw } from "lucide-react"
import { useCards } from "@/hooks/use-cards"

export function CaptureForm() {
  const { addCard } = useCards()
  const [word, setWord] = useState("")
  const [sentence, setSentence] = useState("")
  const [meaning, setMeaning] = useState("")
  const [mnemonic, setMnemonic] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const handleAnalyze = async () => {
    if (!word.trim() || !sentence.trim()) return

    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), sentence: sentence.trim() }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const result = await response.json()
      setMeaning(result.meaning)
      setMnemonic(result.mnemonic)
      setAnalyzed(true)
    } catch (error) {
      console.error("Analysis error:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!word.trim() || !sentence.trim() || !meaning.trim()) return

    setIsSaving(true)
    try {
      await addCard({
        word: word.trim(),
        sentence: sentence.trim(),
        meaning_cn: meaning.trim(),
        mnemonics: mnemonic.trim(),
      })

      // Reset form
      setWord("")
      setSentence("")
      setMeaning("")
      setMnemonic("")
      setAnalyzed(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setWord("")
    setSentence("")
    setMeaning("")
    setMnemonic("")
    setAnalyzed(false)
  }

  const canAnalyze = word.trim() && sentence.trim() && !isAnalyzing
  const canSave = word.trim() && sentence.trim() && meaning.trim() && !isSaving

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          添加生词
        </CardTitle>
        <CardDescription>输入单词和原句，AI 将自动分析语境释义</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="word">单词 *</Label>
            <Input
              id="word"
              placeholder="e.g. ephemeral"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sentence">原句 *</Label>
            <Textarea
              id="sentence"
              placeholder="Paste the original sentence containing the word..."
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleAnalyze} disabled={!canAnalyze} variant="secondary" className="gap-2">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 分析
              </>
            )}
          </Button>
        </div>

        {(analyzed || meaning || mnemonic) && (
          <div className="space-y-4 rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="space-y-2">
              <Label htmlFor="meaning">语境释义 *</Label>
              <Input id="meaning" placeholder="中文释义" value={meaning} onChange={(e) => setMeaning(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mnemonic">助记提示</Label>
              <Input
                id="mnemonic"
                placeholder="词根分析或联想记忆"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={handleReset} disabled={!word && !sentence && !meaning && !mnemonic}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
          <Button onClick={handleSave} disabled={!canSave} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存至词库
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
