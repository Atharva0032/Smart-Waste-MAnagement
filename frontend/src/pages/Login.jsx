import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import RecyclingIcon from '@mui/icons-material/Recycling';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ThemeToggle from '../components/ThemeToggle';
import { homePathForRole, useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { validateLoginForm } from '../utils/validators';

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const PRIMARY_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@swms.gov', password: 'Admin@123' },
  { role: 'Worker', email: 'worker@swms.gov', password: 'Worker@123' },
  { role: 'Citizen', email: 'user@swms.gov', password: 'User@123' }
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const { valid, errors: fieldErrors } = validateLoginForm({ email, password });
    setErrors(fieldErrors);
    if (!valid) return;

    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      const redirectTo = location.state?.from?.pathname || homePathForRole(loggedInUser?.role);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
    setSubmitError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
            <RecyclingIcon />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            SmartWaste
          </span>
        </Link>

        <div className={`${CARD} p-7 sm:p-8`}>
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
              <LockOutlinedIcon />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Sign in to manage and track waste complaints.
            </p>
          </div>

          {submitError && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <ErrorOutlineIcon fontSize="small" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className={LABEL}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={INPUT}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={LABEL}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.password}</p>
              )}
            </div>

            <button type="submit" disabled={submitting} className={PRIMARY_BTN}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Demo credentials
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-white dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {account.role}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {account.email} / {account.password}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
                Create one
              </Link>
            </p>
            <p>
              Just tracking?{' '}
              <Link to="/track" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
                Track a complaint
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
