import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import wsService from '../services/websocket';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { currentOrg } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentChecks, setRecentChecks] = useState([]);

  useEffect(() => {
    if (!currentOrg) return;

    const loadDashboard = async () => {
      try {
        const { data } = await dashboardAPI.getStats(currentOrg.id);
        setStats(data);
        setRecentChecks(data.recentChecks || []);
      } catch (error) {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Set up WebSocket listeners
    const handleMonitorCheck = (data) => {
      setRecentChecks(prev => [data, ...prev].slice(0, 50));
    };

    const handleIncidentCreated = (data) => {
      toast.error(`🚨 Incident: ${data.monitorName} is down!`);
      loadDashboard();
    };

    const handleIncidentResolved = (data) => {
      toast.success(`✅ Resolved: ${data.monitorName} is back up!`);
      loadDashboard();
    };

    wsService.on('monitor:check', handleMonitorCheck);
    wsService.on('incident:created', handleIncidentCreated);
    wsService.on('incident:resolved', handleIncidentResolved);

    return () => {
      wsService.off('monitor:check', handleMonitorCheck);
      wsService.off('incident:created', handleIncidentCreated);
      wsService.off('incident:resolved', handleIncidentResolved);
    };
  }, [currentOrg]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  const chartData = recentChecks
    .filter(c => c.response_time)
    .slice(0, 20)
    .reverse()
    .map(c => ({
      time: format(new Date(c.checked_at), 'HH:mm:ss'),
      responseTime: c.response_time,
      status: c.is_up ? 'up' : 'down'
    }));

  const avgResponseTime = recentChecks.length > 0
    ? Math.round(
        recentChecks
          .filter(c => c.response_time)
          .reduce((sum, c) => sum + c.response_time, 0) /
        recentChecks.filter(c => c.response_time).length
      )
    : 0;

  const uptimePercentage = recentChecks.length > 0
    ? Math.round((recentChecks.filter(c => c.is_up).length / recentChecks.length) * 100 * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor your API health in real-time</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Monitors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.monitors?.active || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                of {stats?.monitors?.total || 0} total
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Incidents</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.incidents?.open || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats?.incidents?.investigating || 0} investigating
              </p>
            </div>
            <div className="w-12 h-12 bg-danger-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {avgResponseTime}ms
              </p>
              <p className="text-sm text-gray-500 mt-1">Last hour</p>
            </div>
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Uptime</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {uptimePercentage}%
              </p>
              <p className="text-sm text-gray-500 mt-1">Last hour</p>
            </div>
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Response Time Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Response Time Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Checks</h2>
          <Link to="/monitors" className="text-sm text-primary-600 hover:text-primary-700">
            View all monitors →
          </Link>
        </div>

        {recentChecks.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No recent checks</p>
            <Link to="/monitors" className="btn btn-primary mt-4 inline-block">
              Create your first monitor
            </Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentChecks.slice(0, 10).map((check, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {check.is_up ? (
                    <CheckCircle2 className="w-5 h-5 text-success-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-danger-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{check.name}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(check.checked_at), 'MMM d, HH:mm:ss')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${check.is_up ? 'text-success-600' : 'text-danger-600'}`}>
                    {check.is_up ? 'Operational' : 'Down'}
                  </p>
                  {check.response_time && (
                    <p className="text-sm text-gray-500">{check.response_time}ms</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
