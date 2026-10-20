import { useEffect } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { attractionIcon, userIcon } from './pins.js';

export const ABUJA_CENTRE = { lat: 9.0579, lng: 7.4951, label: 'Abuja city centre' };

// OpenStreetMap tiles. Attribution is required by the OSM tile usage policy.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Moves the map when `center` or `bounds` change, without remounting it. */
function Viewport({ center, zoom, bounds, maxZoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const container = map.getContainer();
      if (!container.clientWidth || !container.clientHeight) return;
      map.invalidateSize();
      if (bounds && bounds.length > 1) map.fitBounds(bounds, { padding: [44, 44], maxZoom });
      else if (center) map.setView([center.lat, center.lng], zoom ?? map.getZoom());
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, center?.lat, center?.lng, zoom, maxZoom, JSON.stringify(bounds)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * Shared map used by Explore (results), the details page and the admin form.
 * markers: [{ id, lat, lng, name, source }]
 * renderPopup(marker): optional info window content shown when a pin is clicked.
 */
export default function MapView({
  center = ABUJA_CENTRE,
  zoom = 12,
  markers = [],
  selectedId,
  onSelect,
  userPosition,
  radiusKm,
  fitToMarkers = false,
  bounds: boundsOverride,
  onMapClick,
  renderPopup,
  fitMaxZoom,
  className = 'h-[420px]',
  children,
}) {
  const bounds = boundsOverride || (fitToMarkers && markers.length
    ? [
        ...markers.map((m) => [m.lat, m.lng]),
        ...(userPosition ? [[userPosition.lat, userPosition.lng]] : []),
      ]
    : null);

  return (
    <div className={`overflow-hidden rounded-lg border border-granite-200 ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} zoomSnap={0.25} zoomDelta={0.5} scrollWheelZoom className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        <Viewport center={center} zoom={zoom} bounds={bounds} maxZoom={fitMaxZoom} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}

        {userPosition && radiusKm && (
          <Circle
            center={[userPosition.lat, userPosition.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#0A7A4B', weight: 1.5, fillOpacity: 0.05, dashArray: '6 6' }}
          />
        )}
        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} keyboard={false}>
            <Tooltip direction="top" offset={[0, -8]}>{userPosition.label || 'Search point'}</Tooltip>
          </Marker>
        )}

        {markers.map((m) => {
          const isSelected = m.id === selectedId;
          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={attractionIcon({ source: m.source, selected: isSelected })}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{ click: () => onSelect?.(m.id) }}
              title={m.name}
            >
              {renderPopup ? (
                <Popup offset={[0, -18]}>{renderPopup(m)}</Popup>
              ) : (
                <Tooltip
                  key={`${m.id}-${isSelected}`}
                  direction="top"
                  offset={[0, isSelected ? -52 : -24]}
                  permanent={isSelected}
                  className={isSelected ? 'selected-tooltip' : ''}
                >
                  {m.name}
                </Tooltip>
              )}
            </Marker>
          );
        })}
        {children}
      </MapContainer>
    </div>
  );
}
