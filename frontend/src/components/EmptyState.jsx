import React from 'react';

const EmptyState = ({ icon, title, message, action }) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/60">
      {icon ? (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {icon}
        </span>
      ) : null}
      {title ? (
        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      ) : null}
      {message ? (
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
