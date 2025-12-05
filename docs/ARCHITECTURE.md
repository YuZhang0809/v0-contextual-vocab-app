# System Architecture & Tech Spec

## 1. System Overview

ContextVocab is a "Context-First" vocabulary learning application. Unlike traditional flashcards that isolate words, we strictly bind words to their original context (sentences).

### Data Flow
1.  **Capture**: User inputs text (Sentence or Word) -> Next.js API (`/api/analyze`) -> DeepSeek LLM -> Structured JSON Response.
2.  **Storage**: User confirms data -> Server Action -> Supabase (`word_cards` table with `contexts` JSONB).
3.  **Review**: Client fetches due cards -> Supabase Query (JSONB filtering) -> User reviews -> SRS Algorithm updates `contexts` field -> Save back to DB.

## 2. Directory Structure (Key Paths)

- `app/api/analyze/`: The AI Logic Core. Handles Prompt Engineering and LLM interaction.
- `lib/types.ts`: **Type SSOT**. All shared TypeScript interfaces.
- `docs/supabase-setup.sql`: **Database SSOT**. The source of truth for DB Schema.
- `components/vocabulary-list.tsx`: Main dashboard view.
- `components/review-session.tsx`: The review game loop implementation.

## 3. AI Pipeline (DeepSeek Integration)

We use the Vercel AI SDK (`ai` package) with the DeepSeek provider.

### API Endpoint: `POST /api/analyze`

#### Request
```json
{
  "text": "The selection committee established strict criteria.",
  "focus_term": "criteria" // Optional. If present, triggers Focus Mode.
}
```

#### Logic Modes
1.  **General Analysis** (when `focus_term` is empty):
    - Analyzes the sentence.
    - Extracts potential learning items (lemmas).
    - Provides grammar/nuance analysis.
2.  **Assistive/Focus Mode** (when `focus_term` is present):
    - Focuses exclusively on explaining `focus_term`.
    - If `text` context is provided, explains meaning IN CONTEXT.
    - If `text` is missing, generates a new example sentence.

#### Response Schema
```typescript
interface AnalysisResponse {
  is_sentence: boolean;
  sentence_translation?: string; // Full sentence translation
  sentence_analysis?: {
    grammar?: string;
    nuance?: string;
    cultural_background?: string;
  } | null;
  items: Array<{
    term: string;             // Lemma (e.g., "criterion")
    context_segment: string;  // Actual text (e.g., "criteria")
    meaning: string;          // Concise Chinese meaning
    example_sentence: string; // The context sentence
    example_sentence_translation: string; // Translation of the example
  }>;
}
```

## 4. Database Architecture (v3 Context-Level SRS)

We use a JSONB-heavy approach to allow a single word ("run") to have multiple contexts ("run a business" vs "run fast"), each with its own memory progress.

### Table: `word_cards`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | Foreign Key to `auth.users` |
| `word` | TEXT | The normalized word stem (lemma) |
| `mnemonics` | TEXT | Global mnemonics for the word |
| `contexts` | JSONB | **CORE FIELD**. Array of `WordContext` objects. |

### JSONB Structure (`contexts` array)
Each object in the array represents a learning context:

```json
{
  "sentence": "I need to run a test.",
  "meaning_cn": "运行 (测试)",
  "review_status": "learning", // SRS State
  "interval": 0,                 // SRS Interval (ms)
  "ease_factor": 2.5,            // SRS Ease
  "next_review_at": 1701936000000 // Sorting Key for Review Queue
}
```

## 5. Security & RLS
- Row Level Security is ENABLED.
- Users can only SELECT, INSERT, UPDATE, DELETE rows where `user_id == auth.uid()`.

