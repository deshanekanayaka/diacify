import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import EditPatientModal from './EditPatientModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RiskPill } from '@/components/risk-ui';
import { riskColorClass } from '@/lib/risk';
import { EllipsisVertical } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Receives patients/loading/error from Dashboard and calls onRefresh
// after any mutation so Dashboard re-fetches and StatCards + table both update
const PriorityTable = ({ patients = [], loading, error, onRefresh }) => {
  const { getToken } = useAuth();
  const [searchId, setSearchId] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Holds the patient object to be edited, or null when no edit is in progress
  const [editPatient, setEditPatient] = useState(null);
  // Holds the patient object pending deletion, or null when no delete is in progress
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Holds an inline error message if the delete request fails
  const [deleteError, setDeleteError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  // Stores the ID of the most recently saved patient to display in the success modal
  const [savedId, setSavedId] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const token = await getToken();
      const res = await axios.delete(`${BASE_URL}/api/patients/${deleteTarget.patient_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data.success) throw new Error(res.data.message);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      setDeleteError('Delete failed: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Strips leading "p" from search input so "p8" and "8" both match patient 8
  const searchTerm = searchId.trim().replace(/^p/i, '');

  // Only recalculates when patients, searchTerm, or riskFilter changes — not on every render
  const filtered = useMemo(() => {
    return patients
      .filter((patient) => {
        if (searchTerm) {
          const patientId = String(patient.patient_id);
          if (patientId !== searchTerm) return false;
        }
        if (riskFilter !== 'all') {
          const patientRisk = (patient.risk_category || '').toLowerCase();
          if (patientRisk !== riskFilter) return false;
        }
        return true;
      })
      .sort((a, b) => b.risk_score - a.risk_score);
  }, [patients, searchTerm, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pageRows = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const riskCategory = (rc) => (rc || '').toLowerCase();

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const riskTextClass = (cat) => riskColorClass(cat === 'high' || cat === 'medium' || cat === 'low' ? cat : 'low').text;

  return (
    <>
      <EditPatientModal
        isOpen={!!editPatient}
        onClose={() => setEditPatient(null)}
        onPatientUpdated={(patientId) => {
          setEditPatient(null);
          onRefresh();
          setSavedId(patientId);
          setShowSuccess(true);
        }}
        patient={editPatient}
      />

      {/* Auto-dismiss success notice (kept from existing UX) */}
      {showSuccess && (
        <>
          <div className="modal-overlay" onClick={() => setShowSuccess(false)} />
          <div className="modal-panel-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 className="modal-title" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <strong>{savedId}</strong> Patient Saved Successfully
            </h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24 }}>
              The patient record has been saved and risk score updated.
            </p>
            <button className="btn-modal-save" onClick={() => setShowSuccess(false)}>
              Done
            </button>
            <div style={{ height: 3, background: 'var(--primary-blue-light)', borderRadius: 99, marginTop: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--primary-blue)', borderRadius: 99, animation: 'shrink 3s linear forwards' }} />
            </div>
          </div>
        </>
      )}

      {/* Radix AlertDialog for Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-md w-full">
          <AlertDialogTitle className="text-lg font-semibold text-gray-900 mb-2">
            Delete Patient
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-500 mb-6">
            Are you sure you want to delete <strong>{deleteTarget?.patient_id}</strong>?
          </AlertDialogDescription>
          {deleteError && (
            <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-2 mb-4">{deleteError}</div>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialogCancel
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* item 7 — flex-1 search grows, select stays w-40 */}
        <div className="flex items-center gap-3 px-4 pt-4 mb-4">
          <input
            type="text"
            placeholder="Search by Patient ID (e.g. p8 or 8)"
            value={searchId}
            onChange={(e) => {
              setSearchId(e.target.value);
              setPage(1);
            }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ring-offset-0 transition-all duration-150 placeholder-gray-400"
          />
          <select
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk Only</option>
            <option value="medium">Medium Risk Only</option>
            <option value="low">Low Risk Only</option>
          </select>
        </div>

        {loading && <p className="p-6 text-muted-foreground">Loading patients…</p>}
        {error && (
          <div className="mx-4 mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error} <button onClick={onRefresh} className="ml-2 underline">Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-35 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3">PATIENT ID</TableHead>
                  <TableHead className="w-20 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3">AGE</TableHead>
                  <TableHead className="w-25 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3">SEX</TableHead>
                  <TableHead className="w-40 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3">LAST VISIT</TableHead>
                  <TableHead className="w-50 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3 text-left">RISK SCORE</TableHead>
                  <TableHead className="w-30 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3">RISK</TableHead>
                  <TableHead className="w-20 bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 px-4 py-3 text-right pr-4">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No patients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((p) => {
                    const cat = riskCategory(p.risk_category);
                    const lastVisit = p.created_at || p.last_visit || p.last_visit_date || p.last_seen || null;
                    return (
                      <TableRow key={p.patient_id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-100">
                        <TableCell>
                          <Link to={`/patients/${p.patient_id}`} className="text-blue-600 underline hover:text-blue-700">
                            {p.patient_id}
                          </Link>
                        </TableCell>
                        <TableCell>{p.age ?? '—'}</TableCell>
                        <TableCell className="capitalize">{p.sex ?? '—'}</TableCell>
                        <TableCell>{formatDate(lastVisit)}</TableCell>
                        <TableCell>
                          <span className="font-medium tabular-nums text-gray-900">{Math.round(Number(p.risk_score ?? 0))}</span>
                        </TableCell>
                        <TableCell>
                          <RiskPill category={(cat === 'high' || cat === 'medium' || cat === 'low') ? cat : 'low'} />
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                                <EllipsisVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              sideOffset={4}
                              className="z-50 min-w-[140px] bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden"
                            >
                              <DropdownMenuItem
                                onClick={() => setEditPatient(p)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer w-full text-left"
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(p)}
                                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer w-full text-left"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span>Show</span>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-md border px-2 py-1 text-sm disabled:opacity-50" disabled={page === 1} onClick={() => setPage(1)}>
                  First
                </button>
                <button className="rounded-md border px-2 py-1 text-sm disabled:opacity-50" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button className="rounded-md border px-2 py-1 text-sm disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </button>
                <button className="rounded-md border px-2 py-1 text-sm disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PriorityTable;