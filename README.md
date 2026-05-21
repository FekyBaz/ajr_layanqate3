# أجر لا ينقطع - Endless Reward

A secure, minimal, Arabic-first landing page for a faith-based community project.
100% serverless - runs entirely on Netlify (free tier).

## 🗂️ Project Structure

```
أجر لا ينقطع/
├── index.html              # Main landing page
├── admin.html              # Admin review panel
├── styles.css              # RTL Arabic styling
├── script.js               # Form validation & API calls
├── netlify.toml            # Netlify config & redirects
├── package.json            # Dev dependencies
└── netlify/
    └── functions/          # Serverless API
        ├── submit.js       # POST /api/submit
        ├── admin-pending.js
        ├── admin-approve.js
        ├── admin-reject.js
        ├── admin-stats.js
        ├── health.js
        ├── package.json    # Function dependencies
        ├── utils/
        │   └── shared.js   # Supabase, sanitization, rate-limit
        └── migrations/
            └── 003_rate_limits_table.sql
```

---

## 🚀 Quick Start (Local Development)

### 1. Install dependencies

```bash
npm install
cd netlify/functions && npm install && cd ../..
```

### 2. Create `.env` file in project root

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
ADMIN_API_KEY=your-admin-key
FRONTEND_URL=http://localhost:8888
RATE_LIMIT_WINDOW=24
RATE_LIMIT_MAX=10
MEMORY_RATE_LIMIT_MAX=3
MEMORY_RATE_LIMIT_HOURS=24
IP_SALT=random-salt-for-ip-hashing
```

### 3. Run the database migrations

In Supabase SQL Editor, run:
- `api/migrations/001_add_message_hash.sql`
- `api/migrations/002_admin_corrections.sql`
- `netlify/functions/migrations/003_rate_limits_table.sql`

### 4. Start development server

```bash
npm run dev
# or
netlify dev
```

Open http://localhost:8888

---

## 🌐 Deploy to Netlify

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ajr-la-yanqati.git
git push -u origin main
```

### Step 2: Create Netlify Site

1. Go to [netlify.com](https://netlify.com)
2. Click **"Add new site"** → **"Import from Git"**
3. Select your repository
4. Settings:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `/`
5. Click **Deploy**

### Step 3: Add Environment Variables

In Netlify: **Site settings** → **Environment variables**

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NOT anon) |
| `SUPABASE_ANON_KEY` | Anon/public key (required for RLS) |
| `ADMIN_API_KEY` | A secure random string |
| `FRONTEND_URL` | Your Netlify URL (e.g., `https://ajr-la-yanqati.netlify.app`) |
| `RATE_LIMIT_WINDOW` | `24` |
| `RATE_LIMIT_MAX` | `10` |
| `MEMORY_RATE_LIMIT_MAX` | `3` |
| `MEMORY_RATE_LIMIT_HOURS` | `24` |
| `IP_SALT` | Random salt string for IP hashing |

### Step 4: Trigger Redeploy

After adding env vars, trigger a redeploy from Netlify dashboard.

---


## 🔘 Button System Rules

Use only the shared button classes from `styles.css`:

- `.btn`: base structure (size, alignment, interaction).
- `.btn-primary`: one primary action per section.
- `.btn-secondary`: optional supporting action.
- `.btn-ghost`: only for lightweight actions inside cards.

Guardrails:

- Do not add inline styles to buttons.
- Do not override button colors per element.
- Keep accessible contrast (minimum 4.5:1) for text/background pairings.
- Do not introduce transparent buttons without a visible boundary.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit` | Submit dhikr/dua/ayah/hadith |
| GET | `/api/admin/pending` | Get pending submissions |
| POST | `/api/admin/approve` | Approve with optional correction |
| POST | `/api/admin/reject` | Reject submission |
| GET | `/api/admin/stats` | Get submission counts |
| GET | `/api/health` | Health check |

Admin endpoints require `Authorization: Bearer <ADMIN_API_KEY>` header.

---

## 🔒 Security Features

- ✅ IP-based rate limiting (via Supabase table)
- ✅ SHA-256 duplicate detection
- ✅ Arabic-only input validation
- ✅ HTML/script stripping
- ✅ Admin API key authentication
- ✅ CORS restricted to allowed origins
- ✅ Security headers (X-Frame-Options, CSP, etc.)

---

## 💰 Cost

**$0/month** - Everything runs on Netlify free tier + Supabase free tier.

---

## 📊 Product Analytics

This project includes a privacy-first, self-hosted analytics system.

### Setup

1. Run the analytics migration in Supabase SQL Editor:
   - `netlify/functions/migrations/023_product_analytics.sql`

2. No additional environment variables needed — uses existing Supabase connection.

3. Access the dashboard:
   - Login to admin panel at `/admin`
   - Click "📊 التحليلات" or go to `/analytics`

### What We Track

| Category | Metrics |
|---|---|
| Traffic | Page views, unique visitors, returning visitors, sessions |
| Sources | Direct, social, search, UTM campaigns, referrer domains |
| Behavior | Scroll depth, CTA clicks, form interactions, share actions |
| Devices | Mobile/tablet/desktop, browser, OS, screen size |
| Geography | Country (2-letter code only, no precise location) |
| Funnels | Landing → Interaction → Submission conversion rates |
| Retention | Returning visitor rate, repeat session frequency |

### Event Taxonomy

| Event Type | Description |
|---|---|
| `page_view` | Page load (automatic) |
| `scroll` | Scroll depth: 25%, 50%, 75%, 100% (automatic) |
| `outbound_click` | Click on external link (automatic) |
| `share` | Share button click (automatic) |
| `cta_click` | CTA button with `data-analytics-cta` attribute |
| `form_start` | Form submission started |
| `submit` | Form submission succeeded |
| `form_abandon` | Form submission failed |
| `error` | JavaScript error (same-origin only) |

### Privacy

- **No IP addresses stored** — session IDs are random, not derived from IP
- **No personal data** — no names, emails, or identifiers
- **No cookies for tracking** — uses sessionStorage (cleared on tab close)
- **Returning visitor detection** uses a simple cookie with no personal data
- **Referrer stored as origin only** — no full URLs or query parameters
- **Data auto-deleted after 90 days** via cleanup function
- **No third-party analytics SDKs** — fully self-hosted

### Adding New Events

```js
// In any page script:
if (window.AjrAnalytics) {
    window.AjrAnalytics.track('event_type', 'event_name', { key: 'value' });
}
```

### Adding New Events

```js
// In any page script:
if (window.AjrAnalytics) {
    window.AjrAnalytics.track('event_type', 'event_name', { key: 'value' });
}
```

---

## 🔀 Hybrid Analytics Architecture

This project uses a **dual-analytics** approach for production-grade visibility while respecting privacy.

### Why both?

| | Custom Analytics | Google Analytics 4 |
|---|---|---|
| **Purpose** | Business events, observability | Traffic acquisition, SEO, benchmarking |
| **Tracking** | Custom events (adhkar, memories, etc.) | Page views, sessions, sources, geography |
| **Privacy** | Zero PII, no IPs, 90-day auto-delete | Anonymized IPs, standard GA4 privacy controls |
| **Cost** | $0 (Supabase + Netlify) | $0 (GA4 free tier) |
| **Data ownership** | Full control | Google infrastructure |

### How It Works

1. **Custom analytics** (`lib/analytics.js`) sends events to `/api/analytics` → Supabase. Always active.
2. **GA4** (`lib/ga4.js`) loads only when `GA_MEASUREMENT_ID` env var is set in production.
3. The GA4 loader fetches `/api/ga-config` on first visit, caches the ID in sessionStorage, then dynamically injects `gtag.js` from Google.

### GA4 Setup

1. Create a GA4 property in [Google Analytics](https://analytics.google.com/)
2. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)
3. Set it as a Netlify environment variable:

```bash
# Netlify dashboard → Site settings → Environment variables
GA_MEASUREMENT_ID = "G-XXXXXXXXXX"
```

4. Deploy — the site detects the env var and loads GA4 automatically.
5. Verify in GA4 Realtime report after a few page views.

### Adding GA4 Events (Optional)

GA4 auto-tracks `page_view` on every page load. For additional custom GA4 events:

```js
if (window.gtag) {
    window.gtag('event', 'custom_event', { key: 'value' });
}
```

### CSP Notes

The Content Security Policy has been updated to allow:
- `script-src`: `https://www.googletagmanager.com` (gtag.js loader)
- `connect-src`: `https://www.google-analytics.com` + `https://*.google-analytics.com` (GA4 collection endpoint)
- `img-src`: `https://www.google-analytics.com` (GA4 tracking pixel fallback)

### Files

| File | Role |
|---|---|
| `lib/ga4.js` | Client-side GA4 loader (fetches config, injects gtag.js) |
| `netlify/functions/ga-config.js` | Serverless config endpoint (returns measurement ID from env var) |
| `netlify.toml` (CSP + redirect) | Allows Google domains in CSP; proxies `/api/ga-config` |

---

صدقة جارية • لا حقوق محفوظة 🤍
