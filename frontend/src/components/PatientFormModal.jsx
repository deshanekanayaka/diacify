import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, checkWarnings } from '../utils/schema.js';

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

// Reusable input field that shows either a red error or an amber warning below the input.
// Error takes priority — if both exist, only the error is shown.
const Field = ({ label, placeholder, registration, error, warning }) => (
    <div className="modal-field">
        <label className="modal-field-label">{label}</label>
        <input
            type="number"
            placeholder={placeholder}
            className={`modal-input${error ? ' input-error' : warning ? ' input-warning' : ''}`}
            {...registration}
        />
        <p className={error ? 'modal-input-error-msg' : 'modal-input-warning-msg'}>
            {error ? `⚠ ${error.message}` : warning ? `⚠ ${warning}` : ''}
        </p>
    </div>
);

const PatientFormModal = ({ isOpen, onClose, title, initialValues, onSave, saving, savingError }) => {

    const [warnings, setWarnings] = useState({});

    // Holds the validated form data while the clinician reviews warnings.
    // null means no save is currently pending confirmation.
    const [pendingData, setPendingData] = useState(null);

    // Wires up Zod validation, blank defaults, and field-level error timing
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(patientSchema), // runs patientSchema on submit
        defaultValues: EMPTY_FORM,
        mode: 'onBlur',          // validates when clinician leaves a field
        reValidateMode: 'onChange', // clears error as soon as value becomes valid
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

        //Checks if any warnings were returned
        if (Object.keys(activeWarnings).length > 0) {

            // highlight the fields and pause the save.
            setWarnings(activeWarnings);
            setPendingData(data);

        } else {
            // All values are within normal range
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

    // True when at least one field has a warning — used to show the confirm/go-back buttons
    const hasWarnings = Object.keys(warnings).length > 0;

    return (
        <>
            <div className="modal-overlay" onClick={handleClose} />
            <div className="modal-panel modal-panel--lg">

                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close-btn" onClick={handleClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate>

                    <p className="modal-section-label">
                        Patient Information <span className="modal-required-star">*</span>
                    </p>
                    <div className="modal-grid-2">
                        <Field
                            label="Age (years)"
                            placeholder="e.g. 45"
                            registration={register('age')}
                            error={errors.age}
                        />
                        <div className="modal-field">
                            <label className="modal-field-label">Gender</label>
                            <div className="modal-radio-group">
                                {['male', 'female'].map((val) => (
                                    <label key={val} className="modal-radio-label">
                                        <input type="radio" value={val} {...register('sex')} />
                                        {val.charAt(0).toUpperCase() + val.slice(1)}
                                    </label>
                                ))}
                            </div>
                            <p className="modal-input-error-msg"></p>
                        </div>
                    </div>

                    <p className="modal-section-label modal-section-label--padded">
                        Social Life <span className="modal-required-star">*</span>
                    </p>
                    <div className="modal-field">
                        <select className="modal-select" {...register('social_life')}>
                            <option value="city">City (Urban)</option>
                            <option value="village">Village (Rural)</option>
                        </select>
                        <p className="modal-input-error-msg"></p>
                    </div>

                    <p className="modal-section-label modal-section-label--padded">
                        Blood Pressure (mmHg) <span className="modal-required-star">*</span>
                    </p>
                    <div className="modal-grid-2">
                        <Field label="Systolic"  placeholder="5 – 25"  registration={register('bp_systolic')}  error={errors.bp_systolic}  warning={warnings.bp_systolic}  />
                        <Field label="Diastolic" placeholder="3 – 15"  registration={register('bp_diastolic')} error={errors.bp_diastolic} warning={warnings.bp_diastolic} />
                    </div>

                    <p className="modal-section-label modal-section-label--padded">
                        Lipid Profile (mg/dL) <span className="modal-required-star">*</span>
                    </p>
                    <div className="modal-grid-5">
                        <Field label="Cholesterol"   placeholder="0 – 500"  registration={register('cholesterol')}   error={errors.cholesterol}   warning={warnings.cholesterol}   />
                        <Field label="Triglycerides" placeholder="0 – 1000" registration={register('triglycerides')} error={errors.triglycerides} warning={warnings.triglycerides} />
                        <Field label="HDL"           placeholder="0 – 100"  registration={register('hdl')}           error={errors.hdl}           warning={warnings.hdl}           />
                        <Field label="LDL"           placeholder="0 – 300"  registration={register('ldl')}           error={errors.ldl}           warning={warnings.ldl}           />
                        <Field label="VLDL"          placeholder="0 – 100"  registration={register('vldl')}          error={errors.vldl}          warning={warnings.vldl}          />
                    </div>

                    <p className="modal-section-label modal-section-label--padded">
                        Blood Sugar &amp; Metabolic <span className="modal-required-star">*</span>
                    </p>
                    <div className="modal-grid-3">
                        <Field label="HbA1c (%)"                  placeholder="0 – 20"  registration={register('hba1c')} error={errors.hba1c} warning={warnings.hba1c} />
                        <Field label="BMI (kg/m²)"                placeholder="0 – 60"  registration={register('bmi')}   error={errors.bmi}   warning={warnings.bmi}   />
                        <Field label="Random Blood Sugar (mg/dL)" placeholder="0 – 600" registration={register('rbs')}   error={errors.rbs}   warning={warnings.rbs}   />
                    </div>

                    {/* Small confirm bar — only appears when warnings are active.
                        Replaces the old warning banner — inputs do the visual work now. */}
                    {hasWarnings && pendingData && (
                        <div className="modal-warning-banner">
                            <p className="modal-warning-title">
                                ⚠ Highlighted fields have unusual values — save anyway?
                            </p>
                            <div className="modal-warning-actions">
                                <button type="button" className="btn-warning-confirm" onClick={handleConfirmSave}>
                                    Save Anyway
                                </button>
                                <button type="button" className="btn-warning-cancel" onClick={handleDismissWarnings}>
                                    Go Back
                                </button>
                            </div>
                        </div>
                    )}

                    {savingError && <div className="modal-error-banner">{savingError}</div>}

                    <div className="modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={handleClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-modal-save" disabled={saving || !!pendingData}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>

                </form>
            </div>
        </>
    );
};

export default PatientFormModal;