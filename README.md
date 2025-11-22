# PulseAPI - Advanced API Monitoring & Incident Management Platform

![PulseAPI](https://img.shields.io/badge/status-production-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## 🚀 Overview

PulseAPI is a comprehensive, production-ready SaaS platform for API monitoring, analytics, and incident management. Built for modern development teams who need reliable, real-time insights into their API infrastructure without breaking the bank.

### Why PulseAPI?

- **Real-time Monitoring**: Track API health with sub-second precision
- **Intelligent Alerting**: AI-powered anomaly detection and smart notifications
- **Rich Analytics**: p50/p95/p99 latency, error rates, uptime SLA tracking
- **Multi-tenant**: Built for teams with role-based access control
- **Beautiful UI**: Modern, responsive dashboard with real-time updates
- **Status Pages**: Auto-generated public status pages for your APIs
- **Affordable**: Open-source alternative to expensive monitoring solutions

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL (time-series optimized)
- Redis (caching & pub/sub)
- WebSockets (real-time updates)
- Bull (job queue)

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS
- Recharts (analytics)
- Socket.io Client

**DevOps:**
- Docker & Docker Compose
- PostgreSQL migrations
- Environment-based config

### Key Features

✅ **Multi-tenant Architecture** - Separate data per organization
✅ **Real-time Dashboard** - Live updates via WebSockets
✅ **Advanced Metrics** - Response time percentiles, error categorization
✅ **Incident Management** - Auto-detection and team collaboration
✅ **Custom Alert Rules** - Flexible conditions and notification channels
✅ **Status Pages** - Public-facing service health pages
✅ **Anomaly Detection** - ML-based performance anomaly detection
✅ **Geographic Monitoring** - Multi-region health checks
✅ **API-first Design** - Comprehensive REST API

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd creativity

# Install dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure your database and Redis in backend/.env

# Run migrations
npm run migrate

# Start the application
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Using Docker

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# View logs
docker-compose logs -f
```

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Guide](docs/USER_GUIDE.md)

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/pulseapi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
NODE_ENV=development
```

**Frontend** (`frontend/.env`):
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend
```

## 📊 Features in Detail

### Monitoring Engine
- Configurable check intervals (30s to 24h)
- HTTP/HTTPS endpoint monitoring
- Custom headers and request bodies
- SSL certificate validation
- Response time tracking
- Status code validation

### Analytics Dashboard
- Real-time performance charts
- Response time distribution (p50, p95, p99)
- Error rate trending
- Uptime percentage
- Geographic latency heatmaps
- Comparative analysis

### Incident Management
- Automatic incident creation
- Severity classification
- Team notifications
- Resolution tracking
- Post-mortem timeline
- Integration with Slack/PagerDuty

### Status Pages
- Custom subdomain or domain
- Real-time status updates
- Historical uptime data
- Maintenance scheduling
- Subscriber notifications

## 🛣️ Roadmap

- [ ] Mobile app (iOS/Android)
- [ ] GraphQL API support
- [ ] Integration marketplace (Slack, Teams, Discord)
- [ ] Advanced security scanning
- [ ] Performance recommendations
- [ ] Custom dashboards with widgets

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## 💬 Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Email: support@pulseapi.dev

---

Built with ❤️ for developers who care about reliability
