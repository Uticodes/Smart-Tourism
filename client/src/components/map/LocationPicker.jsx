import { Marker } from 'react-leaflet';
import MapView, { ABUJA_CENTRE } from './MapView.jsx';
import { attractionIcon } from './pins.js';

/** Click the map (or drag the pin) to choose a point. Used by the admin form and, later, site reports. */
export default function LocationPicker({ value, onChange, className = 'h-[340px]' }) {
  const hasPoint = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const centre = hasPoint ? value : ABUJA_CENTRE;
  const round = (n) => Number(n.toFixed(6));

  return (
    <div>
      <MapView center={centre} zoom={hasPoint ? 15 : 11} className={className} onMapClick={(p) => onChange({ lat: round(p.lat), lng: round(p.lng) })}>
        {hasPoint && (
          <Marker
            position={[value.lat, value.lng]}
            icon={attractionIcon({ selected: true })}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onChange({ lat: round(p.lat), lng: round(p.lng) });
              },
            }}
          />
        )}
      </MapView>
      <p className="mt-2 text-sm text-granite-500">
        {hasPoint ? `Pin at ${value.lat}, ${value.lng}. Drag it or click elsewhere to move it.` : 'Click the map to drop a pin.'}
      </p>
    </div>
  );
}
