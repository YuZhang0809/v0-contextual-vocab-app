产品需求文档 (PRD) - ContextVocab
项目信息	内容
项目名称	ContextVocab (语境化生词记忆助手)
版本号	v1.0 (MVP)
文档状态	已确认 / 待开发
产品负责人	(您的名字)
目标用户	沉浸式英语学习者 / 开发者本人
平台	Desktop Web
更新日期	2025-12-08
1. 项目背景与目标 (Background & Goals) 
1.1 痛点分析
当前市面上的背单词应用（如百词斩、Anki）存在以下问题：
语境割裂：单词与用户实际遇到的场景（Podcast/YouTube）脱节。
释义冗余：词典列出太多义项，用户难以判断在特定句子中具体是哪个意思。
流程断档：听力软件无记忆功能，记忆软件无听力上下文。
1.2 产品定位
一款 Context-First (语境优先) 的个人词汇管理工具。它强制要求“单词”必须依附于“原句”存在，利用 AI 提取精准释义，并通过间隔重复算法（SRS）巩固记忆。
1.3 核心价值
精准输入：AI 自动分析单词在句子中的特定含义，过滤无效干扰。
科学复习：基于 SM2 算法的复习调度。
极速录入：专为桌面端优化的快捷键操作流程。
2. 核心流程图 (User Flow)
code
Mermaid
graph TD
    User((用户))
    
    subgraph 录入流程 [Capture Flow]
        A[发现生词] --> B[打开录入页]
        B --> C[输入单词 + 粘贴原句]
        C --> D{点击 AI 分析}
        D -->|调用 LLM| E[生成精准释义 + 助记]
        E --> F[人工校验/修改]
        F --> G[保存至词库]
    end

    subgraph 复习流程 [Review Flow]
        H[打开复习页] --> I{检查待复习队列}
        I -->|无| J[显示 Dashboard / 完成页]
        I -->|有| K[展示卡片正面]
        K --> L{模式判定}
        L -->|挖空模式| M[显示句子 + 单词挖空]
        L -->|闪卡模式| N[显示单词 + 完整句子]
        M & N --> O[思考 / 播放TTS]
        O --> P[按 Space 翻转背面]
        P --> Q[展示完整信息]
        Q --> R[选择掌握程度 1-4]
        R --> S[更新下次复习时间]
        S --> I
    end
3. 功能需求详情 (Functional Requirements)
3.1 模块一：语境化录入 (Contextual Capture)
优先级：P0 (Must Have)
ID	功能点	详细描述	验收标准
F-01	双字段输入	提供 Target Word 和 Source Sentence 两个输入框。	支持从剪贴板粘贴文本。
F-02	AI 语境解析	点击按钮调用 LLM API，根据句子上下文解释单词。	AI 需返回：1. 该语境下的中文释义；2. 助记提示。
F-03	人工校验	AI 生成的内容自动填入表单，但允许用户手动修改。	即使 AI 挂了，用户也能手动输入释义并保存。
F-04	卡片创建	将清洗后的数据写入数据库，初始状态设为 New。	数据库新增一条记录，包含创建时间戳。
3.2 模块二：复习系统 (Review Engine)
优先级：P0 (Must Have)
ID	功能点	详细描述	验收标准
F-05	每日队列	筛选 next_review_at <= current_time 的卡片。	队列按时间排序。
F-06	挖空模式 (Cloze)	正面：使用正则将句子中的 Target Word 替换为 ______。	忽略大小写匹配；若句子中多次出现，全部替换。
F-07	闪卡模式 (Flashcard)	正面：显示 Target Word 和 完整 Sentence。	遮挡中文释义。
F-08	TTS 发音	调用浏览器 window.speechSynthesis 朗读单词或句子。	必须有播放图标，支持快捷键触发。
F-09	评分反馈	底部提供 4 个按钮 (Again, Hard, Good, Easy)。	点击后，根据 SM2 算法计算出新的 interval 并保存。
3.3 模块三：仪表盘 (Dashboard)
优先级：P1 (Should Have)
ID	功能点	详细描述	验收标准
F-10	状态概览	显示今日待复习卡片数量。	数字准确。
F-11	词库列表	表格形式展示所有已录入单词。	支持简单的删除操作。
F-12	标签筛选	支持按标签过滤词库列表。	点击标签可筛选，支持清除筛选。

### 3.4 模块四：标签管理 (Tag Management)
优先级：P1 (Should Have)

| ID | 功能点 | 详细描述 | 验收标准 |
|---|---|---|---|
| F-13 | 预设标签 | 系统提供 Business/Academic/IT-Tech/Medical/Legal 五个预设标签。 | 预设标签始终可用，无法删除。 |
| F-14 | 自定义标签 | 用户可创建自己的标签，存储在 `user_tags` 表中。 | 标签名对每个用户唯一。 |
| F-15 | 语境标签 | 录入单词时可为每个语境选择一个或多个标签。 | 标签存储在 `context.tags` 数组中。 |
| F-16 | 标签显示 | 词库详情页显示每个语境的标签。 | 标签以彩色徽章形式展示。 |
4. 数据逻辑与算法 (Logic & Schema)
4.1 数据库 Schema (TypeScript 定义)

> **注意**: 这是概念模型。数据库的唯一事实源是 `docs/supabase-setup.sql`。

```typescript
export type CardStatus = "new" | "learning" | "review" | "graduated"

// 单个语境/上下文 - 每个语境拥有独立的 SRS 复习进度
export interface WordContext {
  sentence: string              // 例句
  meaning_cn: string            // 该语境下的中文释义
  sentence_translation?: string // 句子翻译
  source?: string               // 来源，如 "youtube:VIDEO_ID", "capture", "manual"
  tags?: string[]               // 标签数组（预设或自定义）
  added_at: number              // 添加时间戳
  
  // 独立 SRS 字段 - 每个语境单独追踪复习进度
  review_status: CardStatus
  interval: number              // 当前间隔（毫秒）
  ease_factor: number           // 难度系数，初始 2.5
  repetition: number            // 连续正确次数
  next_review_at: number        // 下次复习的时间戳 (Unix Timestamp)
}

export interface WordCard {
  id: string
  user_id: string               // 用户 ID (Supabase auth.users.id)
  word: string                  // 目标单词 (Stem/Lemma)
  contexts: WordContext[]       // 语境数组，每个语境有独立 SRS 进度
  mnemonics?: string            // 助记（可选，适用于整个单词）
  created_at: number
}
```
4.2 AI Prompt 策略 (Prompt Engineering)

> **注意**: 实际的 Prompt 实现位于 `app/api/analyze/route.ts`。

我们使用 DeepSeek V3 (via Vercel AI SDK) 进行语言分析。支持两种模式：

1.  **通用分析 (General Analysis)**
    *   输入：一个完整句子。
    *   输出：识别句子中的难词（Items），并提供释义和语法分析。
    *   用途：当用户输入一段话，想让 AI 自动挑选生词时。

2.  **聚焦查询 (Focus Mode)**
    *   输入：上下文句子 + 目标单词 (`focus_term`)。
    *   输出：解释该特定单词在当前语境下的含义。
    *   用途：用户指定要查询某个词时。

输出格式统一为 JSON 结构，确保前端解析稳定性。
4.3 记忆算法简述 (Simplified SM2)
当用户评分时，计算逻辑如下：
Again (1): Interval = 1 min, Repetition = 0.
Hard (2): Interval = Current_Interval * 1.2, Ease_Factor -= 0.15.
Good (3): Interval = Current_Interval * 2.5, Ease_Factor (不变).
Easy (4): Interval = Current_Interval * 3.5, Ease_Factor += 0.15.
注：Ease_Factor 最小不低于 1.3。
5. UI/UX 交互规范
5.1 界面布局
极简主义：去除顶部繁杂导航，聚焦内容区。
字体：使用系统无衬线字体 (Inter, San Francisco, Segoe UI)，保证阅读舒适度。
5.2 快捷键支持 (Keyboard Shortcuts)
为了满足“开发者用户”的高效需求，必须支持以下快捷键：
快捷键	作用范围	功能
Cmd/Ctrl + Enter	录入页	提交保存 (Save)
Space	复习页	翻转卡片 (Show Answer)
1	复习页	评分 Again
2	复习页	评分 Hard
3	复习页	评分 Good
4	复习页	评分 Easy
S	复习页	播放发音 (Speak)
6. 非功能需求 (Non-functional)
性能：
复习界面卡片翻转无动画延迟。
AI 响应时间若超过 3秒，需显示 Loading 骨架屏。
兼容性：
Chrome / Edge / Safari (Desktop)。
数据安全：
MVP阶段 API Key 可存储于本地 LocalStorage 或 .env (本地运行)。
数据库建议使用本地 First 的方案 (如 SQLite, IndexedDB via Dexie.js) 或 Supabase。