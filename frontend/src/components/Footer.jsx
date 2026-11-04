import React from 'react';
import { Link } from 'react-router-dom';
import RecycleIcon from '@mui/icons-material/Recycling';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const QUICK_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/track', label: 'Track Complaint' },
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600">
                <RecycleIcon fontSize="small" className="text-white" />
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">SmartWaste</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              A smart waste management platform that helps citizens report waste, enables workers to
              resolve complaints quickly, and gives administrators real-time visibility.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-slate-500 transition hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <EmailIcon fontSize="small" className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" />
                <a
                  href="mailto:support@smartwaste.example"
                  className="transition hover:text-teal-600 dark:hover:text-teal-400"
                >
                  support@smartwaste.example
                </a>
              </li>
              <li className="flex items-start gap-2">
                <PhoneIcon fontSize="small" className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" />
                <a
                  href="tel:+911800123456"
                  className="transition hover:text-teal-600 dark:hover:text-teal-400"
                >
                  +91 1800 123 456
                </a>
              </li>
              <li className="flex items-start gap-2">
                <LocationOnIcon fontSize="small" className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Municipal Corporation, Green Avenue, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row">
          <p>© {year} Smart Waste Management System. All rights reserved.</p>
          <p>Built for cleaner, smarter cities.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
