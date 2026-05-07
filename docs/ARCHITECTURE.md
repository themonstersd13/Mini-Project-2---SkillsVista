# SWOT Coach Architecture

## Surfaces

1. Landing/Login/Onboarding: [/](../app/page.tsx)
2. SWOT Dashboard: [/dashboard](../app/dashboard/page.tsx)
3. Chat Coach: [/coach](../app/coach/page.tsx)

## Backend Modules

- API routes: [app/api](../app/api)
- Auth helpers: [lib/auth.ts](../lib/auth.ts)
- AI context builder: [lib/ai/context-builder.ts](../lib/ai/context-builder.ts)
- AI provider chain: [lib/ai/chat-provider.ts](../lib/ai/chat-provider.ts)
- AI signal extraction (fallback): [lib/ai/pipeline.ts](../lib/ai/pipeline.ts)
- Signal validator: [lib/ai/signal-validator.ts](../lib/ai/signal-validator.ts)
- Proactive engine: [lib/ai/proactive-engine.ts](../lib/ai/proactive-engine.ts)
- Response formatter: [lib/ai/response-formatter.ts](../lib/ai/response-formatter.ts)
- Controlled update service: [lib/server/swot-service.ts](../lib/server/swot-service.ts)
- Session management: [lib/server/session-service.ts](../lib/server/session-service.ts)
- Follow-up tracking: [lib/server/follow-up-service.ts](../lib/server/follow-up-service.ts)
- Read model: [lib/server/swot-read-model.ts](../lib/server/swot-read-model.ts)
- Audit logging: [lib/server/audit.ts](../lib/server/audit.ts)

## Memory Architecture

Three-tier memory system:

1. **Short-term memory** ([lib/memory/short-term.ts](../lib/memory/short-term.ts))
   - Recent messages from current session (last 10)
   - Mood trajectory (last 5 mood scores)
   - Conversation flow state

2. **Structured memory** ([lib/memory/structured-memory.ts](../lib/memory/structured-memory.ts))
   - Active SWOT items with confidence + evidence counts
   - Active goals with task completion %
   - Pending follow-ups
   - Recent signals (last 7 days)
   - User profile with streak info

3. **Semantic memory** ([lib/memory/semantic-memory.ts](../lib/memory/semantic-memory.ts))
   - Embeddings via Gemini text-embedding-004
   - In-memory cosine similarity search
   - Conversation summaries for long-term recall

All layers orchestrated by [lib/memory/memory-manager.ts](../lib/memory/memory-manager.ts).

Performance caching via [lib/memory/cache.ts](../lib/memory/cache.ts) (LRU with TTL).

## RAG Pipeline (1 blocking LLM call per message)

1. **Retrieve**: Context builder assembles full CoachContext from all memory layers (parallel DB queries, ~150ms)
2. **Augment**: Context serialized into structured system prompt sections
3. **Generate**: Single LLM call produces response + embedded signal extraction
4. **Validate**: Extracted signals pass through signal-validator rules
5. **Apply**: Only validated signals (score ≥ 0.72) mutate SWOT; uncertain signals become follow-ups
6. **Store**: Background embedding generation for future semantic search

## Provider Chain

Gemini → Groq → Ollama (Llama 3.1) → Rule-based fallback

Each provider has 8s timeout. Configuration via `CHAT_PROVIDER` env var.

- Gemini: [lib/ai/providers/gemini.ts](../lib/ai/providers/gemini.ts)
- Groq: [lib/ai/providers/groq.ts](../lib/ai/providers/groq.ts)
- Ollama: [lib/ai/providers/ollama.ts](../lib/ai/providers/ollama.ts)

## Data Layer

- Prisma schema: [prisma/schema.prisma](../prisma/schema.prisma)
- Seed script: [prisma/seed.ts](../prisma/seed.ts)

Models: User, UserProfile, Session, ChatMessage, SwotItem, SwotItemVersion, Evidence, Signal, Goal, Task, FollowUp, Habit, Skill, ConversationSummary, CheckIn, Notification, ContextEmbedding, AuditLog

## Signal Validation Rules

Before suggesting SWOT updates:
- **Recurrence**: Signal appeared 2+ times across different sessions
- **Meaningfulness**: Affects long-term growth, not daily mood noise
- **Evidence-backed**: Has concrete evidence, not just sentiment
- **History consistency**: Doesn't contradict established patterns
- **Threshold**: Composite score ≥ 0.72 to apply; 0.5-0.72 creates follow-up instead

## Session Model

- New session created after 4+ hour gap
- Past sessions are read-only / viewable
- User chats only in the latest session
- Session summaries stored for semantic memory

## Proactive Intelligence

Triggered hints (no LLM, DB queries only):
- Inactivity: 2+ days since last message
- Streak reinforcement: 3+ consecutive active days
- Missed tasks: tasks past due date
- Recurring patterns: same weakness 3+ signals
- Stalled goals: no progress in 7+ days
- Threat warnings: high-confidence active threats

## Security

- Passwords stored as bcrypt hashes.
- Stateless auth via signed JWT in HTTP-only cookie.
- Route protection enforced with server-side session validation.
