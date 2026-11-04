import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InboxIcon from '@mui/icons-material/Inbox';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import ComplaintTable from '../../components/ComplaintTable';
import ComplaintMap from '../../components/ComplaintMap';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { getComplaints, assignComplaint, updateComplaintStatus, deleteComplaint, getWorkers } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import { WASTE_TYPES, STATUS_OPTIONS, AREAS } from '../../utils/constants';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_DANGER = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SMALL = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';

const toOption = (item) => (
  typeof item === 'string' ? { value: item, label: item } : { value: item?.value, label: item?.label ?? item?.value }
);

const PAGE_LIMIT = 10;

export default function AdminComplaints() {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [wasteType, setWasteType] = useState('all');
  const [area, setArea] = useState('all');
  const [sort, setSort] = useState('newest');

  const [workers, setWorkers] = useState([]);
  const [showMap, setShowMap] = useState(false);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [flash, setFlash] = useState({ type: '', message: '' });

  const debounceRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Debounce the free-text search so we do not hit the API on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: PAGE_LIMIT,
        sort,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status !== 'all') params.status = status;
      if (wasteType !== 'all') params.wasteType = wasteType;
      if (area !== 'all') params.area = area;

      const data = await getComplaints(params);
      if (!mountedRef.current) return;
      setComplaints(Array.isArray(data?.complaints) ? data.complaints : []);
      setPage(Number(data?.page) || page);
      setPages(Number(data?.pages) || 1);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(getErrorMessage(err));
      setComplaints([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [page, sort, debouncedSearch, status, wasteType, area]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getWorkers();
        if (active) setWorkers(Array.isArray(data?.workers) ? data.workers : []);
      } catch (err) {
        if (active) setWorkers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const areaOptions = useMemo(() => (Array.isArray(AREAS) ? AREAS : []).map(toOption), []);
  const wasteOptions = useMemo(() => (Array.isArray(WASTE_TYPES) ? WASTE_TYPES : []).map(toOption), []);
  const statusOptions = useMemo(() => (Array.isArray(STATUS_OPTIONS) ? STATUS_OPTIONS : []).map(toOption), []);

  const hasFilters = Boolean(debouncedSearch || search) || status !== 'all' || wasteType !== 'all' || area !== 'all' || sort !== 'newest';

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('all');
    setWasteType('all');
    setArea('all');
    setSort('newest');
    setPage(1);
  };

  const locatedComplaints = useMemo(
    () => complaints.filter((c) => c?.location?.latitude && c?.location?.longitude),
    [complaints]
  );

  const handleAssign = async () => {
    if (!assignTarget || !assignWorkerId) return;
    setActionLoading(true);
    try {
      await assignComplaint(assignTarget._id, assignWorkerId);
      setAssignTarget(null);
      setAssignWorkerId('');
      setFlash({ type: 'success', message: 'Worker assigned successfully.' });
      await loadComplaints();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusTarget || !statusValue) return;
    setActionLoading(true);
    try {
      await updateComplaintStatus(statusTarget._id, statusValue, statusNote);
      setStatusTarget(null);
      setStatusValue('');
      setStatusNote('');
      setFlash({ type: 'success', message: 'Complaint status updated successfully.' });
      await loadComplaints();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteComplaint(deleteTarget._id);
      setDeleteTarget(null);
      setFlash({ type: 'success', message: 'Complaint deleted successfully.' });
      await loadComplaints();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const list = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let i = start; i <= end; i += 1) list.push(i);
    return list;
  }, [page, pages]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="All Complaints"
          subtitle="Search, assign and update every complaint across the city."
          actions={(
            <button type="button" className={BTN_SECONDARY} onClick={loadComplaints} disabled={loading}>
              <RefreshIcon fontSize="small" className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        />

        {flash.message ? (
          <div className={flash.type === 'error' ? ERROR_ALERT : SUCCESS_ALERT}>{flash.message}</div>
        ) : null}

        {error ? (
          <div className={ERROR_ALERT}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className={BTN_SECONDARY} onClick={loadComplaints}>Retry</button>
            </div>
          </div>
        ) : null}

        <div className={`${CARD} p-4`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
              <input
                type="search"
                className={`${INPUT} pl-9`}
                placeholder="Search complaints"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={INPUT} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="all">All statuses</option>
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className={INPUT} value={wasteType} onChange={(e) => { setWasteType(e.target.value); setPage(1); }} aria-label="Waste type">
              <option value="all">All waste types</option>
              {wasteOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className={INPUT} value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} aria-label="Area">
              <option value="all">All areas</option>
              {areaOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <div className="flex gap-3">
              <select className={INPUT} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <button type="button" className={BTN_SECONDARY} onClick={resetFilters} disabled={!hasFilters}>
                Reset
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className={BTN_SMALL} onClick={() => setShowMap((v) => !v)}>
              <MapIcon style={{ fontSize: 16 }} />
              {showMap ? 'Hide map' : 'Show map'}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">{total} complaint(s)</span>
          </div>
          {showMap ? (
            <div className="mt-3">
              <ComplaintMap complaints={locatedComplaints} height={340} zoom={12} showPopupLink />
            </div>
          ) : null}
        </div>

        {!loading && complaints.length === 0 ? (
          <EmptyState
            icon={<InboxIcon fontSize="large" />}
            title={hasFilters ? 'No matching complaints' : 'No complaints yet'}
            message={hasFilters ? 'Try clearing your filters to see more results.' : 'Complaints will appear here as citizens report waste.'}
            action={hasFilters ? <button type="button" className={BTN_PRIMARY} onClick={resetFilters}>Clear filters</button> : null}
          />
        ) : (
          <div className={`${CARD} p-1 sm:p-2`}>
            <ComplaintTable
              complaints={complaints}
              loading={loading}
              showCitizen
              emptyMessage={hasFilters ? 'No complaints match your filters.' : 'No complaints found.'}
              onRowClick={(complaint) => navigate(`/complaints/${complaint?._id}`)}
              renderActions={(complaint) => (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={BTN_SMALL}
                    onClick={() => navigate(`/complaints/${complaint?._id}`)}
                  >
                    <VisibilityIcon style={{ fontSize: 16 }} />
                    View
                  </button>
                  <button
                    type="button"
                    className={BTN_SMALL}
                    onClick={() => { setAssignTarget(complaint); setAssignWorkerId(complaint?.assignedWorker?._id || ''); }}
                  >
                    <AssignmentIndIcon style={{ fontSize: 16 }} />
                    Assign
                  </button>
                  <button
                    type="button"
                    className={BTN_SMALL}
                    onClick={() => { setStatusTarget(complaint); setStatusValue(complaint?.status || 'pending'); setStatusNote(''); }}
                  >
                    <AutorenewIcon style={{ fontSize: 16 }} />
                    Status
                  </button>
                  <button
                    type="button"
                    className={`${BTN_SMALL} border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10`}
                    onClick={() => setDeleteTarget(complaint)}
                  >
                    <DeleteOutlineIcon style={{ fontSize: 16 }} />
                    Delete
                  </button>
                </div>
              )}
            />
          </div>
        )}

        {pages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeftIcon fontSize="small" />
                Prev
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={num === page ? BTN_PRIMARY : BTN_SECONDARY}
                  onClick={() => setPage(num)}
                  disabled={loading}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}
              >
                Next
                <ChevronRightIcon fontSize="small" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(assignTarget)}
        onClose={() => (actionLoading ? null : setAssignTarget(null))}
        title="Assign worker"
        size="md"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setAssignTarget(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={handleAssign} disabled={actionLoading || !assignWorkerId}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <AssignmentIndIcon fontSize="small" />}
              Assign
            </button>
          </div>
        )}
      >
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Assign complaint <span className="font-mono font-semibold">{assignTarget?.trackingId || '—'}</span> to a field worker.
        </p>
        <label className={LABEL} htmlFor="assign-worker">Field worker</label>
        <select
          id="assign-worker"
          className={INPUT}
          value={assignWorkerId}
          onChange={(e) => setAssignWorkerId(e.target.value)}
          disabled={actionLoading}
        >
          <option value="">Select a worker</option>
          {workers.map((w) => (
            <option key={w?._id} value={w?._id}>
              {w?.name}{w?.zone ? ` — ${w.zone}` : ''}{w?.isActive === false ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
        {workers.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No workers available. Add workers first.</p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => (actionLoading ? null : setStatusTarget(null))}
        title="Update status"
        size="md"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setStatusTarget(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={handleStatusUpdate} disabled={actionLoading || !statusValue}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : null}
              Update
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="status-value">New status</label>
            <select
              id="status-value"
              className={INPUT}
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              disabled={actionLoading}
            >
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="status-note">Note (optional)</label>
            <textarea
              id="status-note"
              className={INPUT}
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              disabled={actionLoading}
              placeholder="Add context for this status change"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (actionLoading ? null : setDeleteTarget(null))}
        title="Delete complaint"
        size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setDeleteTarget(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <DeleteOutlineIcon fontSize="small" />}
              Delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete complaint <span className="font-mono font-semibold">{deleteTarget?.trackingId || '—'}</span>? This action cannot be undone.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
