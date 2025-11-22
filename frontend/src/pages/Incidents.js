import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { incidentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const Incidents = () => {
  const { currentOrg } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    if (currentOrg) {
      loadIncidents();
    }
  }, [currentOrg, filter]);

  const loadIncidents = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const { data } = await incidentsAPI.getAll(currentOrg.id, params);
      setIncidents(data.incidents);
    } catch (error) {
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const loadIncidentDetails = async (incidentId) => {
    try {
      const { data } = await incidentsAPI.getOne(currentOrg.id, incidentId);
      setSelectedIncident(data);
    } catch (error) {
      toast.error('Failed to load incident details');
    }
  };

  const updateIncidentStatus = async (incidentId, status) => {
    try {
      await incidentsAPI.update(currentOrg.id, incidentId, {
        status,
        message: `Status changed to ${status}`
      });
      toast.success(`Incident ${status}`);
      loadIncidents();
      if (selectedIncident?.incident.id === incidentId) {
        loadIncidentDetails(incidentId);
      }
    } catch (error) {
      toast.error('Failed to update incident');
    }
  };

  const addUpdate = async (e) => {
    e.preventDefault();
    if (!updateMessage.trim() || !selectedIncident) return;

    try {
      await incidentsAPI.addUpdate(
        currentOrg.id,
        selectedIncident.incident.id,
        updateMessage
      );
      toast.success('Update added');
      setUpdateMessage('');
      loadIncidentDetails(selectedIncident.incident.id);
    } catch (error) {
      toast.error('Failed to add update');
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'badge-info',
      medium: 'badge-warning',
      high: 'badge-danger',
      critical: 'bg-red-600 text-white'
    };
    return colors[severity] || 'badge-gray';
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'badge-danger',
      investigating: 'badge-warning',
      resolved: 'badge-success',
      closed: 'badge-gray'
    };
    return colors[status] || 'badge-gray';
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Incidents</h1>
        <p className="text-gray-600 mt-1">Monitor and resolve service incidents</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'open', 'investigating', 'resolved'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium capitalize ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {incidents.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No incidents found</h3>
          <p className="text-gray-600">
            {filter === 'all'
              ? 'All systems are operating normally'
              : `No ${filter} incidents`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incidents List */}
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() => loadIncidentDetails(incident.id)}
                className="card cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{incident.title}</h3>
                  <AlertTriangle className="w-5 h-5 text-danger-600" />
                </div>

                <p className="text-sm text-gray-600 mb-3">{incident.monitor_name}</p>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge ${getSeverityColor(incident.severity)}`}>
                    {incident.severity}
                  </span>
                  <span className={`badge ${getStatusColor(incident.status)}`}>
                    {incident.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}
                  </div>
                  {incident.resolved_at && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Resolved
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Incident Details */}
          {selectedIncident && (
            <div className="card lg:sticky lg:top-24 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Incident Details
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedIncident.incident.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedIncident.incident.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Monitor</p>
                    <p className="font-medium text-gray-900">
                      {selectedIncident.incident.monitor_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Started</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(selectedIncident.incident.started_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Severity</p>
                    <span className={`badge ${getSeverityColor(selectedIncident.incident.severity)}`}>
                      {selectedIncident.incident.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`badge ${getStatusColor(selectedIncident.incident.status)}`}>
                      {selectedIncident.incident.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {selectedIncident.incident.status !== 'resolved' && (
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    {selectedIncident.incident.status === 'open' && (
                      <button
                        onClick={() => updateIncidentStatus(selectedIncident.incident.id, 'investigating')}
                        className="btn btn-primary flex-1 text-sm"
                      >
                        Start Investigating
                      </button>
                    )}
                    <button
                      onClick={() => updateIncidentStatus(selectedIncident.incident.id, 'resolved')}
                      className="btn btn-success flex-1 text-sm"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}

                {/* Timeline */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Timeline</h4>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedIncident.updates.map((update) => (
                      <div key={update.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{update.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {update.user_name || 'System'} •{' '}
                            {format(new Date(update.created_at), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Update */}
                  <form onSubmit={addUpdate} className="mt-4">
                    <textarea
                      className="input resize-none"
                      rows="2"
                      placeholder="Add an update..."
                      value={updateMessage}
                      onChange={(e) => setUpdateMessage(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary mt-2 w-full text-sm"
                      disabled={!updateMessage.trim()}
                    >
                      Add Update
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Incidents;
