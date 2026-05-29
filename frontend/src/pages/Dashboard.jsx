import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PriorityTable from '../components/PriorityTable';

const BASE_URL = import.meta.env.VITE_API_URL;

// clerkId is passed from App.jsx and used to fetch only this clinician's patients
const Dashboard = ({ clerkId }) => {
  const [patients, setPatients] = useState([]); //Patients list fetched from backend
  const [loading, setLoading] = useState(true); //loading indicators in StatCards and PriorityTable
  const [error, setError] = useState(null); //error messages in PriorityTable

  // useCallback ensures fetchPatients is only re-created when clerkId changes
  // otherwise a new function reference is created on every render, causing infinite re-fetches
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetches all patients for this clinician sorted by highest risk score first
      const res = await axios.get(`${BASE_URL}/api/patients`, {
        params: { clerk_id: clerkId, sortBy: 'risk' },
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
  }, [clerkId]);

  // Runs fetchPatients on mount and whenever clerkId changes
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  //Only recalculates when the patients array actually changes. Or the loop would run
  // on every re-render
  const counts = useMemo(() => {
    const result = { total: patients.length, high: 0, medium: 0, low: 0 };
    patients.forEach((patient) => {
      const riskLevel = (patient.risk_category || '').toLowerCase();
      if (riskLevel === 'high') result.high++;
      if (riskLevel === 'medium') result.medium++;
      if (riskLevel === 'low') result.low++;
    });
    return result;
  }, [patients]);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{loading ? '…' : counts.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-[color:var(--risk-high-soft)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-risk-high">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{loading ? '…' : counts.high}</div>
          </CardContent>
        </Card>
        <Card className="bg-[color:var(--risk-medium-soft)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[color:var(--risk-medium)]">Medium Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{loading ? '…' : counts.medium}</div>
          </CardContent>
        </Card>
        <Card className="bg-[color:var(--risk-low-soft)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[color:var(--risk-low)]">Low Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{loading ? '…' : counts.low}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main content + right sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Priority Table spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <PriorityTable
            patients={patients}
            loading={loading}
            error={error}
            onRefresh={fetchPatients}
            clerkId={clerkId}
          />
        </div>

        {/* This week's appointments widget */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>This week’s appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">No upcoming appointments</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;