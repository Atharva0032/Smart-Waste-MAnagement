import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import MapIcon from '@mui/icons-material/Map';
import HomeIcon from '@mui/icons-material/Home';
import RecycleIcon from '@mui/icons-material/Recycling';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAuth } from '../context/AuthContext';

const NAV_BY_ROLE = {
  user: [
    { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
    { to: '/complaints/new', label: 'Report Waste', icon: AddCircleIcon },
    { to: '/complaints', label: 'My Complaints', icon: ListAltIcon },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: DashboardIcon },
    { to: '/admin/complaints', label: 'All Complaints', icon: AssignmentIcon },
    { to: '/admin/workers', label: 'Workers', icon: PeopleIcon },
  ],
  worker: [
    { to: '/worker', label: 'Dashboard', icon: DashboardIcon },
    { to: '/worker/complaints', label: 'Assigned Complaints', icon: AssignmentIcon },
  ],
};

const SHARED_LINKS = [
  { to: '/track', label: 'Public Tracker', icon: MapIcon },
  { to: '/', label: 'Back to site', icon: HomeIcon },
];

const isLinkActive = (pathname, to) => {
  if (to === '/') {
    return pathname === '/';
  }
  return pathname === to;
};

const Sidebar = ({ collapsed, onToggle }) => {
  const { role } = useAuth();
  const location = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Support both controlled and self-managed collapse behaviour.
  const isCollapsed = typeof collapsed === 'boolean' ? collapsed : internalCollapsed;

  const handleToggle = () => {
    if (typeof onToggle === 'function') {
      onToggle();
    } else {
      setInternalCollapsed((value) => !value);
    }
  };

  const roleLinks = NAV_BY_ROLE[role] || NAV_BY_ROLE.user;

  const renderLink = (link) => {
    const active = isLinkActive(location.pathname, link.to);
    const Icon = link.icon;

    return (
      <li key={link.to}>
        <Link
          to={link.to}
          title={link.label}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            isCollapsed ? 'lg:justify-center' : ''
          } ${
            active
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Icon fontSize="small" className="shrink-0" />
          <span className={isCollapsed ? 'lg:hidden' : ''}>{link.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={`flex h-full w-full flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 ${
        isCollapsed ? 'lg:w-20' : 'lg:w-64'
      }`}
    >
      <div
        className={`flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800 ${
          isCollapsed ? 'lg:justify-center' : 'gap-2'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600">
          <RecycleIcon fontSize="small" className="text-white" />
        </span>
        <span
          className={`text-lg font-bold text-slate-900 dark:text-white ${
            isCollapsed ? 'lg:hidden' : ''
          }`}
        >
          SmartWaste
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {roleLinks.map(renderLink)}
        </ul>

        <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

        <ul className="space-y-1">
          {SHARED_LINKS.map(renderLink)}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${
            isCollapsed ? 'lg:justify-center' : ''
          }`}
        >
          {isCollapsed ? (
            <ChevronRightIcon fontSize="small" className="shrink-0" />
          ) : (
            <ChevronLeftIcon fontSize="small" className="shrink-0" />
          )}
          <span className={isCollapsed ? 'lg:hidden' : ''}>Collapse</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
