import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import EngineeringIcon from '@mui/icons-material/Engineering';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VerifiedIcon from '@mui/icons-material/Verified';
import HistoryIcon from '@mui/icons-material/History';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DashboardLayout from '../../components/DashboardLayout';
import StatusBadge from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import ComplaintMap from '../../components/ComplaintMap';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/AuthContext';
import { getComplaint } from '../../services/complaintService';
import { updateComplaintStatus } from '../../services/adminService';
import { updateStatus as workerUpdateStatus } from '../../services/workerService';
import { getErrorMessage, resolveImageUrl } from '../../services/api';
import { STATUS_OPTIONS, getWasteTypeMeta, getStatusMeta, ROLES } from '../../utils/constants';
import { timeAgo, formatDateTime } from '../../utils/format';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const BTN_SMALL = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const MUTED = 'text-slate-500 dark:text-slate-400';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';

const adminRole = typeof ROLES?.ADMIN === 'string' ? ROLES.ADMIN : 'admin';
const workerRole = typeof ROLES?.WORKER === 'string' ? ROLES.WORKER : 'worker';

const Chip = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
    {children}
  </span>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className={`text-sm ${MUTED}`}>{label}</span>
    <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(false);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [flash, setFlash] = useState({ type: '', message: '' });

  const isAdmin = role === adminRole;
  const isWorker = role === workerRole;
  const canSeeContact = isAdmin || isWorker;

  const loadComplaint = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getComplaint(id);
      const record = data?.complaint || data || null;
      setComplaint(record);
    } catch (err) {
      setError(getErrorMessage(err));
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  const backTo = useMemo(() => {
    if (isAdmin) return '/admin/complaints';
    if (isWorker) return '/worker/complaints';
    return '/complaints';
  }, [isAdmin, isWorker]);

  const wasteMeta = useMemo(() => {
    try {
      return getWasteTypeMeta(complaint?.wasteType) || {};
    } catch (err) {
      return {};
    }
  }, [complaint]);

  const coords = complaint?.location || {};
  const hasCoords = Boolean(coords?.latitude && coords?.longitude);
  const osmUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=17/${coords.latitude}/${coords.longitude}`
    : '';
  const mapComplaints = complaint ? [complaint] : [];

  const applyStatus = async (status, source) => {
    if (!complaint?._id) return;
    setUpdating(true);
    setFlash({ type: '', message: '' });
    try {
      if (source === 'admin') {
        await updateComplaintStatus(complaint._id, status, note);
      } else {
        await workerUpdateStatus(complaint._id, status, note);
      }
      setNote('');
      setFlash({ type: 'success', message: `Status updated to ${getStatusMeta(status)?.label || status}.` });
      await loadComplaint();
    } catch (err) {
      setFlash({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Loader fullScreen label="Loading complaint..." />
      </DashboardLayout>
    );
  }

  if (error || !complaint) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link to={backTo} className={BTN_SECONDARY}>
            <ArrowBackIcon fontSize="small" />
            Back
          </Link>
          <EmptyState
            icon={<ErrorOutlineIcon fontSize="large" />}
            title="Complaint not found"
            message={error || 'We could not find the complaint you are looking for. It may have been removed.'}
            action={<button type="button" className={BTN_PRIMARY} onClick={loadComplaint}>Retry</button>}
          />
        </div>
      </DashboardLayout>
    );
  }

  const timelineItems = Array.isArray(complaint?.timeline) ? complaint.timeline : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button type="button" className={BTN_SECONDARY} onClick={() => navigate(backTo)}>
          <ArrowBackIcon fontSize="small" />
          Back
        </button>

        {flash.message ? (
          <div className={flash.type === 'error' ? ERROR_ALERT : SUCCESS_ALERT}>{flash.message}</div>
        ) : null}

        <div className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
              {complaint?.trackingId || '—'}
            </h1>
            <StatusBadge status={complaint?.status} />
            {wasteMeta?.label ? (
              <Chip className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {wasteMeta.label}
              </Chip>
            ) : null}
            {complaint?.priority ? (
              <Chip className="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {String(complaint.priority).charAt(0).toUpperCase() + String(complaint.priority).slice(1)} priority
              </Chip>
            ) : null}
            <span className={`ml-auto text-sm ${MUTED}`}>Reported {timeAgo(complaint?.createdAt)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className={`${CARD} p-5`}>
              <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Reported image</h2>
              {complaint?.image ? (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="block w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={resolveImageUrl(complaint.image)}
                    alt="Reported waste"
                    className="h-72 w-full object-cover transition hover:opacity-95"
                  />
                </button>
              ) : (
                <p className={MUTED}>No image provided.</p>
              )}

              <h3 className={`${LABEL} mt-5`}>Description</h3>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {complaint?.description || 'No description provided.'}
              </p>
            </section>

            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center gap-2">
                <VerifiedIcon className="text-teal-600 dark:text-teal-400" fontSize="small" />
                <h2 className="font-bold text-slate-900 dark:text-white">AI verification</h2>
              </div>
              {complaint?.aiVerification && complaint.aiVerification.confidence !== undefined && complaint.aiVerification.confidence !== null ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Detected: {complaint.aiVerification.label || 'waste'}
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {Number(complaint.aiVerification.confidence || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${Math.min(100, Math.max(0, Number(complaint.aiVerification.confidence || 0)))}%` }}
                    />
                  </div>
                  {complaint.aiVerification.verifiedAt ? (
                    <p className={`mt-2 text-xs ${MUTED}`}>Verified {formatDateTime(complaint.aiVerification.verifiedAt)}</p>
                  ) : null}
                </div>
              ) : (
                <p className={MUTED}>AI verification not available for this complaint.</p>
              )}
            </section>

            {complaint?.completionImage || complaint?.resolutionNote ? (
              <section className={`${CARD} p-5`}>
                <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Resolution</h2>
                {complaint?.completionImage ? (
                  <img
                    src={resolveImageUrl(complaint.completionImage)}
                    alt="Completion"
                    className="h-64 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                ) : null}
                {complaint?.resolutionNote ? (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{complaint.resolutionNote}</p>
                ) : null}
                {complaint?.resolvedAt ? (
                  <p className={`mt-2 text-xs ${MUTED}`}>Resolved {formatDateTime(complaint.resolvedAt)}</p>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className={`${CARD} p-5`}>
              <h2 className="mb-2 font-bold text-slate-900 dark:text-white">Details</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <InfoRow label="Waste type" value={wasteMeta?.label || complaint?.wasteType || '—'} />
                <InfoRow label="Area" value={complaint?.location?.area || '—'} />
                <InfoRow label="Address" value={complaint?.location?.address || '—'} />
                <InfoRow
                  label="Coordinates"
                  value={hasCoords ? (
                    <a
                      href={osmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
                    >
                      {Number(coords.latitude).toFixed(5)}, {Number(coords.longitude).toFixed(5)}
                      <OpenInNewIcon style={{ fontSize: 14 }} />
                    </a>
                  ) : '—'}
                />
                <InfoRow label="Created" value={formatDateTime(complaint?.createdAt)} />
              </div>
            </section>

            <section className={`${CARD} p-5`}>
              <div className="mb-2 flex items-center gap-2">
                <PersonIcon className="text-slate-500 dark:text-slate-400" fontSize="small" />
                <h2 className="font-bold text-slate-900 dark:text-white">Reporter</h2>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{complaint?.user?.name || '—'}</p>
              {canSeeContact ? (
                <div className={`mt-1 space-y-1 text-sm ${MUTED}`}>
                  {complaint?.user?.email ? <p>{complaint.user.email}</p> : null}
                  {complaint?.user?.phone ? <p>{complaint.user.phone}</p> : null}
                </div>
              ) : (
                <p className={`mt-1 text-xs ${MUTED}`}>Contact details are visible to staff only.</p>
              )}
            </section>

            <section className={`${CARD} p-5`}>
              <div className="mb-2 flex items-center gap-2">
                <EngineeringIcon className="text-slate-500 dark:text-slate-400" fontSize="small" />
                <h2 className="font-bold text-slate-900 dark:text-white">Assigned worker</h2>
              </div>
              {complaint?.assignedWorker ? (
                <>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{complaint.assignedWorker.name}</p>
                  <div className={`mt-1 space-y-1 text-sm ${MUTED}`}>
                    {complaint.assignedWorker.zone ? <p>Zone: {complaint.assignedWorker.zone}</p> : null}
                    {complaint.assignedWorker.phone ? <p>{complaint.assignedWorker.phone}</p> : null}
                  </div>
                </>
              ) : (
                <p className={MUTED}>Not assigned yet.</p>
              )}
            </section>

            {isAdmin ? (
              <section className={`${CARD} p-5`}>
                <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Update status</h2>
                <label className={LABEL} htmlFor="admin-note">Note</label>
                <textarea
                  id="admin-note"
                  className={INPUT}
                  rows={2}
                  placeholder="Optional note for this update"
                  value={note}
                  disabled={updating}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Array.isArray(STATUS_OPTIONS) ? STATUS_OPTIONS : []).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={BTN_SMALL}
                      disabled={updating || complaint?.status === opt.value}
                      onClick={() => applyStatus(opt.value, 'admin')}
                    >
                      {updating ? <AutorenewIcon className="animate-spin" style={{ fontSize: 14 }} /> : null}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {isWorker ? (
              <section className={`${CARD} p-5`}>
                <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Field actions</h2>
                <label className={LABEL} htmlFor="worker-note">Note</label>
                <textarea
                  id="worker-note"
                  className={INPUT}
                  rows={2}
                  placeholder="Optional note"
                  value={note}
                  disabled={updating}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={updating || complaint?.status === 'in_progress' || complaint?.status === 'resolved'}
                    onClick={() => applyStatus('in_progress', 'worker')}
                  >
                    <LocalShippingIcon fontSize="small" />
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={updating || complaint?.status === 'resolved'}
                    onClick={() => applyStatus('resolved', 'worker')}
                  >
                    <CheckCircleIcon fontSize="small" />
                    Resolve
                  </button>
                </div>
              </section>
            ) : null}

            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center gap-2">
                <HistoryIcon className="text-slate-500 dark:text-slate-400" fontSize="small" />
                <h2 className="font-bold text-slate-900 dark:text-white">Timeline</h2>
              </div>
              <Timeline items={timelineItems} loading={false} />
            </section>
          </div>
        </div>

        <section className={`${CARD} p-5`}>
          <div className="mb-3 flex items-center gap-2">
            <PlaceIcon className="text-slate-500 dark:text-slate-400" fontSize="small" />
            <h2 className="font-bold text-slate-900 dark:text-white">Location</h2>
          </div>
          {hasCoords ? (
            <ComplaintMap complaints={mapComplaints} height={320} zoom={16} showPopupLink={false} />
          ) : (
            <p className={MUTED}>No coordinates were provided for this complaint.</p>
          )}
        </section>
      </div>

      <Modal open={lightbox} onClose={() => setLightbox(false)} title="Reported image" size="lg">
        <div className="relative">
          <button
            type="button"
            className="absolute -top-1 right-0 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900"
            onClick={() => setLightbox(false)}
            aria-label="Close image"
          >
            <CloseIcon fontSize="small" />
          </button>
          <img
            src={resolveImageUrl(complaint?.image)}
            alt="Reported waste"
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
