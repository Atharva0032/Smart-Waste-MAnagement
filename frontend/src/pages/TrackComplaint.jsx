import { useState } from 'react';
import { Link } from 'react-router-dom';
import RecyclingIcon from '@mui/icons-material/Recycling';
import SearchIcon from '@mui/icons-material/Search';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CategoryIcon from '@mui/icons-material/Category';
import ThemeToggle from '../components/ThemeToggle';
import Timeline from '../components/Timeline';
import ComplaintMap from '../components/ComplaintMap';
import { trackComplaint } from '../services/complaintService';
import { getErrorMessage, resolveImageUrl } from '../services/api';
import { getStatusMeta, getWasteTypeMeta } from '../utils/constants';
import { formatDate } from '../utils/format';

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';

function TrackComplaint() {
  const [trackingId, setTrackingId] = useState('');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const id = trackingId.trim();
    if (!id) {
      setError('Enter a tracking ID to continue.');
      return;
    }

    setLoading(true);
    setError('');
    setNotFound(false);
    setComplaint(null);

    try {
      const data = await trackComplaint(id);
      if (data?.complaint) {
        setComplaint(data.complaint);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = complaint ? getStatusMeta(complaint.status) : null;
  const wasteMeta = complaint ? getWasteTypeMeta(complaint.wasteType) : null;
  const hasCoords =
    complaint &&
    typeof complaint.location?.latitude === 'number' &&
    typeof complaint.location?.longitude === 'number';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
              <RecyclingIcon fontSize="small" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              SmartWaste
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
            <SearchIcon />
          </span>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Track a complaint</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Enter the tracking ID from your complaint confirmation, for example{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">SWM-4F9A2C</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={`${CARD} mt-8 p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value.toUpperCase())}
              placeholder="SWM-XXXXXX"
              aria-label="Tracking ID"
              className={`${INPUT} font-mono`}
            />
            <button type="submit" disabled={loading} className={PRIMARY_BTN}>
              <SearchIcon fontSize="small" />
              {loading ? 'Searching…' : 'Track'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <ErrorOutlineIcon fontSize="small" />
            <span>{error}</span>
          </div>
        )}

        {notFound && (
          <div className={`${CARD} mt-6 p-8 text-center`}>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <SearchOffIcon />
            </span>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              No complaint found
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Check the tracking ID and try again. IDs look like{' '}
              <span className="font-mono">SWM-4F9A2C</span>.
            </p>
          </div>
        )}

        {complaint && (
          <div className={`${CARD} mt-8 overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tracking ID
                </p>
                <p className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                  {complaint.trackingId}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badge}`}
              >
                {statusMeta.label}
              </span>
            </div>

            {complaint.image && (
              <img
                src={resolveImageUrl(complaint.image)}
                alt="Reported waste"
                className="h-64 w-full object-cover"
              />
            )}

            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <CategoryIcon fontSize="small" className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Waste type
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: wasteMeta.color }}
                      aria-hidden="true"
                    />
                    {wasteMeta.label}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <LocationOnIcon fontSize="small" className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Area
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {complaint.location?.area || '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CalendarTodayIcon fontSize="small" className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Reported
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formatDate(complaint.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {complaint.description && (
              <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Description
                </p>
                <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">
                  {complaint.description}
                </p>
              </div>
            )}

            {hasCoords && (
              <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Location
                </p>
                <ComplaintMap
                  complaints={[complaint]}
                  height={260}
                  center={[complaint.location.latitude, complaint.location.longitude]}
                  zoom={15}
                />
              </div>
            )}

            <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Progress timeline
              </p>
              <Timeline items={complaint.timeline} />
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Need the full detail, notes and worker info?{' '}
          <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

export default TrackComplaint;
