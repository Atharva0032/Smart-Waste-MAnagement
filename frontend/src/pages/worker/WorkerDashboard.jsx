import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ComplaintCard from '../../components/ComplaintCard';
import ComplaintMap from '../../components/ComplaintMap';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/AuthContext';
import { getAssigned, updateStatus } from '../../services/workerService';
import { getErrorMessage } from '../../services/api';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_SMALL = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';

export default function WorkerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ assigned: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState({ type: '', message: '' });
  const [updatingId, setUpdatingId] = useState(null);

  const loadAssigned = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAssigned();
      const list = Array.isArray(data) ? data : Array.isArray(data?.complaints) ? data.complaints : [];
      setComplaints(list);
      setStats({
        assigned: Number(data?.stats?.assigned) || 0,
        inProgress: Number(data?.stats?.inProgress) || 0,
        resolved: Number(data?.stats?.resolved) || 0,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const todaysTasks = useMemo(
    () => (Array.isArray(complaints) ? complaints.filter((c) => c?.status === 'assigned' || c?.status === 'in_progress') : []),
    [complaints]
  );

  const located = useMemo(
    () => (Array.isArray(complaints) ? complaints.filter((c) => c?.location?.latitude && c?.location?.longitude) : []),
    [complaints]
  );

  const handleStart = async (complaint) => {
    if (!complaint?._id) return;
    setUpdatingId(complaint._id);
    setFlash({ type: '', message: '' });
    try {
      await updateStatus(complaint._id, 'in_progress', '');
      setFlash({ type: 'success', message: `Complaint ${complaint.trackingId || ''} moved to In Progress.` });
      await loadAssigned();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Worker Dashboard"
          subtitle={`Welcome${user?.name ? `, ${user.name}` : ''}. Here are the tasks assigned to you today.`}
          actions={(
            <Link to="/worker/complaints" className={BTN_PRIMARY}>
              <ListAltIcon fontSize="small" />
              My Assignments
            </Link>
          )}
        />

        {flash.message ? (
          <div className={flash.type === 'error' ? ERROR_ALERT : SUCCESS_ALERT}>{flash.message}</div>
        ) : null}

        {error ? (
          <div className={ERROR_ALERT}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className={BTN_SECONDARY} onClick={loadAssigned}>Retry</button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Assigned" value={stats.assigned} icon={<AssignmentTurnedInIcon />} accent="amber" loading={loading} />
          <StatCard title="In Progress" value={stats.inProgress} icon={<AutorenewIcon />} accent="sky" loading={loading} />
          <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircleIcon />} accent="emerald" loading={loading} />
        </div>

        <section className={`${CARD} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <TaskAltIcon className="text-teal-600 dark:text-teal-400" fontSize="small" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Today&apos;s Tasks</h2>
          </div>
          {loading ? (
            <Loader label="Loading tasks..." />
          ) : todaysTasks.length === 0 ? (
            <EmptyState
              icon={<DoneAllIcon fontSize="large" />}
              title="All caught up"
              message="You have no pending tasks right now. New assignments will appear here."
              action={(
                <Link to="/worker/complaints" className={BTN_SECONDARY}>
                  <ListAltIcon fontSize="small" />
                  View all assignments
                </Link>
              )}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {todaysTasks.map((complaint) => (
                <ComplaintCard
                  key={complaint?._id || complaint?.trackingId}
                  complaint={complaint}
                  to={`/complaints/${complaint?._id}`}
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {complaint?.priority ? `${String(complaint.priority).toUpperCase()} priority` : 'Normal priority'}
                      {complaint?.location?.area ? ` · ${complaint.location.area}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      {complaint?.status === 'assigned' ? (
                        <button
                          type="button"
                          className={BTN_SMALL}
                          disabled={updatingId === complaint?._id}
                          onClick={() => handleStart(complaint)}
                        >
                          {updatingId === complaint?._id
                            ? <AutorenewIcon className="animate-spin" style={{ fontSize: 16 }} />
                            : <PlayArrowIcon style={{ fontSize: 16 }} />}
                          Start
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={BTN_SMALL}
                          onClick={() => navigate(`/complaints/${complaint?._id}`)}
                        >
                          <DoneAllIcon style={{ fontSize: 16 }} />
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </ComplaintCard>
              ))}
            </div>
          )}
        </section>

        <section className={`${CARD} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assignment Map</h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{located.length} located</span>
          </div>
          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <Loader label="Loading map..." />
            </div>
          ) : (
            <ComplaintMap complaints={located} height={340} zoom={12} showPopupLink />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
