# WhatsApp AI Agent SaaS

A multi-tenant WhatsApp AI agent platform. Businesses get their own AI-powered WhatsApp assistant that handles customer queries, books appointments, and manages conversations — all from a single deployment with a real-time dashboard.

Built for selling AI automation to local businesses (doctors, clinics, coaching centers, jewellers, brokers) in India and beyond.

## Features

- **Multi-Tenant** — onboard unlimited businesses, each with its own WhatsApp number, AI personality, and system prompt
- **AI-Powered Replies** — auto-responds to customer messages using Claude, GPT, Gemini, or any OpenRouter model
- **Agent/Human Toggle** — switch any conversation between AI mode and manual mode instantly
- **Real-Time Dashboard** — see messages appear live via Supabase Realtime, no page refresh needed
- **Admin Panel** — create, edit, and delete businesses from a clean UI at `/admin`
- **Async Webhook** — returns 200 to Meta instantly, processes messages in the background (no timeouts)
- **Rate Limiting** — protects AI costs with per-phone-number throttling (5 msgs/min)
- **Message Deduplication** — handles Meta webhook retries without double-processing
- **Non-Text Handling** — gracefully responds to images, audio, and other media with a text fallback
- **Auth Protected** — all dashboard and API routes secured with Bearer token authentication

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + Realtime) |
| AI | OpenRouter API (Claude, GPT, Gemini, etc.) |
| Messaging | Meta WhatsApp Business Cloud API v22.0 |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Kh3rwa1/Whatsapp-Agent.git
cd Whatsapp-Agent
npm install
```

### 2. Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Copy the entire contents of `supabase-schema.sql` and run it
4. Copy your project URL, anon key, and service role key from **Settings → API**

### 3. Set Up Meta WhatsApp

1. Create a Meta Business App at [developers.facebook.com](https://developers.facebook.com)
2. Add the **WhatsApp** product to your app
3. Go to **WhatsApp → API Setup**
4. Copy your **Phone Number ID** and generate a **Permanent Access Token** via System Users

### 4. Set Up OpenRouter

1. Get an API key at [openrouter.ai](https://openrouter.ai)
2. Add credits ($5 is enough to start)

### 5. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your values:

```
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose
OPENROUTER_API_KEY=your_openrouter_key
AI_MODEL=anthropic/claude-sonnet-4-20250514
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DASHBOARD_TOKEN=pick-a-long-secret-string
NEXT_PUBLIC_DASHBOARD_TOKEN=pick-a-long-secret-string
```

### 6. Run Locally

```bash
npm run dev
```

Dashboard: [http://localhost:3000](http://localhost:3000)
Admin Panel: [http://localhost:3000/admin](http://localhost:3000/admin)

### 7. Expose Webhook (for local testing)

```bash
npx ngrok http 3000
```

Copy the ngrok URL and configure it in Meta:

1. Go to **Meta App → WhatsApp → Configuration**
2. Set webhook URL to `https://your-ngrok-url.ngrok.io/api/webhook`
3. Set verify token to the same value as `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to the **messages** field

### 8. Deploy to Vercel

```bash
vercel
```

Or push to GitHub and import the repo on [vercel.com](https://vercel.com). Set all environment variables in the Vercel dashboard. Update the Meta webhook URL to your Vercel domain.

## How It Works

```
Customer sends WhatsApp message
  → Meta delivers to /api/webhook
  → Webhook returns 200 instantly
  → Background: identify business by phone_number_id
  → Store message in Supabase
  → Check rate limit (5 msgs/phone/min)
  → Check conversation mode (agent or human)
  → If agent: load last 20 messages → send to AI with business system prompt → send reply via WhatsApp → store reply
  → If human: store only, owner replies from dashboard
  → Dashboard updates in real-time via Supabase Realtime
```

## Adding a New Business

**Option 1 — Admin Panel (recommended)**

Go to `/admin` → click "Add Business" → fill in the form → done.

**Option 2 — API**

```bash
curl -X POST https://your-domain.com/api/businesses \
  -H "Authorization: Bearer your-dashboard-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Roy Dental Clinic",
    "phone_number_id": "1234567890",
    "access_token": "EAAK...",
    "system_prompt": "You are the AI assistant for Dr. Roy Dental Clinic, Midnapore. Hours: Mon-Sat 10am-8pm. Speak Bangla or Hindi. Never diagnose.",
    "webhook_verify_token": "dr-roy-secret"
  }'
```

No code changes. No redeployment. The webhook automatically routes messages to the correct business.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Chat dashboard
│   ├── admin/page.tsx                    # Business admin panel
│   └── api/
│       ├── webhook/route.ts              # Meta webhook handler
│       ├── businesses/
│       │   ├── route.ts                  # List + create businesses
│       │   └── [id]/route.ts             # Get + update + delete business
│       └── conversations/
│           ├── route.ts                  # List conversations
│           └── [id]/
│               ├── route.ts             # Toggle agent/human mode
│               ├── messages/route.ts    # List messages
│               └── send/route.ts        # Send manual message
├── lib/
│   ├── ai.ts                            # AI integration (OpenRouter)
│   ├── auth.ts                          # Token authentication
│   ├── rate-limiter.ts                  # Rate limiting
│   ├── supabase.ts                      # Database client
│   ├── types.ts                         # TypeScript interfaces
│   └── whatsapp.ts                      # WhatsApp API client
supabase-schema.sql                       # Database schema (run once)
```

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/webhook` | No | Meta webhook verification |
| POST | `/api/webhook` | No | Receive WhatsApp messages |
| GET | `/api/businesses` | Yes | List all businesses |
| POST | `/api/businesses` | Yes | Create a business |
| GET | `/api/businesses/[id]` | Yes | Get business details |
| PUT | `/api/businesses/[id]` | Yes | Update a business |
| DELETE | `/api/businesses/[id]` | Yes | Delete a business |
| GET | `/api/conversations` | Yes | List conversations (filterable by business_id) |
| PATCH | `/api/conversations/[id]` | Yes | Toggle agent/human mode |
| GET | `/api/conversations/[id]/messages` | Yes | Get conversation messages |
| POST | `/api/conversations/[id]/send` | Yes | Send message from dashboard |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Yes | Fallback Meta access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Fallback phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Webhook verification string |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `AI_MODEL` | No | Model string (default: `anthropic/claude-sonnet-4-20250514`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `DASHBOARD_TOKEN` | Yes | Auth token for API routes |
| `NEXT_PUBLIC_DASHBOARD_TOKEN` | Yes | Same token for frontend |

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook verification fails | Check `WHATSAPP_VERIFY_TOKEN` matches Meta config |
| No AI reply | Check `OPENROUTER_API_KEY` and model credits |
| Dashboard shows empty | Check `DASHBOARD_TOKEN` matches `NEXT_PUBLIC_DASHBOARD_TOKEN` |
| Duplicate messages | Normal — deduplication handles this via `whatsapp_msg_id UNIQUE` |
| Messages not appearing live | Ensure Supabase Realtime is enabled (run the schema SQL) |
| Rate limited messages | Increase limit in `rate-limiter.ts` (default: 5/min/phone) |
| Non-text messages ignored | By design — sends a polite "type your message" reply |

## Pricing Model (When Selling to Businesses)

| Plan | Price | Includes |
|---|---|---|
| Basic | ₹3,000/mo | WhatsApp AI bot + reminders |
| Pro | ₹8,000/mo | Basic + CRM + review collection + 8 AI videos |
| Premium | ₹15,000/mo | All features + 30 AI videos + analytics |
| Setup Fee | ₹5,000-₹10,000 | One-time onboarding |

Your cost per client: ₹200-500/mo (AI API + WhatsApp fees). Margins: 85-95%.

## Roadmap

- [ ] Appointment booking (Cal.com / Google Calendar integration)
- [ ] Fee reminder cron jobs (Vercel Cron + WhatsApp template messages)
- [ ] Google Review collector
- [ ] Structured data extraction (patient name, intent, date)
- [ ] Conversation search and filters
- [ ] Typing indicators and read receipts
- [ ] Media message support (images, audio, documents)
- [ ] Analytics dashboard
- [ ] Multi-language auto-detection (Bangla, Hindi, English)
- [ ] Template message support for outbound campaigns

## License

MIT

## Author

Built by [@Kh3rwa1](https://github.com/Kh3rwa1)
```
