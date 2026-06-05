import React, { useState, useEffect } from 'react';
import axios from '../../utils/axiosConfig';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

const BASE_URL = import.meta.env.VITE_API_URL;

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};


const AppointmentsWidget = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${BASE_URL}/api/appointments/upcoming`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          if (!res.data.success) {
            setError(true);
          } else {
            setAppointments(res.data.data || []);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [getToken]);

  const renderBody = () => {
    if (loading) return <div className="text-sm text-gray-400">Loading...</div>;
    if (error) return <div className="text-sm text-red-400">Could not load appointments.</div>;
    if (appointments.length === 0) return <div className="text-sm text-gray-400">No appointments this week.</div>;
    
    return (
      
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <div
            key={appt.appointment_id}
            className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <Link to={`/patients/${appt.patient_id}`} className="font-medium text-blue-600 hover:underline truncate">{appt.patient_id}</Link>
              <span className="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">{appt.appointment_type}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
              <span className="text-xs text-gray-500">{formatDate(appt.scheduled_date)}</span>
              {appt.is_overdue && (
                <span className="text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-0.5 leading-none">
                  Overdue
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">This Week's Appointments</h3>
        <Link to="/appointments" className="text-sm text-blue-600 hover:underline">All</Link>
      </div>
      {renderBody()}
    </div>
  );
};

export default AppointmentsWidget;
