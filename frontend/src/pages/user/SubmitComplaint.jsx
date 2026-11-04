import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DashboardLayout from '../../components/DashboardLayout';
import PageHeader from '../../components/PageHeader';
import ImageUploader from '../../components/ImageUploader';
import MapPicker from '../../components/MapPicker';
import { useAuth } from '../../context/AuthContext';
import { createComplaint, verifyImage } from '../../services/complaintService';
import { getErrorMessage } from '../../services/api';
import { WASTE_TYPES, PRIORITIES, AREAS, AI_CONFIDENCE_THRESHOLD } from '../../utils/constants';
import { validateComplaintForm } from '../../utils/validators';

const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const ERROR_ALERT = 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
const SUCCESS_ALERT = 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
const FIELD_ERROR = 'mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400';

// Normalise option lists that may be plain strings or { value, label } objects.
const toOption = (item) => (
  typeof item === 'string'
    ? { value: item, label: item }
    : { value: item?.value, label: item?.label ?? item?.value }
);

const StepBadge = ({ children }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
    {children}
  </span>
);

export default function SubmitComplaint() {
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);

  // AI verification state: idle | checking | valid | invalid | unavailable
  const [aiState, setAiState] = useState('idle');
  const [aiConfidence, setAiConfidence] = useState(null);
  const [aiLabel, setAiLabel] = useState('');
  const [aiBlocked, setAiBlocked] = useState(false);

  const [wasteType, setWasteType] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    setPhone(user?.phone || '');
  }, [user]);

  // Revoke the most recent object URL on unmount to avoid memory leaks.
  useEffect(() => () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }, []);

  const resetAi = useCallback(() => {
    setAiState('idle');
    setAiConfidence(null);
    setAiLabel('');
    setAiBlocked(false);
  }, []);

  const runVerification = useCallback(async (imageFile) => {
    setAiState('checking');
    setAiBlocked(false);
    try {
      const res = await verifyImage(imageFile);
      const rawConfidence = Number(res?.confidence);
      const confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;
      const isWaste = res?.isWaste !== false;
      setAiConfidence(confidence);
      setAiLabel(res?.label || '');
      if (!isWaste || confidence < AI_CONFIDENCE_THRESHOLD) {
        setAiState('invalid');
        setAiBlocked(true);
      } else {
        setAiState('valid');
        setAiBlocked(false);
      }
    } catch (err) {
      // Fail open: if the AI service is down the citizen can still submit.
      setAiState('unavailable');
      setAiConfidence(null);
      setAiLabel('');
      setAiBlocked(false);
    }
  }, []);

  const handleFileChange = (nextFile) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setErrors((prev) => ({ ...prev, file: '' }));
    resetAi();
    if (nextFile) {
      const url = URL.createObjectURL(nextFile);
      previewRef.current = url;
      setFile(nextFile);
      setPreview(url);
      runVerification(nextFile);
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleLocationChange = (next) => {
    setLocation({ latitude: next?.latitude, longitude: next?.longitude });
    setAddress(next?.address || '');
    setArea(next?.area || '');
    setErrors((prev) => ({ ...prev, location: '' }));
  };

  const areaOptions = useMemo(() => {
    const base = (Array.isArray(AREAS) ? AREAS : []).map(toOption);
    const values = base.map((o) => o.value);
    if (area && !values.includes(area)) {
      return [{ value: area, label: area }, ...base];
    }
    return base;
  }, [area]);

  const wasteOptions = useMemo(() => (Array.isArray(WASTE_TYPES) ? WASTE_TYPES : []).map(toOption), []);
  const priorityOptions = useMemo(() => (Array.isArray(PRIORITIES) ? PRIORITIES : []).map(toOption), []);

  const resetForm = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setFile(null);
    setPreview(null);
    setWasteType('');
    setPriority('medium');
    setDescription('');
    setLocation(null);
    setAddress('');
    setArea('');
    setPhone(user?.phone || '');
    setErrors({});
    setProgress(0);
    setSuccess(null);
    resetAi();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (aiBlocked) return;
    const result = validateComplaintForm({ wasteType, description, location, file });
    if (!result?.valid) {
      setErrors(result?.errors || {});
      return;
    }
    setErrors({});
    setSubmitting(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('wasteType', wasteType);
      formData.append('description', description);
      formData.append('address', address || '');
      formData.append('area', area || '');
      formData.append('latitude', location?.latitude ?? '');
      formData.append('longitude', location?.longitude ?? '');
      formData.append('aiConfidence', aiConfidence ?? '');
      formData.append('aiLabel', aiLabel || '');
      formData.append('priority', priority);
      if (phone) formData.append('phone', phone);

      const data = await createComplaint(formData, (e) => {
        const total = e?.total || 0;
        setProgress(total ? Math.round((e.loaded / total) * 100) : 0);
      });
      const created = data?.complaint || data || {};
      setSuccess({
        trackingId: created?.trackingId || '',
        id: created?._id || '',
      });
    } catch (err) {
      setErrors({ form: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const descriptionLength = description.length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Report Waste"
          subtitle="Upload a photo, describe the issue and drop a pin so our field team can reach it quickly."
        />

        {success ? (
          <div className={`${CARD} p-6`}>
            <div className={SUCCESS_ALERT}>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5" />
                <div>
                  <p className="font-semibold">Complaint submitted successfully.</p>
                  <p className="mt-1">
                    Your tracking ID is{' '}
                    <span className="font-mono font-bold">{success.trackingId || '—'}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {success.id ? (
                <Link to={`/complaints/${success.id}`} className={BTN_PRIMARY}>
                  View complaint
                </Link>
              ) : null}
              <button type="button" className={BTN_SECONDARY} onClick={resetForm}>
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.form ? <div className={ERROR_ALERT}>{errors.form}</div> : null}

            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center gap-3">
                <StepBadge>1</StepBadge>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Upload a photo</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">A clear photo helps our AI and field team identify the waste.</p>
                </div>
              </div>
              <ImageUploader
                label="Waste photo"
                file={file}
                preview={preview}
                onFileChange={handleFileChange}
                error={errors.file}
                required
                disabled={submitting}
                helperText="JPG, PNG or WEBP. Capture the waste clearly."
              />

              {aiState === 'checking' ? (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <AutorenewIcon className="animate-spin" fontSize="small" />
                  Verifying image with AI...
                </div>
              ) : null}

              {aiState === 'valid' ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">AI Verification passed</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {Number(aiConfidence ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Detected: {aiLabel || 'waste'}
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-500/20">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, Number(aiConfidence ?? 0)))}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {aiState === 'invalid' ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <div className="flex items-start gap-2">
                    <ErrorOutlineIcon fontSize="small" className="mt-0.5" />
                    <span>
                      This image does not appear to contain waste (confidence {Number(aiConfidence ?? 0).toFixed(1)}%).
                      Please upload a clear photo of the waste.
                    </span>
                  </div>
                </div>
              ) : null}

              {aiState === 'unavailable' ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <div className="flex items-start gap-2">
                    <SyncProblemIcon fontSize="small" className="mt-0.5" />
                    <span>
                      Automatic AI verification is currently unavailable. You can continue and submit your report — our team
                      will review the photo manually.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center gap-3">
                <StepBadge>2</StepBadge>
                <h2 className="font-bold text-slate-900 dark:text-white">Waste type &amp; priority</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="wasteType">Waste type <span className="text-rose-500">*</span></label>
                  <select
                    id="wasteType"
                    className={INPUT}
                    value={wasteType}
                    disabled={submitting}
                    onChange={(e) => {
                      setWasteType(e.target.value);
                      setErrors((prev) => ({ ...prev, wasteType: '' }));
                    }}
                  >
                    <option value="">Select waste type</option>
                    {wasteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.wasteType ? <p className={FIELD_ERROR}>{errors.wasteType}</p> : null}
                </div>
                <div>
                  <label className={LABEL} htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    className={INPUT}
                    value={priority}
                    disabled={submitting}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {priorityOptions.length === 0 ? <option value="medium">Medium</option> : null}
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center gap-3">
                <StepBadge>3</StepBadge>
                <h2 className="font-bold text-slate-900 dark:text-white">Describe the issue</h2>
              </div>
              <label className={LABEL} htmlFor="description">Description <span className="text-rose-500">*</span></label>
              <textarea
                id="description"
                className={INPUT}
                rows={4}
                maxLength={500}
                placeholder="Tell us what the waste looks like, how much there is and any landmark nearby..."
                value={description}
                disabled={submitting}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors((prev) => ({ ...prev, description: '' }));
                }}
              />
              <div className="mt-1.5 flex items-center justify-between">
                {errors.description
                  ? <p className={FIELD_ERROR}>{errors.description}</p>
                  : <span className="text-xs text-slate-500 dark:text-slate-400">Minimum 10 characters</span>}
                <span className={`text-xs font-medium ${descriptionLength > 500 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {descriptionLength}/500
                </span>
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center gap-3">
                <StepBadge>4</StepBadge>
                <h2 className="font-bold text-slate-900 dark:text-white">Pin the location</h2>
              </div>
              <MapPicker
                value={location}
                onChange={handleLocationChange}
                height={340}
                error={errors.location}
              />
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    className={INPUT}
                    rows={3}
                    readOnly
                    placeholder="Address is filled automatically from the map pin"
                    value={address}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="area">Area</label>
                  <select
                    id="area"
                    className={INPUT}
                    value={area}
                    disabled={submitting}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option value="">Select area</option>
                    {areaOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center gap-3">
                <StepBadge>5</StepBadge>
                <h2 className="font-bold text-slate-900 dark:text-white">Contact (optional)</h2>
              </div>
              <div className="max-w-md">
                <label className={LABEL} htmlFor="phone">Contact phone</label>
                <input
                  id="phone"
                  type="tel"
                  className={INPUT}
                  placeholder="Phone number for field team follow-up"
                  value={phone}
                  disabled={submitting}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {submitting ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <CloudUploadIcon fontSize="small" />
                    Uploading...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" className={BTN_SECONDARY} onClick={resetForm} disabled={submitting}>
                Reset
              </button>
              <button type="submit" className={BTN_PRIMARY} disabled={submitting || aiBlocked}>
                {submitting ? (
                  <>
                    <AutorenewIcon className="animate-spin" fontSize="small" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <AddCircleIcon fontSize="small" />
                    Submit report
                  </>
                )}
              </button>
            </div>

            {aiBlocked && !submitting ? (
              <p className={`${FIELD_ERROR} text-right`}>
                Submission is blocked until a valid waste photo is uploaded.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
