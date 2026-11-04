import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RecyclingIcon from '@mui/icons-material/Recycling';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PersonIcon from '@mui/icons-material/Person';
import EngineeringIcon from '@mui/icons-material/Engineering';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ThemeToggle from '../components/ThemeToggle';
import { homePathForRole, useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { validateRegisterForm } from '../utils/validators';

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const PRIMARY_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900';

const ROLE_OPTIONS = [
  {
    value: 'user',
    label: 'Citizen',
    description: 'Report and track waste issues in your area.',
    icon: <PersonIcon />
  },
  {
    value: 'worker',
    label: 'Municipal Worker',
    description: 'Handle assigned complaints in the field.',
    icon: <EngineeringIcon />
  }
];

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const { valid, errors: fieldErrors } = validateRegisterForm(form);
    setErrors(fieldErrors);
    if (!valid) return;

    setSubmitting(true);
    try {
      const newUser = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role
      });
      navigate(homePathForRole(newUser?.role), { replace: true });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg">
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
              <PersonAddAltIcon />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Join the network making waste reporting fast and accountable.
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
              <label htmlFor="name" className={LABEL}>
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Jane Doe"
                className={INPUT}
              />
              {errors.name && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className={LABEL}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="you@example.com"
                  className={INPUT}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className={LABEL}>
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="+91 98765 43210"
                  className={INPUT}
                />
                {errors.phone && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.phone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className={LABEL}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="At least 6 characters"
                    className={`${INPUT} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className={LABEL}>
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="Re-enter password"
                    className={`${INPUT} pr-11`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <div>
              <span className={LABEL}>I am a</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ROLE_OPTIONS.map((option) => {
                  const selected = form.role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField('role', option.value)}
                      aria-pressed={selected}
                      className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                        selected
                          ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500 dark:border-teal-500 dark:bg-teal-500/10'
                          : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                          selected
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {option.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.role && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.role}</p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <InfoOutlinedIcon fontSize="small" />
              <span>
                Administrator accounts are seeded by the municipality and cannot be self-registered.
              </span>
            </div>

            <button type="submit" disabled={submitting} className={PRIMARY_BTN}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
