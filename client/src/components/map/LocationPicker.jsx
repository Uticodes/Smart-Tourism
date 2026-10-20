import { AdvancedMarker } from '@vis.gl/react-google-maps';
import MapView, { ABUJA_CENTRE } from './MapView.jsx';
import { AttractionPin } from './Pins.jsx';

/** Click the map (or drag the pin) to choose a point. Used by the admin attraction form and the report form. */
export default function LocationPicker({ value, onChange, className = 'h-[340px]' }) {
  const hasPoint = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const centre = hasPoint ? value : ABUJA_CENTRE;
  const round = (n) => Number(n.toFixed(6));

  return (
    <div>
      <MapView center={centre} zoom={hasPoint ? 16 : 11} className={className} gestureHandling="greedy"
        onMapClick={(p) => onChange({ lat: round(p.lat), lng: round(p.lng) })}>
        {hasPoint && (
          <AdvancedMarker
            position={{ lat: value.lat, lng: value.lng }}
            draggable
            title="Drag to adjust"
            onDragEnd={(e) => e.latLng && onChange({ lat: round(e.latLng.lat()), lng: round(e.latLng.lng()) })}
          >
            <AttractionPin selected />
          </AdvancedMarker>
        )}
      </MapView>
      <p className="mt-2 text-sm text-granite-500">
        {hasPoint ? `Pin at ${value.lat}, ${value.lng}. Drag it or click elsewhere to move it.` : 'Click the map to drop a pin.'}
      </p>
    </div>
  );
}
