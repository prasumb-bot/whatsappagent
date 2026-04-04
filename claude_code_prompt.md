

```markdown
# WhatsApp AI Agent — SaaS Platform

## What This Is
A multi-tenant WhatsApp AI agent SaaS built with Next.js 16, Supabase, and OpenRouter. Businesses (doctors, clinics, coaching centers, jewellers, etc.) get their own AI-powered WhatsApp assistant that handles customer queries, books appointments, sends reminders, and collects reviews — all from a single deployment.

## Architecture
```
Customer WhatsApp → Meta Webhook → /api/webhook (POST)
  → Identify business by phone_number_id
  → Store message in Supabase
  → If mode=agent: fetch history → OpenRouter AI (with business-specific system prompt) → send reply via Meta Graph API → store reply
  → If mode=human: store only, owner replies from dashboard
  → Return 200 instantly (async processing via waitUntil)

Dashboard (page.tsx) → Supabase Realtime → live message updates
  → Business selector dropdown (multi-tenant)
  → Agent/Human mode toggle per conversation
  → Manual message sending

Admin Panel (/admin) → Full CRUD for businesses
  → Create, edit, delete businesses via UI
  → Each business gets its own AI persona, WhatsApp credentials, system prompt
```

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL + Realtime)
- **AI**: OpenRouter API (default: Claude Sonnet, configurable per business)
- **Messaging**: Meta WhatsApp Business Cloud API v22.0
- **Styling**: Tailwind CSS 4
- **Deployment**: Vercel (uses waitUntil for async webhook processing)
- **Auth**: Token-based (Bearer token on all dashboard API routes)

## Project Structure
```
src/
├── app/
│   ├── page.tsx                          # Dashboard UI (client component)
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Tailwind imports
│   ├── admin/
│   │   └── page.tsx                      # Admin panel (business CRUD)
│   └── api/
│       ├── webhook/route.ts              # Meta webhook (GET=verify, POST=receive messages)
│       ├── businesses/
│       │   ├── route.ts                  # GET=list businesses, POST=create business
│       │   └── [id]/route.ts             # GET=detail, PUT=update, DELETE=remove
│       └── conversations/
│           ├── route.ts                  # GET=list conversations (with RPC, filterable by business_id)
│           └── [id]/
│               ├── route.ts             # PATCH=toggle agent/human mode
│               ├── messages/route.ts    # GET=list messages for conversation
│               └── send/route.ts        # POST=send manual message from dashboard
├── lib/
│   ├── ai.ts                            # OpenRouter AI call (dynamic system prompt)
│   ├── auth.ts                          # Token-based auth (Bearer header or ?token= query)
│   ├── rate-limiter.ts                  # In-memory rate limiter (5 msgs/phone/min)
│   ├── supabase.ts                      # Supabase client singleton (service role key)
│   ├── types.ts                         # TypeScript interfaces (Business, Conversation, Message)
│   └── whatsapp.ts                      # Meta Graph API send (per-business credentials)
supabase-schema.sql                       # Full DB schema (tables, indexes, RPC function, realtime)
.env.example                              # Environment variable template
```

## Database Schema (Supabase)
```
businesses
  ├── id (uuid, PK)
  ├── name (text)
  ├── phone_number_id (text)          — Meta WhatsApp phone number ID
  ├── access_token (text)             — Meta access token (per business)
  ├── system_prompt (text)            — AI personality/instructions for this business
  ├── webhook_verify_token (text)     — webhook verification string
  └── created_at (timestamptz)

conversations
  ├── id (uuid, PK)
  ├── phone (text)                    — customer's WhatsApp number
  ├── name (text, nullable)           — customer's WhatsApp profile name
  ├── mode ('agent' | 'human')        — who responds: AI or dashboard user
  ├── business_id (uuid, FK → businesses) — which business owns this convo
  ├── updated_at (timestamptz)
  ├── created_at (timestamptz)
  └── UNIQUE(phone, business_id)      — one convo per customer per business

messages
  ├── id (uuid, PK)
  ├── conversation_id (uuid, FK → conversations, CASCADE)
  ├── role ('user' | 'assistant')
  ├── content (text)
  ├── whatsapp_msg_id (text, UNIQUE)  — deduplication
  └── created_at (timestamptz)

RPC: get_conversations_with_last_message(p_business_id uuid DEFAULT null)
  — Returns conversations with last_message column via subquery
  — Filters by business_id if provided
  — Ordered by updated_at DESC
```

## Key Design Decisions
1. **Async webhook processing**: POST handler returns 200 immediately, heavy work (AI call, WhatsApp send, DB writes) runs via `waitUntil()` to prevent Meta timeout/retries.
2. **Multi-tenant via businesses table**: Each business has its own phone_number_id, access_token, and system_prompt. Webhook identifies business by matching `value.metadata.phone_number_id`. Zero code changes per new client.
3. **Rate limiting**: In-memory Map, 5 messages per phone per minute, cleanup every 5 min. Prevents AI cost abuse.
4. **Deduplication**: `whatsapp_msg_id UNIQUE` constraint + `23505` error code check prevents processing retried webhooks twice.
5. **Agent/Human toggle**: Per-conversation mode. When `human`, messages are stored but AI does not reply — owner responds from dashboard.
6. **Single RPC for conversation list**: Avoids N+1 queries. One SQL call returns all conversations with their last message.
7. **Non-text message handling**: Images, audio, location etc. get a polite text reply asking customer to type instead.
8. **Auth**: Simple Bearer token on all dashboard/API routes. Webhook route is unprotected (Meta needs open access).

## Environment Variables
```
WHATSAPP_ACCESS_TOKEN        — fallback Meta token (used if no business match)
WHATSAPP_PHONE_NUMBER_ID     — fallback phone number ID
WHATSAPP_VERIFY_TOKEN        — fallback webhook verify token
OPENROUTER_API_KEY           — OpenRouter API key
AI_MODEL                     — model string (default: anthropic/claude-sonnet-4-20250514)
NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon key (frontend realtime)
SUPABASE_SERVICE_ROLE_KEY    — Supabase service role key (backend)
DASHBOARD_TOKEN              — auth token for API routes
NEXT_PUBLIC_DASHBOARD_TOKEN  — same token exposed to frontend
PORT                         — server port (default 3000)
NEXT_PUBLIC_APP_URL          — public URL
```

## Coding Rules
- Use TypeScript strict mode. No `any` unless unavoidable (mark with eslint-disable comment).
- All API routes must check `isAuthenticated()` EXCEPT `/api/webhook`.
- Never block the webhook POST handler — all heavy work goes through `waitUntil()`.
- Database queries use the `supabase` singleton from `@/lib/supabase`.
- WhatsApp sends must use per-business credentials when available, fall back to env vars.
- AI calls must pass the business-specific `system_prompt`, fall back to DEFAULT_SYSTEM_PROMPT.
- Rate limit check must happen BEFORE any DB writes or AI calls in processMessage().
- Frontend fetches must include `Authorization: Bearer ${NEXT_PUBLIC_DASHBOARD_TOKEN}` header.
- Supabase Realtime subscriptions handle live message updates — no polling.

## What's Built
- [x] Multi-tenant webhook (identifies business by phone_number_id)
- [x] Async processing (waitUntil, instant 200 to Meta)
- [x] Rate limiting (5 msgs/phone/min)
- [x] Message deduplication (whatsapp_msg_id UNIQUE)
- [x] Agent/Human mode toggle
- [x] Conversation history context (last 20 messages to AI)
- [x] Dynamic system prompts per business
- [x] Per-business WhatsApp credentials
- [x] Non-text message fallback reply
- [x] Dashboard with business selector
- [x] Realtime message updates
- [x] Token-based auth on all API routes
- [x] Business management API (full CRUD)
- [x] Optimized conversation list (single RPC query)
- [x] Clean .env.example (placeholder values only)
- [x] Admin panel UI (/admin — create, edit, delete businesses)

## What Needs Building Next (Priority Order)
- [ ] Appointment booking system (extract date/time from AI, store in appointments table, integrate Cal.com or Google Calendar)
- [ ] Fee reminder cron job (Vercel Cron → query due fees → send WhatsApp template messages via Gupshup/AiSensy)
- [ ] Google Review collector (post-service trigger → send review request → follow-up if no review in 3 days)
- [ ] Structured data extraction (second AI call to extract patient_name, intent, preferred_date into structured fields)
- [ ] Conversation search/filter in dashboard
- [ ] Typing indicator + read receipts (Meta mark_as_read API)
- [ ] Conversation memory summarization (summarize older messages to stay within token limits)
- [ ] Media message support (image/audio/document handling)
- [ ] Supabase Auth or NextAuth (replace token-based auth for production)
- [ ] Analytics dashboard (messages/day, response time, AI vs human ratio per business)
- [ ] Multi-language auto-detection (detect Bangla/Hindi/English, respond in same language)
- [ ] Template message support (for outbound campaigns, requires Meta-approved templates)

## How to Add a New Business
Option 1 — Use the Admin Panel at `/admin` (recommended)
Option 2 — POST to `/api/businesses` with auth header:
```json
{
  "name": "Dr. Roy Dental Clinic",
  "phone_number_id": "1234567890",
  "access_token": "EAAK...",
  "system_prompt": "You are the AI assistant for Dr. Roy Dental Clinic, Midnapore. Hours: Mon-Sat 10am-8pm. Services: cleaning, filling, root canal. Speak Bangla or Hindi. Never diagnose. Emergencies: call +91-9876543210.",
  "webhook_verify_token": "dr-roy-secret"
}
```
