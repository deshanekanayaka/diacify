import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import axios from '../utils/axiosConfig';

const BASE_URL = import.meta.env.VITE_API_URL;

const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const EMPTY_VISIT = {
    visit_date:    '',
    bp_systolic:   '',
    bp_diastolic:  '',
    cholesterol:   '',
    triglycerides: '',
    hdl:           '',
    ldl:           '',
    vldl:          '',
    age:           '',
    hba1c:         '',
    bmi:           '',
    rbs:           '',
};

const VisitField = ({ label, placeholder, helper, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type="number"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
        />
        {helper && <p className="text-xs text-gray-400 mt-1">{helper}</p>}
    </div>
);

const SectionLabel = ({ children }) => (
    <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-50">
        {children}
    </h3>
);

const AddVisitModal = ({ isOpen, onClose, patientId, onVisitAdded, latestVisit }) => {
    const { getToken } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Calculate pre-fill age based on time elapsed since last visit
    const getPrefilledAge = () => {
        if (!latestVisit) return '';
        const lastVisitDate = new Date(latestVisit.visit_date);
        const today = new Date();
        const monthsDiff = (today.getFullYear() - lastVisitDate.getFullYear()) * 12 + (today.getMonth() - lastVisitDate.getMonth());
        if (monthsDiff >= 12) {
            const yearsElapsed = Math.floor(monthsDiff / 12);
            return String(latestVisit.age + yearsElapsed);
        }
        return String(latestVisit.age);
    };

    const prefilledAge = getPrefilledAge();

    const initialFormState = {
        visit_date: getToday(),
        age: prefilledAge,
        bp_systolic: latestVisit?.bp_systolic ?? '',
        bp_diastolic: latestVisit?.bp_diastolic ?? '',
        hba1c: latestVisit?.hba1c ?? '',
        bmi: latestVisit?.bmi ?? '',
        rbs: latestVisit?.rbs ?? '',
        cholesterol: latestVisit?.cholesterol ?? '',
        triglycerides: latestVisit?.triglycerides ?? '',
        hdl: latestVisit?.hdl ?? '',
        ldl: latestVisit?.ldl ?? '',
        vldl: latestVisit?.vldl ?? '',
    };

    const [form, setForm] = useState(initialFormState);

    useEffect(() => {
        if (isOpen) {
            setForm(initialFormState);
            setError(null);
        }
    }, [isOpen, latestVisit]);

    if (!isOpen) return null;

    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleRecord = async () => {
        if (submitting) return;

        const requiredFields = ['age', 'bp_systolic', 'bp_diastolic', 'hba1c', 'bmi'];
        const missing = requiredFields.filter((f) => form[f] === '');
        if (missing.length > 0) {
            setError(`Required fields missing: ${missing.join(', ')}`);
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const token = await getToken();
            const payload = {
                visit_date: form.visit_date,
                age: Number(form.age),
                bp_systolic: Number(form.bp_systolic),
                bp_diastolic: Number(form.bp_diastolic),
                hba1c: Number(form.hba1c),
                bmi: Number(form.bmi),
                rbs: form.rbs !== '' ? Number(form.rbs) : null,
                cholesterol: form.cholesterol !== '' ? Number(form.cholesterol) : null,
                triglycerides: form.triglycerides !== '' ? Number(form.triglycerides) : null,
                hdl: form.hdl !== '' ? Number(form.hdl) : null,
                ldl: form.ldl !== '' ? Number(form.ldl) : null,
                vldl: form.vldl !== '' ? Number(form.vldl) : null,
            };
            await axios.post(
                `${BASE_URL}/api/patients/${patientId}/visits`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (onVisitAdded) onVisitAdded();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save visit');
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
                        <h2 className="text-lg font-semibold text-gray-900">Add New Visit</h2>
                        {patientId != null && (
                            <p className="text-sm text-gray-400 mt-0.5">New measurements for p{patientId}</p>
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

                {/* Scrollable form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Visit Details */}
                    <div>
                        <SectionLabel>Visit Details</SectionLabel>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
                            <input
                                type="date"
                                value={form.visit_date}
                                max={getToday()}
                                onChange={set('visit_date')}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                            />
                        </div>
                    </div>

                    {/* Blood Pressure */}
                    <div>
                        <SectionLabel>Blood Pressure</SectionLabel>
                        <div className="grid grid-cols-2 gap-4">
                            <VisitField
                                label="Systolic (mmHg)"
                                placeholder="e.g. 120"
                                helper="Normal: 90–120 mmHg"
                                value={form.bp_systolic}
                                onChange={set('bp_systolic')}
                            />
                            <VisitField
                                label="Diastolic (mmHg)"
                                placeholder="e.g. 80"
                                helper="Normal: 60–80 mmHg"
                                value={form.bp_diastolic}
                                onChange={set('bp_diastolic')}
                            />
                        </div>
                    </div>

                    {/* Lipid Profile */}
                    <div>
                        <SectionLabel>Lipid Profile</SectionLabel>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <VisitField
                                    label="Cholesterol (mg/dL)"
                                    placeholder="e.g. 200"
                                    helper="Desirable: <200 mg/dL"
                                    value={form.cholesterol}
                                    onChange={set('cholesterol')}
                                />
                                <VisitField
                                    label="Triglycerides (mg/dL)"
                                    placeholder="e.g. 150"
                                    helper="Normal: <150 mg/dL"
                                    value={form.triglycerides}
                                    onChange={set('triglycerides')}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <VisitField
                                    label="HDL (mg/dL)"
                                    placeholder="e.g. 50"
                                    helper="Optimal: >60 mg/dL"
                                    value={form.hdl}
                                    onChange={set('hdl')}
                                />
                                <VisitField
                                    label="LDL (mg/dL)"
                                    placeholder="e.g. 100"
                                    helper="Optimal: <100 mg/dL"
                                    value={form.ldl}
                                    onChange={set('ldl')}
                                />
                                <VisitField
                                    label="VLDL (mg/dL)"
                                    placeholder="e.g. 30"
                                    helper="Normal: 2–30 mg/dL"
                                    value={form.vldl}
                                    onChange={set('vldl')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Blood Sugar & Metabolic */}
                    <div>
                        <SectionLabel>Blood Sugar &amp; Metabolic</SectionLabel>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <VisitField
                                    label="Age at this visit (years)"
                                    placeholder="e.g. 52"
                                    helper="Patient's current age"
                                    value={form.age}
                                    onChange={set('age')}
                                />
                                <VisitField
                                    label="HbA1c (%)"
                                    placeholder="e.g. 7.0"
                                    helper="Diabetic: ≥6.5%"
                                    value={form.hba1c}
                                    onChange={set('hba1c')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <VisitField
                                    label="BMI (kg/m²)"
                                    placeholder="e.g. 25"
                                    helper="Normal: 18.5–24.9"
                                    value={form.bmi}
                                    onChange={set('bmi')}
                                />
                                <VisitField
                                    label="Random Blood Sugar (mg/dL)"
                                    placeholder="e.g. 150"
                                    helper="Diabetic: ≥200 mg/dL"
                                    value={form.rbs}
                                    onChange={set('rbs')}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <div />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleRecord}
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Saving...' : 'Record Visit'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AddVisitModal;
