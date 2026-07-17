# ElevateAI — Full Application Audit & Fix Plan

Date: 2026-07-17
Scope: Next.js app (`D:\elevate-ai`) + Python FastAPI backend (`server/app.py`), all 27 API routes, middleware, shared lib code, and the live deployments (`elevate-ai-snowy.vercel.app` + `elevate-ai-flask.onrender.com`).

## How this was tested

- Full manual read-through of all 27 `app/api/**/route.ts` files and the shared `lib/` modules they depend on (`prisma.ts`, `redis.ts`, `ai.ts`, `rate-limit.ts`, `growth/getUserGrowthContext.ts`).
- Full read of `server/app.py` (intent detection, calendar/email tool payload construction, chat endpoint) plus `middleware.ts`, `prisma/schema.prisma`, Docker/CI files.
- Live verification: your Vercel deployment and Render FastAPI backend are both up. I pulled the live `/openapi.json` from Render and confirmed every field the Next.js side sends (`user_id`, `title`, `start_time`, etc.) matches what the Python backend actually requires — no schema drift there.
- Live hit on the public, unauthenticated `GET /api/landing/metrics` endpoint — returned real data (`{"totalUsers":4,...}`), confirming the DB connection and that route work end-to-end in production.
- What I could **not** do: run your local dev server or Prisma against the DB from this sandbox — the sandbox's network allowlist blocks `binaries.prisma.sh` (Prisma's Linux query-engine download) and general outbound HTTPS, so `next dev` / `prisma generate` couldn't run here. This is a limitation of my current environment, not of your app. Everything below was instead verified by reading the code paths directly and, where possible, hitting your live production endpoints.

---

## Bugs found (ordered by priority)

### P0 — Auth gap in `middleware.ts`

`middleware.ts` protects routes via a hardcoded list:

```
"/dashboard(.*)", "/resume(.*)", "/interview(.*)", "/ai-cover-letter(.*)",
"/onboarding(.*)", "/chatbot(.*)", "/academy(.*)"
```

Two problems:
1. `"/ai-cover-letter"` doesn't exist — the real route is `/coverLetter` (see `app/(main)/coverLetter/page.tsx`). So the cover letter page is **not protected by middleware at all**.
2. `/jobs`, `/portfolio`, `/profile`, `/settings` aren't in the list either.

Impact, checked per page:
- `/jobs` and `/profile` happen to have their own server-side `auth()` + `redirect("/sign-in")` guard in the page component, so they're fine in practice.
- `/coverLetter` has no guard of its own — it's a server component that calls `getCoverLetters()`, which throws `"Unauthorized"` when logged out. A signed-out visitor hits Next's generic error boundary instead of being redirected to sign-in.
- `/portfolio` and `/settings` are client components with no auth guard at all. A signed-out visitor gets the full page shell rendered, then the client-side data fetch 401s — no redirect, just a broken/empty page.

**Fix:** add `/jobs(.*)`, `/portfolio(.*)`, `/profile(.*)`, `/settings(.*)` to the matcher and correct `/ai-cover-letter(.*)` to `/coverLetter(.*)`.

### P1 — `/api/jobs` has no error handling (inconsistent with every other route)

`app/api/jobs/route.ts` — `GET`, `PATCH`, `DELETE` all call Prisma directly with no `try/catch`. Every other route in the app wraps its body in `try/catch` and returns a structured `{ error }` JSON response on failure. Here, any transient DB error (e.g. a Neon cold connection blip) surfaces as Next.js's generic unhandled-exception response instead of your app's normal error shape, which breaks the frontend's error handling for this one endpoint.

**Fix:** wrap the three handlers in the same try/catch pattern used everywhere else (`app/api/portfolio/route.ts` is a good template).

### P1 — `/api/study-companion/chat` crashes ungracefully on missing `message`

```ts
const { message, currentLessonId } = body;
if (!message.trim()) { ... }   // throws if message is undefined/non-string
```

If `message` is missing or not a string, `.trim()` throws a `TypeError`, which is caught by the outer `catch` and returned as a generic 500 `"Failed to get response"` instead of the clean `400 "Message is required"` every sibling route (`/api/chat`, `/api/ai-agent/chat`) returns for the same case.

**Fix:** `if (typeof message !== "string" || !message.trim())`.

### P2 — Minor string bug in `/api/actions/execute` (GET)

```ts
type: action.type.toLowerCase().replace("_", "")
```

`String.replace` with a plain string argument only replaces the **first** occurrence. `TRACK_JOB_APPLICATION` → `"trackjob_application"` instead of `"trackjobapplication"`. If any frontend code matches on this normalized string, multi-underscore action types silently fail to match.

**Fix:** `.replace(/_/g, "")` or `.replaceAll("_", "")`.

### P2 — Dead "no cloud key" fallback branches never trigger

`lib/ai.ts`'s `createOllamaClient()` always returns a constructed `OpenAI` client (it defaults `apiKey` to `"ollama"` and `baseURL` to `http://localhost:11434/v1` when env vars are absent) — it never returns `null`/`undefined`. But `interview-simulator/start`, `/next`, and `/finish` all guard with `if (!client)` expecting exactly that "no key configured" case, which can now never happen. It's not currently harmful — a bad/missing key just makes the real API call fail, which is caught by the surrounding `try/catch` and falls into the (working) `"fallback-cloud-error"` path instead — but the `"fallback-no-cloud-key"` code path is unreachable dead code that misrepresents what it's guarding against.

**Fix:** either check for actual key presence (`Boolean(process.env.OLLAMA_API_KEY)`) or delete the dead branch.

### P3 — Dead endpoints and an unfinished route

- `app/api/interview-simulator/room/route.ts` and `.../transcribe/route.ts` always return `410 Gone` and are not called from anywhere in the frontend (grepped `app/` and `components/` — zero references). Safe to delete; they're leftover from the pre-"browser voice" LiveKit implementation.
- `app/(main)/voicebot/` contains only a `_components` folder — there's no `page.tsx`, so `/voicebot` 404s. Nothing links to it. Looks like an abandoned/superseded feature (superseded by `/interview/simulator-live`).
- `server/microservices/services/{user-service,chat-orchestrator}` is a separate FastAPI microservice scaffold that is **not** what's actually deployed — the live Render OpenAPI schema only exposes routes from the monolithic `server/app.py`. Worth confirming whether this is an in-progress migration or dead code, since it's easy to mistake for the live backend when reading the repo.

**Fix:** delete the two dead routes and the empty `voicebot` folder if not planned for near-term use; clarify/remove the unused microservices scaffold.

---

## What's actually solid

Worth calling out since the request was to "test everything" — most of the app is in good shape:
- Every academy, career-planner, portfolio, and action-execution route validates auth (`Clerk auth()`), validates ownership (e.g. `attempt.userId !== user.id` IDOR checks in the simulation submit route), and sanitizes AI output before writing to the DB (score clamping, type-checking arrays/strings from LLM JSON) — this is above-average defensive coding for AI-generated content.
- `career-planner`, `ai-agent/chat`, and `study-companion` all degrade gracefully when the external Python backend or Ollama is slow/down, with proper `AbortSignal` timeouts and fallback responses (except the one `message.trim()` bug noted above).
- The live Render backend's OpenAPI schema matches the Next.js caller's payload shape for every cross-service call I checked (calendar events, email, job tracking, mentorship scheduling) — no schema drift between the two codebases.
- `/api/landing/metrics`, a public unauthenticated endpoint, works correctly against the live production DB right now.

---

## Fix plan (priority order)

1. Fix `middleware.ts` route matcher (5 min, highest impact — closes the auth-boundary gap).
2. Add try/catch to `app/api/jobs/route.ts` (10 min).
3. Fix the `message` type check in `app/api/study-companion/chat/route.ts` (2 min).
4. Fix the `.replace("_","")` bug in `app/api/actions/execute/route.ts` GET handler (2 min).
5. Remove or fix the dead `if (!client)` fallback checks in the three interview-simulator AI routes (15 min, cosmetic/correctness cleanup).
6. Delete dead `room`/`transcribe` interview-simulator routes and the empty `voicebot` folder, or confirm they're intentionally kept as placeholders (5 min + a decision).
7. Clarify status of `server/microservices/` — remove if abandoned, document if it's a live migration target (team decision, no code change needed today).

Items 1–4 are safe, isolated, low-risk changes I can make right now if you'd like — just say the word and I'll apply them.
