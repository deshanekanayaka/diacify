import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import useAnalytics from '../utils/useAnalytics.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// X-axis labels for age groups and risk score bands
const AGE_LABELS  = ['20-29', '30-39', '40-49', '50-59', '60-69', '70+'];
const SCORE_BANDS = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'];

// Chart options defined outside the component — static config, no need to recreate on re-render
const ageOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#1e293b', boxWidth: 12 } },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10,
      callbacks: {
        // Appends patient count with correct pluralisation
        label: (ctx) =>
            ` ${ctx.dataset.label}: ${ctx.parsed.y} patient${ctx.parsed.y !== 1 ? 's' : ''}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#1e293b' },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Age Group', color: '#1e293b', font: { size: 12 } },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#1e293b', precision: 0 },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Number of Patients', color: '#1e293b', font: { size: 12 } },
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

const trendOptions = {
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
        label: (ctx) => ` Avg Risk Score: ${ctx.parsed.y}`,
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
      beginAtZero: false,
      min: 0,
      max: 100,
      ticks: { color: '#1e293b', precision: 1 },
      grid: { color: 'rgba(148,163,184,0.1)' },
      title: { display: true, text: 'Average Risk Score', color: '#1e293b', font: { size: 12 } },
    },
  },
};

// Builds grouped bar chart data split by high/medium/low risk per age group
const buildAgeChartData = (rows) => {
  // Finds the patient count for a specific risk level and age group combination
  const countFor = (riskLevel, ageGroup) => {
    const row = rows.find(
        (r) => r.age_group === ageGroup && r.risk_category === riskLevel
    );
    return row ? row.count : 0;
  };

  return {
    labels: AGE_LABELS,
    datasets: [
      {
        label: 'High Risk',
        data: AGE_LABELS.map((g) => countFor('high', g)),
        backgroundColor: '#EF4444',
        borderRadius: 4,
      },
      {
        label: 'Medium Risk',
        data: AGE_LABELS.map((g) => countFor('medium', g)),
        backgroundColor: '#F59E0B',
        borderRadius: 4,
      },
      {
        label: 'Low Risk',
        data: AGE_LABELS.map((g) => countFor('low', g)),
        backgroundColor: '#10B981',
        borderRadius: 4,
      },
    ],
  };
};

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

// Builds line chart data from monthly average risk scores.
// Each point represents one month's average across all the clinician's patients.
const buildTrendChartData = (rows) => ({
  labels: rows.map((r) => r.month),
  datasets: [
    {
      label: 'Avg Risk Score',
      data: rows.map((r) => r.avg_risk_score),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      pointBackgroundColor: '#3B82F6',
      pointRadius: 5,
      tension: 0.3, // slight curve instead of sharp angles
      fill: true,   // shades the area under the line
    },
  ],
});

const Analytics = () => {
  const { data, loading, error } = useAnalytics();

  // useMemo must sit above all early returns — React requires the same number
  // of hooks on every render. Optional chaining (data?.) handles null safely
  // while the fetch is still in progress, falling back to [] so builders don't crash.
  const ageChartData       = useMemo(() => buildAgeChartData(data?.ageDistribution       || []), [data?.ageDistribution]);
  const histogramChartData = useMemo(() => buildHistogramData(data?.riskScoreDistribution || []), [data?.riskScoreDistribution]);
  const trendChartData     = useMemo(() => buildTrendChartData(data?.riskTrend            || []), [data?.riskTrend]);

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

  if (!data || !data.ageDistribution || !data.riskScoreDistribution) {
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Average risk score</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{data?.summaryStats?.avgRiskScore || '—'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">High risk %</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{data?.summaryStats?.highRiskPercent || '—'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deteriorating %</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{data?.summaryStats?.deterioratingPercent || '—'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total visits</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{data?.summaryStats?.totalVisits || '—'}</div>
          </div>
        </div>

        {/* Charts grid */}
        <div className="space-y-6">
          {/* Row 1: Full-width chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk category migration over time</h2>
            <p className="text-xs text-gray-400 mb-4">Tracking how patients move between risk categories</p>
            <div style={{ height: '300px' }}>
              <Line data={trendChartData} options={trendOptions} />
            </div>
          </div>

          {/* Row 2: Two half-width charts side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Average HbA1c by risk group</h2>
              <p className="text-xs text-gray-400 mb-4">HbA1c levels across patient risk categories</p>
              <div style={{ height: '300px' }}>
                <Bar data={ageChartData} options={ageOptions} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk score distribution</h2>
              <p className="text-xs text-gray-400 mb-4">Number of patients per 10-point risk score band</p>
              <div style={{ height: '300px' }}>
                <Bar data={histogramChartData} options={histogramOptions} />
              </div>
            </div>
          </div>

          {/* Row 3: Full-width chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Age distribution by risk</h2>
            <p className="text-xs text-gray-400 mb-4">Patient age breakdown by risk category</p>
            <div style={{ height: '300px' }}>
              <Bar data={ageChartData} options={ageOptions} />
            </div>
          </div>
        </div>
      </div>
  );
};

export default Analytics;