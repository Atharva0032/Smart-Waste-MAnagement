import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import InboxIcon from '@mui/icons-material/Inbox';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import ComplaintCard from '../../components/ComplaintCard';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { getMyComplaints, deleteComplaint } from '../../services/complaintService';
import { getErrorMessage } from '../../services/api';
import { WASTE_TYPES, STATUS_OPTIONS } from '../../utils/constants';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_DANGER = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';

// Grid of skeleton cards shown while the list loads.
const SkeletonCards = () => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className={`${CARD} animate-pulse p-5`}>
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-32 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    ))}
  </div>
);

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [wasteType, setWasteType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = Array.isArray(complaints) ? [...complaints] : [];
    if (term) {
      list = list.filter((c) => (
        String(c?.trackingId || '').toLowerCase().includes(term)
        || String(c?.description || '').toLowerCase().includes(term)
      ));
    }
    if (status !== 'all') {
      list = list.filter((c) => c?.status === status);
    }
    if (wasteType !== 'all') {
      list = list.filter((c) => c?.wasteType === wasteType);
    }
    list.sort((a, b) => {
      const diff = new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
      return sort === 'oldest' ? -diff : diff;
    });
    return list;
  }, [complaints, search, status, wasteType, sort]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id;
    const previous = complaints;
    // Optimistic removal, rolled back if the request fails.
    setComplaints((prev) => prev.filter((c) => c._id !== id));
    setDeleteTarget(null);
    setDeleting(true);
    setActionError('');
    try {
      await deleteComplaint(id);
    } catch (err) {
      if (mountedRef.current) {
        setComplaints(previous);
        setActionError(getErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  };

  const activeFilters = search || status !== 'all' || wasteType !== 'all';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="My Complaints"
          subtitle="Browse, filter and manage every waste report you have submitted."
          actions={(
            <Link to="/complaints/new" className={BTN_PRIMARY}>
              <AddCircleIcon fontSize="small" />
              Report Waste
            </Link>
          )}
        />

        <div className={`${CARD} p-4`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
              <input
                type="search"
                className={`${INPUT} pl-9`}
                placeholder="Search tracking ID or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {(Array.isArray(STATUS_OPTIONS) ? STATUS_OPTIONS : []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select className={INPUT} value={wasteType} onChange={(e) => setWasteType(e.target.value)} aria-label="Filter by waste type">
              <option value="all">All waste types</option>
              {(Array.isArray(WASTE_TYPES) ? WASTE_TYPES : []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select className={INPUT} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort order">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className={ERROR_ALERT}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className={BTN_SECONDARY} onClick={loadComplaints}>Retry</button>
            </div>
          </div>
        ) : null}

        {actionError ? <div className={ERROR_ALERT}>{actionError}</div> : null}

        {loading ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<InboxIcon fontSize="large" />}
            title={activeFilters ? 'No matching reports' : 'No reports yet'}
            message={activeFilters
              ? 'Try adjusting or clearing your filters to see more reports.'
              : 'You have not submitted any waste reports yet.'}
            action={(
              <Link to="/complaints/new" className={BTN_PRIMARY}>
                <AddCircleIcon fontSize="small" />
                Report Waste
              </Link>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((complaint) => (
              <ComplaintCard
                key={complaint?._id || complaint?.trackingId}
                complaint={complaint}
                to={`/complaints/${complaint?._id}`}
              >
                <div className="flex items-center gap-2">
                  <Link to={`/complaints/${complaint?._id}`} className={BTN_SECONDARY}>
                    <VisibilityIcon fontSize="small" />
                    View
                  </Link>
                  {complaint?.status === 'pending' ? (
                    <button
                      type="button"
                      className={BTN_DANGER}
                      disabled={deleting}
                      onClick={() => { setActionError(''); setDeleteTarget(complaint); }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </ComplaintCard>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete complaint"
        size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className={BTN_DANGER} onClick={handleDelete} disabled={deleting}>
              {deleting ? (<><AutorenewIcon className="animate-spin" fontSize="small" /> Delete</>) : (<><DeleteOutlineIcon fontSize="small" /> Delete</>)}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete complaint{' '}
          <span className="font-mono font-semibold">{deleteTarget?.trackingId || '—'}</span>? This action cannot be undone.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
