# PulseAPI - API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Authentication Endpoints

### Register User

Create a new user account and organization.

**Endpoint**: `POST /auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "organization_name": "My Company" // optional
}
```

**Response**: `201 Created`
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "organization": {
    "id": "uuid",
    "name": "My Company",
    "slug": "my-company",
    "plan_type": "free"
  },
  "token": "jwt-token"
}
```

### Login

Authenticate and receive JWT token.

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: `200 OK`
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "organizations": [
    {
      "id": "uuid",
      "name": "My Company",
      "slug": "my-company",
      "plan_type": "free",
      "role": "owner"
    }
  ],
  "token": "jwt-token"
}
```

### Get Profile

Get current user profile and organizations.

**Endpoint**: `GET /auth/profile`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-15T10:30:00Z"
  },
  "organizations": [...]
}
```

## Monitor Endpoints

### Create Monitor

Create a new API monitor.

**Endpoint**: `POST /organizations/:orgId/monitors`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "API Health Check",
  "url": "https://api.example.com/health",
  "method": "GET", // GET, POST, PUT, DELETE, PATCH, HEAD
  "check_interval": 60000, // milliseconds (30000-86400000)
  "timeout": 30000, // milliseconds
  "headers": {
    "Authorization": "Bearer token",
    "Content-Type": "application/json"
  }, // optional
  "body": "{\"key\": \"value\"}", // optional, for POST/PUT/PATCH
  "expected_status_codes": [200, 201], // default: [200]
  "regions": ["us-east", "eu-west"] // optional, default: ["us-east"]
}
```

**Response**: `201 Created`
```json
{
  "message": "Monitor created successfully",
  "monitor": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "API Health Check",
    "url": "https://api.example.com/health",
    "method": "GET",
    "check_interval": 60000,
    "timeout": 30000,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Get All Monitors

List all monitors for an organization.

**Endpoint**: `GET /organizations/:orgId/monitors`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "monitors": [
    {
      "id": "uuid",
      "name": "API Health Check",
      "url": "https://api.example.com/health",
      "method": "GET",
      "check_interval": 60000,
      "is_active": true,
      "current_status": true, // null if no checks yet
      "avg_response_time": 250, // milliseconds
      "open_incidents": 0,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Monitor by ID

Get details of a specific monitor.

**Endpoint**: `GET /organizations/:orgId/monitors/:id`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "monitor": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "API Health Check",
    "url": "https://api.example.com/health",
    "method": "GET",
    "check_interval": 60000,
    "timeout": 30000,
    "headers": {},
    "expected_status_codes": [200],
    "is_active": true,
    "current_status": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Update Monitor

Update monitor configuration.

**Endpoint**: `PATCH /organizations/:orgId/monitors/:id`

**Authentication**: Required

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "url": "https://new-api.example.com/health",
  "method": "POST",
  "check_interval": 120000,
  "timeout": 60000,
  "headers": {},
  "body": "{}",
  "expected_status_codes": [200, 201],
  "is_active": false,
  "regions": ["us-east"]
}
```

**Response**: `200 OK`
```json
{
  "message": "Monitor updated successfully",
  "monitor": { /* updated monitor object */ }
}
```

### Delete Monitor

Delete a monitor.

**Endpoint**: `DELETE /organizations/:orgId/monitors/:id`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "message": "Monitor deleted successfully"
}
```

### Get Monitor Statistics

Get performance statistics for a monitor.

**Endpoint**: `GET /organizations/:orgId/monitors/:id/stats?period=24h`

**Authentication**: Required

**Query Parameters**:
- `period`: `1h`, `24h`, `7d`, `30d` (default: `24h`)

**Response**: `200 OK`
```json
{
  "period": "24h",
  "statistics": {
    "total_checks": 1440,
    "uptime_percentage": 99.93,
    "average_response_time": 245,
    "p50_response_time": 230,
    "p95_response_time": 350,
    "p99_response_time": 450
  },
  "checks": [
    {
      "checked_at": "2024-01-15T10:30:00Z",
      "response_time": 250,
      "is_up": true,
      "status_code": 200,
      "region": "us-east"
    }
  ],
  "incidents": [
    {
      "severity": "high",
      "count": 1
    }
  ]
}
```

## Incident Endpoints

### Get All Incidents

List all incidents for an organization.

**Endpoint**: `GET /organizations/:orgId/incidents`

**Authentication**: Required

**Query Parameters**:
- `status`: Filter by status (`open`, `investigating`, `resolved`, `closed`)
- `severity`: Filter by severity (`low`, `medium`, `high`, `critical`)

**Response**: `200 OK`
```json
{
  "incidents": [
    {
      "id": "uuid",
      "monitor_id": "uuid",
      "organization_id": "uuid",
      "title": "API Health Check is down",
      "description": "Monitor has failed 3 consecutive health checks",
      "severity": "high",
      "status": "open",
      "started_at": "2024-01-15T10:00:00Z",
      "resolved_at": null,
      "monitor_name": "API Health Check",
      "monitor_url": "https://api.example.com/health",
      "acknowledged_by_name": null,
      "resolved_by_name": null
    }
  ]
}
```

### Get Incident by ID

Get detailed information about an incident.

**Endpoint**: `GET /organizations/:orgId/incidents/:id`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "incident": {
    "id": "uuid",
    "monitor_id": "uuid",
    "title": "API Health Check is down",
    "description": "Monitor has failed 3 consecutive health checks",
    "severity": "high",
    "status": "investigating",
    "started_at": "2024-01-15T10:00:00Z",
    "acknowledged_at": "2024-01-15T10:05:00Z",
    "acknowledged_by_name": "John Doe",
    "monitor_name": "API Health Check",
    "monitor_url": "https://api.example.com/health"
  },
  "updates": [
    {
      "id": "uuid",
      "message": "Investigating the issue",
      "status": "investigating",
      "user_name": "John Doe",
      "created_at": "2024-01-15T10:05:00Z"
    }
  ]
}
```

### Update Incident

Update incident status or severity.

**Endpoint**: `PATCH /organizations/:orgId/incidents/:id`

**Authentication**: Required

**Request Body**:
```json
{
  "status": "investigating", // open, investigating, resolved, closed
  "severity": "critical", // low, medium, high, critical (optional)
  "message": "Status update message" // optional
}
```

**Response**: `200 OK`
```json
{
  "message": "Incident updated successfully",
  "incident": { /* updated incident object */ }
}
```

### Add Incident Update

Add a timeline update to an incident.

**Endpoint**: `POST /organizations/:orgId/incidents/:id/updates`

**Authentication**: Required

**Request Body**:
```json
{
  "message": "Root cause identified. Deploying fix."
}
```

**Response**: `201 Created`
```json
{
  "message": "Update added successfully",
  "update": {
    "id": "uuid",
    "incident_id": "uuid",
    "user_id": "uuid",
    "message": "Root cause identified. Deploying fix.",
    "created_at": "2024-01-15T10:15:00Z"
  }
}
```

### Get Incident Statistics

Get incident statistics for an organization.

**Endpoint**: `GET /organizations/:orgId/incidents/stats`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "statistics": {
    "open_count": 2,
    "investigating_count": 1,
    "resolved_24h": 5,
    "critical_count": 0,
    "avg_resolution_time": 1800 // seconds
  }
}
```

## Dashboard Endpoint

### Get Dashboard Stats

Get overview statistics for the dashboard.

**Endpoint**: `GET /organizations/:orgId/dashboard`

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "monitors": {
    "total": 10,
    "active": 8
  },
  "incidents": {
    "total": 15,
    "open": 2,
    "investigating": 1
  },
  "recentChecks": [
    {
      "name": "API Health Check",
      "id": "uuid",
      "is_up": true,
      "response_time": 250,
      "checked_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## WebSocket Events

Connect to WebSocket server at `ws://localhost:5000`

### Client → Server

**Join Organization Room**:
```javascript
socket.emit('join:organization', orgId);
```

**Leave Organization Room**:
```javascript
socket.emit('leave:organization', orgId);
```

**Ping (Health Check)**:
```javascript
socket.emit('ping');
// Response: 'pong' event
```

### Server → Client

**Monitor Check**:
```javascript
socket.on('monitor:check', (data) => {
  // data: { monitorId, is_up, response_time, status_code, checked_at, ... }
});
```

**Incident Created**:
```javascript
socket.on('incident:created', (data) => {
  // data: { monitorId, monitorName }
});
```

**Incident Resolved**:
```javascript
socket.on('incident:resolved', (data) => {
  // data: { monitorId, monitorName, incidentId }
});
```

**Incident Updated**:
```javascript
socket.on('incident:updated', (data) => {
  // data: { incidentId, status, severity }
});
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Validation Errors

When validation fails, the response includes detailed error information:

```json
{
  "errors": [
    {
      "msg": "Invalid email format",
      "param": "email",
      "location": "body"
    }
  ]
}
```

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Headers** (included in response):
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Timestamp when limit resets

When rate limit is exceeded:
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

## Best Practices

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (httpOnly cookies or secure storage)
3. **Implement exponential backoff** for retries
4. **Handle WebSocket reconnections** gracefully
5. **Validate and sanitize** all input data
6. **Use pagination** for large datasets
7. **Cache responses** where appropriate
8. **Monitor rate limits** and implement client-side limiting
