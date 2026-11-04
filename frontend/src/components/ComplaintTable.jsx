import React, { useState } from 'react';
import ImageIcon from '@mui/icons-material/Image';
import InboxIcon from '@mui/icons-material/Inbox';
import { resolveImageUrl } from '../services/api';
import { getWasteTypeMeta } from '../utils/constants';
import { formatDate, truncate } from '../utils/format';
import StatusBadge from './StatusBadge';
import EmptyState from './EmptyState';

const Thumbnail = ({ src, size = 'h-12 w-12' }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`flex ${size} items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600`}
      >
        <ImageIcon fontSize="small" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className={`${size} rounded-lg object-cover`}
    />
  );
};

const WasteTypeChip = ({ value }) => {
  const meta = getWasteTypeMeta(value);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
};

const ComplaintTable = ({
  complaints = [],
  loading = false,
  renderActions,
  onRowClick,
  showCitizen = false,
  emptyMessage = 'No complaints found.',
}) => {
  const list = Array.isArray(complaints) ? complaints : [];

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="flex items-center gap-4">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700 md:block" />
              <div className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon fontSize="large" />}
        title="Nothing here yet"
        message={emptyMessage}
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tracking ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Waste Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Area
                </th>
                {showCitizen ? (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Citizen
                  </th>
                ) : null}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {list.map((complaint) => (
                <tr
                  key={complaint?._id}
                  onClick={onRowClick ? () => onRowClick(complaint) : undefined}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      : ''
                  }
                >
                  <td className="px-4 py-3">
                    <Thumbnail src={resolveImageUrl(complaint?.image)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {complaint?.trackingId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <WasteTypeChip value={complaint?.wasteType} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {complaint?.location?.area || '—'}
                  </td>
                  {showCitizen ? (
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {complaint?.user?.name || '—'}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <StatusBadge status={complaint?.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(complaint?.createdAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderActions ? renderActions(complaint) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 md:hidden">
        {list.map((complaint) => (
          <div
            key={complaint?._id}
            onClick={onRowClick ? () => onRowClick(complaint) : undefined}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
              onRowClick ? 'cursor-pointer' : ''
            }`}
          >
            <div className="flex gap-3">
              <Thumbnail src={resolveImageUrl(complaint?.image)} size="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {complaint?.trackingId}
                  </span>
                  <StatusBadge status={complaint?.status} size="sm" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <WasteTypeChip value={complaint?.wasteType} />
                  {complaint?.location?.area ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {complaint.location.area}
                    </span>
                  ) : null}
                </div>
                {showCitizen && complaint?.user?.name ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {complaint.user.name}
                  </p>
                ) : null}
                {complaint?.description ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {truncate(complaint.description, 90)}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(complaint?.createdAt)}
                </p>
              </div>
            </div>
            {renderActions ? (
              <div
                className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"
                onClick={(event) => event.stopPropagation()}
              >
                {renderActions(complaint)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
};

export default ComplaintTable;
