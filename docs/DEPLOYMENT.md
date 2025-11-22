# PulseAPI Deployment Guide

This guide covers various deployment scenarios for PulseAPI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### System Requirements

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (for containerized deployment)
- 2GB+ RAM (recommended)
- 10GB+ disk space

### Required Knowledge

- Basic Linux/Unix commands
- Docker basics (for containerized deployment)
- PostgreSQL administration
- Node.js application deployment

## Local Development

### 1. Clone Repository

```bash
git clone <repository-url>
cd creativity
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend and frontend dependencies
npm run install:all
```

### 3. Set Up Environment Variables

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pulseapi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-development-secret-key
CORS_ORIGIN=http://localhost:3000
```

**Frontend** (`frontend/.env`):
```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
```

### 4. Set Up Database

```bash
# Create database
createdb pulseapi

# Run migrations
npm run migrate
```

### 5. Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start separately:
npm run dev:backend  # Backend on port 5000
npm run dev:frontend # Frontend on port 3000
```

### 6. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/health

### Default Credentials

```
Email: admin@pulseapi.dev
Password: admin123
```

**⚠️ Change these credentials immediately in production!**

## Docker Deployment

### Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec backend npm run migrate

# Stop services
docker-compose down
```

### Services

The Docker Compose stack includes:

- **postgres**: PostgreSQL 14 (port 5432)
- **redis**: Redis 7 (port 6379)
- **backend**: Node.js API server (port 5000)
- **frontend**: Nginx serving React app (port 3000)

### Persistent Data

Data is persisted in Docker volumes:

- `postgres_data`: Database files
- `redis_data`: Redis data

To backup:
```bash
docker-compose exec postgres pg_dump -U postgres pulseapi > backup.sql
```

To restore:
```bash
docker-compose exec -T postgres psql -U postgres pulseapi < backup.sql
```

### Environment Configuration

Create `.env` file in root directory:

```env
JWT_SECRET=your-production-secret-key-change-this
```

### Scaling

Scale backend instances:
```bash
docker-compose up -d --scale backend=3
```

**Note**: Requires load balancer configuration.

## Production Deployment

### Option 1: Traditional VPS/Server

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-14

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Database Setup

```bash
# Create database and user
sudo -u postgres psql

CREATE DATABASE pulseapi;
CREATE USER pulseapi WITH ENCRYPTED PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE pulseapi TO pulseapi;
\q
```

#### 3. Application Setup

```bash
# Create application directory
sudo mkdir -p /var/www/pulseapi
sudo chown $USER:$USER /var/www/pulseapi
cd /var/www/pulseapi

# Clone repository
git clone <repository-url> .

# Install dependencies
cd backend && npm ci --only=production
cd ../frontend && npm ci

# Build frontend
npm run build
```

#### 4. Configure Environment

Create `backend/.env`:
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://pulseapi:secure-password@localhost:5432/pulseapi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secure-jwt-secret-change-this
CORS_ORIGIN=https://yourdomain.com
```

#### 5. Run Migrations

```bash
cd backend
npm run migrate
```

#### 6. Configure Nginx

Create `/etc/nginx/sites-available/pulseapi`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/pulseapi/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/pulseapi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 7. Set Up SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

#### 8. Start Application with PM2

```bash
cd /var/www/pulseapi/backend

# Start with PM2
pm2 start src/server.js --name pulseapi-backend

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

#### 9. Configure Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Option 2: Docker on Production Server

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository
git clone <repository-url> pulseapi
cd pulseapi

# Create production environment file
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
EOF

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# Set up SSL with Nginx proxy
# (Use nginx-proxy or Traefik for automatic SSL)
```

### Option 3: Cloud Platform Deployment

#### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create pulseapi-app

# Add PostgreSQL and Redis
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

#### AWS (EC2 + RDS + ElastiCache)

1. Launch EC2 instance (t3.medium or larger)
2. Create RDS PostgreSQL instance
3. Create ElastiCache Redis cluster
4. Follow "Traditional VPS/Server" setup
5. Configure security groups
6. Set up Application Load Balancer (optional)

#### DigitalOcean App Platform

1. Connect GitHub repository
2. Configure build settings:
   - Backend: Node.js service
   - Frontend: Static site
3. Add PostgreSQL and Redis managed databases
4. Set environment variables
5. Deploy

## Environment Variables

### Backend Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 5000 |
| NODE_ENV | Environment | No | development |
| DATABASE_URL | PostgreSQL connection string | Yes | - |
| REDIS_URL | Redis connection string | Yes | - |
| JWT_SECRET | JWT signing secret | Yes | - |
| JWT_EXPIRES_IN | JWT expiration time | No | 7d |
| CORS_ORIGIN | Allowed CORS origin | Yes | - |
| DEFAULT_CHECK_INTERVAL | Default monitor interval (ms) | No | 60000 |
| RATE_LIMIT_WINDOW_MS | Rate limit window | No | 900000 |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | No | 100 |

### Frontend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| REACT_APP_API_URL | Backend API URL | Yes |
| REACT_APP_WS_URL | WebSocket URL | Yes |

## Database Setup

### Manual Migration

```bash
cd backend
node migrations/run.js
```

### Rollback (Manual)

Rollback is manual. To revert:

1. Backup your database
2. Drop tables or restore from backup
3. Re-run migrations

### Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres pulseapi > "backup_${DATE}.sql"
gzip "backup_${DATE}.sql"
```

Schedule with cron:
```bash
0 2 * * * /path/to/backup-script.sh
```

## Monitoring & Maintenance

### Application Logs

**PM2**:
```bash
pm2 logs pulseapi-backend
pm2 logs --lines 100
```

**Docker**:
```bash
docker-compose logs -f backend
docker-compose logs -f --tail=100
```

### Health Checks

**API Health**:
```bash
curl http://localhost:5000/health
```

**Database**:
```bash
psql -U postgres -d pulseapi -c "SELECT version();"
```

**Redis**:
```bash
redis-cli ping
```

### Performance Monitoring

Install monitoring tools:

```bash
# PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# System monitoring
sudo apt install htop iotop
```

### Database Maintenance

**Vacuum and analyze**:
```sql
VACUUM ANALYZE;
```

**Check table sizes**:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Updating Application

```bash
# Traditional deployment
cd /var/www/pulseapi
git pull
cd backend && npm ci --only=production
cd ../frontend && npm ci && npm run build
npm run migrate
pm2 restart pulseapi-backend

# Docker deployment
cd pulseapi
git pull
docker-compose build
docker-compose up -d
docker-compose exec backend npm run migrate
```

## Troubleshooting

### Backend won't start

Check logs:
```bash
pm2 logs pulseapi-backend --err
```

Common issues:
- Database connection failed → Check DATABASE_URL
- Redis connection failed → Check REDIS_URL
- Port already in use → Change PORT or kill process

### Frontend shows 404 on refresh

Ensure Nginx is configured to serve index.html for all routes:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### WebSocket connection fails

- Check CORS_ORIGIN matches frontend domain
- Ensure nginx proxy passes WebSocket upgrade headers
- Verify firewall allows WebSocket connections

### High database CPU usage

- Add indexes on frequently queried columns
- Implement query result caching
- Archive old monitor_checks data
- Enable connection pooling

## Security Checklist

- [ ] Change default admin credentials
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable rate limiting
- [ ] Update dependencies regularly
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Restrict database access
- [ ] Enable Redis authentication (production)
- [ ] Set up monitoring and alerting
- [ ] Review and rotate API keys

## Support

For issues and questions:
- GitHub Issues: [Repository Issues]
- Documentation: [docs/]
- Email: support@pulseapi.dev
