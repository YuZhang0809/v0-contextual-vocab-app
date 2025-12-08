import { deepseek } from "@ai-sdk/deepseek"
import { generateObject } from "ai"
import { z } from "zod"

// 每批翻译的句子数量
const BATCH_SIZE = 20

// 翻译结果 Schema
const translationSchema = z.object({
  translations: z.array(z.string()).describe("Array of Chinese translations, one for each input sentence")
})

interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

interface TranslateRequest {
  segments: TranscriptSegment[]
  startIndex?: number  // 起始索引（用于按需翻译）
  endIndex?: number    // 结束索引（用于按需翻译）
  stream?: boolean     // 是否使用流式响应
}

// 上下文窗口大小（前后各取几个句子作为参考）
const CONTEXT_WINDOW = 2

// 翻译单个批次（带上下文）
async function translateBatch(
  batch: TranscriptSegment[],
  batchNumber: number,
  totalBatches: number,
  contextBefore: TranscriptSegment[] = [],
  contextAfter: TranscriptSegment[] = []
): Promise<string[]> {
  // 构建上下文提示
  const hasContext = contextBefore.length > 0 || contextAfter.length > 0
  
  let contextSection = ''
  if (hasContext) {
    contextSection = `
【上下文参考（仅供理解，无需翻译）】
${contextBefore.length > 0 ? `前文：${contextBefore.map(s => s.text).join(' ')}` : ''}
${contextAfter.length > 0 ? `后文：${contextAfter.map(s => s.text).join(' ')}` : ''}

注意：上下文仅帮助你理解句子的完整含义。例如：
- 如果某句以 "an immediate" 结尾，而后文是 "disappointment"，应翻译为"立刻感到失望"而非"立刻生效"
- 如果某句以 "I think we" 结尾，参考后文来理解完整意思
`
  }

  const prompt = `你是一位专业的英中翻译专家。请将以下英文字幕逐句翻译成简体中文。

要求：
1. 保持翻译自然流畅，符合中文表达习惯
2. 如遇俚语、习语，翻译其实际含义而非字面意思
3. 保持原文的语气和风格
4. 每句翻译独立成行，顺序与原文一一对应
5. 返回的翻译数量必须与输入句子数量完全相同（${batch.length}句）
6. **重要**：参考上下文理解不完整的句子，确保翻译连贯
${contextSection}
【需要翻译的字幕】
${batch.map((seg, idx) => `${idx + 1}. ${seg.text}`).join('\n')}

请返回 ${batch.length} 条翻译。`

  try {
    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: translationSchema,
      prompt: prompt,
      maxOutputTokens: 2000,
    })

    // 确保翻译数量与输入一致
    let translations = object.translations
    if (translations.length !== batch.length) {
      console.warn(`Batch ${batchNumber}/${totalBatches}: Expected ${batch.length} translations, got ${translations.length}`)
      while (translations.length < batch.length) {
        translations.push("[翻译缺失]")
      }
      translations = translations.slice(0, batch.length)
    }

    return translations
  } catch (error) {
    console.error(`Batch ${batchNumber}/${totalBatches} failed:`, error)
    return batch.map(() => "[翻译失败]")
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as TranslateRequest
    const { segments, startIndex = 0, endIndex, stream = false } = body

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return Response.json({ error: "Segments array is required" }, { status: 400 })
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Missing DEEPSEEK_API_KEY")
      return Response.json({ error: "Server configuration error: Missing API Key" }, { status: 500 })
    }

    // 计算实际翻译范围
    const actualEndIndex = endIndex !== undefined ? Math.min(endIndex, segments.length) : segments.length
    const segmentsToTranslate = segments.slice(startIndex, actualEndIndex)
    const totalBatches = Math.ceil(segmentsToTranslate.length / BATCH_SIZE)

    console.log(`Translating segments ${startIndex}-${actualEndIndex} (${segmentsToTranslate.length} segments) in ${totalBatches} batches, stream=${stream}`)

    // 流式响应模式
    if (stream) {
      const encoder = new TextEncoder()
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < segmentsToTranslate.length; i += BATCH_SIZE) {
              const batch = segmentsToTranslate.slice(i, i + BATCH_SIZE)
              const batchNumber = Math.floor(i / BATCH_SIZE) + 1
              const batchStartIndex = startIndex + i

              // 获取上下文（前后各 CONTEXT_WINDOW 个句子）
              const contextBefore = segmentsToTranslate.slice(
                Math.max(0, i - CONTEXT_WINDOW), 
                i
              )
              const contextAfter = segmentsToTranslate.slice(
                i + BATCH_SIZE, 
                Math.min(segmentsToTranslate.length, i + BATCH_SIZE + CONTEXT_WINDOW)
              )

              // 发送进度事件
              const progressEvent = {
                type: "progress",
                batch: batchNumber,
                totalBatches,
                startIndex: batchStartIndex,
                count: batch.length,
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`))

              // 翻译当前批次（带上下文）
              const translations = await translateBatch(batch, batchNumber, totalBatches, contextBefore, contextAfter)

              // 发送翻译结果
              const dataEvent = {
                type: "data",
                startIndex: batchStartIndex,
                translations,
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(dataEvent)}\n\n`))
            }

            // 发送完成事件
            const doneEvent = {
              type: "done",
              totalTranslated: segmentsToTranslate.length,
              range: { start: startIndex, end: actualEndIndex },
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`))
            controller.close()
          } catch (error) {
            console.error("Streaming error:", error)
            const errorEvent = {
              type: "error",
              message: error instanceof Error ? error.message : "Translation failed",
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    }

    // 非流式模式（兼容旧逻辑）
    const allTranslations: string[] = []
    
    for (let i = 0; i < segmentsToTranslate.length; i += BATCH_SIZE) {
      const batch = segmentsToTranslate.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      
      // 获取上下文
      const contextBefore = segmentsToTranslate.slice(
        Math.max(0, i - CONTEXT_WINDOW), 
        i
      )
      const contextAfter = segmentsToTranslate.slice(
        i + BATCH_SIZE, 
        Math.min(segmentsToTranslate.length, i + BATCH_SIZE + CONTEXT_WINDOW)
      )
      
      const translations = await translateBatch(batch, batchNumber, totalBatches, contextBefore, contextAfter)
      allTranslations.push(...translations)
    }

    console.log(`Translation complete: ${allTranslations.length} segments`)

    return Response.json({ 
      translations: allTranslations,
      count: allTranslations.length,
      range: { start: startIndex, end: actualEndIndex },
    })

  } catch (error) {
    console.error("Translation API error:", error)
    const errorDetails = error instanceof Error ? error.message : "Unknown error"
    return Response.json(
      { error: "Failed to translate", details: errorDetails },
      { status: 500 }
    )
  }
}
