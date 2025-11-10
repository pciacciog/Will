# Staging Deployment Strategy Guide

## ✅ Question 1: Health Check Endpoint - IMPLEMENTED

The `/api/health` endpoint is now live and enhanced! It returns:

```json
{
  "status": "ok",
  "environment": "development",
  "database": "development",
  "databaseConnected": true,
  "version": "1.0.0",
  "timestamp": "2025-11-10T11:21:47.470Z",
  "services": {
    "daily": "simulation",
    "pushNotifications": "simulation"
  }
}
```

**Test it:**
```bash
curl https://your-repl-url.repl.co/api/health
```

When running in staging mode, you'll see:
- `"environment": "staging"`
- `"database": "staging"`

---

## 🎯 Question 2: Staging Repl Clone Strategy - RECOMMENDED APPROACH

### **Recommended: Option A - Clone This Repl**

Based on architectural best practices, here's the recommended setup:

### Two-Repl Topology:

#### **This Repl (Production)**
- **Name**: Keep as-is (will-beta or whatever it's called now)
- **Purpose**: Production deployment only
- **Secrets**: `DATABASE_URL`, `DAILY_API_KEY`, `APNS_PRIVATE_KEY` (production values)
- **Deployment**: Click "Deploy" to push to production
- **Local Testing**: `npm run dev` for development testing

#### **New Repl (Staging)**
- **Name**: `will-staging` (clone this Repl)
- **Purpose**: Staging environment testing
- **Secrets**: `DATABASE_URL_STAGING`, staging API keys
- **Deployment**: Manually deploy or keep as development
- **Default Run**: Modify to always use `npm run dev:staging`

---

### Step-by-Step Clone Setup:

1. **Clone This Repl**
   - Click the three dots menu → "Fork" or create a new Repl by importing
   - Name it `will-staging`

2. **Configure Staging Repl**
   
   In the cloned `will-staging` Repl:
   
   a. **Update `.replit` file** to default to staging:
   ```toml
   run = "npm run dev:staging"
   
   [deployment]
   deploymentTarget = "autoscale"
   build = ["npm", "run", "build"]
   run = ["sh", "-c", "NODE_ENV=staging npm run start"]
   ```
   
   b. **Add Staging Secrets** (in the staging Repl only):
   - `DATABASE_URL_STAGING` = your Neon staging database URL
   - `DAILY_API_KEY` = staging/test API key (if different)
   - `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, etc. = development certificates
   
   c. **Remove Production Secrets** from staging Repl:
   - Delete `DATABASE_URL` (to prevent accidental production access)

3. **Configure Production Repl**
   
   In this Repl (production):
   
   - **Keep** `DATABASE_URL` = production Neon database
   - **Add** `DATABASE_URL_STAGING` = staging database (for local testing only)
   - Leave `.replit` as-is (defaults to production deployment)

---

### Why Two Repls?

**Security & Isolation**:
- Staging secrets stay in staging Repl
- Production secrets stay in production Repl
- No risk of accidentally using wrong database

**Clear Separation**:
- Staging Repl = Always runs in staging mode
- Production Repl = Always deploys to production
- No environment confusion

**Deployment Safety**:
- Click "Deploy" in production Repl → production deployment
- Click "Deploy" in staging Repl → staging deployment (if needed)
- Can't accidentally deploy staging to production

---

## 🚀 Question 3: Current Deployment - SAFE TO DEPLOY

### Analysis of Your `.replit` File:

```toml
[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]
```

Your `package.json` shows:
```json
"start": "NODE_ENV=production node dist/index.js"
```

### ✅ Deployment is Safe:

**YES**, it's safe to deploy from this Repl because:

1. **Deployment uses `npm run start`** → sets `NODE_ENV=production`
2. **Production mode uses `DATABASE_URL`** → your production database
3. **Staging database (`DATABASE_URL_STAGING`)** is only used when `NODE_ENV=staging`

**Your deployment will:**
- ✅ Use `DATABASE_URL` (production)
- ✅ Set `NODE_ENV=production`
- ✅ Connect to production database
- ✅ Ignore `DATABASE_URL_STAGING` completely

**Safe to deploy as long as:**
- `DATABASE_URL` secret is set to your production Neon database
- You don't manually set `NODE_ENV=staging` in deployment

---

## 📋 Complete Workflow

### This Repl (Production):

**Development Testing:**
```bash
npm run dev                    # Test against production DB locally
npm run dev:staging            # Test against staging DB locally
```

**Deployment:**
```bash
# Just click "Deploy" button in Replit
# OR manually:
npm run build
npm run start
```

### Staging Repl (After Cloning):

**Development:**
```bash
# Default run command (automatically staging)
npm run dev:staging
```

**Database Operations:**
```bash
npm run db:push:staging        # Push schema to staging
npm run seed:staging           # Seed test data
```

**Deployment (if needed):**
```bash
# Click "Deploy" in staging Repl
# Deploys with NODE_ENV=staging to autoscale
```

---

## 🔒 Security Checklist

### In Production Repl:
- [ ] `DATABASE_URL` = Production Neon database
- [ ] `DATABASE_URL_STAGING` = Staging database (for local testing only)
- [ ] `DAILY_API_KEY` = Production Daily.co key
- [ ] `APNS_PRIVATE_KEY` = Production APNs certificate
- [ ] `.replit` deployment set to `npm run start`

### In Staging Repl:
- [ ] `DATABASE_URL_STAGING` = Staging Neon database
- [ ] `DAILY_API_KEY` = Test/staging Daily.co key
- [ ] `APNS_PRIVATE_KEY` = Development APNs certificate
- [ ] **NO** `DATABASE_URL` secret (prevents production access)
- [ ] `.replit` run command set to `npm run dev:staging`
- [ ] `.replit` deployment set to staging mode

---

## 🎯 Recommended Next Steps

1. **Complete Neon Setup** (as planned):
   - Create `will_staging` database in Neon
   - Copy connection string

2. **Add Staging Secret** (in this Repl for testing):
   - Add `DATABASE_URL_STAGING` secret here

3. **Test Staging Mode** (in this Repl):
   ```bash
   npm run db:push:staging
   npm run seed:staging
   npm run dev:staging
   ```
   
   Then visit: `http://localhost:5000/api/health`
   
   Should show: `"environment": "staging"`, `"database": "staging"`

4. **Clone Repl for Staging**:
   - Fork/clone this Repl → name it `will-staging`
   - Update `.replit` to default to staging mode
   - Move `DATABASE_URL_STAGING` secret to staging Repl
   - Remove `DATABASE_URL` from staging Repl

5. **Deploy Production** (from this Repl):
   - Click "Deploy" button
   - Verify via `/api/health` endpoint shows production mode

---

## 💡 Pro Tips

### Environment Verification:

Always check the health endpoint after starting:

```bash
# Development
curl http://localhost:5000/api/health
# Should show: "environment": "development"

# Staging
curl http://localhost:5000/api/health
# Should show: "environment": "staging", "database": "staging"

# Production (after deploy)
curl https://your-deployed-url.repl.co/api/health
# Should show: "environment": "production", "database": "production"
```

### Quick Environment Switch (Single Repl):

If you want to test both environments in one Repl before cloning:

```bash
# Test development
npm run dev

# Test staging
npm run dev:staging

# Never run production mode locally unless testing deployment
NODE_ENV=production npm run start
```

### Neon Database URLs:

Make sure your connection strings include:
- `?sslmode=require` at the end
- Correct database name in the path

Example:
```
postgresql://user:pass@ep-xxx.region.aws.neon.tech/will_production?sslmode=require
postgresql://user:pass@ep-xxx.region.aws.neon.tech/will_staging?sslmode=require
```

---

## ❓ Questions?

If you need any clarification or run into issues:
1. Check `/api/health` endpoint to verify environment
2. Check server logs for database connection messages
3. Verify secrets are set correctly in each Repl

Good luck with your staging setup! 🎉
