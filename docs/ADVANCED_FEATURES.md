# PulseAPI - Advanced Features

This document outlines the advanced, enterprise-grade features that set PulseAPI apart from competitors.

## 🔔 Multi-Channel Notifications

### Overview
Comprehensive notification system that alerts your team across multiple channels when incidents occur.

### Supported Channels

#### 1. **Slack Integration**
- Native Slack webhook support
- Rich message formatting with colors and fields
- Incident severity indicators
- Quick action buttons (coming soon)

**Setup:**
```json
{
  "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
}
```

#### 2. **Discord Integration**
- Discord webhook support
- Embedded messages with status colors
- Role mentions (coming soon)
- Channel-specific routing

**Setup:**
```json
{
  "webhook_url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
}
```

#### 3. **Custom Webhooks**
- Generic webhook support for any service
- HMAC signature verification
- Custom payload formatting
- Retry logic with exponential backoff

**Setup:**
```json
{
  "url": "https://your-webhook.com/endpoint",
  "secret": "optional-signing-secret"
}
```

**Webhook Payload:**
```json
{
  "event": "incident_created",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "incidentId": "uuid",
    "monitorId": "uuid",
    "monitorName": "API Health Check",
    "monitorUrl": "https://api.example.com/health",
    "error": "Connection timeout",
    "severity": "high"
  }
}
```

#### 4. **Email Notifications**
- SMTP support for custom email providers
- HTML email templates
- Multiple recipients
- Batch digest options (coming soon)

**Setup:**
```json
{
  "recipients": ["ops@company.com", "oncall@company.com"]
}
```

#### 5. **PagerDuty Integration**
- Native PagerDuty Events API v2
- Automatic incident routing
- Severity mapping
- Auto-resolution

**Setup:**
```json
{
  "integration_key": "YOUR_PAGERDUTY_INTEGRATION_KEY"
}
```

### Notification Events

- `incident_created` - New incident detected
- `incident_resolved` - Incident automatically resolved
- `incident_updated` - Incident status changed
- `ssl_expiring` - SSL certificate expiring soon
- `ssl_expired` - SSL certificate has expired
- `monitor_slow` - Response time above threshold

### Notification Log

Complete audit trail of all notifications:
- Delivery status (pending, sent, failed)
- Timestamp and retry attempts
- Error messages for failed deliveries
- Channel-specific details

## 🛡️ SSL Certificate Monitoring

### Features

#### Automatic Certificate Checking
- Real-time SSL/TLS certificate validation
- Expiry date tracking
- Issuer and subject information
- Certificate chain validation

#### Configurable Thresholds
```javascript
{
  "ssl_check_enabled": true,
  "ssl_expiry_threshold": 30 // Days before expiry to alert
}
```

#### Proactive Alerts
- Automatic notifications when certificate expires soon
- Critical alerts when certificate has expired
- Support for custom expiry thresholds per monitor

### Certificate Information Tracked

- Valid from / Valid to dates
- Days until expiry
- Certificate issuer
- Certificate subject
- Certificate validity status

## ✅ Response Body Assertions

### Overview
Go beyond status code checking - validate actual response content.

### Assertion Types

#### 1. **Equality Check**
```json
{
  "property": "status",
  "operator": "equals",
  "value": "healthy"
}
```

#### 2. **Contains Check**
```json
{
  "property": "message",
  "operator": "contains",
  "value": "success"
}
```

#### 3. **Numeric Comparison**
```json
{
  "property": "users.count",
  "operator": "greater_than",
  "value": 0
}
```

#### 4. **Existence Check**
```json
{
  "property": "data.users",
  "operator": "exists",
  "value": null
}
```

### Supported Operators

- `equals` - Exact match
- `not_equals` - Not equal
- `contains` - String contains
- `not_contains` - String does not contain
- `greater_than` - Numeric greater than
- `less_than` - Numeric less than
- `exists` - Property exists
- `not_exists` - Property does not exist

### Nested Property Access

Use dot notation for nested objects:
```json
{
  "property": "data.users[0].status",
  "operator": "equals",
  "value": "active"
}
```

### Multiple Assertions

Combine multiple assertions - ALL must pass:
```json
{
  "assertions": [
    {
      "property": "status",
      "operator": "equals",
      "value": "ok"
    },
    {
      "property": "data.count",
      "operator": "greater_than",
      "value": 0
    }
  ]
}
```

## 👥 Team Management

### Features

#### Team Invitations
- Email-based invitation system
- Token-based secure invitations
- 7-day expiration window
- Pending invitation management

#### Role-Based Access Control

**Owner**:
- Full control over organization
- Cannot be removed
- Manage all settings

**Admin**:
- Invite/remove team members
- Manage monitors and incidents
- Configure notifications
- Cannot modify owner

**Member**:
- View monitors and incidents
- Add incident updates
- Receive notifications
- Read-only access to settings

#### Team Operations

**Invite Member:**
```http
POST /api/organizations/:orgId/team/invite
{
  "email": "teammate@company.com",
  "role": "member"
}
```

**Accept Invitation:**
```http
POST /api/organizations/:orgId/team/invitations/accept
{
  "token": "invitation-token"
}
```

**Update Member Role:**
```http
PATCH /api/organizations/:orgId/team/members/:userId/role
{
  "role": "admin"
}
```

**Remove Member:**
```http
DELETE /api/organizations/:orgId/team/members/:userId
```

### Invitation Workflow

1. Admin sends invitation via email
2. Recipient receives email with unique link
3. Recipient creates account or logs in
4. Recipient accepts invitation
5. Automatically added to organization with assigned role

## 📊 Public Status Pages

### Overview
Beautiful, customizable status pages for your end users.

### Features

#### Custom Branding
- Custom subdomain (e.g., `status.yourcompany.com`)
- Organization logo
- Custom color themes
- Branded messaging

#### Real-Time Status
- Live monitor status (up/down/degraded)
- Overall system status calculation
- Response time metrics
- Recent incident history

#### Status Indicators

**Operational** 🟢
- All monitors are up
- No open incidents

**Degraded** 🟡
- Some monitors are down
- Performance issues detected
- Open incidents being investigated

**Down** 🔴
- Critical monitors are down
- Service unavailable

### Configuration

**Create Status Page:**
```json
{
  "subdomain": "mycompany",
  "title": "MyCompany Status",
  "description": "Real-time status of MyCompany services",
  "logo_url": "https://example.com/logo.png",
  "monitors": ["monitor-uuid-1", "monitor-uuid-2"],
  "theme": {
    "primary_color": "#0ea5e9",
    "background": "#ffffff"
  },
  "is_public": true
}
```

### Public API Endpoint

**No authentication required:**
```http
GET /api/status/public/:subdomain

Response:
{
  "title": "MyCompany Status",
  "description": "Real-time service status",
  "overall_status": "operational",
  "monitors": [
    {
      "id": "uuid",
      "name": "API Server",
      "current_status": true,
      "avg_response_time": 245,
      "open_incidents": 0
    }
  ],
  "recent_incidents": [
    {
      "id": "uuid",
      "title": "Database connectivity issues",
      "severity": "high",
      "status": "resolved",
      "started_at": "2024-01-15T10:00:00Z",
      "resolved_at": "2024-01-15T10:30:00Z"
    }
  ],
  "updated_at": "2024-01-15T12:00:00Z"
}
```

### Status Page URLs

**Development:**
- `https://yoursubdomain.status.pulseapi.local`

**Production:**
- `https://yoursubdomain.status.pulseapi.dev`

**Custom Domain** (coming soon):
- `https://status.yourcompany.com`

## 🔐 Security Enhancements

### Notification Security

**Webhook Signatures:**
- HMAC-SHA256 signatures for webhook payloads
- Verify webhook authenticity
- Prevent replay attacks

**API Key Support** (coming soon):
- Generate API keys for programmatic access
- Granular permissions
- Key rotation and expiry

### Team Security

**Invitation Tokens:**
- Cryptographically secure random tokens
- Single-use tokens
- Automatic expiration (7 days)

**Role Enforcement:**
- Middleware-level role checking
- Prevent privilege escalation
- Owner protection (cannot be removed)

## 📈 Advanced Analytics

### Response Time Tracking

**Detailed Metrics:**
- DNS resolution time
- TCP connection time
- TLS handshake time
- Time to first byte
- Total response time

**Percentile Tracking:**
- p50 (median)
- p95 (95th percentile)
- p99 (99th percentile)
- Custom percentiles

### Performance Monitoring

**Anomaly Detection** (coming soon):
- ML-based anomaly detection
- Baseline performance tracking
- Automatic threshold adjustment
- Predictive alerting

## 🔄 Future Advanced Features

### Maintenance Windows
- Schedule maintenance to prevent false alerts
- Recurring maintenance schedules
- Monitor-specific or organization-wide
- Automatic notification suppression

### On-Call Schedules
- Rotating on-call schedules
- Timezone-aware scheduling
- Escalation policies
- Override and swap functionality

### Uptime Reports
- Automated daily/weekly/monthly reports
- PDF and HTML formats
- Email delivery
- SLA compliance tracking

### Advanced Integrations
- Microsoft Teams
- Google Chat
- Telegram
- SMS (Twilio)
- Phone calls (for critical incidents)

### API Keys Management
- Generate multiple API keys
- Key-specific permissions
- Usage tracking
- Automatic expiration

### Custom Dashboards
- Drag-and-drop dashboard builder
- Custom widgets and visualizations
- Saved dashboard templates
- Team-specific dashboards

### Incident Postmortems
- Structured postmortem templates
- Collaborative editing
- Action item tracking
- Integration with project management tools

## 🎯 Competitive Advantages

### vs. Datadog / New Relic
✅ **Free & Open Source** - Self-host for zero cost
✅ **Data Ownership** - Complete control over your data
✅ **Customizable** - Modify to fit your exact needs
✅ **Multi-channel Notifications** - Built-in, not addon
✅ **Team Management** - Included at no extra cost

### vs. UptimeRobot / Pingdom
✅ **Response Assertions** - Validate actual response content
✅ **SSL Monitoring** - Built-in certificate tracking
✅ **Team Collaboration** - Multi-user support
✅ **Custom Status Pages** - Unlimited, no extra cost
✅ **Advanced Analytics** - Percentile tracking, detailed metrics

### vs. StatusPage.io
✅ **Integrated Monitoring** - Not just a status page
✅ **Automatic Updates** - Status derived from real monitors
✅ **No Extra Cost** - Status pages included
✅ **Self-Hosted** - Deploy on your infrastructure

## 📚 API Documentation

### Notification Channels

**Create:**
```http
POST /api/organizations/:orgId/notifications
```

**List:**
```http
GET /api/organizations/:orgId/notifications
```

**Update:**
```http
PATCH /api/organizations/:orgId/notifications/:id
```

**Delete:**
```http
DELETE /api/organizations/:orgId/notifications/:id
```

**Test:**
```http
POST /api/organizations/:orgId/notifications/:id/test
```

**Get Logs:**
```http
GET /api/organizations/:orgId/notifications/logs
```

### Team Management

**Invite:**
```http
POST /api/organizations/:orgId/team/invite
```

**List Members:**
```http
GET /api/organizations/:orgId/team/members
```

**List Invitations:**
```http
GET /api/organizations/:orgId/team/invitations
```

**Accept Invitation:**
```http
POST /api/organizations/:orgId/team/invitations/accept
```

**Update Role:**
```http
PATCH /api/organizations/:orgId/team/members/:userId/role
```

**Remove Member:**
```http
DELETE /api/organizations/:orgId/team/members/:userId
```

### Status Pages

**Create:**
```http
POST /api/organizations/:orgId/status-pages
```

**List:**
```http
GET /api/organizations/:orgId/status-pages
```

**Get:**
```http
GET /api/organizations/:orgId/status-pages/:id
```

**Update:**
```http
PATCH /api/organizations/:orgId/status-pages/:id
```

**Delete:**
```http
DELETE /api/organizations/:orgId/status-pages/:id
```

**Public (No Auth):**
```http
GET /api/status/public/:subdomain
```

## 🚀 Getting Started with Advanced Features

### 1. Set Up Notifications

1. Navigate to Settings → Notifications
2. Click "Add Channel"
3. Choose channel type (Slack, Discord, etc.)
4. Enter configuration (webhook URL, etc.)
5. Test the channel
6. Save

### 2. Invite Team Members

1. Navigate to Team
2. Click "Invite Member"
3. Enter email and select role
4. Send invitation
5. Member receives email with link
6. They accept and join your organization

### 3. Create Status Page

1. Navigate to Status Pages
2. Click "Create Status Page"
3. Choose subdomain
4. Customize branding (title, logo, colors)
5. Select monitors to include
6. Publish
7. Share public URL with customers

### 4. Enable SSL Monitoring

1. Edit monitor
2. Enable "SSL Certificate Monitoring"
3. Set expiry threshold (default: 30 days)
4. Save
5. Automatic alerts when certificate expires soon

### 5. Add Response Assertions

1. Edit monitor
2. Click "Add Assertion"
3. Select property to check
4. Choose operator
5. Enter expected value
6. Save
7. Monitor will fail if assertion doesn't pass

---

## 📝 Notes

- All advanced features are included at no extra cost
- Self-hosted deployment gives you complete control
- Features designed for production use at scale
- Regularly updated with new capabilities

For questions or feature requests, please open a GitHub issue.
