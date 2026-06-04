import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import PriorityTable from '../components/PriorityTable';
import AddPatientModal from '../components/AddPatientModal';
import { Plus } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL;

// clerkId is passed from App.jsx and used to fetch only this clinician's patients
const Dashboard = ({ clerkId }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const [alertDismissed, setAlertDismissed] = useState(false);

  const { getToken } = useAuth();

  // Reset dismissal whenever the patients list refreshes so the banner reappears if still relevant
  useEffect(() => {
    setAlertDismissed(false);
  }, [patients]);

  // useCallback ensures fetchPatients is only re-created when clerkId changes
  // otherwise a new function reference is created on every render, causing infinite re-fetches
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      // Fetches all patients for this clinician sorted by highest risk score first
      const res = await axios.get(`${BASE_URL}/api/patients`, {
        params: { clerk_id: clerkId, sortBy: 'risk' },
        headers: { Authorization: `Bearer ${token}` },
      });

      // Manually check the success field and throws an error if it's false,
      // forcing the code to jump to the catch block
      if (!res.data.success) throw new Error(res.data.message || 'Failed to fetch');

      // Falls back to empty array if data is missing so the table renders safely
      setPatients(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      // Runs whether the request succeeds or fails — always clears the loading state
      setLoading(false);
    }
  }, [clerkId, getToken]);

  // Runs fetchPatients on mount and whenever clerkId changes
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  // Only recalculates when the patients array actually changes
  const counts = useMemo(() => {
    const result = { total: patients.length, high: 0, medium: 0, low: 0, worsening: 0 };
    patients.forEach((patient) => {
      const riskLevel = (patient.risk_category || '').toLowerCase();
      if (riskLevel === 'high') result.high++;
      if (riskLevel === 'medium') result.medium++;
      if (riskLevel === 'low') result.low++;
      const trend = (patient.trend || '').toLowerCase();
      if (trend === 'worsening') result.worsening++;
    });
    return result;
  }, [patients]);

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <AddPatientModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onPatientAdded={(patientId) => {
          setShowAdd(false);
          fetchPatients();
          setSavedId(patientId);
          setShowSuccess(true);
        }}
      />

      {showSuccess && (
        <>
          <div className="modal-overlay" onClick={() => setShowSuccess(false)} />
          <div className="modal-panel-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 className="modal-title" style={{ justifyContent: 'center', marginBottom: 8 }}>
              <strong>p{savedId}</strong> Patient Saved Successfully
            </h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24 }}>
              The patient record has been saved and risk score updated.
            </p>
            <button className="btn-modal-save" onClick={() => setShowSuccess(false)}>
              Done
            </button>
            <div style={{ height: 3, background: 'var(--primary-blue-light)', borderRadius: 99, marginTop: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--primary-blue)', borderRadius: 99, animation: 'shrink 3s linear forwards' }} />
            </div>
          </div>
        </>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Priority Patients List</h1>
          <p className="text-sm text-gray-500 mt-1">Patients ranked by clinical urgency. Decision support only.</p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={16} />
          Add Patient
        </button>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total Patients */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Patients</div>
          <div className="text-3xl font-bold text-gray-900">{loading ? '…' : counts.total}</div>
        </div>
        {/* High Risk */}
        <div className="bg-[#FFE9E5] border border-[#FFD2CA] rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">High Risk</div>
          <div className="text-3xl font-bold text-gray-900">{loading ? '…' : counts.high}</div>
        </div>
        {/* Medium Risk */}
        <div className="bg-[#FFF2D0] border border-[#FFE6A3] rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Medium Risk</div>
          <div className="text-3xl font-bold text-gray-900">{loading ? '…' : counts.medium}</div>
        </div>
        {/* Low Risk */}
        <div className="bg-[#D6FDE6] border border-[#B4F6D0] rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Risk</div>
          <div className="text-3xl font-bold text-gray-900">{loading ? '…' : counts.low}</div>
        </div>
      </div>

      {/* Deterioration alert banner — only shown when 1+ patients have worsened since last visit */}
      {!loading && counts.worsening > 0 && !alertDismissed && (
        <div className="flex items-center justify-between gap-3 mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-lg">⚠</span>
            <p className="text-sm text-red-700 font-medium">
              {counts.worsening} {counts.worsening === 1 ? 'patient has' : 'patients have'} moved to a higher risk category since their last visit.
            </p>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-red-400 hover:text-red-600 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content + right sidebar layout */}
      <div className="flex gap-6">
        {/* Priority Table on left (takes remaining space) */}
        <div className="flex-1">
          <PriorityTable
            patients={patients}
            loading={loading}
            error={error}
            onRefresh={fetchPatients}
            clerkId={clerkId}
          />
        </div>

        {/* This week's appointments widget on right (fixed width) */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">This week's appointments</h3>
            <div className="text-sm text-gray-400">No upcoming appointments</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;