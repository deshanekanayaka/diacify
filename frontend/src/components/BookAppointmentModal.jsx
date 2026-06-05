import React, { useEffect, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import axios from '../utils/axiosConfig';

const BASE_URL = import.meta.env.VITE_API_URL;

const localDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localDate(d);
};

const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDate(d);
};

const BookAppointmentModal = ({ isOpen, onClose, patientId, onBooked }) => {
    const { getToken } = useAuth();
    const [date, setDate]           = useState(getDefaultDate);
    const [type, setType]           = useState('Routine Review');
    const [notes, setNotes]         = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]         = useState(null);

    useEffect(() => {
        if (isOpen) {
            setDate(getDefaultDate());
            setType('Routine Review');
            setNotes('');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBook = async () => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await axios.post(BASE_URL + '/api/appointments', {
                patient_id: patientId,
                scheduled_date: date,
                appointment_type: type,
                notes,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                onClose();
                if (onBooked) onBooked();
            } else {
                setError(res.data.message || 'Booking failed.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Booking failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Book Appointment</h2>
                        {patientId != null && (
                            <p className="text-sm text-gray-400 mt-0.5">{patientId}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Appointment Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            min={getMinDate()}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Select a future date</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Appointment Type
                        </label>
                        <div className="relative">
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                            >
                                <option>Routine Review</option>
                                <option>Urgent Attention</option>
                                <option>Follow-up Visit</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {type === 'Urgent Attention' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                            Urgent appointments should be scheduled within 48 hours of this booking.
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional — add context for the clinician attending this appointment"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white resize-none"
                        />
                    </div>

                </div>

                {/* Error message */}
                {error && (
                    <div className="shrink-0 px-6 py-3 bg-red-50 border-t border-red-200">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <div />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleBook}
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Booking...' : 'Book Appointment'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BookAppointmentModal;
