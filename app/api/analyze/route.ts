import { generateObject } from "ai"
import { z } from "zod"

const analysisSchema = z.object({
  meaning: z.string().describe("语境释义，不超过15个中文字"),
  mnemonic: z.string().describe("助记提示，词根或联想，不超过30字"),
})

export async function POST(req: Request) {
  const { word, sentence } = await req.json()

  if (!word || !sentence) {
    return Response.json({ error: "Word and sentence are required" }, { status: 400 })
  }

  try {
    const { object } = await generateObject({
      model: "openai/gpt-4o-mini",
      schema: analysisSchema,
      prompt: `你是一位英语学习助手。请根据以下语境分析单词含义。

单词: "${word}"
原句: "${sentence}"

要求:
1. meaning: 仅基于此语境给出中文释义，不超过15字
2. mnemonic: 给出助记提示（可以是词根分析、谐音联想或场景联想），不超过30字`,
      maxOutputTokens: 200,
    })

    return Response.json(object)
  } catch (error) {
    console.error("AI analysis error:", error)
    return Response.json({ error: "Failed to analyze word" }, { status: 500 })
  }
}
