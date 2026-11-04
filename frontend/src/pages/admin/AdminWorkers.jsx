import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { getWorkers, createWorker, updateWorker, deleteWorker } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import { AREAS } from '../../utils/constants';
import { validateRequired } from '../../utils/validators';
import { formatDate } from '../../utils/format';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_DANGER = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SMALL = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const FIELD_ERROR = 'mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toOption = (item) => (
  typeof item === 'string' ? { value: item, label: item } : { value: item?.value, label: item?.label ?? item?.value }
);

// Tolerant wrapper around the shared validateRequired helper, with a local fallback.
const requiredError = (value, field) => {
  try {
    if (typeof validateRequired === 'function') {
      const res = validateRequired(value, field);
      if (typeof res === 'string') return res;
      if (res && typeof res === 'object' && typeof res.message === 'string') return res.message;
    }
  } catch (err) {
    // fall through to the local check below
  }
  return value === undefined || value === null || String(value).trim() === '' ? `${field} is required` : '';
};

const initialsOf = (name) => (
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?'
);

const SkeletonRows = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className={`${CARD} flex animate-pulse items-center gap-4 p-4`}>
        <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-56 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    ))}
  </div>
);

const emptyForm = { name: '', email: '', phone: '', zone: '', password: '', confirmPassword: '' };

export default function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState({ type: '', message: '' });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', zone: '', isActive: true });
  const [editErrors, setEditErrors] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getWorkers();
      const list = Array.isArray(data) ? data : Array.isArray(data?.workers) ? data.workers : [];
      if (mountedRef.current) setWorkers(list);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(getErrorMessage(err));
      setWorkers([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const areaOptions = useMemo(() => (Array.isArray(AREAS) ? AREAS : []).map(toOption), []);

  // Only show the workload column when the API returns counts on worker objects.
  const hasCounts = useMemo(
    () => workers.some((w) => w?.assignedCount !== undefined || w?.completedCount !== undefined || w?.assigned !== undefined || w?.completed !== undefined),
    [workers]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = Array.isArray(workers) ? [...workers] : [];
    if (term) {
      list = list.filter((w) => (
        String(w?.name || '').toLowerCase().includes(term)
        || String(w?.email || '').toLowerCase().includes(term)
        || String(w?.zone || '').toLowerCase().includes(term)
      ));
    }
    return list;
  }, [workers, search]);

  const openAdd = () => {
    setForm(emptyForm);
    setFormErrors({});
    setAddOpen(true);
  };

  const validateAdd = () => {
    const errs = {};
    const nameErr = requiredError(form.name, 'Name');
    if (nameErr) errs.name = nameErr;
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    const zoneErr = requiredError(form.zone, 'Zone');
    if (zoneErr) errs.zone = zoneErr;
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateAdd()) return;
    setActionLoading(true);
    try {
      await createWorker({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        zone: form.zone,
        password: form.password,
      });
      setAddOpen(false);
      setForm(emptyForm);
      setFlash({ type: 'success', message: 'Worker created successfully.' });
      await loadWorkers();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (worker) => {
    setEditTarget(worker);
    setEditForm({
      name: worker?.name || '',
      phone: worker?.phone || '',
      zone: worker?.zone || '',
      isActive: worker?.isActive !== false,
    });
    setEditErrors({});
  };

  const validateEdit = () => {
    const errs = {};
    const nameErr = requiredError(editForm.name, 'Name');
    if (nameErr) errs.name = nameErr;
    if (editForm.phone && !/^[0-9+\-\s()]{6,}$/.test(editForm.phone.trim())) errs.phone = 'Enter a valid phone number';
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUpdate = async () => {
    if (!editTarget || !validateEdit()) return;
    setActionLoading(true);
    try {
      await updateWorker(editTarget._id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        zone: editForm.zone,
        isActive: editForm.isActive,
      });
      setEditTarget(null);
      setFlash({ type: 'success', message: 'Worker updated successfully.' });
      await loadWorkers();
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
      await deleteWorker(deleteTarget._id);
      setDeleteTarget(null);
      setFlash({ type: 'success', message: 'Worker deleted successfully.' });
      await loadWorkers();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Field Workers"
          subtitle="Create, edit and manage the field team that resolves waste complaints."
          actions={(
            <button type="button" className={BTN_PRIMARY} onClick={openAdd}>
              <PersonAddIcon fontSize="small" />
              Add Worker
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
              <button type="button" className={BTN_SECONDARY} onClick={loadWorkers}>Retry</button>
            </div>
          </div>
        ) : null}

        <div className={`${CARD} p-4`}>
          <div className="relative max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
            <input
              type="search"
              className={`${INPUT} pl-9`}
              placeholder="Search by name, email or zone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GroupIcon fontSize="large" />}
            title={search ? 'No matching workers' : 'No workers yet'}
            message={search ? 'Try a different search term.' : 'Add your first field worker to start assigning complaints.'}
            action={!search ? (
              <button type="button" className={BTN_PRIMARY} onClick={openAdd}>
                <PersonAddIcon fontSize="small" />
                Add Worker
              </button>
            ) : null}
          />
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                    {hasCounts ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workload</th> : null}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((worker) => {
                    const assigned = worker?.assignedCount ?? worker?.assigned;
                    const completed = worker?.completedCount ?? worker?.completed;
                    return (
                      <tr key={worker?._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                              {initialsOf(worker?.name)}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{worker?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-700 dark:text-slate-200">{worker?.email || '—'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{worker?.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{worker?.zone || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            worker?.isActive !== false
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                          >
                            {worker?.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {hasCounts ? (
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {assigned ?? '—'} assigned · {completed ?? '—'} completed
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(worker?.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" className={BTN_SMALL} onClick={() => openEdit(worker)}>
                              <EditIcon style={{ fontSize: 16 }} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${BTN_SMALL} border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10`}
                              onClick={() => setDeleteTarget(worker)}
                            >
                              <PersonOffIcon style={{ fontSize: 16 }} />
                              {worker?.isActive !== false ? 'Deactivate' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => (actionLoading ? null : setAddOpen(false))}
        title="Add worker"
        size="md"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setAddOpen(false)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <PersonAddIcon fontSize="small" />}
              Create
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="w-name">Full name</label>
            <input id="w-name" className={INPUT} value={form.name} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
            {formErrors.name ? <p className={FIELD_ERROR}>{formErrors.name}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="w-email">Email</label>
            <input id="w-email" type="email" className={INPUT} value={form.email} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="worker@city.gov" />
            {formErrors.email ? <p className={FIELD_ERROR}>{formErrors.email}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="w-phone">Phone</label>
            <input id="w-phone" className={INPUT} value={form.phone} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 0100" />
            {formErrors.phone ? <p className={FIELD_ERROR}>{formErrors.phone}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="w-zone">Zone</label>
            <select id="w-zone" className={INPUT} value={form.zone} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}>
              <option value="">Select zone</option>
              {areaOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {formErrors.zone ? <p className={FIELD_ERROR}>{formErrors.zone}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="w-pass">Password</label>
            <input id="w-pass" type="password" className={INPUT} value={form.password} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" />
            {formErrors.password ? <p className={FIELD_ERROR}>{formErrors.password}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="w-confirm">Confirm password</label>
            <input id="w-confirm" type="password" className={INPUT} value={form.confirmPassword} disabled={actionLoading}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" />
            {formErrors.confirmPassword ? <p className={FIELD_ERROR}>{formErrors.confirmPassword}</p> : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => (actionLoading ? null : setEditTarget(null))}
        title="Edit worker"
        size="md"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setEditTarget(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={handleUpdate} disabled={actionLoading}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <EditIcon fontSize="small" />}
              Save changes
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="e-name">Full name</label>
            <input id="e-name" className={INPUT} value={editForm.name} disabled={actionLoading}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            {editErrors.name ? <p className={FIELD_ERROR}>{editErrors.name}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="e-phone">Phone</label>
            <input id="e-phone" className={INPUT} value={editForm.phone} disabled={actionLoading}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            {editErrors.phone ? <p className={FIELD_ERROR}>{editErrors.phone}</p> : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="e-zone">Zone</label>
            <select id="e-zone" className={INPUT} value={editForm.zone} disabled={actionLoading}
              onChange={(e) => setEditForm((f) => ({ ...f, zone: e.target.value }))}>
              <option value="">Select zone</option>
              {editForm.zone && !areaOptions.some((o) => o.value === editForm.zone) ? (
                <option value={editForm.zone}>{editForm.zone}</option>
              ) : null}
              {areaOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800"
                checked={editForm.isActive}
                disabled={actionLoading}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active (available to receive assignments)
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (actionLoading ? null : setDeleteTarget(null))}
        title={deleteTarget?.isActive !== false ? 'Deactivate worker' : 'Delete worker'}
        size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => setDeleteTarget(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <DeleteOutlineIcon fontSize="small" />}
              Confirm
            </button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to deactivate/remove{' '}
          <span className="font-semibold">{deleteTarget?.name || 'this worker'}</span>? They will no longer receive new assignments.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
