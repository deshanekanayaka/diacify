import React from 'react';
import { Link } from 'react-router-dom';

// TODO: wire to GET /api/appointments

// item 20 — updated badge colours
const TYPE_BADGE = {
  'Urgent Attention': 'bg-red-100 text-red-700',
  'Routine Review':   'bg-gray-100 text-gray-700',
  'Follow-up Visit':  'bg-purple-100 text-purple-700',
};

const TABLE_COLS = ['DATE', 'PATIENT', 'TYPE', 'NOTES', 'ACTIONS'];

function AppointmentsTable({ rows, showActions }) {
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
                <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{appt.date}</td>
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
                      <button className="border border-green-400 text-green-600 hover:bg-green-50 rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors">
                        Complete
                      </button>
                      <button className="border border-red-300 text-red-500 hover:bg-red-50 rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors">
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
  const upcoming = [];
  const past     = [];

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
          <AppointmentsTable rows={upcoming} showActions={true} />
        </section>

        {/* item 23 — only render past section when data exists */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Past · {past.length}</h2>
            <AppointmentsTable rows={past} showActions={false} />
          </section>
        )}
      </div>
    </div>
  );
};

export default Appointments;
