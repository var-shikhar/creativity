-- Add notification channels table
CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'slack', 'discord', 'webhook', 'pagerduty')),
    config JSONB NOT NULL, -- Channel-specific configuration (URLs, emails, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_notification_channels_org_id ON notification_channels(organization_id);

-- Update alert_rules to reference notification_channels
ALTER TABLE alert_rules
    DROP COLUMN notification_channels,
    ADD COLUMN notification_channel_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Add maintenance windows table
CREATE TABLE maintenance_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    monitor_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Empty array means all monitors
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- For recurring windows (daily, weekly, etc.)
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_windows_org_id ON maintenance_windows(organization_id);
CREATE INDEX idx_maintenance_windows_time ON maintenance_windows(start_time, end_time);

-- Add team invitations table
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_team_invitations_org_id ON team_invitations(organization_id);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);

-- Add response assertions to monitors
ALTER TABLE monitors
    ADD COLUMN assertions JSONB DEFAULT '[]'::jsonb, -- Array of assertions to validate
    ADD COLUMN ssl_check_enabled BOOLEAN DEFAULT true,
    ADD COLUMN ssl_expiry_threshold INTEGER DEFAULT 30; -- Days before expiry to alert

-- Add on-call schedules
CREATE TABLE on_call_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    rotation_type VARCHAR(50) DEFAULT 'weekly' CHECK (rotation_type IN ('daily', 'weekly', 'custom')),
    members JSONB NOT NULL, -- Array of user IDs with their rotation slots
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_on_call_schedules_org_id ON on_call_schedules(organization_id);

-- Add current on-call tracking
CREATE TABLE on_call_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES on_call_schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(schedule_id)
);

CREATE INDEX idx_on_call_current_schedule ON on_call_current(schedule_id);

-- Add uptime reports table
CREATE TABLE uptime_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    monitor_ids UUID[] NOT NULL,
    frequency VARCHAR(50) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    recipients TEXT[] NOT NULL, -- Email addresses
    format VARCHAR(50) DEFAULT 'pdf' CHECK (format IN ('pdf', 'html', 'csv')),
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uptime_reports_org_id ON uptime_reports(organization_id);

-- Add monitor tags for better organization
ALTER TABLE monitors
    ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX idx_monitors_tags ON monitors USING GIN(tags);

-- Add notification log for tracking
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    monitor_id UUID REFERENCES monitors(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- incident_created, incident_resolved, ssl_expiry, etc.
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_log_org_id ON notification_log(organization_id);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at DESC);

-- Add trigger for maintenance windows
CREATE TRIGGER update_maintenance_windows_updated_at
BEFORE UPDATE ON on_call_schedules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
