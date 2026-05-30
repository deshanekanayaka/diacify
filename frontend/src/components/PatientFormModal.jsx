import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, checkWarnings } from '../utils/schema.js';
import { AlertCircle, Loader2, X } from 'lucide-react';

// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_FORM = {
    age:           '',
    sex:           'male',
    social_life:   'city',
    bp_systolic:   '',
    bp_diastolic:  '',
    cholesterol:   '',
    triglycerides: '',
    hdl:           '',
    ldl:           '',
    vldl:          '',
    hba1c:         '',
    bmi:           '',
    rbs:           '',
};

const Field = ({ label, placeholder, helper, registration, error, warning }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type="number"
            placeholder={placeholder}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white ${
                error ? 'border-red-500' : warning ? 'border-amber-400' : 'border-gray-200'
            }`}
            {...registration}
        />
        {!error && !warning && helper && (
            <p className="text-xs text-gray-400 mt-1">{helper}</p>
        )}
        {(error || warning) && (
            <p className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-amber-600'}`}>
                {error ? `⚠ ${error.message}` : `⚠ ${warning}`}
            </p>
        )}
    </div>
);

const SectionLabel = ({ children }) => (
    <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-50">
        {children}
    </h3>
);

const PatientFormModal = ({ isOpen, onClose, title, subtitle, initialValues, onSave, saving, savingError, primaryLabel = 'Save' }) => {

    const [warnings, setWarnings] = useState({});

    // Holds the validated form data while the clinician reviews warnings.
    // null means no save is currently pending confirmation.
    const [pendingData, setPendingData] = useState(null);

    // Wires up Zod validation, blank defaults, and field-level error timing
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(patientSchema),
        defaultValues: EMPTY_FORM,
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });

    // Resets the form and clears leftover state every time the modal opens
    useEffect(() => {
        if (isOpen) {
            reset(initialValues ?? EMPTY_FORM);
            setWarnings({});
            setPendingData(null);
        }
    }, [isOpen, initialValues, reset]);

    if (!isOpen) return null;

    // Runs after Zod passes — checks clinical thresholds and either saves immediately
    // or pauses and highlights unusual fields for the clinician to review
    const onSubmit = (data) => {
        const activeWarnings = checkWarnings(data);
        if (Object.keys(activeWarnings).length > 0) {
            setWarnings(activeWarnings);
            setPendingData(data);
        } else {
            onSave(data);
        }
    };

    const handleConfirmSave = () => {
        // Clinician reviewed the highlighted fields and chose to proceed
        onSave(pendingData);
        setPendingData(null);
    };

    const handleDismissWarnings = () => {
        // Clinician wants to correct values — clear highlights and unlock the form
        setWarnings({});
        setPendingData(null);
    };

    const handleClose = () => {
        reset(EMPTY_FORM);
        setWarnings({});
        setPendingData(null);
        onClose();
    };

    const hasWarnings = Object.keys(warnings).length > 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable form body */}
                <form
                    id="patient-form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
                >

                    {/* Patient Information */}
                    <div>
                        <SectionLabel>Patient Information</SectionLabel>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field
                                    label="Age (years)"
                                    placeholder="e.g. 45"
                                    helper="Age in years (1–120)"
                                    registration={register('age')}
                                    error={errors.age}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                    <div className="flex gap-6 mt-1">
                                        {[['male', 'Male'], ['female', 'Female']].map(([val, lbl]) => (
                                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    value={val}
                                                    {...register('sex')}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-gray-700">{lbl}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Social Life</label>
                                    <select
                                        {...register('social_life')}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                                    >
                                        <option value="city">City (Urban)</option>
                                        <option value="village">Village (Rural)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Family History of Diabetes</label>
                                    <select
                                        disabled
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed appearance-none"
                                    >
                                        <option>Not collected</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Not in current data model</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Blood Pressure */}
                    <div>
                        <SectionLabel>Blood Pressure</SectionLabel>
                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label="Systolic (mmHg)"
                                placeholder="e.g. 120"
                                helper="Normal: 90–120 mmHg"
                                registration={register('bp_systolic')}
                                error={errors.bp_systolic}
                                warning={warnings.bp_systolic}
                            />
                            <Field
                                label="Diastolic (mmHg)"
                                placeholder="e.g. 80"
                                helper="Normal: 60–80 mmHg"
                                registration={register('bp_diastolic')}
                                error={errors.bp_diastolic}
                                warning={warnings.bp_diastolic}
                            />
                        </div>
                    </div>

                    {/* Lipid Profile */}
                    <div>
                        <SectionLabel>Lipid Profile</SectionLabel>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field
                                    label="Cholesterol (mg/dL)"
                                    placeholder="e.g. 200"
                                    helper="Desirable: <200 mg/dL"
                                    registration={register('cholesterol')}
                                    error={errors.cholesterol}
                                    warning={warnings.cholesterol}
                                />
                                <Field
                                    label="Triglycerides (mg/dL)"
                                    placeholder="e.g. 150"
                                    helper="Normal: <150 mg/dL"
                                    registration={register('triglycerides')}
                                    error={errors.triglycerides}
                                    warning={warnings.triglycerides}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <Field
                                    label="HDL (mg/dL)"
                                    placeholder="e.g. 50"
                                    helper="Optimal: >60 mg/dL"
                                    registration={register('hdl')}
                                    error={errors.hdl}
                                    warning={warnings.hdl}
                                />
                                <Field
                                    label="LDL (mg/dL)"
                                    placeholder="e.g. 100"
                                    helper="Optimal: <100 mg/dL"
                                    registration={register('ldl')}
                                    error={errors.ldl}
                                    warning={warnings.ldl}
                                />
                                <Field
                                    label="VLDL (mg/dL)"
                                    placeholder="e.g. 30"
                                    helper="Normal: 2–30 mg/dL"
                                    registration={register('vldl')}
                                    error={errors.vldl}
                                    warning={warnings.vldl}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Blood Sugar & Metabolic */}
                    <div>
                        <SectionLabel>Blood Sugar &amp; Metabolic</SectionLabel>
                        <div className="grid grid-cols-3 gap-4">
                            <Field
                                label="HbA1c (%)"
                                placeholder="e.g. 7.0"
                                helper="Diabetic: ≥6.5%"
                                registration={register('hba1c')}
                                error={errors.hba1c}
                                warning={warnings.hba1c}
                            />
                            <Field
                                label="BMI (kg/m²)"
                                placeholder="e.g. 25"
                                helper="Normal: 18.5–24.9"
                                registration={register('bmi')}
                                error={errors.bmi}
                                warning={warnings.bmi}
                            />
                            <Field
                                label="Random Blood Sugar (mg/dL)"
                                placeholder="e.g. 150"
                                helper="Diabetic: ≥200 mg/dL"
                                registration={register('rbs')}
                                error={errors.rbs}
                                warning={warnings.rbs}
                            />
                        </div>
                    </div>

                    {/* Warning Banner */}
                    {hasWarnings && pendingData && (
                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                            <div className="flex gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-amber-800 mb-3">
                                        Highlighted fields have unusual values — save anyway?
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleConfirmSave}
                                            className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition"
                                        >
                                            Save Anyway
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDismissWarnings}
                                            className="px-3 py-1.5 border border-amber-300 text-amber-700 text-sm font-medium rounded hover:bg-amber-50 transition"
                                        >
                                            Go Back
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </form>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <div>
                        {savingError && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {savingError}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="patient-form"
                            disabled={saving || !!pendingData}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {saving ? 'Saving…' : primaryLabel}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PatientFormModal;
