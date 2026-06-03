import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { RiskPill, Sparkline, TrendArrow } from '@/components/risk-ui';
import { riskColorClass } from '@/lib/risk';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BookAppointmentModal from '../components/BookAppointmentModal';
import AddVisitModal from '../components/AddVisitModal';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Line, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL;


export default function PatientDetailPage({ clerkId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [expandedVisits, setExpandedVisits] = useState(new Set());
  const [appointments, setAppointments] = useState([]);

  const toggleVisit = (rowId) => {
    setExpandedVisits(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const res = await axios.get(`${BASE_URL}/api/patients/${id}`, {
        params: { clerk_id: clerkId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to fetch');
      setPatient(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, clerkId, getToken]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const fetchAppointments = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BASE_URL}/api/appointments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setAppointments(res.data.data);
    } catch {
      setAppointments([]);
    }
  }, [id, getToken]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const category = useMemo(() => {
    const rc = (patient?.latest_visit?.risk_category ?? '').toLowerCase();
    if (rc === 'high' || rc === 'medium' || rc === 'low') return rc;
    return 'pending';
  }, [patient]);

  const riskPanelClass = category === 'high'
    ? 'bg-red-100 border-red-200'
    : category === 'medium'
    ? 'bg-amber-100 border-amber-200'
    : category === 'low'
    ? 'bg-green-100 border-green-200'
    : 'bg-gray-100 border-gray-200';

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const topFactors = Array.isArray(patient?.latest_visit?.top_factors) ? patient.latest_visit.top_factors : [];

  // Debug: log the patient object to see the full structure
  useEffect(() => {
    if (patient) {
      console.log('Patient object:', patient);
      console.log('Top factors:', patient?.latest_visit?.top_factors);
      console.log('Confidence values:', { low: patient?.latest_visit?.confidence_low, medium: patient?.latest_visit?.confidence_medium, high: patient?.latest_visit?.confidence_high });
    }
  }, [patient]);

  const factorDesc = (name) => ({
    HbA1c: 'Primary glycaemic control indicator',
    RBS: 'Random blood sugar — acute glucose level',
    BMI: 'Body mass index — obesity marker',
    BP_Systolic: 'Systolic blood pressure',
    TG_HDL_ratio: 'Atherogenic dyslipidaemia marker',
  }[name]);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          Failed to load patient: {error}{' '}
          <button className="underline ml-2" onClick={fetchPatient}>Retry</button>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  const c = riskColorClass(category);
  const lv = patient.latest_visit || {};
  const pt = patient.patient || {};

  const bmi = lv.bmi ?? null;
  const rbs = lv.rbs ?? null;
  const sbp = lv.bp_systolic ?? null;
  const tg = lv.triglycerides ?? null;

  const lineData = [...(patient.visits || [])].reverse().map(v => ({
    date: formatDate(v.visit_date),
    HbA1c: Number(v.hba1c),
    Risk: Number(v.risk_score),
  }));

  const geneticsLabel = (val) => {
    const map = {
      0: 'None', 'None': 'None',
      1: 'Father T2DM', 'Father': 'Father T2DM',
      2: 'Mother T2DM', 'Mother': 'Mother T2DM',
      3: 'Sibling T2DM', 'Sibling': 'Sibling T2DM',
      4: 'Both Parents T2DM',
    };
    if (val === null || val === undefined || val === '' || val === '—') return 'Not recorded';
    return map[val] ?? map[String(val)] ?? String(val);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer mb-3"
          >
            <ChevronLeft className="h-4 w-4" /> Back to dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Patient {pt.patient_id}</h1>
            {category === 'pending'
              ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">Pending</span>
              : <RiskPill category={category} />
            }
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {[
              { label: null, value: `${lv.age ?? '—'} years` },
              { label: null, value: pt.sex ? pt.sex.charAt(0).toUpperCase() + pt.sex.slice(1) : '—' },
              { label: 'Social life', value: pt.social_life ?? '—' },
              { label: 'Genetics', value: geneticsLabel(pt.genetics) },
            ].map((item, i) => (
              <span key={i} className="text-sm text-gray-500">
                {item.label
                  ? <><span className="text-gray-400">{item.label}:</span>{' '}<span className="font-medium text-gray-700">{item.value}</span></>
                  : <span className="font-medium text-gray-700">{item.value}</span>
                }
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBookOpen(true)}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            Book Appointment
          </button>
          <button
            onClick={() => setVisitOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            Add New Visit
          </button>
        </div>
      </div>

      {/* TOP ROW — Risk Score + Contributing Factors */}
      <div className="grid grid-cols-3 gap-6 mb-4">
        {/* Risk Score Panel */}
        <div className={`border rounded-xl p-6 ${riskPanelClass}`}>
          <div className="text-center mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CURRENT RISK SCORE</p>
            <div className="text-6xl font-bold text-gray-900">{category === 'pending' ? '—' : Math.round(Number(lv.risk_score))}</div>
            <p className="text-sm text-gray-600 mt-2">out of 100</p>
          </div>
          {/* Confidence bars */}
          <div className="mt-3">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">Low</span>
              {lv.confidence_low
                ? <span className="font-medium">{Math.round(Number(lv.confidence_low))}%</span>
                : <span className="text-gray-400">Not available</span>
              }
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">Medium</span>
              {lv.confidence_medium
                ? <span className="font-medium">{Math.round(Number(lv.confidence_medium))}%</span>
                : <span className="text-gray-400">Not available</span>
              }
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">High</span>
              {lv.confidence_high
                ? <span className="font-medium">{Math.round(Number(lv.confidence_high))}%</span>
                : <span className="text-gray-400">Not available</span>
              }
            </div>
          </div>
        </div>

        {/* Contributing Factors Panel */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">TOP CONTRIBUTING FACTORS</p>
          {topFactors.length === 0 && (
            <div className="text-sm text-gray-500">No contributing factors provided.</div>
          )}
          <div>
            {topFactors.map((f, idx) => {
              let factorName = typeof f === 'string' ? f : f?.name || f?.label || '';
              let pct;
              if (typeof f === 'string') {
                pct = idx === 0 ? 100 : idx === 1 ? 75 : idx === 2 ? 50 : 25;
              } else {
                pct = Math.round(Number(f?.weight ?? f?.value ?? 0));
              }
              const desc = factorDesc(factorName);
              return (
                <div key={idx} className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">{factorName}</span>
                    <div
                      className="h-1.5 rounded-full bg-blue-500 mt-2"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="text-right">
                    {desc && <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>}
                    <p className="text-xs font-medium text-gray-600 mt-1">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DISCLAIMER — below both panels */}
      <p className="text-xs text-gray-400 mb-6 text-center">
        Risk scores are decision support tools only and do not constitute a clinical diagnosis. Clinician judgement must be applied.
      </p>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-gray-900 mb-4">HbA1c trajectory</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <ReferenceLine y={5.7} stroke="var(--risk-medium)" strokeDasharray="4 4" label={{ value: 'Prediabetes 5.7%', position: 'top', fontSize: 10 }} />
                <ReferenceLine y={6.5} stroke="var(--risk-high)" strokeDasharray="4 4" label={{ value: 'Diabetes 6.5%', position: 'top', fontSize: 10 }} />
                <Line type="monotone" dataKey="HbA1c" stroke="var(--primary)" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-gray-900 mb-4">Risk score trajectory</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 0, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <ReferenceArea y1={0} y2={39} fill="var(--risk-low-soft)" fillOpacity={1} ifOverflow="hidden" />
                <ReferenceArea y1={39} y2={69} fill="var(--risk-medium-soft)" fillOpacity={1} ifOverflow="hidden" />
                <ReferenceArea y1={69} y2={100} fill="var(--risk-high-soft)" fillOpacity={1} ifOverflow="hidden" />
                <Line type="monotone" dataKey="Risk" stroke="var(--primary)" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SPARKLINES ROW */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'BMI', unit: 'kg/m²', value: bmi },
          { label: 'Systolic BP', unit: 'mmHg', value: sbp },
          { label: 'RBS', unit: 'mg/dL', value: rbs },
          { label: 'Triglycerides', unit: 'mg/dL', value: tg },
        ].map((m, i) => {
          const values = m.value != null ? [Number(m.value)] : [];
          return (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 mb-1">{m.label}</span>
                <span className="text-xs text-gray-400">{m.unit}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{m.value ?? '—'}</div>
              <div className="text-gray-400">
                <TrendArrow from={m.value} to={m.value} />
              </div>
              {values.length <= 1 ? (
                <svg viewBox="0 0 100 30" className="w-full h-8 mt-2">
                  <line x1="0" y1="15" x2="100" y2="15" stroke="#93c5fd" strokeWidth="2" strokeDasharray="4 2" />
                </svg>
              ) : (
                <div className="mt-2">
                  <Sparkline values={values} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VISIT HISTORY */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit history</h2>
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="w-8 pb-2"></th>
                {['Date', 'HbA1c', 'BMI', 'BP', 'RBS', 'Score', 'Risk'].map((h) => (
                  <th key={h} className="text-xs font-bold text-gray-500 uppercase tracking-wider pb-2 text-left px-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(patient.visits || []).map((v, idx) => {
                const vrc = (v.risk_category ?? '').toLowerCase();
                const visitCategory = vrc === 'high' || vrc === 'medium' || vrc === 'low' ? vrc : 'pending';
                const rowId = v.visit_id ?? idx;
                return (
                  <React.Fragment key={rowId}>
                    <tr className="border-b border-gray-100">
                      <td className="px-2 py-3">
                        <ChevronRight
                          size={14}
                          className={`text-gray-400 cursor-pointer transition-transform ${expandedVisits.has(rowId) ? 'rotate-90' : ''}`}
                          onClick={() => toggleVisit(rowId)}
                        />
                      </td>
                      <td className="px-2 py-3 text-sm">{formatDate(v.visit_date)}</td>
                      <td className="px-2 py-3 text-sm">{v.hba1c ?? '—'}</td>
                      <td className="px-2 py-3 text-sm">{v.bmi ?? '—'}</td>
                      <td className="px-2 py-3 text-sm">{v.bp_systolic ? `${v.bp_systolic}` : '—'}</td>
                      <td className="px-2 py-3 text-sm">{v.rbs ?? '—'}</td>
                      <td className="px-2 py-3 text-sm">{visitCategory === 'pending' ? '—' : Math.round(Number(v.risk_score))}</td>
                      <td className="px-2 py-3 text-sm">
                        {visitCategory === 'pending'
                          ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">Pending</span>
                          : <RiskPill category={visitCategory} />
                        }
                      </td>
                    </tr>
                    {expandedVisits.has(rowId) && (
                      <tr>
                        <td colSpan={8}>
                          <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-b-lg text-xs text-gray-600">
                            {Object.entries(v)
                              .filter(([k]) => !['visit_id', 'patient_id', 'created_at', 'updated_at', 'risk_score', 'risk_category'].includes(k))
                              .map(([k, val]) => (
                                <div key={k}>
                                  <div className="text-gray-400 uppercase text-xs">{k}</div>
                                  <div className="font-medium text-gray-800">{String(val)}</div>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPOINTMENTS SECTION */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Appointments</h2>
          <button
            onClick={() => setBookOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            Book new appointment
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['DATE', 'TYPE', 'STATUS', 'NOTES'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-sm text-gray-400 py-8">
                  No appointments booked yet
                </td>
              </tr>
            ) : appointments.map((a, idx) => {
              const statusClass = a.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : a.status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700';
              return (
                <tr key={a.appointment_id ?? idx} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm">{formatDate(a.scheduled_date)}</td>
                  <td className="px-4 py-3 text-sm">
                    {a.appointment_type ? a.appointment_type.charAt(0).toUpperCase() + a.appointment_type.slice(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                      {a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.notes ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BookAppointmentModal
        isOpen={bookOpen}
        onClose={() => setBookOpen(false)}
        patientId={pt.patient_id}
        onBooked={fetchAppointments}
      />
      <AddVisitModal
        isOpen={visitOpen}
        onClose={() => setVisitOpen(false)}
        patientId={pt.patient_id}
        latestVisit={patient.latest_visit}
        onVisitAdded={fetchPatient}
      />
    </div>
  );
}
