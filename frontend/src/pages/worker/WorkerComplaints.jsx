import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NavigationIcon from '@mui/icons-material/Navigation';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import InboxIcon from '@mui/icons-material/Inbox';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import ComplaintTable from '../../components/ComplaintTable';
import ImageUploader from '../../components/ImageUploader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { getAssigned, updateStatus, resolveComplaint } from '../../services/workerService';
import { getErrorMessage, resolveImageUrl } from '../../services/api';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_SMALL = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const TAB_ACTIVE = 'inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white';
const TAB_INACTIVE = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const FIELD_ERROR = 'mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const osmUrlFor = (complaint) => {
  const lat = complaint?.location?.latitude;
  const lng = complaint?.location?.longitude;
  if (!lat || !lng) return '';
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
};

const initialResolveState = { file: null, preview: null, note: '', fileError: '', noteError: '' };

export default function WorkerComplaints() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [flash, setFlash] = useState({ type: '', message: '' });
  const [updatingId, setUpdatingId] = useState(null);

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolve, setResolve] = useState(initialResolveState);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const previewRef = useRef(null);

  useEffect(() => () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }, []);

  const loadAssigned = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAssigned();
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
    loadAssigned();
  }, [loadAssigned]);

  const counts = useMemo(() => {
    const list = Array.isArray(complaints) ? complaints : [];
    return {
      all: list.length,
      assigned: list.filter((c) => c?.status === 'assigned').length,
      in_progress: list.filter((c) => c?.status === 'in_progress').length,
      resolved: list.filter((c) => c?.status === 'resolved').length,
    };
  }, [complaints]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = Array.isArray(complaints) ? [...complaints] : [];
    if (tab !== 'all') list = list.filter((c) => c?.status === tab);
    if (term) {
      list = list.filter((c) => (
        String(c?.trackingId || '').toLowerCase().includes(term)
        || String(c?.description || '').toLowerCase().includes(term)
        || String(c?.location?.area || '').toLowerCase().includes(term)
      ));
    }
    list.sort((a, b) => {
      const diff = new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
      return sort === 'oldest' ? -diff : diff;
    });
    return list;
  }, [complaints, tab, search, sort]);

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

  const openResolve = (complaint) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setResolve(initialResolveState);
    setProgress(0);
    setResolveTarget(complaint);
  };

  const closeResolve = () => {
    if (submitting) return;
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setResolveTarget(null);
    setResolve(initialResolveState);
  };

  const handleCompletionFile = (fileOrNull) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    if (fileOrNull) {
      const url = URL.createObjectURL(fileOrNull);
      previewRef.current = url;
      setResolve((r) => ({ ...r, file: fileOrNull, preview: url, fileError: '' }));
    } else {
      setResolve((r) => ({ ...r, file: null, preview: null }));
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveTarget) return;
    const fileError = resolve.file ? '' : 'Completion photo is required';
    const trimmedNote = resolve.note.trim();
    const noteError = trimmedNote.length < 10 ? 'Resolution note must be at least 10 characters' : '';
    setResolve((r) => ({ ...r, fileError, noteError }));
    if (fileError || noteError) return;

    setSubmitting(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('completionImage', resolve.file);
      formData.append('note', trimmedNote);
      await resolveComplaint(resolveTarget._id, formData, (e) => {
        const total = e?.total || 0;
        setProgress(total ? Math.round((e.loaded / total) * 100) : 0);
      });
      setFlash({ type: 'success', message: `Complaint ${resolveTarget.trackingId || ''} resolved successfully.` });
      closeResolve();
      await loadAssigned();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Assigned Complaints"
          subtitle="Work through your assigned tasks, start them and submit proof of resolution."
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

        <div className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={tab === t.value ? TAB_ACTIVE : TAB_INACTIVE}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-bold dark:bg-white/10">
                  {counts[t.value]}
                </span>
              </button>
            ))}
            <div className="ml-auto flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
                <input
                  type="search"
                  className={`${INPUT} pl-9`}
                  placeholder="Search assignments"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className={INPUT} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {!loading && visible.length === 0 ? (
          <EmptyState
            icon={<InboxIcon fontSize="large" />}
            title="No assignments"
            message={tab === 'all' ? 'You have no assigned complaints right now.' : 'There are no complaints with this status.'}
          />
        ) : (
          <div className={`${CARD} p-1 sm:p-2`}>
            <ComplaintTable
              complaints={visible}
              loading={loading}
              emptyMessage="No assignments match your filters."
              onRowClick={(complaint) => navigate(`/complaints/${complaint?._id}`)}
              renderActions={(complaint) => {
                const mapHref = osmUrlFor(complaint);
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={BTN_SMALL} onClick={() => navigate(`/complaints/${complaint?._id}`)}>
                      <VisibilityIcon style={{ fontSize: 16 }} />
                      View
                    </button>
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
                    ) : null}
                    {complaint?.status === 'in_progress' ? (
                      <button type="button" className={BTN_SMALL} onClick={() => openResolve(complaint)}>
                        <DoneAllIcon style={{ fontSize: 16 }} />
                        Complete
                      </button>
                    ) : null}
                    {mapHref ? (
                      <a href={mapHref} target="_blank" rel="noreferrer" className={BTN_SMALL}>
                        <NavigationIcon style={{ fontSize: 16 }} />
                        Navigate
                      </a>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>

      <Modal
        open={Boolean(resolveTarget)}
        onClose={closeResolve}
        title="Complete complaint"
        size="lg"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={closeResolve} disabled={submitting}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={handleResolveSubmit} disabled={submitting}>
              {submitting ? <AutorenewIcon className="animate-spin" fontSize="small" /> : <DoneAllIcon fontSize="small" />}
              Submit resolution
            </button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Complaint <span className="font-mono font-semibold">{resolveTarget?.trackingId || '—'}</span>
            </p>
          </div>

          {resolveTarget?.image ? (
            <div>
              <p className={LABEL}>Reported image</p>
              <img
                src={resolveImageUrl(resolveTarget.image)}
                alt="Reported waste"
                className="h-48 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
            </div>
          ) : null}

          <div>
            <ImageUploader
              label="Completion Photo"
              file={resolve.file}
              preview={resolve.preview}
              onFileChange={handleCompletionFile}
              error={resolve.fileError}
              required
              disabled={submitting}
              helperText="Upload a clear photo proving the waste has been cleared."
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="resolution-note">Resolution note <span className="text-rose-500">*</span></label>
            <textarea
              id="resolution-note"
              className={INPUT}
              rows={3}
              value={resolve.note}
              disabled={submitting}
              placeholder="Describe what was done to resolve this complaint (min 10 characters)."
              onChange={(e) => setResolve((r) => ({ ...r, note: e.target.value, noteError: '' }))}
            />
            <div className="mt-1.5 flex items-center justify-between">
              {resolve.noteError ? <p className={FIELD_ERROR}>{resolve.noteError}</p> : <span className="text-xs text-slate-500 dark:text-slate-400">Minimum 10 characters</span>}
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{resolve.note.trim().length}/500</span>
            </div>
          </div>

          {submitting ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                <span>Uploading proof...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
