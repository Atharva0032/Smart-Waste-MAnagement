import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RecyclingIcon from '@mui/icons-material/Recycling';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EngineeringIcon from '@mui/icons-material/Engineering';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import InsightsIcon from '@mui/icons-material/Insights';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ThemeToggle from '../components/ThemeToggle';
import Footer from '../components/Footer';
import { WASTE_TYPES } from '../utils/constants';
import { formatNumber } from '../utils/format';

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';
const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const STATS = [
  { value: 12480, suffix: '+', label: 'Complaints resolved' },
  { value: 38, suffix: '', label: 'Zones covered' },
  { value: 96, suffix: '%', label: 'AI match accuracy' },
  { value: 26, suffix: 'h', label: 'Avg. resolution time' }
];

const STEPS = [
  {
    icon: <PhotoCameraIcon />,
    title: 'Report with photo & GPS',
    text: 'Snap the waste pile, add a short description and drop a pin so crews know exactly where to go.'
  },
  {
    icon: <AutoAwesomeIcon />,
    title: 'AI verification',
    text: 'Our model checks the image, confirms it is waste and classifies the waste stream automatically.'
  },
  {
    icon: <EngineeringIcon />,
    title: 'Authority assigns a worker',
    text: 'Municipal admins review, set priority and dispatch the nearest available field worker.'
  },
  {
    icon: <TrackChangesIcon />,
    title: 'Track to resolution',
    text: 'Follow every status change on a live timeline until the area is cleaned and closed.'
  }
];

const FEATURES = [
  {
    icon: <PhotoCameraIcon />,
    title: 'Photo & GPS reporting',
    text: 'Capture evidence and precise coordinates in a single, mobile-friendly form.'
  },
  {
    icon: <AutoAwesomeIcon />,
    title: 'AI waste classification',
    text: 'Automatic detection and tagging of seven waste streams before review.'
  },
  {
    icon: <EngineeringIcon />,
    title: 'Smart worker dispatch',
    text: 'Assign the right crew to the right zone with priority and workload awareness.'
  },
  {
    icon: <TrackChangesIcon />,
    title: 'Live status tracking',
    text: 'Public tracking by ID plus a full audit timeline for every complaint.'
  },
  {
    icon: <InsightsIcon />,
    title: 'Analytics dashboard',
    text: 'Spot trends by zone and waste type with resolution-rate and turnaround metrics.'
  },
  {
    icon: <NotificationsActiveIcon />,
    title: 'Instant notifications',
    text: 'Citizens, workers and admins all stay informed on every status change.'
  }
];

// Animate a number from 0 to `target` once on mount.
function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

function StatCard({ value, suffix, label }) {
  const count = useCountUp(value);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
      <div className="text-2xl font-bold text-white sm:text-3xl">
        {formatNumber(count)}
        {suffix}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  );
}

function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Switch the header from transparent to solid once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinkClass = scrolled
    ? 'text-slate-600 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400'
    : 'text-slate-100 hover:text-white';

  return (
    <div id="top" className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? 'border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
              <RecyclingIcon fontSize="small" />
            </span>
            <span
              className={`text-base font-bold tracking-tight ${
                scrolled ? 'text-slate-900 dark:text-white' : 'text-white'
              }`}
            >
              SmartWaste
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <Link to="/" className={`text-sm font-medium transition ${navLinkClass}`}>
              Home
            </Link>
            <Link to="/track" className={`text-sm font-medium transition ${navLinkClass}`}>
              Track Complaint
            </Link>
            <Link to="/login" className={`text-sm font-medium transition ${navLinkClass}`}>
              Login
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/register" className={`${PRIMARY_BTN} hidden sm:inline-flex`}>
              Register
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden ${
                scrolled ? 'text-slate-700 dark:text-slate-200' : 'text-white'
              }`}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-3">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Home
              </Link>
              <Link
                to="/track"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Track Complaint
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Login
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className={PRIMARY_BTN}>
                Register
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 pb-20 pt-32 dark:bg-slate-950">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-300">
              <AutoAwesomeIcon fontSize="inherit" />
              AI-assisted civic waste management
            </span>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Report civic waste.
              <span className="block bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
                Track it to resolution.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
              A single platform connecting citizens, municipal authorities and field workers — from
              the first photo to a verified, clean result.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register" className={PRIMARY_BTN}>
                Report an Issue
                <ArrowForwardIcon fontSize="small" />
              </Link>
              <Link
                to="/track"
                className={`${SECONDARY_BTN} border-white/20 bg-white/5 text-white hover:bg-white/10 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10`}
              >
                Track a Complaint
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
            How it works
          </h2>
          <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
            Four simple steps take a complaint from spotted on the street to solved.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className={`${CARD} relative p-6`}>
              <span className="absolute right-5 top-5 text-3xl font-bold text-slate-200 dark:text-slate-800">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
                {step.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
              Everything a cleaner city needs
            </h2>
            <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
              Built for citizens, municipal authorities and the crews on the ground.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className={`${CARD} p-6`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waste types */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Every waste stream, handled
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Complaints are classified automatically so the right crew and equipment are dispatched.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {WASTE_TYPES.map((type) => (
            <span
              key={type.value}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: type.color }}
                aria-hidden="true"
              />
              {type.label}
            </span>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 px-8 py-14 text-center shadow-sm">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Spotted waste in your neighbourhood?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-teal-50">
            Report it in under a minute. Your complaint is verified, dispatched and tracked until the
            area is clean.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-600"
            >
              Get started
              <ArrowForwardIcon fontSize="small" />
            </Link>
            <Link
              to="/track"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-600"
            >
              Track a complaint
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Landing;
