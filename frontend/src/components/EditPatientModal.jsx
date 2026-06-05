import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import { useAuth } from '@clerk/clerk-react';
import PatientFormModal from './PatientFormModal';

const BASE_URL = import.meta.env.VITE_API_URL;

// Converts a DB patient record into the shape the form fields expect
// DB values can be numbers or null; the form expects strings or '' (empty strings)
const toFormValues = (patient) => ({
    age:           patient.age           ?? '',
    sex:           patient.sex           ?? 'male',
    social_life:   patient.social_life   ?? 'city',
    bp_systolic:   patient.bp_systolic   ?? '',
    bp_diastolic:  patient.bp_diastolic  ?? '',
    cholesterol:   patient.cholesterol   ?? '',
    triglycerides: patient.triglycerides ?? '',
    hdl:           patient.hdl           ?? '',
    ldl:           patient.ldl           ?? '',
    vldl:          patient.vldl          ?? '',
    hba1c:         patient.hba1c         ?? '',
    bmi:           patient.bmi           ?? '',
    rbs:           patient.rbs           ?? '',
});

// Handles the PUT request when an existing patient is updated via PatientFormModal
// API logic lives here so PatientFormModal stays a pure form component
const EditPatientModal = ({ isOpen, onClose, onPatientUpdated, patient }) => {
    const { getToken } = useAuth();
    // Tracks whether the save request is in progress to disable the submit button
    const [saving,      setSaving]      = useState(false);
    // Holds any error message returned by the server to display in the form
    const [savingError, setSavingError] = useState(null);

    // Clears any previous error before closing the modal
    const handleClose = () => {
        setSavingError(null);
        onClose();
    };

    const handleSave = async (payload) => {
        try {
            setSaving(true);
            setSavingError(null);

            const token = await getToken();
            // Sends the updated patient data to the backend
            const res = await axios.put(
                `${BASE_URL}/api/patients/${patient.patient_id}`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Checks for application-level errors returned inside a 200 response
            if (!res.data.success) {
                setSavingError(res.data.errors?.join(', ') ?? res.data.message ?? 'Failed to update patient.');
                return;
            }

            // Notifies the parent to refresh the patient list, then closes the modal
            onPatientUpdated(patient.patient_id);
            handleClose();

        } catch (err) {
            console.error(err);
            // Uses the most specific error available, falling back to a generic message
            setSavingError(
                err.response?.data?.errors?.join(', ') ??
                err.response?.data?.message ??
                'Could not connect to server.'
            );
        } finally {
            // Always re-enables the save button regardless of outcome
            setSaving(false);
        }
    };

    return (
        // Prevents rendering if patient data hasn't loaded yet
        <PatientFormModal
            isOpen={isOpen && !!patient}
            onClose={handleClose}
            title="Edit Patient"
            subtitle={patient ? `p${patient.patient_id}` : undefined}
            // Converts the raw DB record to form-friendly values, or passes null if no patient
            initialValues={patient ? toFormValues(patient) : null}
            onSave={handleSave}
            saving={saving}
            savingError={savingError}
            primaryLabel="Save Changes"
        />
    );
};

export default EditPatientModal;

//References
//https://www.taniarascia.com/crud-app-in-react-with-hooks/
//https://www.freecodecamp.org/news/javascript-advanced-operators/
//https://www.digitalocean.com/community/tutorials/react-axios-react
//https://designrevision.com/react-axios/
