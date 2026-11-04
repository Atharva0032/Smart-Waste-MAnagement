import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ComplaintCard from '../../components/ComplaintCard';
import ComplaintMap from '../../components/ComplaintMap';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getMyComplaints } from '../../services/complaintService';
import { getErrorMessage } from '../../services/api';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';

export default function UserDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyComplaints();
      const list = Array.isArray(data) ? data : Array.isArray(data?.complaints) ? data.complaints : [];
      setComplaints(list);
    } catch (err) {
      setError(getErrorMessage(err));
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const counts = useMemo(() => {
    const list = Array.isArray(complaints) ? complaints : [];
    return {
      total: list.length,
      pending: list.filter((c) => c?.status === 'pending').length,
      inProgress: list.filter((c) => c?.status === 'in_progress').length,
      resolved: list.filter((c) => c?.status === 'resolved').length,
    };
  }, [complaints]);

  const recent = useMemo(() => {
    const list = Array.isArray(complaints) ? [...complaints] : [];
    list.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    return list.slice(0, 3);
  }, [complaints]);

  const located = useMemo(
    () => (Array.isArray(complaints) ? complaints.filter((c) => c?.location?.latitude && c?.location?.longitude) : []),
    [complaints]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Citizen Dashboard"
          subtitle={`Welcome back${user?.name ? `, ${user.name}` : ''}. Track your waste reports and their resolution status.`}
          actions={(
            <Link to="/complaints/new" className={BTN_PRIMARY}>
              <AddCircleIcon fontSize="small" />
              Report Waste
            </Link>
          )}
        />

        {error ? (
          <div className={ERROR_ALERT}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className={BTN_SECONDARY} onClick={loadComplaints}>Retry</button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Reports" value={counts.total} icon={<AssessmentIcon />} accent="teal" loading={loading} />
          <StatCard title="Pending" value={counts.pending} icon={<HourglassEmptyIcon />} accent="amber" loading={loading} />
          <StatCard title="In Progress" value={counts.inProgress} icon={<AutorenewIcon />} accent="sky" loading={loading} />
          <StatCard title="Resolved" value={counts.resolved} icon={<CheckCircleIcon />} accent="emerald" loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Reports</h2>
              <Link to="/complaints" className="text-sm font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">View all</Link>
            </div>
            {loading ? (
              <Loader label="Loading your reports..." />
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<ListAltIcon fontSize="large" />}
                title="No reports yet"
                message="You have not submitted any waste reports. Report waste to help keep your city clean."
                action={(
                  <Link to="/complaints/new" className={BTN_PRIMARY}>
                    <AddCircleIcon fontSize="small" />
                    Report Waste
                  </Link>
                )}
              />
            ) : (
              <div className="space-y-4">
                {recent.map((complaint) => (
                  <ComplaintCard
                    key={complaint?._id || complaint?.trackingId}
                    complaint={complaint}
                    to={`/complaints/${complaint?._id}`}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your Reports Map</h2>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{located.length} located</span>
            </div>
            {loading ? (
              <div className="flex h-80 items-center justify-center">
                <Loader label="Loading map..." />
              </div>
            ) : (
              <ComplaintMap complaints={located} height={320} zoom={12} />
            )}
          </section>
        </div>

        <section className={`${CARD} p-5`}>
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link to="/complaints/new" className={BTN_PRIMARY}>
              <AddCircleIcon fontSize="small" />
              Report Waste
            </Link>
            <Link to="/complaints" className={BTN_SECONDARY}>
              <ListAltIcon fontSize="small" />
              My Complaints
            </Link>
            <Link to="/track" className={BTN_SECONDARY}>
              <TravelExploreIcon fontSize="small" />
              Public Tracker
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
