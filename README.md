# API Gateway + Rate Limiter

A production-ready API gateway built with Node.js and Express, featuring JWT authentication, Redis-based sliding window rate limiting, and a circuit breaker pattern with automatic recovery.

**Live dashboard:** https://your-dashboard.vercel.app  
**Gateway:** https://your-gateway.railway.app

---

## Architecture
Client
↓
API Gateway (Express) — auth → rate limiter → circuit breaker → proxy
↓                 ↓
Service A         Service B
(port 4001)      (port 4002)
↓
Admin Dashboard (Next.js) — reads PostgreSQL + Redis

---

## Features

- JWT authentication with bcrypt password hashing
- Per-user sliding window rate limiting via Redis sorted sets
- Per-plan quotas (FREE: 10 req/min, PRO: 100 req/min)
- Circuit breaker with CLOSED → OPEN → HALF-OPEN state machine
- Distributed trace IDs on every request via X-Trace-Id header
- Request logging to PostgreSQL with response time tracking
- Real-time admin dashboard showing traffic, errors, circuit state, and rate limit usage

---

## Rate limiting algorithm

Uses a sliding window implemented with Redis sorted sets:

1. Each request adds a timestamped entry via ZADD
2. Entries older than the window are removed via ZREMRANGEBYSCORE
3. ZCARD counts remaining entries in the window
4. If count exceeds the plan limit → 429 with Retry-After header

Unlike fixed windows, this prevents burst attacks at window boundaries.

---

## Circuit breaker states

| State | Behaviour |
|---|---|
| CLOSED | Normal operation, failures counted |
| OPEN | Downstream failing, all requests rejected with 503 |
| HALF-OPEN | Cooldown expired, one probe request allowed |

Threshold: 5 failures → OPEN. Cooldown: 10 seconds → HALF-OPEN.

---

## Load test results

FREE plan (10 req/min limit):
- Requests correctly blocked at threshold with 429
- Avg latency: 7671.77 ms, Max: 13256 ms
![alt text](./public/free.png)


PRO plan (100 req/min limit):
- Sustained 53 req/sec over 30 seconds without errors
- Avg latency: 8066.12 ms, Max: 15567 ms
![alt text](./public/pro.png)


---

## Local development

### Prerequisites
- Node.js v18+
- Neon account (PostgreSQL)
- Upstash account (Redis)

### Setup

```bash
git clone https://github.com/priyacha123/api-gateway
cd api-gateway
npm install
cp .env.example .env
# fill in DATABASE_URL, REDIS_URL, JWT_SECRET
npx prisma migrate dev
npm run dev
```

### Mock downstream services

Create two simple Express servers locally:

**service-a (port 4001)**
```bash
mkdir service-a && cd service-a
npm init -y && npm install express
```

```js
const express = require('express')
const app = express()
let failing = false
app.get('/data', (req, res) => failing
  ? res.status(500).json({ error: 'down' })
  : res.json({ service: 'A', traceId: req.headers['x-trace-id'] }))
app.get('/break', (req, res) => { failing = true; res.json({ message: 'now failing' }) })
app.get('/fix', (req, res) => { failing = false; res.json({ message: 'recovered' }) })
app.listen(4001)
```

**service-b (port 4002)** 
```bash
mkdir service-b && cd service-b
npm init -y && npm install express
```

```js
const express = require('express')
const app = express()
let failing = false
app.get('/data', (req, res) => failing
  ? res.status(500).json({ error: 'down' })
  : res.json({ service: 'B', traceId: req.headers['x-trace-id'] }))
app.get('/break', (req, res) => { failing = true; res.json({ message: 'now failing' }) })
app.get('/fix', (req, res) => { failing = false; res.json({ message: 'recovered' }) })
app.listen(4002)
```

### Environment variables

| Variable | Description |
|---|---|
| DATABASE_URL | Neon PostgreSQL connection string |
| REDIS_URL | Upstash Redis connection string |
| JWT_SECRET | Any long random string |
| PORT | Gateway port (default 3000) |

---

## Tech stack

Node.js · Express · PostgreSQL · Prisma · Redis · ioredis · jsonwebtoken · bcrypt · http-proxy-middleware

