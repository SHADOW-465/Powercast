# 🚀 POWERCAST AI - Production Setup Guide

## Prerequisites
- Node.js 18+ and pnpm installed
- Python 3.10+ installed
- Supabase account (free tier is fine)
- Render account (free tier available)

---

## 📦 STEP 1: Supabase Setup (5 minutes)

### 1.1 Create Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose organization and set:
   - **Name:** powercast-ai
   - **Database Password:** (generate strong password)
   - **Region:** Choose closest to you (eu-central-1 recommended)
4. Wait ~2 minutes for project to provision

### 1.2 Get API Credentials
1. Go to Project Settings → API
2. Copy these values:
   - **Project URL:** `https://xxx.supabase.co`
   - **anon public key:** (starts with `eyJ...`)
   - **service_role key:** (starts with `eyJ...` - keep secret!)

### 1.3 Create Database Tables
1. Go to SQL Editor
2. Run the migration script from `supabase/migrations/001_initial_schema.sql`

---

## 🔧 STEP 2: Local Development Setup

### 2.1 Frontend Setup
```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Supabase credentials:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
NEXT_PUBLIC_API_URL=http://localhost:8000

# Start frontend dev server
pnpm dev
# Opens at http://localhost:3000
```

### 2.2 Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp ../.env.example .env

# Edit .env and add:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
FRONTEND_URL=http://localhost:3000

# Start backend server
python -m app.main
# or
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Opens at http://localhost:8000
```

---

## 🌐 STEP 3: External API Setup (OPTIONAL)

These are **optional**. If not configured, the app will use **simulated data**.

### 3.1 OpenWeather API (Free Tier - 1000 calls/day)
1. Go to https://openweathermap.org/api
2. Sign up for free account
3. Get API key from dashboard
4. Add to `.env`:
```bash
OPENWEATHER_API_KEY=your-key-here
```

### 3.2 ENTSO-E Transparency Platform (Free)
1. Go to https://transparency.entsoe.eu
2. Register account
3. Request API access (email verification)
4. Add to `.env`:
```bash
ENTSOE_API_KEY=your-key-here
```

### 3.3 Swiss Grid API (if available)
- Contact Swissgrid for API access
- Not required for demo/testing

---

## 📤 STEP 4: Deploy to Production

### 4.1 Deploy Backend to Render

1. **Push code to GitHub:**
```bash
git add .
git commit -m "Production setup"
git push origin main
```

2. **Create Render Web Service:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Configure:
     - **Name:** powercast-ai-backend
     - **Environment:** Python 3
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     - **Instance Type:** Free (or Starter $7/mo)

3. **Add Environment Variables:**
   - Click "Environment" tab
   - Add all variables from `.env`:
     ```
     SUPABASE_URL=https://xxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
     FRONTEND_URL=https://powercast-ai.vercel.app
     OPENWEATHER_API_KEY=xxx (if you have it)
     ENTSOE_API_KEY=xxx (if you have it)
     ML_MODEL_PATH=ml/outputs/xgboost_model.joblib
     ENABLE_REALTIME=true
     ENABLE_EXTERNAL_APIS=true
     ```

4. **Deploy:**
   - Click "Create Web Service"
   - Wait ~5 minutes for build
   - Note your backend URL: `https://powercast-ai-backend.onrender.com`

### 4.2 Deploy Frontend to Vercel

1. **Push to GitHub** (if not already done)

2. **Import to Vercel:**
   - Go to https://vercel.com
   - Click "Add New" → "Project"
   - Import your GitHub repo
   - Configure:
     - **Framework Preset:** Next.js
     - **Build Command:** `pnpm build`
     - **Output Directory:** `.next`

3. **Add Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_API_URL=https://powercast-ai-backend.onrender.com
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait ~3 minutes
   - Your app is live at: `https://powercast-ai.vercel.app`

### 4.3 Update CORS Settings

1. **Backend:** Update `FRONTEND_URL` in Render environment variables:
   ```
   FRONTEND_URL=https://powercast-ai.vercel.app
   ```

2. **Supabase:** Add to allowed domains:
   - Go to Authentication → URL Configuration
   - Add: `https://powercast-ai.vercel.app`

---

## 🔒 STEP 5: Security Checklist

- [ ] All `.env` files are in `.gitignore`
- [ ] Supabase RLS (Row Level Security) enabled
- [ ] CORS restricted to production domain only
- [ ] JWT secret is strong (32+ characters)
- [ ] Service role keys never exposed to frontend
- [ ] API rate limiting enabled
- [ ] HTTPS enforced on all endpoints

---

## 🧪 STEP 6: Test Your Deployment

### 6.1 Health Checks
```bash
# Backend health
curl https://powercast-ai-backend.onrender.com/health

# Database connection
curl https://powercast-ai-backend.onrender.com/api/v1/plants
```

### 6.2 Frontend Test
1. Open: `https://powercast-ai.vercel.app`
2. Sign up for account
3. Upload CSV data
4. Check forecast charts
5. Verify real-time updates

---

## 🐛 Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify all environment variables are set
- Ensure `requirements.txt` is up to date

### Frontend can't connect to backend
- Check CORS settings in backend
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check browser console for errors

### Supabase connection failed
- Verify URL and keys are correct
- Check Supabase project is not paused
- Ensure RLS policies allow access

### External APIs not working
- Fallback to simulated data is automatic
- Check API keys are valid
- Verify rate limits not exceeded

---

## 📊 Monitoring

### Render Logs
```bash
# View live logs
render logs -s powercast-ai-backend --tail
```

### Supabase Logs
- Go to Logs → API Logs
- Filter by status code / endpoint

### Vercel Logs
- Go to project → Deployments → Click deployment → Logs

---

## 💰 Cost Estimate

**Free Tier (Good for development):**
- Supabase: Free (500MB DB, 50k MAU)
- Render: Free (750 hrs/mo, sleeps after inactivity)
- Vercel: Free (100GB bandwidth)
- **Total: $0/month**

**Production (Recommended):**
- Supabase Pro: $25/mo (8GB DB, 100k MAU, backups)
- Render Starter: $7/mo (always on, 512MB RAM)
- Vercel Pro: $20/mo (unlimited sites, analytics)
- **Total: $52/month**

---

## 🆘 Support

- **Issues:** GitHub Issues
- **Docs:** This file + code comments
- **Supabase Docs:** https://supabase.com/docs
- **Render Docs:** https://render.com/docs

