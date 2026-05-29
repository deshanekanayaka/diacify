import React, { useState } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/clerk-react';
import PatientFormModal, { EMPTY_FORM } from './PatientFormModal';

const BASE_URL = import.meta.env.VITE_API_URL;

// Handles the POST request when a new patient is submitted
// API logic lives here so PatientFormModal stays a pure form component
const AddPatientModal = ({ isOpen, onClose, onPatientAdded }) => {
    // Retrieves the signed-in clinician's Clerk user object to attach their ID to the request
    const { user } = useUser();

    const [saving, setSaving] = useState(false);
    // Holds any error message returned by the server to display inside the form
    const [savingError, setSavingError] = useState(null);

    // Clears any previous error before closing so it doesn't linger on next open
    const handleClose = () => {
        setSavingError(null);
        onClose();
    };

    const handleSave = async (payload) => {
        try {
            setSaving(true);
            setSavingError(null);

            // Zod on the backend coerces strings to numbers, so only clerk_id needs appending here
            const res = await axios.post(`${BASE_URL}/api/patients`, {
                ...payload,
                clerk_id: user.id,
            });

            // Checks for application-level failures returned inside a 200 response
            if (!res.data.success) {
                setSavingError(res.data.errors?.join(', ') ?? res.data.message ?? 'Failed to add patient.');
                return;
            }

            // Passes the new patient's ID up to the parent so the success modal can display it
            onPatientAdded(res.data.data.patient_id);
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
        // Passes EMPTY_FORM as initial values so the form always opens blank for a new patient
        <PatientFormModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add Patient Details"
            initialValues={EMPTY_FORM}
            onSave={handleSave}
            saving={saving}
            savingError={savingError}
        />
    );
};

export default AddPatientModal;