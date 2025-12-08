"use client"

import * as React from "react"
import { X, Plus, Check, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTags } from "@/hooks/use-tags"

interface TagSelectorProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  className?: string
  compact?: boolean  // 紧凑模式，用于卡片内
}

// 预设标签的颜色映射
const PRESET_TAG_COLORS: Record<string, string> = {
  "Business": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Academic": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "IT/Tech": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  "Medical": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Legal": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
}

export function TagSelector({
  selectedTags,
  onChange,
  disabled = false,
  className,
  compact = false,
}: TagSelectorProps) {
  const { allTags, createTag, isLoading } = useTags()
  const [isCreating, setIsCreating] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState("")
  const [createLoading, setCreateLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleToggleTag = (tagName: string) => {
    if (disabled) return
    
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter(t => t !== tagName))
    } else {
      onChange([...selectedTags, tagName])
    }
  }

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim()
    if (!trimmed) return

    // 检查是否已存在
    const exists = allTags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      // 如果已存在，直接选中
      if (!selectedTags.includes(trimmed)) {
        onChange([...selectedTags, trimmed])
      }
      setNewTagName("")
      setIsCreating(false)
      return
    }

    setCreateLoading(true)
    try {
      const newTag = await createTag(trimmed)
      // 自动选中新创建的标签
      onChange([...selectedTags, newTag.name])
      setNewTagName("")
      setIsCreating(false)
    } catch (error) {
      console.error("Failed to create tag:", error)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleCreateTag()
    } else if (e.key === "Escape") {
      setIsCreating(false)
      setNewTagName("")
    }
  }

  React.useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载标签...</span>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* 已选标签 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "pr-1 gap-1 cursor-pointer transition-all",
                PRESET_TAG_COLORS[tag] || "bg-secondary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && handleToggleTag(tag)}
            >
              {tag}
              {!disabled && <X className="h-3 w-3 hover:text-destructive" />}
            </Badge>
          ))}
        </div>
      )}

      {/* 标签选择区域 */}
      {!disabled && (
        <div className={cn("flex flex-wrap gap-1.5", compact && "text-xs")}>
          {/* 预设标签 */}
          {allTags
            .filter(t => !selectedTags.includes(t.name))
            .map(tag => (
              <Badge
                key={tag.name}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  tag.isPreset
                    ? PRESET_TAG_COLORS[tag.name] || "bg-secondary/30"
                    : "bg-muted/50 border-dashed",
                  compact && "text-xs py-0"
                )}
                onClick={() => handleToggleTag(tag.name)}
              >
                {tag.name}
              </Badge>
            ))}

          {/* 创建新标签 */}
          {isCreating ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newTagName.trim()) {
                    setIsCreating(false)
                  }
                }}
                placeholder="新标签名..."
                className={cn(
                  "h-6 w-24 text-xs px-2",
                  compact && "h-5 w-20"
                )}
                disabled={createLoading}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createLoading}
              >
                {createLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer border-dashed hover:bg-muted/50 transition-all",
                compact && "text-xs py-0"
              )}
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-3 w-3" />
              自定义
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// 简化版：仅用于显示标签（只读）
export function TagDisplay({
  tags,
  className,
}: {
  tags?: string[]
  className?: string
}) {
  if (!tags || tags.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            "text-xs py-0",
            PRESET_TAG_COLORS[tag] || "bg-secondary/50"
          )}
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}

