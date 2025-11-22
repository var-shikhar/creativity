import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { monitorsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Activity,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

const Monitors = () => {
  const { currentOrg } = useAuth();
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET',
    check_interval: 60000,
    expected_status_codes: [200]
  });

  useEffect(() => {
    if (currentOrg) {
      loadMonitors();
    }
  }, [currentOrg]);

  const loadMonitors = async () => {
    try {
      const { data } = await monitorsAPI.getAll(currentOrg.id);
      setMonitors(data.monitors);
    } catch (error) {
      toast.error('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      await monitorsAPI.create(currentOrg.id, formData);
      toast.success('Monitor created successfully');
      setShowModal(false);
      setFormData({
        name: '',
        url: '',
        method: 'GET',
        check_interval: 60000,
        expected_status_codes: [200]
      });
      loadMonitors();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create monitor');
    }
  };

  const handleDelete = async (monitorId) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) {
      return;
    }

    try {
      await monitorsAPI.delete(currentOrg.id, monitorId);
      toast.success('Monitor deleted');
      loadMonitors();
    } catch (error) {
      toast.error('Failed to delete monitor');
    }
  };

  const toggleMonitor = async (monitor) => {
    try {
      await monitorsAPI.update(currentOrg.id, monitor.id, {
        is_active: !monitor.is_active
      });
      toast.success(monitor.is_active ? 'Monitor paused' : 'Monitor resumed');
      loadMonitors();
    } catch (error) {
      toast.error('Failed to update monitor');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitors</h1>
          <p className="text-gray-600 mt-1">Track your API endpoints</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Monitor
        </button>
      </div>

      {monitors.length === 0 ? (
        <div className="card text-center py-12">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No monitors yet</h3>
          <p className="text-gray-600 mb-6">Start monitoring your API endpoints</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Create your first monitor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {monitors.map((monitor) => (
            <div key={monitor.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{monitor.name}</h3>
                  <a
                    href={monitor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
                  >
                    {monitor.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {monitor.current_status !== null && (
                    monitor.current_status ? (
                      <CheckCircle2 className="w-6 h-6 text-success-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-danger-600" />
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Method</p>
                  <p className="font-medium text-gray-900">{monitor.method}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Check Interval</p>
                  <p className="font-medium text-gray-900">
                    {monitor.check_interval / 1000}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg Response Time</p>
                  <p className="font-medium text-gray-900">
                    {monitor.avg_response_time ? `${monitor.avg_response_time}ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Open Incidents</p>
                  <p className="font-medium text-gray-900">{monitor.open_incidents || 0}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`badge ${monitor.is_active ? 'badge-success' : 'badge-gray'}`}>
                    {monitor.is_active ? 'Active' : 'Paused'}
                  </span>
                  {monitor.current_status !== null && (
                    <span className={`badge ${monitor.current_status ? 'badge-success' : 'badge-danger'}`}>
                      {monitor.current_status ? 'Up' : 'Down'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMonitor(monitor)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {monitor.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDelete(monitor.id)}
                    className="text-sm text-danger-600 hover:text-danger-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Monitor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Monitor</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monitor Name
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My API"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  required
                  className="input"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/health"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTTP Method
                </label>
                <select
                  className="input"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check Interval (seconds)
                </label>
                <input
                  type="number"
                  min="30"
                  required
                  className="input"
                  value={formData.check_interval / 1000}
                  onChange={(e) => setFormData({
                    ...formData,
                    check_interval: parseInt(e.target.value) * 1000
                  })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Create Monitor
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Monitors;
