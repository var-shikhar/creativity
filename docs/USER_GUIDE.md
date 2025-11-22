# PulseAPI User Guide

Welcome to PulseAPI! This guide will help you get started with monitoring your APIs.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Your First Monitor](#creating-your-first-monitor)
- [Understanding the Dashboard](#understanding-the-dashboard)
- [Managing Monitors](#managing-monitors)
- [Handling Incidents](#handling-incidents)
- [Best Practices](#best-practices)
- [FAQs](#faqs)

## Getting Started

### Creating an Account

1. Navigate to the PulseAPI registration page
2. Fill in your details:
   - Full Name
   - Email Address
   - Password (minimum 6 characters)
   - Organization Name (optional)
3. Click "Create Account"
4. You'll be automatically logged in and redirected to the dashboard

### Logging In

1. Go to the login page
2. Enter your email and password
3. Click "Sign In"

**Demo Account**: You can test the platform using:
- Email: `admin@pulseapi.dev`
- Password: `admin123`

## Creating Your First Monitor

### Step 1: Navigate to Monitors

Click on "Monitors" in the navigation menu.

### Step 2: Click "Add Monitor"

Click the "+ Add Monitor" button in the top-right corner.

### Step 3: Configure Your Monitor

Fill in the monitor details:

**Monitor Name** (required)
- A descriptive name for your monitor
- Example: "Production API Health Check"

**URL** (required)
- The full URL to monitor
- Example: `https://api.yourapp.com/health`
- Must include protocol (http:// or https://)

**HTTP Method**
- Choose from: GET, POST, PUT, DELETE, PATCH, HEAD
- Default: GET
- Most health checks use GET

**Check Interval** (seconds)
- How often to check the endpoint
- Minimum: 30 seconds
- Maximum: 86,400 seconds (24 hours)
- Default: 60 seconds
- Recommended: 60-300 seconds for production

### Step 4: Create the Monitor

Click "Create Monitor" to save. The monitor will immediately start checking your endpoint.

### Example Configuration

**Basic Health Check**:
```
Name: Production API
URL: https://api.example.com/health
Method: GET
Interval: 60 seconds
```

**Authenticated Endpoint** (coming soon):
```
Name: Protected API
URL: https://api.example.com/protected
Method: GET
Headers: {"Authorization": "Bearer your-token"}
Interval: 120 seconds
```

## Understanding the Dashboard

The dashboard provides an at-a-glance view of your monitoring setup:

### Key Metrics

**Active Monitors**
- Number of currently running monitors
- Shows total count including paused monitors

**Open Incidents**
- Number of currently unresolved incidents
- Includes "Open" and "Investigating" statuses

**Average Response Time**
- Average API response time in the last hour
- Lower is better (typically < 500ms)

**Uptime Percentage**
- Overall uptime across all monitors
- Based on last hour of data
- Target: > 99.9%

### Response Time Chart

- Real-time visualization of API response times
- Updates automatically as new checks complete
- X-axis: Time
- Y-axis: Response time in milliseconds

### Recent Activity

- Lists the most recent health checks
- Shows monitor name, status, timestamp, and response time
- Green check = Up
- Red X = Down

## Managing Monitors

### Viewing Monitor Details

Click on any monitor card to see:
- Current status (Up/Down)
- Configuration details
- Response time statistics
- Number of open incidents

### Monitor Status Indicators

**Green checkmark (✓)**: Monitor is up and responding correctly
**Red X (✗)**: Monitor is down or not responding as expected
**Active badge**: Monitor is currently running checks
**Paused badge**: Monitor is temporarily disabled

### Pausing a Monitor

1. Navigate to the Monitors page
2. Find the monitor you want to pause
3. Click "Pause"
4. The monitor will stop checking immediately

**Use cases for pausing**:
- Scheduled maintenance
- Testing in production
- Temporary API unavailability

### Resuming a Monitor

1. Find the paused monitor
2. Click "Resume"
3. Monitoring will restart immediately

### Editing a Monitor

1. Click on the monitor
2. Click "Edit" (coming soon)
3. Update the desired fields
4. Save changes

**Note**: Changing the URL or interval will restart the monitor.

### Deleting a Monitor

1. Navigate to the Monitors page
2. Click the trash icon on the monitor you want to delete
3. Confirm deletion

**⚠️ Warning**: This action cannot be undone. All associated data (checks, incidents) will be permanently deleted.

## Handling Incidents

### What is an Incident?

An incident is automatically created when:
- A monitor fails 3 consecutive health checks
- The API returns an unexpected status code
- The request times out

### Incident Severity Levels

**Low** 🟢
- Minor issues
- Backup systems available
- Limited user impact

**Medium** 🟡
- Moderate issues
- Some service degradation
- Partial user impact

**High** 🟠
- Serious issues
- Significant service disruption
- Major user impact

**Critical** 🔴
- Complete service outage
- All users affected
- Immediate action required

### Incident Lifecycle

```
Open → Investigating → Resolved → Closed
```

**Open**: Incident just detected, awaiting acknowledgment
**Investigating**: Team is actively working on resolution
**Resolved**: Issue fixed, monitoring for stability
**Closed**: Incident archived

### Responding to Incidents

#### 1. View Incident Details

Click on an incident to see:
- Affected monitor
- Start time and duration
- Current status and severity
- Timeline of updates

#### 2. Acknowledge the Incident

Click "Start Investigating" to:
- Let your team know you're on it
- Change status to "Investigating"
- Record acknowledgment time

#### 3. Add Updates

Keep your team informed:
1. Scroll to the timeline section
2. Type your update in the text box
3. Click "Add Update"

**Example updates**:
- "Identified root cause: database connection pool exhausted"
- "Deployed fix to production"
- "Monitoring for stability"

#### 4. Resolve the Incident

When fixed:
1. Click "Mark Resolved"
2. Add a final update explaining the resolution
3. The incident status changes to "Resolved"

### Real-time Notifications

PulseAPI provides real-time notifications for:
- New incidents (toast notification)
- Incident resolution (toast notification)
- Status changes (WebSocket updates)

**Browser notifications**: Coming soon

## Understanding Metrics

### Response Time

**What it measures**: Time from sending request to receiving response

**Good response times**:
- < 100ms: Excellent
- 100-300ms: Good
- 300-500ms: Acceptable
- > 500ms: Poor (investigate)

### Uptime Percentage

**Calculation**: (Successful checks / Total checks) × 100

**Industry standards**:
- 99.9% ("three nines"): ~8.7 hours downtime/year
- 99.95%: ~4.4 hours downtime/year
- 99.99% ("four nines"): ~52 minutes downtime/year

### Percentiles (p50, p95, p99)

**p50 (Median)**: 50% of requests are faster than this
**p95**: 95% of requests are faster than this (typical SLA metric)
**p99**: 99% of requests are faster than this

**Why percentiles matter**:
- Average can hide outliers
- p95 and p99 show worst-case user experience
- Use p95 for SLA commitments

## Best Practices

### Monitor Configuration

**✅ DO**:
- Use descriptive monitor names
- Set appropriate check intervals (60-300s for production)
- Monitor health/status endpoints (not root URLs)
- Use HTTPS when possible

**❌ DON'T**:
- Check too frequently (< 30s without good reason)
- Monitor rate-limited endpoints
- Use production API keys in monitors (use read-only keys)
- Monitor pages that require user interaction

### Incident Management

**✅ DO**:
- Acknowledge incidents quickly
- Add regular updates to timeline
- Include root cause in resolution notes
- Document fixes for future reference

**❌ DON'T**:
- Ignore low-severity incidents
- Close incidents without investigation
- Skip adding resolution details
- Forget to update stakeholders

### Organization

**✅ DO**:
- Group related monitors by service
- Use consistent naming conventions
- Pause monitors during scheduled maintenance
- Review and clean up unused monitors

**❌ DON'T**:
- Create duplicate monitors
- Keep broken monitors active
- Use generic names like "API 1", "API 2"

## Keyboard Shortcuts

Coming soon!

## FAQs

### How often should I check my API?

**Development**: 5-10 minutes
**Staging**: 2-5 minutes
**Production**: 1-2 minutes
**Critical services**: 30-60 seconds

### What happens if my monitor fails?

1. PulseAPI will retry 2 more times immediately
2. If all 3 checks fail, an incident is created
3. You'll receive a real-time notification
4. Monitoring continues at the configured interval

### Can I monitor internal/private APIs?

Yes! PulseAPI can monitor any URL accessible from the server. For internal APIs:
- Use VPN or private network deployment
- Self-host PulseAPI behind your firewall
- Use SSH tunneling (advanced)

### How long is monitoring data stored?

- **Raw checks**: 90 days (configurable)
- **Daily statistics**: Forever
- **Incidents**: Forever

### Can I export my data?

Coming soon! Export features include:
- CSV export of checks
- Incident reports
- Uptime reports

### How accurate are the response times?

Response times include:
- DNS lookup
- TCP connection
- TLS handshake (if HTTPS)
- Server processing
- Network latency

They represent end-to-end time from PulseAPI's server. Results may vary based on:
- Network conditions
- Server location
- Geographic distance

### What if I exceed my plan limits?

**Free Plan**: 10 monitors, 60s minimum interval
**Pro Plan**: Unlimited monitors, 30s minimum interval
**Enterprise**: Custom limits and features

When limits are reached:
- New monitors cannot be created
- Existing monitors continue working
- Upgrade prompt shown

### Is my data secure?

Yes! We implement:
- Encrypted connections (HTTPS/TLS)
- Password hashing (bcrypt)
- SQL injection prevention
- XSS protection
- Rate limiting
- Regular security audits

### Can I monitor GraphQL APIs?

Coming soon! Current workaround:
- Create a REST wrapper endpoint
- Monitor the wrapper

### What about WebSocket monitoring?

Coming soon! Subscribe to updates for:
- WebSocket connection monitoring
- Message latency tracking
- Connection stability metrics

## Getting Help

### Documentation

- [Architecture Guide](ARCHITECTURE.md)
- [API Documentation](API.md)
- [Deployment Guide](DEPLOYMENT.md)

### Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **Email**: support@pulseapi.dev
- **Documentation**: Check this guide first!

### Feature Requests

We love hearing from users! To request a feature:
1. Check existing GitHub issues
2. Create a new issue with:
   - Clear description
   - Use case
   - Expected behavior
3. Vote on existing requests

### Reporting Bugs

Found a bug? Please report it:
1. Check if it's already reported
2. Create a GitHub issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Browser/environment details

## What's Next?

Explore these advanced features (coming soon):
- **Alert Rules**: Custom notifications
- **Status Pages**: Public-facing status pages
- **Team Collaboration**: Invite team members
- **Integrations**: Slack, PagerDuty, webhooks
- **API Access**: Programmatic monitor management
- **Custom Dashboards**: Build your perfect view

Happy monitoring! 🚀
