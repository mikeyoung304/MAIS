# Deployment Guide - Elope Wedding Booking Platform

Complete guide for deploying Elope to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Migration](#database-migration)
- [Credential Setup](#credential-setup)
- [Deployment Methods](#deployment-methods)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Accounts & Services

- **Supabase Account** (free tier sufficient for small deployments)
  - PostgreSQL 15+ database
  - Connection pooling enabled
  - Backups configured

- **Stripe Account** (live mode)
  - Business verification completed
  - Bank account connected
  - Webhook endpoints configured

- **Postmark Account** (optional but recommended)
  - Domain verified
  - Sender signatures configured
  - Monthly sending limits reviewed

- **Google Cloud Platform** (optional, for calendar integration)
  - Service account created
  - Calendar API enabled
  - Calendar sharing configured

### Infrastructure Requirements

**Minimum Production Specs:**

- **CPU**: 2 vCPUs
- **Memory**: 4GB RAM
- **Storage**: 20GB SSD
- **Network**: 100Mbps bandwidth
- **OS**: Ubuntu 22.04 LTS or similar

**Recommended Production Specs:**

- **CPU**: 4 vCPUs
- **Memory**: 8GB RAM
- **Storage**: 50GB SSD
- **Network**: 1Gbps bandwidth
- **OS**: Ubuntu 22.04 LTS

### Software Requirements

- **Node.js**: v20.x or later
- **npm**: v8.x or later
- **PostgreSQL**: v15 or later (via Supabase)
- **Process Manager**: PM2, systemd, or Docker
- **Reverse Proxy**: nginx or Caddy (for SSL/TLS)
- **Git**: For deployment automation

---

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository to your server
git clone https://github.com/yourusername/elope.git
cd elope

# Checkout the specific release version
git checkout v1.1.0
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm run doctor
```

### 3. Configure Environment Variables

Create production environment file:

```bash
# Create production .env file
cp server/.env.example server/.env.production
```

Edit `server/.env.production` with production values:

```bash
# ============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ============================================================================

# ----------------------------------------------------------------------------
# APPLICATION MODE
# ----------------------------------------------------------------------------
ADAPTERS_PRESET=real
NODE_ENV=production

# ----------------------------------------------------------------------------
# SERVER CONFIGURATION
# ----------------------------------------------------------------------------
API_PORT=3001
CORS_ORIGIN=https://yourdomain.com

# ----------------------------------------------------------------------------
# SECURITY - JWT AUTHENTICATION
# ----------------------------------------------------------------------------
# CRITICAL: Generate using: openssl rand -hex 32
# NEVER reuse across environments or expose publicly
JWT_SECRET=<your-64-character-hex-string-here>

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# ----------------------------------------------------------------------------
# Get from Supabase: Project Settings > Database > Connection String
# Use Transaction Mode pooler (port 5432) for Prisma
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require

# ----------------------------------------------------------------------------
# SUPABASE CONFIGURATION
# ----------------------------------------------------------------------------
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# ----------------------------------------------------------------------------
# MULTI-TENANT ENCRYPTION
# ----------------------------------------------------------------------------
# CRITICAL: Generate using: openssl rand -hex 32
# Backup this key securely - losing it means losing tenant secrets!
TENANT_SECRETS_ENCRYPTION_KEY=<your-64-character-hex-string-here>

# ----------------------------------------------------------------------------
# STRIPE CONFIGURATION (LIVE MODE)
# ----------------------------------------------------------------------------
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY

# Get from: https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Production URLs
STRIPE_SUCCESS_URL=https://yourdomain.com/booking/success
STRIPE_CANCEL_URL=https://yourdomain.com/booking/canceled

# ----------------------------------------------------------------------------
# EMAIL CONFIGURATION
# ----------------------------------------------------------------------------
# Postmark production credentials
POSTMARK_SERVER_TOKEN=<your-postmark-token>
POSTMARK_FROM_EMAIL=bookings@yourdomain.com

# ----------------------------------------------------------------------------
# CALENDAR INTEGRATION (Optional)
# ----------------------------------------------------------------------------
GOOGLE_CALENDAR_ID=<your-calendar-id>
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64-encoded-service-account-json>

# ----------------------------------------------------------------------------
# ADMIN USER (Change Immediately After First Login)
# ----------------------------------------------------------------------------
ADMIN_DEFAULT_PASSWORD=<strong-initial-password-change-after-login>
```

### 4. Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate tenant encryption key
openssl rand -hex 32

# Generate admin password (temporary)
openssl rand -base64 24
```

**IMPORTANT**: Store these secrets securely in a password manager or secrets vault!

---

## Database Migration

### 1. Verify Database Connection

```bash
# Test database connectivity
psql "$DATABASE_URL" -c "SELECT 1;"
# Expected: Returns 1
```

### 2. Run Prisma Migrations

```bash
cd server

# Generate Prisma client
npx prisma generate

# Apply all pending migrations (production)
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### 3. Seed Initial Data (Optional)

```bash
# Seed the database with initial data
npm run db:seed

# This creates:
# - Default platform admin user
# - Sample tenant (for testing)
# - Sample packages and add-ons
```

### 4. Verify Database Schema

```bash
# Connect to database
psql "$DATABASE_URL"

# Check tables exist
\dt

# Expected tables:
# - User
# - Tenant
# - Package
# - AddOn
# - Booking
# - Customer
# - Blackout
# - WebhookEvent
# - PaymentIntent

# Verify package photos column
\d "Package"
# Should show "photos" column with type "jsonb"

# Exit psql
\q
```

---

## Credential Setup

### Stripe Live Mode

1. **Enable Live Mode**
   - Go to Stripe Dashboard
   - Toggle to "Live Mode" (top right)
   - Complete business verification if not done

2. **Get API Keys**
   - Navigate to: Developers > API Keys
   - Copy "Secret key" (starts with `sk_live_`)
   - Add to `STRIPE_SECRET_KEY` in .env.production

3. **Configure Webhook Endpoint**
   - Navigate to: Developers > Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://yourdomain.com/v1/webhooks/stripe`
   - Events to send:
     - `checkout.session.completed`
     - `charge.succeeded`
     - `charge.failed`
   - Copy "Signing secret" (starts with `whsec_`)
   - Add to `STRIPE_WEBHOOK_SECRET` in .env.production

4. **Test Webhook Delivery**
   ```bash
   # Send test event from Stripe dashboard
   # Verify it appears in your application logs
   ```

### Postmark Email

1. **Verify Domain**
   - Go to Postmark > Sender Signatures
   - Add your domain (e.g., yourdomain.com)
   - Add DNS records (DKIM, CNAME)
   - Verify domain ownership

2. **Get Server Token**
   - Navigate to: Servers > API Tokens
   - Copy "Server API token"
   - Add to `POSTMARK_SERVER_TOKEN` in .env.production

3. **Test Email Delivery**
   ```bash
   # Use Postmark API to send test email
   curl -X POST "https://api.postmarkapp.com/email" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
     -d '{
       "From": "bookings@yourdomain.com",
       "To": "your-email@example.com",
       "Subject": "Test Email",
       "TextBody": "This is a test email from Elope."
     }'
   ```

### Google Calendar (Optional)

1. **Create Service Account**
   - Go to: Google Cloud Console > IAM & Admin > Service Accounts
   - Create service account
   - Generate JSON key
   - Base64 encode the JSON:
     ```bash
     cat service-account.json | base64 -w 0
     ```
   - Add to `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`

2. **Share Calendar**
   - Open Google Calendar
   - Settings > Share with specific people
   - Add service account email (e.g., `elope@project.iam.gserviceaccount.com`)
   - Permission: "Make changes to events"

3. **Get Calendar ID**
   - Calendar Settings > Integrate calendar
   - Copy "Calendar ID"
   - Add to `GOOGLE_CALENDAR_ID`

---

## Deployment Methods

### Option A: Docker Deployment (Recommended)

1. **Build Docker Image**

   ```bash
   # Build server image
   docker build -t elope/api:v1.1.0 -f server/Dockerfile .

   # Build client image
   docker build -t elope/web:v1.1.0 -f client/Dockerfile .
   ```

2. **Create Docker Compose File**

   ```yaml
   # docker-compose.production.yml
   version: '3.8'

   services:
     api:
       image: elope/api:v1.1.0
       container_name: elope-api
       restart: unless-stopped
       env_file: server/.env.production
       ports:
         - '3001:3001'
       volumes:
         - ./server/uploads:/app/server/uploads
       healthcheck:
         test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
         interval: 30s
         timeout: 10s
         retries: 3
         start_period: 40s

     web:
       image: elope/web:v1.1.0
       container_name: elope-web
       restart: unless-stopped
       ports:
         - '3000:80'
       depends_on:
         - api
       environment:
         - VITE_API_URL=https://api.yourdomain.com
   ```

3. **Start Services**

   ```bash
   docker-compose -f docker-compose.production.yml up -d

   # Verify services are running
   docker-compose -f docker-compose.production.yml ps

   # Check logs
   docker-compose -f docker-compose.production.yml logs -f api
   ```

### Option B: PM2 Deployment

1. **Install PM2**

   ```bash
   npm install -g pm2
   ```

2. **Create PM2 Ecosystem File**

   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [
       {
         name: 'elope-api',
         cwd: './server',
         script: 'dist/index.js',
         env_production: {
           NODE_ENV: 'production',
           ADAPTERS_PRESET: 'real',
         },
         instances: 2,
         exec_mode: 'cluster',
         max_memory_restart: '500M',
         error_file: './logs/api-error.log',
         out_file: './logs/api-out.log',
         log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       },
     ],
   };
   ```

3. **Build and Start**

   ```bash
   # Build server
   cd server
   npm run build

   # Start with PM2
   pm2 start ecosystem.config.js --env production

   # Save PM2 process list
   pm2 save

   # Setup PM2 startup script
   pm2 startup
   ```

4. **Serve Client**

   ```bash
   # Build client
   cd client
   npm run build

   # Serve with nginx (config below)
   ```

### Option C: Systemd Service

1. **Create Systemd Service**

   ```ini
   # /etc/systemd/system/elope-api.service
   [Unit]
   Description=Elope Wedding Booking API
   After=network.target

   [Service]
   Type=simple
   User=elope
   WorkingDirectory=/opt/elope/server
   EnvironmentFile=/opt/elope/server/.env.production
   ExecStart=/usr/bin/node dist/index.js
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and Start**

   ```bash
   # Reload systemd
   sudo systemctl daemon-reload

   # Enable service
   sudo systemctl enable elope-api

   # Start service
   sudo systemctl start elope-api

   # Check status
   sudo systemctl status elope-api

   # View logs
   sudo journalctl -u elope-api -f
   ```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/elope

# API Server
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase body size for photo uploads
    client_max_body_size 10M;
}

# Web Client
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /opt/elope/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# API health check
curl https://api.yourdomain.com/health
# Expected: {"ok":true}

# Database connectivity
curl https://api.yourdomain.com/health/db
# Expected: {"ok":true,"database":"connected"}
```

### 2. Authentication Test

```bash
# Login as platform admin
curl -X POST https://api.yourdomain.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-admin-password"
  }'

# Expected: {"token":"eyJhbG...","user":{...}}
```

### 3. Create Test Tenant

```bash
cd server
npm run create-tenant -- \
  --name "Test Tenant" \
  --slug "test-tenant" \
  --email "test@yourdomain.com" \
  --commission 12.5

# Save the API keys returned!
```

### 4. Test Photo Upload

```bash
# Upload a test photo
curl -X POST https://api.yourdomain.com/v1/tenant/admin/packages/PKG_ID/photos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@test-photo.jpg"

# Expected: {"url":"...","filename":"...","size":...,"order":0}
```

### 5. Test Stripe Webhook

```bash
# Send test webhook from Stripe Dashboard
# Developers > Webhooks > Your endpoint > Send test webhook

# Verify in application logs
docker logs elope-api | grep "webhook"
# OR
pm2 logs elope-api | grep "webhook"
```

---

## Monitoring & Maintenance

### Application Monitoring

**Recommended Tools:**

- **Sentry** - Error tracking and performance monitoring
- **DataDog** - Infrastructure and application metrics
- **UptimeRobot** - Uptime monitoring and alerts
- **LogDNA** - Log aggregation and search

### Health Check Endpoints

Monitor these endpoints:

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity
- `GET /ready` - Readiness probe (used by load balancers)

### Log Management

```bash
# Docker logs
docker logs -f elope-api
docker logs --since 1h elope-api

# PM2 logs
pm2 logs elope-api
pm2 logs --lines 100

# Systemd logs
journalctl -u elope-api -f
journalctl -u elope-api --since "1 hour ago"
```

### Database Backups

Supabase provides automatic backups:

- **Free tier**: Daily backups, 7-day retention
- **Pro tier**: Daily backups, configurable retention

**Manual backup:**

```bash
# Backup database
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# Compress backup
gzip backup-$(date +%Y%m%d).sql

# Upload to S3/cloud storage
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://your-bucket/backups/
```

### Update Procedure

```bash
# 1. Pull latest code
git fetch --tags
git checkout v1.2.0

# 2. Install dependencies
npm install

# 3. Run migrations
cd server
npx prisma migrate deploy

# 4. Build application
npm run build

# 5. Restart services
docker-compose restart
# OR
pm2 restart elope-api
# OR
sudo systemctl restart elope-api

# 6. Verify health
curl https://api.yourdomain.com/health
```

---

## Rollback Procedures

### Quick Rollback

```bash
# 1. Stop current version
docker-compose down
# OR
pm2 stop elope-api

# 2. Checkout previous version
git checkout v1.0.0

# 3. Restore database (if migration was applied)
psql "$DATABASE_URL" < backup-previous-version.sql

# 4. Rebuild and restart
npm install
npm run build
docker-compose up -d
# OR
pm2 start elope-api

# 5. Verify
curl https://api.yourdomain.com/health
```

### Database Rollback

If a migration needs to be rolled back:

```bash
# WARNING: This can cause data loss!

# 1. Create backup first
pg_dump "$DATABASE_URL" > backup-before-rollback.sql

# 2. Manually revert migration
psql "$DATABASE_URL"

# 3. Drop added columns/tables
ALTER TABLE "Package" DROP COLUMN IF EXISTS "photos";

# 4. Regenerate Prisma client
npx prisma generate

# 5. Restart application
```

---

## Security Checklist

Before going live:

- [ ] All environment variables use production values
- [ ] JWT_SECRET is cryptographically secure (64+ characters)
- [ ] TENANT_SECRETS_ENCRYPTION_KEY is backed up securely
- [ ] Stripe is in live mode with webhook secret configured
- [ ] SSL/TLS certificates are valid and auto-renewing
- [ ] CORS_ORIGIN is set to production domain only
- [ ] Database uses SSL/TLS connections
- [ ] Admin default password has been changed
- [ ] Firewall rules limit access to necessary ports only
- [ ] Rate limiting is enabled (login, API endpoints)
- [ ] Monitoring and alerting are configured
- [ ] Backups are automated and tested
- [ ] Incident response plan is documented

---

## Support & Troubleshooting

**Common Issues:**

1. **Database connection fails**
   - Verify DATABASE_URL is correct
   - Check Supabase project isn't paused
   - Ensure firewall allows outbound PostgreSQL connections

2. **Stripe webhooks not received**
   - Verify webhook endpoint URL is publicly accessible
   - Check STRIPE_WEBHOOK_SECRET matches dashboard
   - Test webhook delivery from Stripe dashboard

3. **Photos not uploading**
   - Check `/server/uploads/packages/` directory exists and is writable
   - Verify nginx client_max_body_size is set to 10M+
   - Check server disk space

4. **Application crashes on startup**
   - Review logs for specific error
   - Verify all environment variables are set
   - Run `npm run doctor` to check configuration

For additional help:

- Review [RUNBOOK.md](./docs/operations/RUNBOOK.md)
- Check [INCIDENT_RESPONSE.md](./docs/operations/INCIDENT_RESPONSE.md)
- Open a GitHub issue

---

**Last Updated:** November 7, 2025
**Version:** v1.1.0
