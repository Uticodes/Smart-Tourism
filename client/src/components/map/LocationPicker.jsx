import { useEffect, useId, useRef, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import MapView, { ABUJA_CENTRE } from './MapView.jsx';
import { AttractionPin } from './Pins.jsx';
import { lookupPlaces } from '../../api/attractions.js';
import { inFCT } from '../../lib/format.js';
import { metres } from '../../lib/geo.js';

// Approximate FCT bounding box (left,top,right,bottom) for OpenStreetMap Nominatim.
const FCT_VIEWBOX = '6.70,9.40,7.70,8.30';
const round = (n) => Number(Number(n).toFixed(6));

async function searchNominatim(q, signal) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '6',
    countrycodes: 'ng',
    viewbox: FCT_VIEWBOX,
    bounded: '1',
    addressdetails: '1',
  }).toString();
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Accept-Language': 'en' },
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || [])
    .map((item) => {
      const lat = round(item.lat);
      const lng = round(item.lon);
      const parts = (item.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
      const name = item.name || parts[0] || q;
      const address = parts
        .filter((p, i) => i > 0 && p !== name && !/^(\d{6}|Nigeria|Federal Capital Territory|Municipal Area Council)$/i.test(p))
        .slice(0, 3)
        .join(', ');
      return {
        id: `osm-${item.place_id || `${lat},${lng}`}`,
        name,
        address: address || 'Abuja, FCT',
        lat,
        lng,
      };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && inFCT(p));
}

function mergePlaces(localList = [], osmList = []) {
  const merged = [];
  for (const candidate of [...localList, ...osmList]) {
    if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng) || !inFCT(candidate)) continue;
    const norm = candidate.name.trim().toLocaleLowerCase();
    const exists = merged.some(
      (m) => m.name.trim().toLocaleLowerCase() === norm && metres(m, candidate) < 300
    );
    if (!exists) merged.push({ ...candidate, lat: round(candidate.lat), lng: round(candidate.lng) });
    if (merged.length >= 6) break;
  }
  return merged;
}

/** Search for a place in Abuja, click the map, or drag the pin to choose a point. */
export default function LocationPicker({ value, onChange, className = 'h-[340px]' }) {
  const searchId = useId();
  const hasPoint = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const centre = hasPoint ? value : ABUJA_CENTRE;

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [chosenName, setChosenName] = useState('');
  const boxRef = useRef(null);
  const abortRef = useRef(null);
  const skipNextDebounce = useRef(false);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function runSearch(rawQuery, pickFirst = false) {
    const q = rawQuery.trim();
    if (q.length < 2) {
      setMatches([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setNotice('');

    try {
      const [localRes, osmRes] = await Promise.allSettled([
        lookupPlaces(q, controller.signal),
        searchNominatim(q, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      const localPlaces = localRes.status === 'fulfilled' ? localRes.value : [];
      const osmPlaces = osmRes.status === 'fulfilled' ? osmRes.value : [];
      const list = mergePlaces(localPlaces, osmPlaces);
      setMatches(list);

      if (list.length === 0) {
        setOpen(false);
        setNotice('No matching place found in the FCT. Try another name or click the map to drop a pin.');
      } else if (pickFirst) {
        choosePlace(list[0], list.length > 1);
      } else {
        setOpen(true);
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  useEffect(() => {
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return undefined;
    }
    const q = query.trim();
    if (q.length < 2) {
      abortRef.current?.abort();
      setMatches([]);
      setOpen(false);
      setSearching(false);
      return undefined;
    }
    const timer = setTimeout(() => runSearch(q, false), 300);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function choosePlace(place, keepListOpen = false) {
    skipNextDebounce.current = true;
    setQuery(place.name);
    setChosenName(place.name);
    setNotice('');
    setOpen(keepListOpen);
    onChange({ lat: round(place.lat), lng: round(place.lng), name: place.name, address: place.address });
  }

  function clearSearch() {
    abortRef.current?.abort();
    setQuery('');
    setMatches([]);
    setOpen(false);
    setNotice('');
    setSearching(false);
  }

  return (
    <div>
      <div className="relative mb-3" ref={boxRef}>
        <label htmlFor={searchId} className="sr-only">Search for a place in Abuja</label>
        <div className="flex items-center gap-2">
          <input
            id={searchId}
            type="search"
            className="field"
            placeholder="Search for a place (e.g. Thought Pyramid Art Centre)…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotice('');
            }}
            onFocus={() => { if (matches.length) setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch(query, true);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          <button
            type="button"
            className="btn-quiet shrink-0 !py-2.5"
            onClick={() => runSearch(query, true)}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
          {query && (
            <button type="button" className="btn-quiet shrink-0 !py-2.5" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>

        {open && matches.length > 0 && (
          <ul
            role="listbox"
            aria-label="Matching places in Abuja"
            className="absolute left-0 right-0 z-[1000] mt-1 max-h-60 divide-y divide-granite-200 overflow-y-auto rounded-md border border-granite-200 bg-surface shadow-lg"
          >
            {matches.map((m) => (
              <li key={m.id} role="option" aria-selected={chosenName === m.name}>
                <button
                  type="button"
                  onClick={() => choosePlace(m, false)}
                  className="w-full px-3.5 py-2.5 text-left transition-colors hover:bg-green-50 focus:bg-green-50 focus:outline-none"
                >
                  <span className="block text-sm font-semibold text-granite-900">{m.name}</span>
                  {m.address && <span className="block text-xs text-granite-700">{m.address}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice && <p className="mb-2 text-sm text-granite-700" role="status">{notice}</p>}

      <MapView
        center={centre}
        zoom={hasPoint ? 16 : 11}
        className={className}
        gestureHandling="greedy"
        onMapClick={(p) => {
          setChosenName('');
          onChange({ lat: round(p.lat), lng: round(p.lng) });
        }}
      >
        {hasPoint && (
          <AdvancedMarker
            position={{ lat: value.lat, lng: value.lng }}
            draggable
            title="Drag to adjust"
            onDragEnd={(e) => {
              if (!e.latLng) return;
              setChosenName('');
              onChange({ lat: round(e.latLng.lat()), lng: round(e.latLng.lng()) });
            }}
          >
            <AttractionPin selected />
          </AdvancedMarker>
        )}
      </MapView>
      <p className="mt-2 text-sm text-granite-500">
        {hasPoint
          ? `Pin at ${value.lat}, ${value.lng}${chosenName ? ` (${chosenName})` : ''}. Drag it or click elsewhere to move it.`
          : 'Search for a place above, or click the map to drop a pin.'}
      </p>
    </div>
  );
}
