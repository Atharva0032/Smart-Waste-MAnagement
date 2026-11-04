import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EngineeringIcon from '@mui/icons-material/Engineering';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import DashboardCharts from '../../components/DashboardCharts';
import ComplaintTable from '../../components/ComplaintTable';
import ComplaintMap from '../../components/ComplaintMap';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import { getStats, getWorkers, getUsers } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import { formatHours, formatNumber } from '../../utils/format';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const MUTED = 'text-slate-500 dark:text-slate-400';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, workersRes, usersRes] = await Promise.all([
        getStats(),
        getWorkers(),
        getUsers(),
      ]);
      setStats(statsRes?.stats || null);
      const workerList = Array.isArray(workersRes?.workers) ? workersRes.workers : [];
      setWorkers(workerList);
      const userList = Array.isArray(usersRes?.users) ? usersRes.users : [];
      setUsers(userList);
    } catch (err) {
      setError(getErrorMessage(err));
      setStats(null);
      setWorkers([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = stats?.totals || {};
  const recentComplaints = Array.isArray(stats?.recentComplaints) ? stats.recentComplaints : [];
  const activeWorkers = useMemo(
    () => (Array.isArray(workers) ? workers.filter((w) => w?.isActive !== false).length : 0),
    [workers]
  );
  const citizens = useMemo(
    () => (Array.isArray(users) ? users.filter((u) => u?.role === 'user').length : 0),
    [users]
  );
  const resolutionRate = Number(stats?.resolutionRate) || 0;
  const locatedComplaints = useMemo(
    () => recentComplaints.filter((c) => c?.location?.latitude && c?.location?.longitude),
    [recentComplaints]
  );

  if (error && !stats) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <PageHeader title="Municipal Control Center" subtitle="Live overview of city-wide waste operations." />
          <div className={ERROR_ALERT}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className={BTN_SECONDARY} onClick={loadData}>Retry</button>
            </div>
          </div>
          <EmptyState
            icon={<AssessmentIcon fontSize="large" />}
            title="Unable to load dashboard"
            message="We could not retrieve the dashboard statistics. Please try again."
            action={<button type="button" className={BTN_PRIMARY} onClick={loadData}>Retry</button>}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Municipal Control Center"
          subtitle="Live overview of city-wide waste operations and field performance."
          actions={(
            <>
              <Link to="/admin/complaints" className={BTN_SECONDARY}>
                <ListAltIcon fontSize="small" />
                All Complaints
              </Link>
              <Link to="/admin/workers" className={BTN_PRIMARY}>
                <EngineeringIcon fontSize="small" />
                Manage Workers
              </Link>
            </>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard title="Total" value={totals.total} icon={<AssessmentIcon />} accent="teal" loading={loading} />
          <StatCard title="Pending" value={totals.pending} icon={<HourglassEmptyIcon />} accent="amber" loading={loading} />
          <StatCard title="Assigned" value={totals.assigned} icon={<AssignmentIndIcon />} accent="sky" loading={loading} />
          <StatCard title="In Progress" value={totals.inProgress} icon={<AutorenewIcon />} accent="violet" loading={loading} />
          <StatCard title="Resolved" value={totals.resolved} icon={<CheckCircleIcon />} accent="emerald" loading={loading} />
          <StatCard title="Rejected" value={totals.rejected} icon={<CancelIcon />} accent="rose" loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                <AccessTimeIcon fontSize="small" />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg. Resolution Time</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : formatHours(stats?.averageResolutionHours)}
            </p>
          </div>

          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <TrendingUpIcon fontSize="small" />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Resolution Rate</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : `${resolutionRate.toFixed(1)}%`}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, resolutionRate))}%` }}
              />
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
                <EngineeringIcon fontSize="small" />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Active Workers</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : formatNumber(activeWorkers)}
            </p>
          </div>

          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <PeopleAltIcon fontSize="small" />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Registered Citizens</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : formatNumber(citizens)}
            </p>
          </div>
        </div>

        <DashboardCharts stats={stats} loading={loading} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Complaints</h2>
              <Link to="/admin/complaints" className="text-sm font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
                View all
              </Link>
            </div>
            <ComplaintTable
              complaints={recentComplaints.slice(0, 5)}
              loading={loading}
              showCitizen
              emptyMessage="No recent complaints to show."
              onRowClick={(complaint) => navigate(`/complaints/${complaint?._id}`)}
            />
          </section>

          <section className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Complaint Map</h2>
              <span className={`text-xs font-medium ${MUTED}`}>{locatedComplaints.length} located</span>
            </div>
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader label="Loading map..." />
              </div>
            ) : (
              <ComplaintMap complaints={locatedComplaints} height={380} zoom={12} showPopupLink />
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
