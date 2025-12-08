"use client"

import useSWR from "swr"
import type { UserTag } from "@/lib/types"
import { PRESET_TAGS } from "@/lib/types"

// 获取用户自定义标签
async function fetchUserTags(): Promise<UserTag[]> {
  const res = await fetch('/api/tags')
  if (!res.ok) {
    throw new Error('Failed to fetch tags')
  }
  const data = await res.json()
  return data.tags || []
}

export function useTags() {
  const {
    data: userTags,
    error,
    isLoading,
    mutate,
  } = useSWR<UserTag[]>("user-tags", fetchUserTags, {
    revalidateOnFocus: false,
    fallbackData: [],
  })

  // 合并预设标签和用户标签
  const allTags = [
    ...PRESET_TAGS.map(name => ({ name, isPreset: true as const })),
    ...(userTags || []).map(tag => ({ ...tag, isPreset: false as const })),
  ]

  /**
   * 创建新的自定义标签
   */
  const createTag = async (name: string, color?: string): Promise<UserTag> => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to create tag')
    }

    const data = await res.json()
    mutate()
    return data.tag
  }

  /**
   * 删除自定义标签
   */
  const deleteTag = async (tagId: string): Promise<void> => {
    const res = await fetch(`/api/tags?id=${tagId}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to delete tag')
    }

    mutate()
  }

  /**
   * 检查标签是否为预设标签
   */
  const isPresetTag = (tagName: string): boolean => {
    return PRESET_TAGS.includes(tagName as typeof PRESET_TAGS[number])
  }

  return {
    userTags: userTags || [],
    allTags,
    presetTags: PRESET_TAGS,
    isLoading,
    error,
    createTag,
    deleteTag,
    isPresetTag,
    refresh: mutate,
  }
}

