# أجر لا ينقطع - Endless Reward

A secure, minimal, Arabic-first landing page for a faith-based community project.

This is NOT a commercial product. It is a spiritual contribution page (Sadaqah Jariyah concept) that allows users to submit Dhikr, Du'a, Qur'anic verses, and authentic Hadith.

## 🗂️ Project Structure

```
أجر لا ينقطع/
├── index.html          # Main landing page
├── admin.html          # Admin review panel
├── styles.css          # RTL Arabic styling
├── script.js           # Form validation & API integration
├── netlify.toml        # Netlify deployment config
└── api/                # Backend API (deploy separately)
    ├── server.js       # Express.js server
    ├── package.json    # Node.js dependencies
    ├── .env.example    # Environment variables template
    └── migrations/     # Database migrations
```

---

## 🚀 Netlify Deployment (Frontend)

The frontend is a **static site** - no build step required.

### Step 1: Push to GitHub

```bash
cd "أجر لا ينقطع"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ajr-la-yanqati.git
git push -u origin main
```

### Step 2: Create Netlify Site

1. Go to [netlify.com](https://netlify.com) and sign in with GitHub
2. Click **"Add new site"** → **"Import an existing project"**
3. Select your GitHub repository
4. Configure build settings:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `/`
5. Click **"Deploy site"**

Netlify will auto-assign HTTPS and a `.netlify.app` domain.

### Step 3: Update Production API URL

After deploying your **backend API** (see below), update `PRODUCTION_API_URL` in:

- `script.js` (line ~32)
- `admin.html` (line ~339)

```javascript
const PRODUCTION_API_URL = 'https://your-backend.railway.app'; // ← Your backend URL
```

Then push the changes - Netlify will auto-deploy.

---

1. **Install dependencies:**

```bash
cd api
npm install
```

2. **Configure environment variables:**

```bash
# Copy the template
cp .env.example .env

# Edit with your values
# - SUPABASE_URL: Your Supabase project URL
# - SUPABASE_SERVICE_ROLE_KEY: Your service role key (never expose publicly)
# - ALLOWED_ORIGINS: Your frontend domain(s)
```

3. **Run the database migration:**

   Execute the SQL in `migrations/001_add_message_hash.sql` in your Supabase SQL Editor.

4. **Start the server:**

```bash
npm start
# or for development with auto-reload
npm run dev
```

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| **Rate Limiting** | 10 requests per IP per 24 hours (server-side) |
| **Input Sanitization** | Strips HTML, scripts, and validates Arabic text |
| **Duplicate Detection** | SHA-256 hash prevents spam/duplicate submissions |
| **CORS Protection** | Only allowed origins can access the API |
| **No Tracking** | No IP logging, no cookies, no analytics |

## 🗄️ Database Schema

The `submissions` table should have:

```sql
CREATE TABLE submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('dhikr', 'dua', 'ayah', 'hadith')),
    author_name TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    message_hash TEXT,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Public insert policy (anonymous submissions)
CREATE POLICY "Allow anonymous inserts" ON submissions
    FOR INSERT WITH CHECK (true);

-- Service role can do everything (for backend)
CREATE POLICY "Service role full access" ON submissions
    USING (auth.role() = 'service_role');
```

## 🌐 Deployment

### Frontend

Deploy `index.html`, `styles.css`, and `script.js` to:
- Vercel (static)
- Netlify
- GitHub Pages
- Any static hosting

### Backend

Deploy the `/api` folder to:
- Vercel (Serverless Functions)
- Railway
- Render
- Any Node.js hosting

**Important:** Update `CONFIG.API_BASE_URL` in `script.js` to point to your deployed API.

## 📋 Configuration

### Frontend (`script.js`)

```javascript
const CONFIG = {
    // Development
    API_BASE_URL: 'http://localhost:3001',
    
    // Production (change this)
    // API_BASE_URL: 'https://api.yourdomain.com',
    
    API_ENDPOINT: '/api/submit',
};
```

### Backend (`api/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW_HOURS=24
RATE_LIMIT_MAX_REQUESTS=10
```

## 📝 API Reference

### `POST /api/submit`

Submit a new dhikr/dua/ayah/hadith.

**Request:**
```json
{
    "message": "سبحان الله وبحمده",
    "content_type": "dhikr",
    "author_name": "optional name"
}
```

**Response (Success):**
```json
{
    "success": true,
    "message": "تم استلام مشاركتك. جزاك الله خيرًا."
}
```

**Response (Rate Limited):**
```json
{
    "success": false,
    "message": "تم تجاوز الحد المسموح من المشاركات. يرجى المحاولة لاحقًا."
}
```

### `GET /api/health`

Health check endpoint.

## 🤍 License

This is a Sadaqah Jariyah project. No rights reserved. Use freely for the sake of Allah.

---

صدقة جارية • لا حقوق محفوظة
