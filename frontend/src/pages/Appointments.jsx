import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

// item 20 — updated badge colours
const TYPE_BADGE = {
  'Urgent Attention': 'bg-red-100 text-red-700',
  'Routine Review':   'bg-gray-100 text-gray-700',
  'Follow-up Visit':  'bg-purple-100 text-purple-700',
};

const TYPE_LABEL_MAP = {
  'routine':   'Routine Review',
  'urgent':    'Urgent Attention',
  'follow-up': 'Follow-up Visit',
};

const TABLE_COLS = ['DATE', 'PATIENT', 'TYPE', 'NOTES', 'ACTIONS'];

const formatDate = (dateStr) => {
  // Return empty string if input is null or undefined
  if (!dateStr) return '';

  // Check if input matches YYYY-MM-DD regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day))
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Fall back to new Date(dateStr) if format doesn't match
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {
    // Continue to final fallback
  }

  // Return original input if all parsing fails
  return dateStr;
};

function AppointmentsTable({ rows, showActions, onComplete, onCancel }) {
  return (
    // items 16 — table container
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden w-full mb-8">
      <table className="w-full text-sm">
        {/* item 17 — header row */}
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {TABLE_COLS.map((col) => (
              <th
                key={col}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            // item 22 — empty state
            <tr>
              <td colSpan={TABLE_COLS.length} className="text-center py-12 text-sm text-gray-400">
                No upcoming appointments
              </td>
            </tr>
          ) : (
            rows.map((appt) => (
              // item 18 — row styling
              <tr key={appt.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{formatDate(appt.date)}</td>
                {/* item 19 — patient cell */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <Link to={`/patients/${appt.patientId}`} className="text-blue-600 cursor-pointer hover:underline font-medium">
                    {appt.patientName || appt.patientId}
                  </Link>
                </td>
                {/* item 20 — type badge */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${TYPE_BADGE[appt.type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {appt.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{appt.notes || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {showActions ? (
                    // item 21 — action buttons
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onComplete(appt.id)}
                        className="border border-green-400 text-green-600 hover:bg-green-50 rounded-md px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors">
                        Complete
                      </button>
                      <button
                        onClick={() => onCancel(appt.id)}
                        className="border border-red-300 text-red-500 hover:bg-red-50 rounded-md px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    // item 23 — past status badge
                    <span className="bg-gray-100 text-gray-500 rounded-full px-3 py-1 text-xs font-medium">
                      {appt.status || 'Completed'}
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const Appointments = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    const fetchAppointments = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/appointments`,
          {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Map DB fields to the shape AppointmentsTable expects
        const mapRow = (a) => ({
          id:          a.appointment_id,
          patientId:   a.patient_id,
          patientName: a.patient_id,
          date:        a.scheduled_date,
          type:        TYPE_LABEL_MAP[a.appointment_type] ?? a.appointment_type,
          notes:       a.notes,
          status:      a.status,
        });

        setUpcoming((json.data.upcoming || []).map(mapRow));
        setPast((json.data.past || []).map(mapRow));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
    return () => controller.abort();
  }, [user, getToken]);

  const handleComplete = async (appointmentId) => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/appointments/${appointmentId}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'completed' }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Find the appointment before removing it
      const appointmentToMove = upcoming.find(a => a.id === appointmentId);
      
      // Remove from upcoming
      setUpcoming(prev => prev.filter(a => a.id !== appointmentId));
      
      // Add to past with updated status
      if (appointmentToMove) {
        setPast(prev => [{ ...appointmentToMove, status: 'completed' }, ...prev]);
      }
      
      setConfirmComplete(null);
    } catch (err) {
      alert('Failed to update appointment: ' + err.message);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/appointments/${appointmentId}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Find the appointment before removing it
      const appointmentToMove = upcoming.find(a => a.id === appointmentId);
      
      // Remove from upcoming
      setUpcoming(prev => prev.filter(a => a.id !== appointmentId));
      
      // Add to past with updated status
      if (appointmentToMove) {
        setPast(prev => [{ ...appointmentToMove, status: 'cancelled' }, ...prev]);
      }
      
      setConfirmCancel(null);
    } catch (err) {
      alert('Failed to cancel appointment: ' + err.message);
    }
  };

  if (loading) return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <p className="text-gray-400">Loading appointments…</p>
    </div>
  );

  if (error) return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <p className="text-red-500">Error: {error}</p>
    </div>
  );

  return (
    // items 13–14 — already correct, preserved
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        All scheduled visits across your patient list.
      </p>

      <div className="space-y-8">
        <section>
          {/* item 15 — count in heading */}
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming · {upcoming.length}</h2>
          <AppointmentsTable rows={upcoming} showActions={true} onComplete={setConfirmComplete} onCancel={setConfirmCancel} />
        </section>

        {/* item 23 — only render past section when data exists */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Past · {past.length}</h2>
            <AppointmentsTable rows={past} showActions={false} />
          </section>
        )}
      </div>

      {confirmComplete !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-white/10">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Mark as completed?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This will move the appointment to your past visits and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmComplete(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Go back
              </button>
              <button
                onClick={() => handleComplete(confirmComplete)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Yes, mark complete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancel !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-white/10">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Cancel this appointment?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This appointment will be marked as cancelled and moved to past visits.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Go back
              </button>
              <button
                onClick={() => handleCancel(confirmCancel)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
