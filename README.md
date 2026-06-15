# XenoTask — Channel Service (Stub)

A **stubbed messaging channel provider** for [XenoTask](https://xeno-task.acadmate.in). It deliberately does **not** deliver real messages. Instead, it models the full lifecycle of a communication — accepting send requests, simulating a realistic delivery + engagement funnel, and calling back into the CRM asynchronously with what "happened" to each message.

This separation is intentional: it mirrors how a real external provider (Twilio, MSG91, etc.) actually behaves — an async ACK followed by webhook callbacks — and lets the CRM be tested against realistic volume, ordering, retries, and failures.

🔗 **Live App:** https://xeno-task.acadmate.in

### Related repositories
| Repo | Description |
|------|-------------|
| [xeno-crm-backend](https://github.com/Saumay-Goel/xeno-crm-backend) | Core API — segment engine, campaigns, queue, receipt handler |
| [xeno-crm-frontend](https://github.com/Saumay-Goel/xeno-crm-frontend) | Next.js app — chat-first campaign builder, dashboard, live funnel |
| [xeno-channel-service](https://github.com/Saumay-Goel/xeno-channel-service) | **This repo** — stubbed channel provider |

---

## Tech stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white)

- **Runtime / language:** Node.js + TypeScript (ESM)
- **Framework:** Express
- **Validation:** Zod
- **Infra:** Docker Compose on AWS EC2 (alongside the backend + Redis), GitHub Actions CI/CD → GHCR

It is intentionally lightweight — no database, no queue. It holds no state; it accepts, simulates, and calls back.

---

## How it works

```
CRM worker  ──POST /send──▶  Channel service
                                 │  202 Accepted (immediately)
                                 │
                                 ├─ simulateOutcome() decides the funnel
                                 │
                                 └─ scheduleCallback() fires each event after a delay
                                          │
                                          ▼
                              POST /api/receipts on the CRM
                              (x-callback-secret, retried with backoff)
```

1. **Accept** — the CRM's worker POSTs a batch of messages (`communicationId`, recipient, channel, message). The service validates the batch with Zod and immediately responds **202 Accepted** — it never blocks the caller.
2. **Simulate** — for each message, `simulateOutcome()` walks a weighted, conditional funnel.
3. **Call back** — each simulated event is scheduled (with a realistic delay) and POSTed back to the CRM's receipt endpoint, authenticated with a shared secret and retried on failure.

---

## The simulated funnel

`simulateOutcome()` rolls each stage **conditionally** — a stage only happens if the previous one did:

| Stage | Probability | Meaning |
|-------|-------------|---------|
| `failed` | ~8% | delivery fails outright; no further events |
| `delivered` | ~92% | message reaches the recipient |
| `opened` | ~65% *of delivered* | recipient opens it |
| `read` | ~80% *of opened* | recipient reads it |
| `clicked` | ~35% *of read* | recipient clicks |
| `converted` | ~20% *of clicked* | a conversion is attributed |

Each event is assigned an **increasing delay with jitter**, so callbacks arrive spread out over time — and can arrive out of order across different messages, which is exactly what the CRM's forward-only status logic is built to handle.

---

## Reliability: callbacks with retry

`callback.service.ts` posts each event to the CRM with:

- an **`x-callback-secret`** header so the CRM can verify the callback is genuinely from this service (the receipt endpoint is otherwise public),
- **up to 3 retries with increasing backoff** (500ms × attempt) if the CRM errors or is unreachable,
- graceful give-up-and-log after the final attempt — a failed callback never crashes the service.

This faithfully mirrors how real provider webhooks behave: asynchronous, authenticated, and retried.

---

## Project structure

```
xeno-channel-service/
├── src/
│   ├── config/
│   │   └── env.ts                  # CRM_RECEIPT_URL, CALLBACK_SECRET, PORT
│   ├── controllers/
│   │   └── send.controller.ts      # /send endpoint: validate → simulate → schedule, ACK 202
│   ├── services/
│   │   ├── simulate.service.ts     # weighted conditional funnel
│   │   └── callback.service.ts     # async, authenticated, retried callbacks
│   ├── routes/
│   └── index.ts
├── Dockerfile
├── .dockerignore
└── .github/workflows/deploy.yml    # CI/CD: build → GHCR → EC2
```


---

## Running locally

**Prerequisites:** Node 22+, pnpm 9. The CRM backend should be running so callbacks have somewhere to land.

```bash
pnpm install
cp .env.example .env
pnpm dev          # starts on PORT (default 4001)
```

### Environment variables
```
PORT=4001
CRM_RECEIPT_URL=http://localhost:4000/api/receipts
CALLBACK_SECRET=...     # MUST match the backend's CALLBACK_SECRET
```

> `CALLBACK_SECRET` must be identical to the backend's value — it's how the receipt callbacks are authenticated. It is unrelated to the backend's `JWT_SECRET`.

---

## Why a separate service?

The brief explicitly asks for the channel to be stubbed as a **separate service** with a callback-driven loop, because that's how delivery and engagement tracking actually work. Modeling it separately (rather than faking numbers inside the CRM) means the CRM is exercised against real async behavior: out-of-order events, retries, failures, and idempotent receipt handling. The cost is an extra deployable service — a deliberate, worthwhile tradeoff for an honest model.
