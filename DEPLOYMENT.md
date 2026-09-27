# Production Deployment Guide — RocketWheel MedPulse

This guide provides end-to-end instructions for deploying the **Multi-Hospital Doctor Appointment Booking Platform** into production environments.

---

## 1. System Architecture Overview

```
                          [ Client Browsers / Mobile Devices ]
                                          │
                                    (HTTPS: 443)
                                          ▼
                         [ Cloudflare / Nginx Reverse Proxy ]
                          │                                │
                  (Static Assets)                  (/api/ Forwarding)
                          ▼                                ▼
            [ Frontend Nginx Container ]        [ Backend Express Container ]
            (React 18 SPA + Vite Build)          (Node.js 20+ TypeScript API)
                                                           │
                                          ┌────────────────┴────────────────┐
                                          ▼                                 ▼
                             [ PostgreSQL Database ]                 [ Redis Cache ]
                              (Port 5432 / Managed)               (Port 6379 / OTP & Rate)
```

---

## 2. Production Environment Variables Matrix

Create a `.env` file in the `backend/` directory (or supply these variables via your cloud host environment manager):

| Variable | Description | Example / Production Value |
| :--- | :--- | :--- |
| `PORT` | API Server listening port | `5000` |
| `NODE_ENV` | Runtime environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@db-host:5432/medipulse_db?schema=public` |
| `JWT_SECRET` | Secret key for access tokens | `64+ char random hex string` |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `64+ char random hex string` |
| `JWT_EXPIRES_IN` | Access token lifespan | `2h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `CLIENT_URL` | Public frontend URL (for CORS) | `https://medipulse.org` |
| `BASE_URL` | Public API base URL | `https://api.medipulse.org` |
| `PLATFORM_FEE` | Flat convenience fee in INR | `20` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_live_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Key Secret | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `RAZORPAY_WEBHOOK_SECRET`| Razorpay Webhook Signing Secret | `xxxxxxxxxxxxxxxxxxxxxxxx` |

> [!IMPORTANT]
> Generate cryptographic secrets using:
> ```bash
> openssl rand -base64 48
> ```

---

## 3. Deployment Option A: Docker Compose on a Cloud VM (Recommended for Standalone Production)

Target hosts: **AWS EC2 (t3.medium or larger)**, **DigitalOcean Droplet (4GB RAM)**, **Hetzner Cloud (CPX21)**.

### Step 1: Server Provisioning & Prerequisites
Install Docker and Docker Compose on an Ubuntu 22.04 / 24.04 LTS instance:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker Engine & Compose plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

### Step 2: Clone Repository & Configure Environment
```bash
git clone https://github.com/akhilkrishnak25/rocketwheel_medpulse.git
cd rocketwheel_medpulse

# Prepare backend environment
cp backend/.env.example backend/.env
nano backend/.env
```

### Step 3: Switch Prisma to PostgreSQL Schema
Before building the container, configure Prisma to use the PostgreSQL datasource:

```bash
cp backend/prisma/schema.postgresql.prisma backend/prisma/schema.prisma
```

### Step 4: Launch Containers
Run Docker Compose in detached mode:

```bash
docker compose up -d --build
```

Verify service health:
```bash
docker compose ps
docker compose logs -f backend
```

### Step 5: Database Migration & Baseline Seed
Execute Prisma migration and seed inside the running backend container:

```bash
# Apply schema to PostgreSQL
docker compose exec backend npx prisma db push

# Seed baseline hospitals, specialties, doctors, and credentials
docker compose exec backend npm run seed
```

### Step 6: Configure SSL Certificate (Certbot + Nginx)
To attach an SSL certificate from Let's Encrypt for your domain:

```bash
sudo apt install -y certbot python3-certbot-nginx

# Obtain and automatically configure SSL certificate
sudo certbot --nginx -d medipulse.org -d api.medipulse.org
```

---

## 4. Deployment Option B: Managed PaaS (Vercel + Render / Railway + Neon PostgreSQL)

This approach eliminates infrastructure maintenance and leverages managed platforms.

### 1. Database: Neon Serverless PostgreSQL / Supabase
1. Create a project on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the pooled connection string `DATABASE_URL` (ensure `?sslmode=require`).

### 2. Backend API: Render / Railway
1. Connect your GitHub repository to [Render.com](https://render.com) or [Railway.app](https://railway.app).
2. Configure service settings:
   - **Root Directory**: `backend`
   - **Build Command**:
     ```bash
     cp prisma/schema.postgresql.prisma prisma/schema.prisma && npm ci && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma db push && node dist/server.js
     ```
3. Add Environment Variables:
   - `DATABASE_URL` = Your Neon PostgreSQL connection string
   - `NODE_ENV` = `production`
   - `PORT` = `5000` (or leave default on Render)
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `CLIENT_URL` = Your frontend URL (e.g. `https://medipulse.vercel.app`)

### 3. Frontend: Vercel / Cloudflare Pages
1. Import repository on [Vercel](https://vercel.com).
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add rewrites to `frontend/vercel.json` if proxying API requests under the same domain:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend-service.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

---

## 5. Post-Deployment Verification & Smoke Tests

Run these checks immediately after deployment:

### 1. API Health Check
```bash
curl -i https://<your-api-domain>/api/health
# Expected Response: 200 OK, { "status": "UP", "timestamp": "...", "uptime": ... }
```

### 2. Super Admin Initial Access
- URL: `https://<your-frontend-domain>/staff/login`
- Login with seeded Super Admin credentials:
  - **Email**: `superadmin@medipulse.org`
  - **Password**: `Password@123` (Must be changed immediately via Reset Password)

### 3. Hospital Admin Verification
- Login with seeded Apollo Admin:
  - **Email**: `admin.apollo@medipulse.org`
  - **Password**: `Password@123`
- Verify doctor rosters and pending approval queue.

### 4. Zero-Login Patient Booking Journey
- Access homepage as an anonymous user without logging in.
- Search for a doctor (e.g., Cardiology at Apollo).
- Pick an outpatient time slot, fill in patient phone and name.
- Complete simulated payment and verify download of the Digital OP registration card (`OP-APOL-XXXX`).

---

## 6. Security Hardening Checklist

- [ ] **HTTPS Enforced**: HTTP traffic automatically redirects (301) to HTTPS.
- [ ] **CORS Restricted**: `CLIENT_URL` in `backend/.env` is set strictly to the production frontend domain (wildcard `*` disabled).
- [ ] **JWT Key Rotation**: Production uses distinct, high-entropy secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- [ ] **Rate Limiting**: Express rate limiting enabled (`express-rate-limit`) on `/api/auth/login`, `/api/otp/send`, and `/api/appointments`.
- [ ] **Database Connection Security**: SSL connection required (`sslmode=require`) between backend and PostgreSQL.
- [ ] **Secrets Management**: No `.env` files committed to version control (`.gitignore` verified).

---

## 7. Backup, Disaster Recovery & Monitoring

### Automated Database Backup Cron
Add a daily cron job on the database server to backup PostgreSQL:

```bash
# Edit crontab
crontab -e

# Daily backup at 02:00 AM UTC
0 2 * * * docker compose exec -T postgres pg_dump -U medipulse_admin medipulse_db | gzip > /backups/medipulse_db_$(date +\%Y\%m\%d).sql.gz
```

### Log Inspection
```bash
# Follow backend logs
docker compose logs -f --tail=100 backend

# Follow frontend access logs
docker compose logs -f --tail=100 frontend
```

### Uptime Monitoring
Set up automated ping checks with **Better Stack**, **Uptime Kuma**, or **Datadog** monitoring:
- `GET https://<api-domain>/api/health`
- Interval: 60 seconds
- Alert notification: Slack / Email / PagerDuty
