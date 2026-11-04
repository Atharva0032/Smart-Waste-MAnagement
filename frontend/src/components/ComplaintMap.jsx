import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { resolveImageUrl } from '../services/api';
import { getStatusMeta, getWasteTypeMeta } from '../utils/constants';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const FitBounds = ({ points }) => {
  const map = useMap();
  // Serialize coordinates so the effect re-runs only when the set of points changes.
  const boundsKey = points.map((point) => point.join(',')).join('|');

  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 13));
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, map]);

  return null;
};

const ComplaintMap = ({
  complaints = [],
  height = 420,
  center = null,
  zoom = 12,
  showPopupLink = true,
}) => {
  const list = Array.isArray(complaints) ? complaints : [];

  // Only complaints with usable numeric coordinates can be plotted.
  const mappable = useMemo(
    () =>
      list.filter(
        (complaint) =>
          typeof complaint?.location?.latitude === 'number' &&
          typeof complaint?.location?.longitude === 'number'
      ),
    [list]
  );

  const points = useMemo(
    () => mappable.map((complaint) => [complaint.location.latitude, complaint.location.longitude]),
    [mappable]
  );

  const initialCenter =
    Array.isArray(center) && center.length === 2
      ? center
      : points.length > 0
        ? points[0]
        : [20.5937, 78.9629];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        <FitBounds points={points} />

        {mappable.map((complaint) => {
          const statusMeta = getStatusMeta(complaint?.status);
          const wasteMeta = getWasteTypeMeta(complaint?.wasteType);
          const thumb = resolveImageUrl(complaint?.image);

          return (
            <CircleMarker
              key={complaint?._id}
              center={[complaint.location.latitude, complaint.location.longitude]}
              radius={9}
              pathOptions={{
                color: statusMeta.hex,
                fillColor: statusMeta.hex,
                fillOpacity: 0.65,
                weight: 2,
              }}
            >
              <Popup>
                <div className="w-44 space-y-1.5">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={complaint?.trackingId || 'Complaint'}
                      className="h-24 w-full rounded-md object-cover"
                    />
                  ) : null}
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    {complaint?.trackingId}
                  </p>
                  <p className="text-xs text-slate-600">{wasteMeta.label}</p>
                  <p className="text-xs font-medium" style={{ color: statusMeta.hex }}>
                    {statusMeta.label}
                  </p>
                  {complaint?.location?.area ? (
                    <p className="text-xs text-slate-500">{complaint.location.area}</p>
                  ) : null}
                  {showPopupLink ? (
                    <Link
                      to={`/complaints/${complaint?._id}`}
                      className="inline-block text-xs font-semibold text-teal-700 hover:underline"
                    >
                      View details
                    </Link>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {mappable.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-950/70">
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No complaints with location data to display.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default ComplaintMap;
