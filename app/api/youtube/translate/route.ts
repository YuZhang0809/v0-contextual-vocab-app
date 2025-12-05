import { deepseek } from "@ai-sdk/deepseek"
import { generateObject } from "ai"
import { z } from "zod"

// 每批翻译的句子数量
const BATCH_SIZE = 25

// 翻译结果 Schema
const translationSchema = z.object({
  translations: z.array(z.string()).describe("Array of Chinese translations, one for each input sentence")
})

interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

export async function POST(req: Request) {
  try {
    const { segments } = await req.json() as { segments: TranscriptSegment[] }

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return Response.json({ error: "Segments array is required" }, { status: 400 })
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Missing DEEPSEEK_API_KEY")
      return Response.json({ error: "Server configuration error: Missing API Key" }, { status: 500 })
    }

    console.log(`Translating ${segments.length} segments in batches of ${BATCH_SIZE}`)

    // 分批翻译
    const allTranslations: string[] = []
    
    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch = segments.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(segments.length / BATCH_SIZE)
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}`)

      const prompt = `你是一位专业的英中翻译专家。请将以下英文字幕逐句翻译成简体中文。

要求：
1. 保持翻译自然流畅，符合中文表达习惯
2. 如遇俚语、习语，翻译其实际含义而非字面意思
3. 保持原文的语气和风格
4. 每句翻译独立成行，顺序与原文一一对应
5. 返回的翻译数量必须与输入句子数量完全相同（${batch.length}句）

英文字幕：
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
        if (object.translations.length !== batch.length) {
          console.warn(`Batch ${batchNumber}: Expected ${batch.length} translations, got ${object.translations.length}`)
          // 填充或截断以匹配长度
          while (object.translations.length < batch.length) {
            object.translations.push("[翻译缺失]")
          }
          object.translations = object.translations.slice(0, batch.length)
        }

        allTranslations.push(...object.translations)
      } catch (batchError) {
        console.error(`Batch ${batchNumber} failed:`, batchError)
        // 失败的批次用占位符
        for (let j = 0; j < batch.length; j++) {
          allTranslations.push("[翻译失败]")
        }
      }
    }

    console.log(`Translation complete: ${allTranslations.length} segments`)

    return Response.json({ 
      translations: allTranslations,
      count: allTranslations.length 
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

