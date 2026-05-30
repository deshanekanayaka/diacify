import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskPill, Sparkline, TrendArrow } from '@/components/risk-ui';
import { riskColorClass } from '@/lib/risk';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import BookAppointmentModal from '../components/BookAppointmentModal';
import AddVisitModal from '../components/AddVisitModal';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Line, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL;

function Gauge({ value = 0, category }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  // Semicircle gauge using SVG arc
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const start = { x: cx - r, y: cy };
  const end = { x: cx + r, y: cy };
  const largeArc = 0; // 180deg
  const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  const angle = Math.PI * (clamped / 100);
  const x = cx - r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const fgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${clamped > 50 ? 1 : 0} 1 ${x} ${y}`;
  const c = riskColorClass(category);
  return (
    <svg width={size} height={size / 2} viewBox={`0 0 ${size} ${size/2}`} className="block">
      <path d={bgPath} fill="none" stroke="var(--muted)" strokeWidth={stroke} strokeLinecap="round" />
      <path d={fgPath} fill="none" strokeWidth={stroke} strokeLinecap="round" className={c.bg} />
      {/* needle dot */}
      <circle cx={x} cy={y} r={4} className={c.bg} />
    </svg>
  );
}

function RowExpander({ label = 'Details', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md">
      <button className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted" onClick={() => setOpen(!open)}>
        <span className="inline-flex items-center gap-2"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /> {label}</span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="p-3 text-sm">{children}</div>}
    </div>
  );
}

export default function PatientDetailPage({ clerkId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${BASE_URL}/api/patients/${id}`, {
        params: { clerk_id: clerkId },
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to fetch');
      setPatient(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, clerkId]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const category = useMemo(() => {
    const rc = (patient?.risk_category || '').toLowerCase();
    return rc === 'high' || rc === 'medium' || rc === 'low' ? rc : 'low';
  }, [patient]);

  const tintBg = category === 'high' ? 'bg-[color:var(--risk-high-soft)]' : category === 'medium' ? 'bg-[color:var(--risk-medium-soft)]' : 'bg-[color:var(--risk-low-soft)]';

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const topFactors = Array.isArray(patient?.top_factors) ? patient.top_factors : [];
  
  // Debug: log the patient object to see the full structure
  useEffect(() => {
    if (patient) {
      console.log('Patient object:', patient);
      console.log('Top factors:', patient?.top_factors);
      console.log('Confidence values:', { low: patient?.confidence_low, medium: patient?.confidence_medium, high: patient?.confidence_high });
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
      <div className="space-y-4">
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
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Failed to load patient: {error} <button className="underline ml-2" onClick={fetchPatient}>Retry</button>
      </div>
    );
  }

  if (!patient) return null;

  const c = riskColorClass(category);
  const hba1c = patient.HbA1c ?? patient.hba1c ?? null;
  const bmi = patient.BMI ?? patient.bmi ?? null;
  const rbs = patient.RBS ?? patient.rbs ?? null;
  const sbp = patient.BP_Systolic ?? patient.bp_systolic ?? null;
  const tg = patient.Triglycerides ?? patient.triglycerides ?? null;

  const visitDate = patient.created_at || patient.last_visit || patient.last_visit_date || null;
  const lineData = [{ date: visitDate ? formatDate(visitDate) : '—', HbA1c: Number(hba1c ?? 0), Risk: Number(patient.risk_score ?? 0) }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline">
            <ChevronLeft className="h-4 w-4" /> Back to dashboard
          </button>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Patient p{patient.patient_id}</h1>
            <RiskPill category={category} />
          </div>
          <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
            <span>Age: <strong className="text-foreground font-medium">{patient.age ?? '—'}</strong></span>
            <span>Sex: <strong className="text-foreground font-medium capitalize">{patient.sex ?? '—'}</strong></span>
            <span>Social life: <strong className="text-foreground font-medium">{patient.social_life ?? '—'}</strong></span>
            <span>Genetics: <strong className="text-foreground font-medium">{patient.genetics ?? '—'}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBookOpen(true)}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book Appointment
          </button>
          <button
            onClick={() => setVisitOpen(true)}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Add New Visit
          </button>
        </div>
      </div>

      {/* Score + Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`${tintBg}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm ${riskColorClass(category).text}`}>Risk score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-semibold tabular-nums mb-2">{Math.round(Number(patient.risk_score ?? 0))}</div>
            <Gauge value={Number(patient.risk_score ?? 0)} category={category} />
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Low confidence</span>
                <strong>{patient.confidence_low ? Math.round(Number(patient.confidence_low)) + '%' : 'Not available'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Medium confidence</span>
                <strong>{patient.confidence_medium ? Math.round(Number(patient.confidence_medium)) + '%' : 'Not available'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>High confidence</span>
                <strong>{patient.confidence_high ? Math.round(Number(patient.confidence_high)) + '%' : 'Not available'}</strong>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Risk scores are decision support tools only and do not constitute a clinical diagnosis. Clinician judgement must be applied.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">TOP CONTRIBUTING FACTORS</CardTitle>
          </CardHeader>
          <CardContent>
            {topFactors.length === 0 && (
              <div className="text-sm text-muted-foreground">No contributing factors provided.</div>
            )}
            <div className="space-y-3">
              {topFactors.map((f, idx) => {
                // Handle both string factors (factor names) and object factors (with weight/value)
                let factorName = typeof f === 'string' ? f : f?.name || f?.label || '';
                // If it's a string, use proportional widths: 1st=100%, 2nd=75%, 3rd=50%
                let pct;
                if (typeof f === 'string') {
                  pct = idx === 0 ? 100 : idx === 1 ? 75 : idx === 2 ? 50 : 25;
                } else {
                  pct = Math.round(Number(f?.weight ?? f?.value ?? 0));
                }
                const desc = factorDesc(factorName);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{factorName}</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${riskColorClass(category).bg}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                    {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">HbA1c trajectory</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk score trajectory</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 0, right: 16, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {/* Background bands */}
                  <ReferenceArea y1={0} y2={39} fill="var(--risk-low-soft)" fillOpacity={1} ifOverflow="hidden" />
                  <ReferenceArea y1={39} y2={69} fill="var(--risk-medium-soft)" fillOpacity={1} ifOverflow="hidden" />
                  <ReferenceArea y1={69} y2={100} fill="var(--risk-high-soft)" fillOpacity={1} ifOverflow="hidden" />
                  <Line type="monotone" dataKey="Risk" stroke="var(--primary)" dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[{label:'BMI', unit:'kg/m²', value:bmi}, {label:'Systolic BP', unit:'mmHg', value:sbp}, {label:'RBS', unit:'mg/dL', value:rbs}, {label:'Triglycerides', unit:'mg/dL', value:tg}].map((m, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{m.label} <span className="text-muted-foreground">({m.unit})</span></CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-semibold tabular-nums">{m.value ?? '—'}</div>
                <TrendArrow from={m.value} to={m.value} />
              </div>
              <div className="mt-2"><Sparkline values={m.value != null ? [Number(m.value)] : []} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visit history */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Visit history</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">HbA1c</th>
                  <th className="px-2 py-2 text-left">BMI</th>
                  <th className="px-2 py-2 text-left">BP</th>
                  <th className="px-2 py-2 text-left">RBS</th>
                  <th className="px-2 py-2 text-left">Score</th>
                  <th className="px-2 py-2 text-left">Risk</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50">
                  <td className="px-2 py-2">{formatDate(visitDate)}</td>
                  <td className="px-2 py-2">{hba1c ?? '—'}</td>
                  <td className="px-2 py-2">{bmi ?? '—'}</td>
                  <td className="px-2 py-2">{sbp ? `${sbp}` : '—'}</td>
                  <td className="px-2 py-2">{rbs ?? '—'}</td>
                  <td className="px-2 py-2">{Math.round(Number(patient.risk_score ?? 0))}</td>
                  <td className="px-2 py-2"><RiskPill category={category} /></td>
                </tr>
                <tr>
                  <td className="px-2 py-2" colSpan={7}>
                    <RowExpander label="Show all clinical values">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(patient).filter(([k]) => !['id','patient_id','created_at','updated_at','risk_score','risk_category'].includes(k)).map(([k,v]) => (
                          <div key={k} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                            <span className="text-xs text-muted-foreground">{k}</span>
                            <span className="text-sm font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </RowExpander>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Appointments section */}
      <Card>
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="text-sm">Appointments</CardTitle>
          <button
            onClick={() => setBookOpen(true)}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book new appointment
          </button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No appointments booked yet</div>
        </CardContent>
      </Card>

      <BookAppointmentModal
        isOpen={bookOpen}
        onClose={() => setBookOpen(false)}
        patientId={patient.patient_id}
      />
      <AddVisitModal
        isOpen={visitOpen}
        onClose={() => setVisitOpen(false)}
        patientId={patient.patient_id}
      />
    </div>
  );
}
