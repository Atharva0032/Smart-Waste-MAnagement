import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// OpenStreetMap tile layer shared by every map in the app.
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_CENTER = [20.5937, 78.9629]; // Geographic center of India.

const markerPin = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Leaflet ships marker images referenced by a broken default path under bundlers.
// Patch the default prototype icon at module scope so every Marker renders correctly.
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
  L.Marker.prototype.options.icon = markerPin;
}

const MapEvents = ({ onPick }) => {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const Recenter = ({ position }) => {
  const map = useMap();
  // Compare coordinates by value so the map is not recentred on every render.
  const positionKey = position ? position.join(',') : '';

  useEffect(() => {
    if (position) {
      map.setView(position, 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey, map]);

  return null;
};

const MapPicker = ({ value, onChange, height = 320, error }) => {
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState('');

  const hasValue =
    value && typeof value.latitude === 'number' && typeof value.longitude === 'number';
  const center = hasValue ? [value.latitude, value.longitude] : DEFAULT_CENTER;
  const zoom = hasValue ? 16 : 5;
  const position = hasValue ? [value.latitude, value.longitude] : null;

  const reverseGeocode = async (latitude, longitude) => {
    setGeocoding(true);
    setMessage('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      const address = data?.display_name || '';
      const parts = data?.address || {};
      const area = parts.suburb || parts.city_district || parts.city || parts.county || 'Unspecified';

      onChange?.({ latitude, longitude, address, area });
    } catch (geocodeError) {
      // Coordinates are still useful even when reverse geocoding is unavailable.
      setMessage('Could not fetch the address for this point. Coordinates were saved.');
      onChange?.({ latitude, longitude, address: '' });
    } finally {
      setGeocoding(false);
    }
  };

  const handlePick = (latitude, longitude) => {
    reverseGeocode(latitude, longitude);
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMessage('Geolocation is not supported by this browser.');
      return;
    }

    setLocating(true);
    setMessage('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setMessage('Unable to retrieve your current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const busy = locating || geocoding;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Pick the location on the map
        </span>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <MyLocationIcon fontSize="inherit" />
          {locating ? 'Locating...' : 'Use my current location'}
        </button>
      </div>

      <div
        className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
          <MapEvents onPick={handlePick} />
          <Recenter position={position} />
          {position ? <Marker position={position} icon={markerPin} /> : null}
        </MapContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {busy ? (
          <span className="text-slate-500 dark:text-slate-400">
            {geocoding ? 'Looking up address...' : 'Finding your location...'}
          </span>
        ) : null}
        {hasValue ? (
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </span>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">Click anywhere on the map to drop a pin.</span>
        )}
        {value?.area ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {value.area}
          </span>
        ) : null}
      </div>

      {value?.address ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{value.address}</p>
      ) : null}

      {message ? (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{message}</p>
      ) : null}

      {error ? <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
};

export default MapPicker;
