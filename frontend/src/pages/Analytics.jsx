import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import useAnalytics from '../utils/useAnalytics.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

const SCORE_BANDS = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'];

const formatMonth = (yearMonth) => {
  const [year, month] = yearMonth.split('-');
  return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

// Chart options defined outside the component — static config, no need to recreate on re-render
const migrationOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { color: '#1e293b', boxWidth: 12 } },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10,
      callbacks: {
        label: (ctx) =>
            ` ${ctx.dataset.label}: ${ctx.parsed.y} visit${ctx.parsed.y !== 1 ? 's' : ''}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#1e293b' },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Month', color: '#1e293b', font: { size: 12 } },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      min: 0,
      ticks: { color: '#1e293b', precision: 0 },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Number of visits', color: '#1e293b', font: { size: 12 } },
    },
  },
};

const histogramOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10,
      callbacks: {
        // Shows patient count per score band on hover
        label: (ctx) =>
            ` ${ctx.parsed.y} patient${ctx.parsed.y !== 1 ? 's' : ''}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#1e293b' },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Risk Score Band', color: '#1e293b', font: { size: 12 } },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#1e293b', precision: 0 },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Number of Patients', color: '#1e293b', font: { size: 12 } },
    },
  },
};

const hba1cOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { color: '#1e293b', boxWidth: 12 } },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#1e293b' },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Month', color: '#1e293b', font: { size: 12 } },
    },
    y: {
      min: 4,
      max: 10,
      ticks: { color: '#1e293b', precision: 1 },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Average HbA1c (%)', color: '#1e293b', font: { size: 12 } },
    },
  },
};

const buildMigrationChartData = (rows) => ({
  labels: rows.map((r) => formatMonth(r.month)),
  datasets: [
    {
      label: 'Low',
      data: rows.map((r) => r.low),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16,185,129,0.2)',
      fill: true,
      tension: 0.3,
      stack: 'migration',
    },
    {
      label: 'Medium',
      data: rows.map((r) => r.medium),
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.2)',
      fill: true,
      tension: 0.3,
      stack: 'migration',
    },
    {
      label: 'High',
      data: rows.map((r) => r.high),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239,68,68,0.2)',
      fill: true,
      tension: 0.3,
      stack: 'migration',
    },
  ],
});

// Builds histogram data with colour-coded bars matching the system's risk colours
const buildHistogramData = (rows) => {
  // Colours each bar based on which risk tier its score band falls in
  const barColor = (band) => {
    const lower = parseInt(band.split('-')[0], 10);
    if (lower >= 70) return '#EF4444'; // red   — high risk band
    if (lower >= 40) return '#F59E0B'; // amber — medium risk band
    return '#10B981';                   // green — low risk band
  };

  const counts = SCORE_BANDS.map((band) => {
    const row = rows.find((r) => r.score_band === band);
    return row ? row.count : 0;
  });

  return {
    labels: SCORE_BANDS,
    datasets: [
      {
        label: 'Number of Patients',
        data: counts,
        backgroundColor: SCORE_BANDS.map(barColor),
        borderRadius: 4,
        // Full-width bars so they touch — gives a true histogram appearance
        categoryPercentage: 1.0,
        barPercentage: 1.0,
      },
    ],
  };
};

const buildHba1cChartData = (rows) => ({
  labels: rows.map((r) => formatMonth(r.month)),
  datasets: [
    {
      label: 'Low patients',
      data: rows.map((r) => r.avgLow),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16,185,129,0.1)',
      pointBackgroundColor: '#10B981',
      pointRadius: 4,
      tension: 0.3,
      spanGaps: true,
      fill: false,
    },
    {
      label: 'Medium patients',
      data: rows.map((r) => r.avgMedium),
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.1)',
      pointBackgroundColor: '#F59E0B',
      pointRadius: 4,
      tension: 0.3,
      spanGaps: true,
      fill: false,
    },
    {
      label: 'High patients',
      data: rows.map((r) => r.avgHigh),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      pointBackgroundColor: '#EF4444',
      pointRadius: 4,
      tension: 0.3,
      spanGaps: true,
      fill: false,
    },
    {
      label: 'Prediabetes threshold (5.7%)',
      data: rows.map(() => 5.7),
      borderColor: '#F59E0B',
      borderDash: [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    },
    {
      label: 'Diabetes threshold (6.5%)',
      data: rows.map(() => 6.5),
      borderColor: '#EF4444',
      borderDash: [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    },
  ],
});

const midpointForBand = (band) => {
  const [lower, upper] = band.split('-').map(Number);
  return (lower + upper) / 2;
};

const buildSummaryStats = (data) => {
  const riskScoreRows = data?.riskScoreDistribution || [];
  const migrationRows = data?.riskCategoryMigration || [];

  const riskScoreTotals = riskScoreRows.reduce(
      (acc, row) => {
        const count = Number(row.count || 0);
        return {
          scoreTotal: acc.scoreTotal + midpointForBand(row.score_band) * count,
          countTotal: acc.countTotal + count,
        };
      },
      { scoreTotal: 0, countTotal: 0 }
  );

  const visitTotals = migrationRows.reduce(
      (acc, row) => ({
        highRiskVisits: acc.highRiskVisits + Number(row.high || 0),
        totalVisits:
            acc.totalVisits +
            Number(row.low || 0) +
            Number(row.medium || 0) +
            Number(row.high || 0),
      }),
      { highRiskVisits: 0, totalVisits: 0 }
  );

  return {
    avgRiskScore: riskScoreTotals.countTotal
        ? (riskScoreTotals.scoreTotal / riskScoreTotals.countTotal).toFixed(1)
        : '—',
    highRiskVisits: visitTotals.highRiskVisits,
    totalVisits: visitTotals.totalVisits,
  };
};

const Analytics = () => {
  const { data, loading, error } = useAnalytics();

  // useMemo must sit above all early returns — React requires the same number
  // of hooks on every render. Optional chaining (data?.) handles null safely
  // while the fetch is still in progress, falling back to [] so builders don't crash.
  const migrationChartData = useMemo(() =>
      buildMigrationChartData(data?.riskCategoryMigration || []),
  [data?.riskCategoryMigration]);

  const hba1cChartData = useMemo(() =>
      buildHba1cChartData(data?.hba1cByRiskGroup || []),
  [data?.hba1cByRiskGroup]);

  const histogramChartData = useMemo(() =>
      buildHistogramData(data?.riskScoreDistribution || []),
  [data?.riskScoreDistribution]);

  const summaryStats = useMemo(() => buildSummaryStats(data), [data]);

  // Guard clauses after all hooks
  if (loading) {
    return (
        <div className="p-8 bg-gray-50 min-h-screen">
          <p className="text-gray-400">Loading analytics…</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 bg-gray-50 min-h-screen">
          <p className="text-red-600">Error: {error}</p>
        </div>
    );
  }

  if (!data || !data.riskCategoryMigration || !data.riskScoreDistribution) {
    return (
        <div className="p-8 bg-gray-50 min-h-screen"></div>
    );
  }

  return (
      <div className="p-8 bg-gray-50 min-h-screen">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Cohort-level trends across your patient list.</p>
        </div>

        {/* Summary stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Average risk score</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.avgRiskScore}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              High risk visits
              <span className="relative group cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 normal-case font-normal tracking-normal leading-snug">
                  Counts all high-risk visits in the last 12 months. A patient with multiple high-risk visits is counted each time.
                </span>
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.highRiskVisits}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total visits</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.totalVisits}</div>
          </div>
        </div>

        {/* Charts grid */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk category migration</h2>
            <p className="text-xs text-gray-400 mb-4">Visits per risk category per month — last 12 months</p>
            <div style={{ height: '300px' }}>
              <Line data={migrationChartData} options={migrationOptions} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Average HbA1c by risk group</h2>
            <p className="text-xs text-gray-400 mb-4">Monthly average HbA1c for each risk category</p>
            <div style={{ height: '300px' }}>
              <Line data={hba1cChartData} options={hba1cOptions} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk score distribution</h2>
            <p className="text-xs text-gray-400 mb-4">Number of patients per 10-point score band (latest visit only)</p>
            <div style={{ height: '300px' }}>
              <Bar data={histogramChartData} options={histogramOptions} />
            </div>
          </div>
        </div>
      </div>
  );
};

export default Analytics;
