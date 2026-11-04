import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ImageIcon from '@mui/icons-material/Image';
import { resolveImageUrl } from '../services/api';
import { getWasteTypeMeta } from '../utils/constants';
import { formatDate, truncate } from '../utils/format';
import StatusBadge from './StatusBadge';

const ComplaintCard = ({ complaint, to, children }) => {
  const [imageError, setImageError] = useState(false);

  if (!complaint) {
    return null;
  }

  const linkTo = to || `/complaints/${complaint._id}`;
  const wasteMeta = getWasteTypeMeta(complaint.wasteType);
  const imageSrc = resolveImageUrl(complaint.image);
  const confidence = complaint?.aiVerification?.confidence;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link
        to={linkTo}
        className="block transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <div className="flex gap-4 p-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
            {imageSrc && !imageError ? (
              <img
                src={imageSrc}
                alt={complaint.trackingId || 'Complaint'}
                className="h-full w-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-600">
                <ImageIcon />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                {complaint.trackingId}
              </span>
              <StatusBadge status={complaint.status} size="sm" />
              {typeof confidence === 'number' ? (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                  AI {confidence}%
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${wasteMeta.color}1a`, color: wasteMeta.color }}
              >
                {wasteMeta.label}
              </span>
              {complaint?.location?.area ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {complaint.location.area}
                </span>
              ) : null}
            </div>

            {complaint.description ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {truncate(complaint.description, 110)}
              </p>
            ) : null}

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {formatDate(complaint.createdAt)}
            </p>
          </div>
        </div>
      </Link>

      {children ? (
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">{children}</div>
      ) : null}
    </div>
  );
};

export default ComplaintCard;
