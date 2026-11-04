import { Link } from 'react-router-dom';
import RecyclingIcon from '@mui/icons-material/Recycling';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ThemeToggle from '../components/ThemeToggle';

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900';
const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-center dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
          <RecyclingIcon />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          SmartWaste
        </span>
      </Link>

      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
        <RecyclingIcon sx={{ fontSize: 40 }} />
      </span>

      <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
        Error 404
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved. Let&apos;s get you
        back on track.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/" className={PRIMARY_BTN}>
          <HomeIcon fontSize="small" />
          Back to home
        </Link>
        <Link to="/track" className={SECONDARY_BTN}>
          <SearchIcon fontSize="small" />
          Track a complaint
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
