# ReachInbox Email Scheduler

A production-grade, distributed email scheduling system built for the **ReachInbox Hiring Assignment**. The application allows users to compose email campaigns, upload recipient lists (via CSV or single recipient entry), configure execution start times, enforce minimum delays between successive emails, and respect strict hourly rate limits.

The system is built on an event-driven architecture using **Node.js, Express, TypeScript, BullMQ, and Redis** for asynchronous job scheduling and worker queue management, backed by **PostgreSQL (via Prisma ORM)** for relational persistence, **Elasticsearch** for search indexing, **Ethereal SMTP** for safe email testing, and a responsive **React (Vite + Tailwind CSS)** dashboard with **Google OAuth 2.0** and **Slack OAuth** integrations.

Docker Compose is utilized to orchestrate the datastores (PostgreSQL, Redis, Elasticsearch), while worker processes run independently with configurable concurrency to simulate realistic multi-worker background job processing.

---

# Features

## Backend
| Feature | Implementation Details | Status |
|---|---|---|
| **Email Scheduling API** | Express REST endpoints (`/api/emails/schedule`) validate payloads using Zod and persist campaign and email records. | Implemented |
| **BullMQ Delayed Jobs** | BullMQ `emailQueue` computes precise milliseconds delay from start time and stagger offset for each recipient. | Implemented |
| **Redis-Backed Queue** | Redis 7 stores delayed BullMQ job state, hashes, and sorted sets with AOF persistence enabled. | Implemented |
| **PostgreSQL Persistence** | PostgreSQL 15 stores users, senders, campaigns, individual email statuses, and Slack connections via Prisma. | Implemented |
| **Worker Concurrency** | Dedicated BullMQ worker (`src/workers/index.ts`) supports concurrent execution configured via `WORKER_CONCURRENCY` (default: 3). | Implemented |
| **Minimum Delay Between Emails** | Dynamic offset calculation (`startTime + index * delayMs`) staggers individual recipient delivery. | Implemented |
| **Hourly Email Rate Limiting** | Redis atomic counter tracks sent emails per sender in fixed 1-hour time windows (`YYYY-MM-DDTHH`). | Implemented |
| **Redis-Backed Rate-Limit State** | Atomic `INCR` and `EXPIRE` operations prevent race conditions across concurrent workers. | Implemented |
| **Rescheduling on Limit Hit** | When the hourly limit is exceeded, jobs are delayed to the start of the next hour window via `getDelayForNextHour()` and `job.changeDelay()`. | Implemented |
| **Multiple Senders** | Multi-sender relational schema (`Sender` model) with per-sender rate limiting and campaign association. | Implemented |
| **Idempotency & Duplicate Protection** | Unique `idempotencyKey` per email record, BullMQ job deduplication via `jobId`, and pre-send status verification. | Implemented |
| **Ethereal SMTP Sending** | Nodemailer integration supporting automatic test account provisioning or explicit credentials with web preview URLs. | Implemented |
| **Elasticsearch Indexing** | Successfully sent emails are indexed into the `emails` index in Elasticsearch. | Implemented |
| **Elasticsearch Search Functionality** | `searchEmails()` service method is implemented; search API endpoint is not yet mounted to Express routes. | Partial |
| **Bull Board Dashboard** | Real-time queue visualizer mounted at `/admin/queues` via `@bull-board/express`. | Implemented |
| **Restart Persistence** | BullMQ delayed jobs and PostgreSQL state survive complete backend/worker process termination. | Implemented |
| **Slack OAuth 2.0** | Full OAuth flow storing team access tokens in the `SlackConnection` table. | Implemented |
| **Slack Rate-Limit Alert** | Automated real-time alerts posted to Slack when a sender hits the hourly limit, deduplicated per hour. | Implemented |

### Rate Limiting Mechanism
- **Configured Limit**: Configured per campaign via the compose modal (`hourlyLimit` field) or falling back to the global `MAX_EMAILS_PER_HOUR` environment variable (default: `100`).
- **Storage**: Stored in Redis under the key `rate_limit:${senderId}:${currentHour}`.
- **Window Calculation**: `new Date().toISOString().slice(0, 13)` produces a fixed hourly key format (e.g., `2026-09-30T20`).
- **Limit Exceeded Action**: If the incremented counter exceeds `hourlyLimit`, the worker calculates milliseconds remaining until the top of the next hour using `getDelayForNextHour()`, reschedules the BullMQ job, and raises a rate limit exception to delay execution.
- **Multi-Worker Safety**: Uses Redis atomic `INCR` so multiple worker threads or processes cannot exceed the limit under race conditions.
- **Notification Deduplication**: A separate Redis key `slack_notification:${senderId}:${currentHour}` with a 1-hour TTL ensures only **one** Slack alert is triggered per sender per hour window.

### Concurrency Mechanism
- **Configuration**: Worker concurrency is initialized with `env.WORKER_CONCURRENCY` (defaults to `3`).
- **Safety**: BullMQ locks jobs using Redis lock tokens during processing. Concurrent worker threads pick distinct jobs from the queue without double-processing.

## Frontend
| Feature | Implementation Details | Status |
|---|---|---|
| **Google OAuth Login** | Dedicated login page with "Login with Google" button routing through backend Passport strategy. | Implemented |
| **User Profile Display** | Header displays user avatar, display name, and email address retrieved from `/api/auth/me`. | Implemented |
| **Logout** | Session destruction endpoint `/api/auth/logout` with automatic redirection to `/login`. | Implemented |
| **Dashboard Layout** | Two-column responsive interface matching the provided Figma specifications. | Implemented |
| **Scheduled Emails Tab** | Displays queued emails with recipient, subject, preview body snippet, scheduled time, and status badge. | Implemented |
| **Sent Emails Tab** | Displays sent and failed emails with execution timestamps and status badges. | Implemented |
| **Compose Modal** | Floating modal with recipient toggle, sender selector, schedule inputs, and rich reply box. | Implemented |
| **Single Recipient Mode** | Direct email input field with RFC regex validation. | Implemented |
| **CSV / Text Upload** | Browser-side file parser with automatic duplicate removal and format validation counters. | Implemented |
| **Recipient Counter** | Real-time counts of total, valid, duplicate, and invalid entries detected from uploaded CSVs. | Implemented |
| **Campaign Parameters** | Configurable Start Time (`datetime-local`), Delay between emails (`delayMs`), and Hourly Limit. | Implemented |
| **Loading & Empty States** | Loading spinners and empty state placeholders ("No emails found") for empty queues. | Implemented |
| **Slack Connection Toggle** | Live header button reflecting Slack connection status (`Connect Slack` / `Slack Connected`) with connect and disconnect handlers. | Implemented |
| **Header Search Bar** | Visual search bar styled in dashboard header (not yet wired to Elasticsearch backend endpoint). | Partial (UI Only) |

---

# Architecture

```mermaid
flowchart TD
    User([User Browser]) -->|HTTP / React SPA| Frontend[Frontend: Vite + React]
    Frontend -->|REST API / Cookies| Express[Backend: Express API]
    
    subgraph Data Storage
        Express -->|Prisma ORM| Postgres[(PostgreSQL 15)]
        Express -->|Queue Jobs| Redis[(Redis 7)]
    end

    subgraph Background Queue
        Redis <-->|Fetch / Delay Jobs| BullMQ[BullMQ Engine]
        BullMQ <--> Worker[Email Worker Process]
    end

    subgraph External Integrations
        Worker -->|SMTP Delivery| Ethereal[Ethereal Email SMTP]
        Worker -->|Index Email Document| Elastic[(Elasticsearch 8.10.2)]
        Worker -->|Post Rate-Limit Alert| Slack[Slack API chat.postMessage]
        Express -->|OAuth 2.0| GoogleAuth[Google Identity Services]
        Express -->|OAuth 2.0| SlackAuth[Slack OAuth v2]
    end

    Express -->|Queue Metrics| BullBoard[Bull Board Dashboard]
```

### Component Explanations
1. **Frontend (React 19 + TypeScript + Tailwind CSS)**: Provides the user interface for authentication, composing campaigns, configuring scheduling parameters, viewing scheduled/sent emails, and managing Slack connectivity.
2. **Express REST API (Node.js + TypeScript)**: Authenticates sessions via Passport.js, validates input schemas via Zod, writes relational records to PostgreSQL, and creates delayed jobs in BullMQ.
3. **PostgreSQL 15 (Prisma ORM)**: Serves as the source of truth for persistent entity state (Users, Senders, Campaigns, Emails, and Slack OAuth Connections).
4. **Redis 7 (BullMQ Datastore & Rate Limiter)**: Holds delayed queues, active job locks, and atomic hourly rate limiting counters. Configured with AOF (`--appendonly yes`) for persistence.
5. **Worker Process (`src/workers/index.ts`)**: Decoupled background process that consumes BullMQ jobs, validates idempotency against PostgreSQL, enforces rate limits, handles delays, dispatches emails via Nodemailer, and indices documents in Elasticsearch.
6. **Ethereal SMTP**: Safe developer SMTP server trapping outgoing emails without delivering to real recipient inboxes, returning web inspection URLs.
7. **Elasticsearch 8.10.2**: Search engine datastore indexing email fields (`recipient`, `subject`, `body`, `sender`, `status`).
8. **Bull Board**: Administrative web interface mounted at `/admin/queues` providing real-time visibility into queue states (`waiting`, `delayed`, `active`, `completed`, `failed`).

---

# Scheduling Flow

The complete lifecycle of an email scheduling request is as follows:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend (React)
    participant API as Express API
    participant DB as PostgreSQL
    participant Redis as Redis (BullMQ)
    participant Worker as BullMQ Worker
    participant SMTP as Ethereal SMTP
    participant ES as Elasticsearch
    participant Slack as Slack API

    User->>FE: Enter campaign details & recipients (Single / CSV)
    User->>FE: Click "Send Later"
    FE->>API: POST /api/emails/schedule
    API->>DB: Create Campaign record
    loop For each recipient
        API->>DB: Create Email record (status: 'scheduled', idempotencyKey)
        API->>Redis: Add delayed job to emailQueue (delay = scheduledTime - now)
        API->>DB: Update Email record with bullJobId
    end
    API-->>FE: Return success { campaignId, count }
    
    Note over Redis,Worker: Job delay expires at scheduled time
    Redis->>Worker: Worker picks up job
    Worker->>DB: Fetch email by ID (Idempotency check)
    alt Email already sent
        Worker-->>Redis: Skip processing (already sent)
    else Email pending
        Worker->>Redis: Atomic INCR rate_limit:senderId:hour
        alt Rate limit exceeded
            Worker->>Redis: Delay job to start of next hour
            opt First notification this hour
                Worker->>Slack: Send rate limit alert via chat.postMessage
            end
            Worker-->>Redis: Fail job with RATE_LIMIT_EXCEEDED (rescheduled)
        else Rate limit allowed
            Worker->>DB: Update Email (status: 'processing', retryCount + 1)
            Worker->>SMTP: Send message via Nodemailer
            SMTP-->>Worker: Return messageId & previewUrl
            Worker->>DB: Update Email (status: 'sent', sentAt: now)
            Worker->>ES: Index document into 'emails' index
            Worker-->>Redis: Mark BullMQ job completed
        end
    end
```

---

# Persistence and Restart Behavior

A critical requirement of the email scheduler is surviving unexpected process or infrastructure termination without losing jobs or sending duplicate emails.

### 1. PostgreSQL Persistence
- Every email is assigned a persistent UUID, a unique `idempotencyKey`, and initial status `scheduled` before any queue job is scheduled.
- Email records store foreign keys to `Campaign`, `Sender`, and `User`.

### 2. Redis & BullMQ Persistence
- Redis is configured with Append-Only File persistence (`--appendonly yes`), ensuring queue state, delayed timers, and job payloads survive Redis restarts.
- BullMQ stores jobs in Redis Hashes and Sorted Sets (keyed by target execution timestamp). When the backend or worker crashes, the timers and jobs remain in Redis.

### 3. Worker Reconnect & Crash Handling
- When the worker restarts, it connects to Redis, scans `emailQueue`, and resumes listening for jobs.
- If a job was scheduled for a time that passed while the worker was down, BullMQ immediately marks the job as available and assigns it to the worker upon startup.
- **In-flight crashes**: If a worker crashes while processing a job, BullMQ's lock expires (`lockDuration`), moving the job back to the waiting queue or failed state based on retry configurations (`attempts: 3`).

### 4. Idempotency & Duplicate Send Protection
Before dispatching an email to SMTP, the worker performs a strict database check:
```typescript
const email = await prisma.email.findUnique({ where: { id: emailId } });
if (email.status === 'sent') {
  return { skipped: true, reason: 'Already sent' };
}
```
Furthermore, the BullMQ job is registered with `jobId: idempotencyKey`, preventing duplicate job registration in Redis.

---

# Rate Limiting

The application enforces both inter-email staggering and hourly aggregate rate limiting:

1. **Minimum Delay Between Emails**:
   - Staggers emails within a campaign across time using `index * delayMs`.
   - Default configured minimum delay is `2000` ms (2 seconds).
2. **Hourly Rate Limit**:
   - Limit is tracked **per sender** using Redis keys formatted as:
     ```
     rate_limit:<senderId>:<YYYY-MM-DDTHH>
     ```
   - Counter is atomically incremented via Redis `INCR`.
   - On the first increment, an expiration of `3600` seconds (1 hour) is set.
3. **Rescheduling Behavior**:
   - If `currentCount > hourlyLimit`, the worker calculates the exact millisecond offset until the top of the next hour using:
     ```typescript
     export const getDelayForNextHour = (): number => {
       const now = new Date();
       const nextHour = new Date(now);
       nextHour.setHours(nextHour.getHours() + 1);
       nextHour.setMinutes(0, 0, 0);
       return nextHour.getTime() - now.getTime() + 1000;
     };
     ```
   - The job is rescheduled into the new hour window using `job.changeDelay(delayMs)`.
4. **Slack Notification Rate Limiting**:
   - To avoid spamming Slack channels when multiple queued jobs hit the rate limit in rapid succession, a secondary Redis key is set:
     ```
     slack_notification:<senderId>:<YYYY-MM-DDTHH>
     ```
   - Only the first blocked job triggers a Slack alert (`count === 1`). Subsequent blocked jobs in that hour skip sending duplicate Slack alerts.

---

# Worker Concurrency

The BullMQ worker runs as a dedicated Node process (`src/workers/index.ts`):

- **Concurrency Setting**: Managed via `WORKER_CONCURRENCY` in `.env` (defaults to `3`).
- **Concurrent Processing**: The worker concurrently processes up to 3 jobs simultaneously.
- **Safety**: Because rate limiting utilizes atomic Redis operations (`INCR`) and email status checks utilize transactional PostgreSQL lookups, multiple concurrent jobs cannot corrupt counters or double-send emails.

Example configuration:
```env
WORKER_CONCURRENCY=3
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100
```

---

# Slack Integration

The application integrates with Slack OAuth 2.0 to deliver real-time operational notifications:

1. **Connection Flow**:
   - User clicks **Connect Slack** in the Dashboard header.
   - User is redirected to `https://slack.com/oauth/v2/authorize` with scope `chat:write` and `state=<userId>`.
   - Upon authorization, Slack redirects to `/api/slack/callback`.
   - Backend exchanges the authorization code for an OAuth access token and team metadata via `https://slack.com/api/oauth.v2.access`.
   - The token is securely stored in PostgreSQL in the `SlackConnection` table linked to the user.
2. **Notification Dispatch**:
   - When a worker encounters a rate-limited email, it queries PostgreSQL for an active `SlackConnection` for that user.
   - It posts an alert message to `#general` using `https://slack.com/api/chat.postMessage`.
3. **Graceful Fallback**:
   - If the user has not connected Slack, `sendSlackNotification` logs a debug message and safely returns `false` without crashing the worker or aborting job rescheduling.
   - Connecting Slack at a later time immediately enables notifications without restarting services.

---

# Elasticsearch

- **Index Name**: `emails`
- **When Indexed**: Immediately after successful SMTP transmission in the worker (`src/workers/index.ts`).
- **Indexed Fields**:
  - `emailId` (`keyword`)
  - `userId` (`keyword`)
  - `campaignId` (`keyword`)
  - `sender` (`text`)
  - `recipient` (`text`)
  - `subject` (`text`)
  - `body` (`text`)
  - `status` (`keyword`)
  - `scheduledAt` (`date`)
  - `sentAt` (`date`)
- **Compatibility Fix**: Configured with `enableMetaHeader: false` in `elasticsearch.service.ts` so the Elasticsearch client operates smoothly with Elasticsearch 8.10.2 without media-type header rejections.
- **Current Status**: Document indexing and the `searchEmails()` service method are implemented; the search query route is currently pending frontend connection.

---

# Bull Board

Queue observability is provided via **Bull Board**:

- **Local URL**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **Queues Registered**: `emailQueue`
- **Reviewer Observability**:
  - View jobs organized by state: `Waiting`, `Active`, `Completed`, `Failed`, `Delayed`, `Paused`.
  - Inspect job data payloads (`emailId`, `recipient`, `scheduledAt`, `delay`).
  - Observe delayed jobs transition to active when their scheduled start time arrives.
  - Inspect error logs and stack traces for failed or rate-limited jobs.

---

# Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.x or v20.x+
- **npm**: v9.x or v10.x+
- **Docker & Docker Compose**: Docker Desktop running (Linux containers mode on Windows/macOS)
- **Google Cloud Console Account**: For Google OAuth Client ID & Secret
- **Slack App**: For Slack OAuth credentials (optional for core email scheduling)

---

# Environment Variables

Backend configuration is loaded from `backend/.env` (and root `.env`). All variables are validated at startup with Zod:

| Variable | Required | Description | Example Placeholder |
|---|---|---|---|
| `NODE_ENV` | No | Application environment (`development` / `production`) | `development` |
| `PORT` | No | Backend Express API port | `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:password@localhost:5432/reachinbox` |
| `REDIS_URL` | Yes | Redis connection string | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | Yes | Elasticsearch server URL | `http://localhost:9200` |
| `WORKER_CONCURRENCY` | No | Concurrent jobs processed by the worker | `3` |
| `MIN_EMAIL_DELAY_MS` | No | Default minimum delay between emails in ms | `2000` |
| `MAX_EMAILS_PER_HOUR` | No | Default hourly rate limit per sender | `100` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Web Client ID | `your_google_client_id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret | `your_google_client_secret` |
| `GOOGLE_CALLBACK_URL` | Yes | Google OAuth authorized redirect URI | `http://localhost:5000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` | No | Slack App Client ID | `your_slack_client_id` |
| `SLACK_CLIENT_SECRET` | No | Slack App Client Secret | `your_slack_client_secret` |
| `SLACK_REDIRECT_URI` | No | Slack App Redirect URI | `http://localhost:5000/api/slack/callback` |
| `SESSION_SECRET` | Yes | Secret used to sign session cookies (min 32 chars) | `your_session_secret_min_32_chars` |
| `ETHEREAL_HOST` | No | SMTP host for test email delivery | `smtp.ethereal.email` |
| `ETHEREAL_PORT` | No | SMTP port for test email delivery | `587` |
| `ETHEREAL_USER` | No | Ethereal account username | `your_ethereal_user` |
| `ETHEREAL_PASSWORD` | No | Ethereal account password | `your_ethereal_password` |

---

# Ethereal Email Setup

Ethereal is a fake SMTP service used for safe email testing. Emails sent through Ethereal are trapped and **never delivered to real user inboxes**.

### Option A: Automatic Account Creation (Zero Config)
The application has built-in automatic provisioning in `src/services/email.service.ts`. If `ETHEREAL_USER` or `ETHEREAL_PASSWORD` are missing or contain placeholder values, the backend automatically generates a temporary test account using `nodemailer.createTestAccount()` on first send and logs the credentials and preview URL to the worker terminal.

### Option B: Manual Ethereal Account (Persistent Mailbox)
To keep all test emails inside a single Ethereal dashboard:
1. Go to [https://ethereal.email](https://ethereal.email) and click **Create Ethereal Account**.
2. Copy the generated **Username** and **Password**.
3. Update `backend/.env`:
   ```env
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USER=your_username@ethereal.email
   ETHEREAL_PASSWORD=your_password
   ```
4. When an email is processed, the worker terminal logs a clickable preview URL:
   ```text
   📧 Preview URL: https://ethereal.email/message/XXXXXX...
   ```
5. Click the URL or log in at `https://ethereal.email/messages` to view the rendered email.

---

# Google OAuth Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > OAuth consent screen**:
   - User Type: **External**
   - App name: `ReachInbox Scheduler`
   - Add your developer email.
4. Navigate to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `ReachInbox Local Dev`.
   - **Authorized JavaScript origins**: `http://localhost:5173` and `http://localhost:5000`.
   - **Authorized redirect URIs**: `http://localhost:5000/api/auth/google/callback`.
5. Copy the **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```

---

# Slack OAuth Setup

1. Open [Slack API Apps](https://api.slack.com/apps) and click **Create New App** (choose "From scratch").
2. Under **Features > OAuth & Permissions**:
   - Scroll to **Redirect URLs** and add: `http://localhost:5000/api/slack/callback`.
   - Scroll to **Scopes > Bot Token Scopes** and add: `chat:write`.
3. Under **Settings > Basic Information**:
   - Copy **Client ID** and **Client Secret**.
4. Update `backend/.env`:
   ```env
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
   ```
5. Install the app to your development workspace. Invite your bot to the `#general` channel (`/invite @your_app_name`).

---

# Installation

Clone the repository and install dependencies for both the backend and frontend:

```bash
git clone https://github.com/sarukeshwar2016/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler
```

### Backend Installation
```bash
cd backend
npm install
```

### Frontend Installation
```bash
cd ../frontend
npm install
```

---

# Database Setup

1. Start the PostgreSQL, Redis, and Elasticsearch containers:
   ```bash
   # From the project root
   docker compose up -d
   ```
2. Run Prisma migrations to generate the database schema:
   ```bash
   cd backend
   npx prisma migrate dev --name init
   ```
3. Generate the Prisma Client:
   ```bash
   npx prisma generate
   ```

---

# Redis Setup

Redis is fully managed via Docker Compose with Append-Only File (AOF) enabled. It is started with:
```bash
docker compose up -d redis
```
Connection URL: `redis://localhost:6379`.

---

# Elasticsearch Setup

Elasticsearch 8.10.2 runs via Docker Compose with single-node discovery and security disabled for local development:
```bash
docker compose up -d elasticsearch
```
Connection URL: `http://localhost:9200`.

---

# Running the Backend

The backend consists of two processes that should be run in separate terminal tabs:

### Terminal 1: Express REST API
```bash
cd backend
npm run dev
```
*Runs the Express server on port 5000 using `nodemon` and `tsx`.*

### Terminal 2: BullMQ Email Worker
```bash
cd backend
npm run worker
```
*Starts the background worker listening on `emailQueue`.*

---

# Running the Frontend

In a third terminal window:
```bash
cd frontend
npm run dev
```
*Starts the Vite dev server at **[http://localhost:5173](http://localhost:5173)**.*

---

# Running Everything with Docker

The datastores are containerized via Docker Compose:
```bash
docker compose up -d
```
This starts three containers:
- `reachinbox_postgres` (Port 5432)
- `reachinbox_redis` (Port 6379)
- `reachinbox_elasticsearch` (Port 9200)

*Note: The Node.js Express server and React frontend are run on the host via `npm run dev` for rapid local development and hot-reloading.*

---

# API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 flow |
| `GET` | `/api/auth/google/callback` | Google OAuth callback handler |
| `GET` | `/api/auth/me` | Fetch active user session |
| `POST` | `/api/auth/logout` | Terminate user session |
| `POST` | `/api/emails/schedule` | Schedule email campaign and dispatch BullMQ delayed jobs |
| `GET` | `/api/emails/scheduled` | Fetch paginated scheduled emails |
| `GET` | `/api/emails/sent` | Fetch paginated sent/failed emails |
| `POST` | `/api/emails/senders` | Create a sender identity |
| `GET` | `/api/emails/senders` | List sender identities for authenticated user |
| `GET` | `/api/slack/connect` | Initiates Slack OAuth 2.0 authorization |
| `GET` | `/api/slack/callback` | Slack OAuth callback saving access token |
| `GET` | `/api/slack/status` | Check Slack connection status (`{ connected: boolean }`) |
| `POST` | `/api/slack/disconnect` | Disconnect Slack integration |
| `GET` | `/admin/queues` | Bull Board queue monitoring dashboard |

---

# Testing the Scheduler

Follow this end-to-end verification flow:

1. **Start Services**: Ensure Docker Compose containers, backend API (`npm run dev`), worker (`npm run worker`), and frontend (`npm run dev`) are running.
2. **Login**: Navigate to [http://localhost:5173](http://localhost:5173) and click **Login with Google**.
3. **Open Compose**: Click the **+ Compose** button in the dashboard sidebar.
4. **Choose Recipient Mode**:
   - Choose **Single** and enter a valid recipient (e.g., `test@example.com`).
   - Or toggle **CSV Upload** and upload a `.csv` with email addresses.
5. **Set Scheduling Parameters**:
   - **Start Time**: Set 1 minute in the future.
   - **Delay (ms)**: `2000` (2 seconds).
   - **Hourly Limit**: `100`.
6. **Submit**: Click **Send Later**.
7. **Verify Scheduled Tab**: Check the **Scheduled** tab in the dashboard. The email appears with an orange "Scheduled" badge.
8. **Verify Bull Board**: Open [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) to see the job in the **Delayed** tab.
9. **Observe Execution**: When the start time is reached, BullMQ moves the job to **Active**. The worker sends the email.
10. **Verify Sent Tab**: Switch to the **Sent** tab on the dashboard. The email badge changes to green "Sent".
11. **Verify Ethereal Delivery**: Check the worker terminal log for the `📧 Preview URL` and open it in a browser to inspect the rendered email.

---

# Restart Persistence Test

To prove that scheduled emails survive crashes and restarts:

1. In the Compose modal, schedule an email with a Start Time set **5 minutes into the future**.
2. Confirm the email appears in the dashboard's **Scheduled** tab and in Bull Board under **Delayed**.
3. In the worker terminal, press `Ctrl + C` to **kill the worker**.
4. In the backend API terminal, press `Ctrl + C` to **kill the API server**.
5. Wait 30 seconds. Note that Redis and PostgreSQL remain running in Docker.
6. Restart the backend API: `npm run dev`.
7. Restart the worker: `npm run worker`.
8. Check Bull Board: The delayed job remains intact with its original scheduled execution timestamp.
9. When the 5-minute timer expires, the worker picks up the job and sends the email without duplication or data loss.

---

# Rate Limit Test

To demonstrate the hourly rate limiter and Slack alert with a low threshold:

1. In `backend/.env`, set:
   ```env
   MAX_EMAILS_PER_HOUR=2
   ```
2. Restart the worker terminal to load the new environment setting.
3. Connect Slack via the dashboard header (ensure bot is invited to `#general`).
4. Click **Compose** and schedule **5 emails** (either via CSV or multiple sends) with `Hourly Limit: 2` and `Delay: 2000`.
5. **Observation**:
   - The first 2 emails execute and succeed.
   - The 3rd email hits the rate limit.
   - The worker terminal outputs:
     ```text
     Rate limit reached for sender <id>. Rescheduling email <id>.
     Job <id> rate limited. Retrying after <delayMs>ms
     ```
   - The remaining emails are rescheduled to the next hour window via `moveToDelayed` / `changeDelay`.
   - A single Slack notification is posted to your `#general` channel:
     ```text
     ⚠️ Email rate limit reached
     Sender: demo@reachinbox.ai
     Limit: 2 emails/hour
     Queued emails will be delayed to the next available window.
     ```

---

# Project Structure

```text
reachinbox-email-scheduler/
├── .env.example
├── .gitignore
├── DEMO.md
├── docker-compose.yml
├── README.md
├── SUBMISSION_CHECKLIST.md
├── backend/
│   ├── .env.example
│   ├── Dockerfile
│   ├── jest.config.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── auth/
│   │   │   └── google.ts
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   ├── queues/
│   │   │   └── email.queue.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── email.routes.ts
│   │   │   ├── queue.routes.ts
│   │   │   └── slack.routes.ts
│   │   ├── services/
│   │   │   ├── elasticsearch.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── slack.service.ts
│   │   ├── utils/
│   │   │   ├── rateLimiter.ts
│   │   │   └── redis.ts
│   │   └── workers/
│   │       └── index.ts
│   └── tests/
│       └── scheduler.test.ts
└── frontend/
    ├── Dockerfile
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── components/
        │   └── ComposeEmailModal.tsx
        └── pages/
            ├── Dashboard.tsx
            └── Login.tsx
```

---

# Assumptions and Trade-offs

1. **Ethereal Test SMTP vs. Production SMTP**:
   - Ethereal SMTP is used to allow reviewers to inspect email delivery safely without requiring paid SendGrid/SES accounts or risking spam strikes on real email inboxes.
2. **Fixed-Window vs. Sliding-Log Rate Limiting**:
   - Fixed 1-hour windows (`YYYY-MM-DDTHH`) via Redis `INCR` and `EXPIRE` were chosen for optimal $O(1)$ time complexity and minimal memory footprint across high email volumes.
3. **Exactly-Once vs. At-Least-Once Delivery**:
   - Because SMTP delivery across external networks cannot be two-phase committed with database writes, there is an inherent distributed systems race condition if a worker crashes between SMTP acceptance and PostgreSQL write. To minimize this, strict pre-send idempotency checks, atomic job status tracking (`processing`), and BullMQ job deduplication are implemented.
4. **Elasticsearch Resilience**:
   - Elasticsearch calls are wrapped in non-blocking try/catch handlers so indexing issues or ES unavailability never crash email dispatch.
5. **Separate Worker Process**:
   - The worker runs as a distinct Node process (`npm run worker`) instead of inside the Express API process, modeling a real distributed production setup where worker clusters can scale independently.

---

# Assignment Requirement Mapping

| Assignment Requirement | Implementation in Codebase | Status |
|---|---|---|
| **BullMQ Scheduling** | Implemented using BullMQ `Queue` with dynamic millisecond delay calculation | ✅ Implemented |
| **Redis Persistence** | Redis 7 container with `--appendonly yes` and BullMQ persistent keys | ✅ Implemented |
| **PostgreSQL Persistence** | PostgreSQL 15 managed with Prisma schemas (`User`, `Sender`, `Campaign`, `Email`, `SlackConnection`) | ✅ Implemented |
| **Ethereal SMTP Integration** | Nodemailer with automatic test account fallback & preview URL generation | ✅ Implemented |
| **Worker Concurrency** | BullMQ Worker with `concurrency: env.WORKER_CONCURRENCY` | ✅ Implemented |
| **Minimum Email Delay** | Inter-email stagger calculation (`index * delayMs`) | ✅ Implemented |
| **Hourly Rate Limiter** | Redis atomic counter per sender per hour with `getDelayForNextHour()` rescheduling | ✅ Implemented |
| **Slack OAuth & Notifications** | Full OAuth v2 flow, token storage, and rate-limit alert dispatch via `chat.postMessage` | ✅ Implemented |
| **Elasticsearch Document Indexing** | Document indexing on sent email event with ES 8.10.2 compatibility header fix | ✅ Implemented |
| **Elasticsearch Search API** | `searchEmails()` service method is implemented; search endpoint not yet wired to Express routes | ⚠️ Partial |
| **Bull Board UI** | Mounted at `/admin/queues` with Express adapter | ✅ Implemented |
| **Google OAuth Authentication** | Passport.js Google Strategy with session persistence and callback handling | ✅ Implemented |
| **Dashboard UI** | React 19 + Tailwind CSS dashboard matching Figma design | ✅ Implemented |
| **Recipient List Upload** | CSV/text client-side parser with duplicate detection + Single email input toggle | ✅ Implemented |
| **Scheduled Emails View** | Dedicated tab with real-time status badges and pagination | ✅ Implemented |
| **Sent Emails View** | Dedicated tab with sent timestamps and status indicators | ✅ Implemented |
| **Restart Persistence** | Verified against worker and backend crash scenarios | ✅ Implemented |
| **Idempotency Protection** | Unique database constraints + BullMQ `jobId` deduplication | ✅ Implemented |

---

# Demo Checklist

Use this 5-minute checklist when recording your assignment submission video:

- [ ] **Architecture Overview**: Show `docker-compose.yml` and explain the decoupled worker architecture.
- [ ] **Google Login**: Navigate to [http://localhost:5173](http://localhost:5173) and sign in via Google OAuth.
- [ ] **Dashboard Walkthrough**: Show user profile, empty states, and the Slack connection indicator.
- [ ] **Compose Modal**: Demonstrate the toggle between Single email input and CSV Upload (highlighting duplicate parsing).
- [ ] **Schedule Campaign**: Set a 1-minute future start time with a 2-second delay.
- [ ] **Verify Scheduled State**: Show the email in the **Scheduled** tab and inside **Bull Board** (`/admin/queues`) under **Delayed**.
- [ ] **Worker Processing**: Watch the job transition to **Active** and then **Completed** in Bull Board.
- [ ] **Verify Sent State & Ethereal**: Show the email in the **Sent** tab and open the Ethereal web preview URL from the worker console.
- [ ] **Restart Persistence**: Schedule an email 5 minutes out, kill the worker process, restart it, and show the job remains scheduled.
- [ ] **Rate Limiting & Slack Alert**: Trigger the hourly rate limit and show the real-time Slack alert in `#general`.
