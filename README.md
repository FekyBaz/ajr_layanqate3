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
ADMIN_API_KEY=your-admin-key
FRONTEND_URL=http://localhost:8888
RATE_LIMIT_WINDOW=24
RATE_LIMIT_MAX=10
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
| `ADMIN_API_KEY` | A secure random string |
| `FRONTEND_URL` | Your Netlify URL (e.g., `https://ajr-la-yanqati.netlify.app`) |
| `RATE_LIMIT_WINDOW` | `24` |
| `RATE_LIMIT_MAX` | `10` |

### Step 4: Trigger Redeploy

After adding env vars, trigger a redeploy from Netlify dashboard.

---

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

صدقة جارية • لا حقوق محفوظة 🤍
