# PulseAPI Architecture Documentation

## System Overview

PulseAPI is a full-stack SaaS application built with a modern, scalable architecture designed for high performance and real-time capabilities.

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ (with time-series optimizations)
- **Cache/Pub-Sub**: Redis 6+
- **Real-time**: Socket.IO (WebSocket)
- **Job Queue**: Bull
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, bcrypt, express-rate-limit

### Frontend
- **Framework**: React 18
- **Language**: JavaScript (ES6+)
- **Routing**: React Router v6
- **State Management**: React Context API
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **Notifications**: React Hot Toast

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (for frontend)
- **Process Management**: PM2 (optional)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Browser   │  │   Mobile    │  │  API Client │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                ┌───────┴────────┐
                │                │
        HTTP/REST          WebSocket
                │                │
┌───────────────┴────────────────┴───────────────────────────┐
│                    Application Layer                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Express.js API Server                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │    │
│  │  │   Auth   │  │ Monitors │  │Incidents │         │    │
│  │  └──────────┘  └──────────┘  └──────────┘         │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Socket.IO Server (Real-time)              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────┬──────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
┌───────────┴────────┐      ┌──────────┴──────────┐
│  Monitoring Engine │      │   Background Jobs   │
│  ┌──────────────┐  │      │  ┌──────────────┐  │
│  │ Health Checks│  │      │  │Daily Stats   │  │
│  │ (Intervals)  │  │      │  │Calculations  │  │
│  └──────────────┘  │      │  └──────────────┘  │
└────────────────────┘      └────────────────────┘
            │                           │
            └─────────────┬─────────────┘
                          │
┌─────────────────────────┴──────────────────────────────────┐
│                      Data Layer                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  PostgreSQL  │              │    Redis     │            │
│  │  (Primary DB)│              │ (Cache/Queue)│            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication & Authorization

**JWT-based authentication** with the following flow:
1. User registers/logs in with credentials
2. Server validates and returns JWT token
3. Client stores token and includes in subsequent requests
4. Middleware validates token on protected routes

**Multi-tenancy**:
- Organization-based data isolation
- Role-based access control (Owner, Admin, Member)
- Automatic organization creation on registration

### 2. Monitoring Engine

**Architecture**:
- In-memory interval-based health checks
- Configurable check intervals (30s to 24h)
- Multi-region support (extensible)
- Performance metrics collection

**Health Check Flow**:
```
1. Load active monitors from database
2. For each monitor:
   a. Perform HTTP request with configured parameters
   b. Measure response time, status code, SSL validity
   c. Store check result in database
   d. Check for incident conditions
   e. Emit real-time update via WebSocket
3. Schedule next check based on interval
```

**Metrics Collected**:
- Response time (total, DNS, TCP, TLS, first byte)
- HTTP status code
- SSL certificate validity and expiration
- Error messages
- Response size

### 3. Incident Management

**Incident Creation**:
- Automatic detection based on consecutive failures
- Configurable thresholds (3 consecutive failures by default)
- Severity classification (low, medium, high, critical)

**Incident Lifecycle**:
```
Open → Investigating → Resolved → Closed
```

**Features**:
- Real-time incident notifications
- Timeline tracking with updates
- User assignment and acknowledgment
- Resolution tracking with MTTR calculation

### 4. Real-time Updates

**WebSocket Architecture**:
- Socket.IO for bidirectional communication
- Organization-based rooms for data isolation
- Event-driven updates

**Events**:
- `monitor:check` - New health check result
- `incident:created` - New incident detected
- `incident:updated` - Incident status change
- `incident:resolved` - Incident resolved

### 5. Analytics Engine

**Time-Series Data**:
- Optimized PostgreSQL schema with partitioning strategies
- Indexed queries for fast retrieval
- Aggregated daily statistics

**Metrics Computed**:
- Uptime percentage
- Average response time
- Percentiles (p50, p95, p99)
- Error rates and categorization
- SLA compliance

**Daily Statistics Job**:
- Runs daily at 1 AM (configurable via cron)
- Aggregates previous day's data
- Stores in `monitor_statistics` table
- Improves query performance for historical data

## Database Schema

### Core Tables

**users**: User accounts
- Authentication credentials
- Profile information
- Activity tracking

**organizations**: Tenant entities
- Organization details
- Plan/subscription info
- Configuration settings

**user_organizations**: Many-to-many relationship
- User-organization membership
- Role assignment (owner, admin, member)

**monitors**: API endpoints to monitor
- Configuration (URL, method, headers, etc.)
- Check intervals and timeouts
- Expected status codes
- Regional settings

**monitor_checks**: Time-series health check data
- Status and performance metrics
- Indexed for fast time-range queries
- Partitioning strategy for scalability

**incidents**: Service incidents
- Automated detection and tracking
- Status workflow
- Assignment and resolution tracking

**alert_rules**: Alerting configuration
- Condition-based triggers
- Multi-channel notifications
- Threshold settings

### Optimization Strategies

1. **Indexes**:
   - B-tree indexes on foreign keys
   - Composite indexes on (monitor_id, checked_at)
   - Partial indexes on status fields

2. **Time-series Optimization**:
   - Table partitioning by date (recommended for production)
   - Retention policies (auto-delete old data)
   - Materialized views for aggregations

3. **Triggers**:
   - Auto-update `updated_at` timestamps
   - Cascade deletes for data integrity

## Security

### Authentication
- Password hashing with bcrypt (10 rounds)
- JWT with configurable expiration
- Token validation on protected routes

### Authorization
- Organization-based access control
- Role-based permissions (RBAC)
- Resource ownership validation

### Security Headers
- Helmet.js for HTTP security headers
- CORS configuration
- XSS protection
- Content Security Policy

### Rate Limiting
- Per-IP rate limiting (100 req/15min default)
- Configurable windows and limits
- Protection against brute force

### Input Validation
- express-validator for request validation
- SQL injection prevention (parameterized queries)
- XSS sanitization

## Scalability Considerations

### Horizontal Scaling

**API Servers**:
- Stateless design allows multiple instances
- Load balancer required (nginx, HAProxy)
- Session storage in Redis (not memory)

**Database**:
- Read replicas for query distribution
- Connection pooling (pg pool)
- Query optimization and indexing

**Redis**:
- Redis Cluster for high availability
- Separate instances for cache vs. pub/sub

### Performance Optimization

1. **Caching Strategy**:
   - Redis for frequently accessed data
   - API response caching
   - Static asset caching (CDN)

2. **Database Optimization**:
   - Query result caching
   - Batch insertions for check results
   - Pagination for large datasets

3. **Monitoring Engine**:
   - In-memory interval management
   - Parallel health checks
   - Graceful degradation on failures

## Deployment Architecture

### Production Setup

```
                    ┌──────────────┐
                    │ Load Balancer│
                    │   (nginx)    │
                    └───────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
    ┌─────────┴─────────┐       ┌────────┴────────┐
    │  Frontend (nginx) │       │  Backend APIs   │
    │   Static Assets   │       │  (Node.js)      │
    └───────────────────┘       └────────┬────────┘
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                    ┌───────┴───────┐       ┌────────┴────────┐
                    │  PostgreSQL   │       │     Redis       │
                    │   (Primary)   │       │ (Cache/Queue)   │
                    └───────────────┘       └─────────────────┘
```

### Container Orchestration

**Docker Compose** (Development/Small Production):
- All services in one compose file
- Volume persistence
- Health checks
- Automatic restarts

**Kubernetes** (Large Production):
- Deployment manifests
- Service discovery
- Auto-scaling (HPA)
- Persistent volumes
- ConfigMaps and Secrets

## Monitoring & Observability

### Application Monitoring
- Winston logger for structured logging
- Error tracking and aggregation
- Performance metrics

### Infrastructure Monitoring
- Container health checks
- Database connection monitoring
- Redis connection monitoring

### Business Metrics
- Active monitors count
- Check success rate
- Incident frequency
- Response time trends

## Future Enhancements

1. **Multi-region Monitoring**: Distributed health checks from multiple locations
2. **Advanced Analytics**: ML-based anomaly detection, predictive alerting
3. **Integration Ecosystem**: Slack, PagerDuty, Teams, Discord webhooks
4. **Status Pages**: Public-facing status pages with custom domains
5. **API Keys**: Programmatic access to PulseAPI
6. **Alerting Rules**: Complex condition-based alerting
7. **SLA Management**: Contract-based SLA tracking and reporting
8. **Team Collaboration**: Comments, mentions, on-call rotations
