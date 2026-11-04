import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { getWasteTypeMeta } from '../utils/constants';
import { useTheme } from '../context/ThemeContext';

const ChartCard = ({ title, subtitle, className = '', children }) => (
  <div
    className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
  >
    <div className="mb-4">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      ) : null}
    </div>
    <div className="h-72 w-full">{children}</div>
  </div>
);

const ChartFallback = ({ message }) => (
  <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
    {message}
  </div>
);

const DashboardCharts = ({ stats, loading = false }) => {
  const { isDark } = useTheme();

  const byWasteType = Array.isArray(stats?.byWasteType) ? stats.byWasteType : [];
  const byArea = Array.isArray(stats?.byArea) ? stats.byArea : [];
  const weeklyTrend = Array.isArray(stats?.weeklyTrend) ? stats.weeklyTrend : [];

  const wasteData = byWasteType.map((item) => {
    const meta = getWasteTypeMeta(item?._id);
    return { name: meta.label, count: Number(item?.count) || 0, color: meta.color };
  });

  // Keep the busiest six areas for a readable bar chart.
  const areaData = [...byArea]
    .sort((a, b) => (Number(b?.count) || 0) - (Number(a?.count) || 0))
    .slice(0, 6)
    .map((item) => ({ name: item?._id || 'Unknown', count: Number(item?.count) || 0 }));

  const trendData = weeklyTrend.map((item) => ({
    name: item?._id || '',
    count: Number(item?.count) || 0,
    resolved: Number(item?.resolved) || 0,
  }));

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const legendStyle = { fontSize: '0.75rem', color: axisColor };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
              key === 2 ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Complaints by Waste Type">
        {wasteData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={wasteData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {wasteData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartFallback message="No waste type data available yet." />
        )}
      </ChartCard>

      <ChartCard title="Top Areas" subtitle="Areas with the most reported complaints">
        {areaData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={areaData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: axisColor }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }} />
              <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartFallback message="No area data available yet." />
        )}
      </ChartCard>

      <ChartCard
        title="Weekly Trend"
        subtitle="Reported vs resolved complaints over the last weeks"
        className="lg:col-span-2"
      >
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="trendReported" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Area
                type="monotone"
                dataKey="count"
                name="Reported"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#trendReported)"
              />
              <Area
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#trendResolved)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartFallback message="No trend data available yet." />
        )}
      </ChartCard>
    </div>
  );
};

export default DashboardCharts;
