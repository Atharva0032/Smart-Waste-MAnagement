import React from 'react';
import { getStatusMeta } from '../utils/constants';
import { formatDateTime } from '../utils/format';

const Timeline = ({ items = [], loading = false }) => {
  const list = Array.isArray(items) ? items : [];

  if (loading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex gap-3">
            <span className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No timeline activity yet.</p>
    );
  }

  return (
    <ol className="relative space-y-6 border-l border-slate-200 pl-6 dark:border-slate-800">
      {list.map((item, index) => {
        const meta = getStatusMeta(item?.status);
        return (
          <li key={item?._id || `${item?.status || 'event'}-${index}`} className="relative">
            <span
              className="absolute -left-[30px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900"
              style={{ backgroundColor: meta.hex }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {meta.label}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(item?.timestamp)}
              </span>
            </div>
            {item?.note ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.note}</p>
            ) : null}
            {item?.updatedBy?.name ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                by {item.updatedBy.name}
                {item.updatedBy.role ? ` · ${item.updatedBy.role}` : ''}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

export default Timeline;
