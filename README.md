# AI-Powered Bulk Job Application Platform

A production-ready full-stack web application that automates personalized, ATS-friendly recruiter outreach using your verified resume, an Excel/CSV contact list, Google Gemini AI, and real SMTP email delivery with your resume attached.

Built with Next.js, TypeScript, Tailwind CSS, Prisma ORM, Nodemailer, ExcelJS, PDF/DOCX parsers, BullMQ, and AES-256-GCM encryption.

---

## 🌟 Key Features

1. **Master Resume Extraction & Grounding**:
   - Upload PDF or Word (.docx) resumes (up to 10MB).
   - Extracts and structures candidate contact info, technical skills, employment experience, education, key projects, and certifications.
   - Interactive candidate profile editor allows you to inspect and refine extracted data.
   - Original master file is safely preserved and attached to every outgoing email.
   - **Strict Anti-Hallucination Grounding**: Gemini is strictly instructed never to fabricate employers, projects, degrees, or tools.

2. **Excel & CSV HR Contact Import**:
   - Parses `.xlsx`, `.xls`, and `.csv` files.
   - Intelligent column auto-detection (recognizes recruiter names, email headers, company names, job titles, and job descriptions).
   - Interactive Column Mapping interface for custom or ambiguous column layouts.
   - Automatic RFC 5322 email syntax validation, duplicate email detection, and empty row skipping.
   - Preserves original spreadsheet row numbers for transparent error diagnostics.
   - Search, sort, filter, inline edit, and exclude contacts.
   - Formula injection protection (CWE-1236) on all CSV exports.

3. **Google Gemini AI Integration**:
   - Powered by official Google Gen AI SDK (`@google/genai` and `@google/generative-ai`).
   - Generates personalized subject lines, professional greetings, concise application bodies (under 250 words), and tailored cover letters.
   - Configurable target role and tone (e.g. *Professional & Confident*, *Startup-ready*, *Technical & Project-focused*).
   - Defends against prompt injection embedded in untrusted spreadsheet cells or job descriptions.
   - Bounded concurrency with exponential backoff for API rate limits and quota handling.

4. **Authentic SMTP Email Delivery & Attachments**:
   - Sends real emails using your configured mail provider (Gmail, Outlook, Zoho, or private SMTP servers).
   - Original uploaded resume attached with correct MIME type.
   - Verifies file integrity and server path existence before sending.
   - Built-in "Test SMTP Connection" and "Send Test Email" functions.
   - Sensitive credentials encrypted at rest using AES-256-GCM with a server-side master key (`APP_ENCRYPTION_KEY`). Never exposes passwords in API responses or logs.

5. **Bulk Sending Engine & Resilient Queues**:
   - Explicit confirmation modal before initiating batch outreach.
   - Duplicate prevention safeguard: prevents accidentally sending repeated emails to the same contact.
   - Configurable rate-limit delay (e.g. 2s, 3s, 5s) and concurrency control (1-3 connections).
   - Dual-mode resilient pipeline: BullMQ worker with Redis, and a persistent database queue runner.
   - Real-time progress monitoring: Pending, Processing, Accepted by SMTP, Failed, and Skipped counts.
   - Pause, resume, and cancel active batches at any time.
   - Records SMTP Message-IDs, timestamps, and actionable diagnostic errors.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Sonner |
| **Backend API** | Next.js Server-side Route Handlers with Zod validation |
| **Database** | PostgreSQL with Prisma ORM (SQLite supported for zero-setup local dev) |
| **AI Engine** | Google Gemini API (`gemini-2.5-flash` or `gemini-1.5-flash`) |
| **Document Parsers** | `pdf-parse` (PDF) and `mammoth` (DOCX) |
| **Spreadsheet Engine** | `exceljs` (Excel) and `csv-parse` / `csv-stringify` (CSV) |
| **Email Protocol** | Nodemailer with STARTTLS / SSL support |
| **Background Queue** | Persistent Database Queue + optional BullMQ with Redis |
| **Security** | AES-256-GCM encryption, formula sanitization, path traversal defense |
| **Testing** | Vitest, React Testing Library, Playwright E2E |
| **Deployment** | Docker & Docker Compose compatible |

---

## 📋 Prerequisites

- **Node.js**: v18.18.0 or later (v20+ recommended)
- **npm** or **pnpm**
- **Google Gemini API Key**: Free key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **SMTP Account**: Your email credentials (e.g. Gmail with a 16-character App Password)
- **Docker** (optional): For running PostgreSQL and Redis containers

---

## 🚀 Quickstart & Local Development

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd "hr email app"
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review or update the variables in `.env`:

```env
APP_URL=http://localhost:3000
APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Database Configuration (Defaults to SQLite for instant local dev)
DATABASE_URL="file:./dev.db"

# For PostgreSQL (e.g. Docker or cloud provider):
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hremaildb?schema=public"

# Redis Queue (Optional)
REDIS_URL="redis://localhost:6379"

# Default SMTP settings (can also be saved in Settings UI)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM="Your Name <your_email@gmail.com>"
EMAIL_REPLY_TO=your_email@gmail.com

MAX_SEND_CONCURRENCY=2
SEND_DELAY_MS=3000
```

### 3. Initialize Database

Run the database synchronization script:

```bash
npm run db:sync
```

*(This automatically detects whether you are using PostgreSQL or SQLite, copies the matching schema, and pushes tables.)*

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Optional: Start Dedicated Background Worker

If you want to run the queue in a dedicated standalone background process:

```bash
npm run worker
```

---

## 🔑 Service Configuration Guides

### 1. Google Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Copy the key and either:
   - Add it to `.env`: `GEMINI_API_KEY=AIzaSy...`
   - Or paste it directly in the **Settings** page in the web UI.

### 2. Gmail SMTP Setup (App Passwords)

> **Important**: Google disables direct password logins over SMTP. You **cannot** use your regular Gmail password. You must generate an **App Password**:

1. Go to your [Google Account Security](https://myaccount.google.com/security) settings.
2. Ensure **2-Step Verification** is turned **ON**.
3. In the search bar at the top, type `App passwords` and select it.
4. Name the application (e.g., `Job Outreach`) and click **Create**.
5. Copy the generated 16-character code (e.g., `abcd efgh ijkl mnop`).
6. In ApplyAI **Settings**:
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **Secure (SSL)**: *Unchecked* (Port 587 uses STARTTLS)
   - **Username**: `your_email@gmail.com`
   - **Password**: *Paste your 16-character App Password*
   - **From**: `Your Name <your_email@gmail.com>`
7. Click **Test SMTP Connection**, then **Send Test Email** to verify!

### 3. Microsoft Outlook / Office 365 Setup

- **SMTP Host**: `smtp.office365.com`
- **SMTP Port**: `587`
- **Secure (SSL)**: *Unchecked*
- **Username**: `your_email@outlook.com`
- **Password**: Your password or App Password

---

## 🧪 Testing & Verification

Execute the automated test suite covering parsing, security, AI generation, and SMTP error handling:

```bash
npm test
```

### Test Coverage Summary:
- `tests/parsers.test.ts`: Excel (.xlsx) and CSV parsing, header detection, manual column mapping, duplicate email detection, formula injection sanitization.
- `tests/crypto-security.test.ts`: AES-256-GCM encryption/decryption, authentication tag verification, secret masking, sensitive log redaction.
- `tests/ai-validation.test.ts`: Gemini JSON schema parsing with Zod, anti-hallucination prompt construction, deterministic fallback generation.
- `tests/smtp-queue.test.ts`: SMTP diagnostic code mapping (`EAUTH`, `ECONNREFUSED`, `ETIMEDOUT`, `ESOCKET`), configuration validation, attachment existence verification.
- `tests/e2e-workflow.test.ts`: Complete end-to-end flow from contact import to draft approval, campaign creation, and duplicate delivery prevention.

---

## 🐳 Docker Deployment

### Start PostgreSQL & Redis via Docker Compose:

```bash
docker compose up -d postgres redis
```

### Full Containerized Stack:

To build and run the entire application, PostgreSQL, and Redis in containers:

```bash
docker compose up -d --build
```

Access the application at [http://localhost:3000](http://localhost:3000).

---

## 🛡️ Security Architecture

- **Authenticated Encryption at Rest**: Sensitive SMTP passwords and API keys stored in the database are encrypted using AES-256-GCM with a 12-byte initialization vector and a 16-byte authentication tag.
- **Path Traversal & Safe Uploads**: Resumes are stored in a private directory with UUID-based filenames. User-supplied filenames are sanitized to prevent directory traversal (`../`).
- **Spreadsheet Formula Injection (CWE-1236)**: Any field starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically sanitized with a leading quote upon export.
- **Credential Redaction**: Application diagnostics and server logs redact passwords, bearer tokens, and Google API keys.
- **Duplicate Prevention Safeguard**: The system tracks contacts that have already received an email and skips them in subsequent campaigns unless explicitly overridden.

---

## 📁 Project Structure

```
├── prisma/
│   ├── schema.prisma          # PostgreSQL production schema
│   ├── schema.sqlite.prisma   # SQLite local development schema
│   └── schema.active.prisma   # Active synchronized schema
├── scripts/
│   └── db-sync.js             # Turnkey database setup & provider switcher
├── src/
│   ├── app/
│   │   ├── api/               # Server-side REST API routes
│   │   │   ├── campaigns/     # Batch creation, progress, pause, resume, cancel
│   │   │   ├── contacts/      # Upload, mapping, filtering, export
│   │   │   ├── drafts/        # Gemini generation, batch generation, approval
│   │   │   ├── resume/        # File upload, text extraction, profile edit
│   │   │   ├── settings/      # SMTP test, send test email, config save
│   │   │   └── stats/         # Live metrics and audit activity
│   │   ├── campaigns/         # Campaign progress and delivery logs UI
│   │   ├── contacts/          # Contact management & column mapping UI
│   │   ├── drafts/            # Application review, editor & approval UI
│   │   ├── resume/            # Resume profile inspector & preview UI
│   │   ├── settings/          # SMTP & Gemini configuration UI
│   │   ├── layout.tsx         # Root layout with navigation & toast notifications
│   │   └── page.tsx           # Command center dashboard
│   ├── components/            # Reusable UI modals & navigation
│   ├── lib/
│   │   ├── ai/                # Gemini client, retry backoff, prompts
│   │   ├── crypto/            # AES-256-GCM encryption & redaction
│   │   ├── db/                # Prisma client singleton
│   │   ├── email/             # Nodemailer transporter & diagnostic mapper
│   │   ├── parsers/           # PDF/DOCX and Excel/CSV parsers
│   │   ├── queue/             # BullMQ Redis queue & persistent DB queue
│   │   └── utils/             # Zod validation & sanitization
│   └── worker.ts              # Standalone background queue runner
├── tests/                     # Vitest automated test suite
├── Dockerfile                 # Production multi-stage container
├── docker-compose.yml         # Container orchestration (App, Postgres, Redis)
└── package.json
```

---

## 📄 License

MIT. Built for authentic, high-impact job applications.
