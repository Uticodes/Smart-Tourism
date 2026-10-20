import { useEffect, useState } from 'react';
import { AdvancedMarker, Circle, InfoWindow, Map, Polyline, useApiLoadingStatus, useMap } from '@vis.gl/react-google-maps';
import { MAPS_KEY, MAP_ID } from './MapsProvider.jsx';
import { AttractionPin, UserDot } from './Pins.jsx';

export const ABUJA_CENTRE = { lat: 9.0579, lng: 7.4951, label: 'Abuja city centre' };

/**
 * Moves the camera when `center` or `bounds` change, without re-creating the map,
 * and frames it again when the map's box changes size (e.g. the mobile Map tab is opened).
 */
function Viewport({ center, zoom, bounds, maxZoom = 15 }) {
  const map = useMap();
  const key = JSON.stringify(bounds || [center?.lat, center?.lng, zoom]);
  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      const el = map.getDiv();
      if (!el.clientWidth || !el.clientHeight) return;
      if (bounds && bounds.length > 1) {
        const b = new window.google.maps.LatLngBounds();
        bounds.forEach(([lat, lng]) => b.extend({ lat, lng }));
        map.fitBounds(b, 44);
        // fitBounds can zoom right in on two close points; cap it.
        const once = window.google.maps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
        });
        return () => once.remove();
      }
      if (center) {
        map.panTo({ lat: center.lat, lng: center.lng });
        if (zoom != null) map.setZoom(zoom);
      }
      return undefined;
    };
    update();
    let last = '';
    const observer = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      if (size !== last) { last = size; update(); }
    });
    observer.observe(map.getDiv());
    return () => observer.disconnect();
  }, [map, key, maxZoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Straight or dashed line, e.g. a route or the gap between a report and the nearest known place. */
export function MapLine({ path, color = '#2B3036', weight = 4, dashed = false, opacity = 1 }) {
  if (!path?.length) return null;
  if (!dashed) return <Polyline path={path} strokeColor={color} strokeWeight={weight} strokeOpacity={opacity} clickable={false} />;
  return (
    <Polyline path={path} strokeOpacity={0} clickable={false}
      icons={[{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: 2, scale: 3 }, offset: '0', repeat: '12px' }]} />
  );
}

function Fallback({ className, children }) {
  return (
    <div className={`grid place-items-center rounded-lg border border-dashed border-granite-200 bg-granite-100/50 p-6 text-center text-sm text-granite-700 ${className}`}>
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

/**
 * Shared Google map used by Home, Explore, the details page, Community, the report form and the admin pages.
 * markers: [{ id, lat, lng, name, source }]
 * renderPopup(marker): optional info-window content shown when a pin is clicked.
 * lines: [{ path: [{lat,lng}], color, dashed }]
 */
export default function MapView({
  center = ABUJA_CENTRE,
  zoom = 12,
  markers = [],
  selectedId,
  onSelect,
  userPosition,
  userHeading = null,
  radiusKm,
  fitToMarkers = false,
  bounds: boundsOverride,
  onMapClick,
  renderPopup,
  fitMaxZoom,
  lines = [],
  gestureHandling = 'cooperative',
  picking = false,
  className = 'h-[420px]',
  children,
}) {
  const status = useApiLoadingStatus();
  const [openId, setOpenId] = useState(null);

  if (!MAPS_KEY) {
    return (
      <Fallback className={className}>
        <p className="font-semibold text-granite-900">Map not configured</p>
        <p className="mt-1">Add <code>VITE_GOOGLE_MAPS_BROWSER_KEY</code> to <code>client/.env</code> and restart <code>npm run dev</code>.</p>
      </Fallback>
    );
  }
  if (status === 'AUTH_FAILURE' || status === 'FAILED') {
    return (
      <Fallback className={className}>
        <p className="font-semibold text-granite-900">The map could not load</p>
        <p className="mt-1">
          {status === 'AUTH_FAILURE'
            ? 'Google rejected the API key. Check that Maps JavaScript API is enabled and that the key allows this address.'
            : 'Check your internet connection and reload the page.'}
        </p>
      </Fallback>
    );
  }

  const bounds = boundsOverride || (fitToMarkers && markers.length
    ? [...markers.map((m) => [m.lat, m.lng]), ...(userPosition ? [[userPosition.lat, userPosition.lng]] : [])]
    : null);
  const open = renderPopup ? markers.find((m) => m.id === openId) : null;

  return (
    <div className={`overflow-hidden rounded-lg border border-granite-200 bg-granite-100 ${className}`}>
      <Map
        mapId={MAP_ID}
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={zoom}
        gestureHandling={gestureHandling}
        clickableIcons={false}
        draggableCursor={picking ? 'crosshair' : undefined}
        mapTypeControl={false}
        streetViewControl={false}
        cameraControl={false}
        fullscreenControl
        onClick={onMapClick ? (e) => e.detail.latLng && onMapClick(e.detail.latLng) : undefined}
        className="h-full w-full"
      >
        <Viewport center={center} zoom={zoom} bounds={bounds} maxZoom={fitMaxZoom} />

        {userPosition && radiusKm && (
          <Circle center={{ lat: userPosition.lat, lng: userPosition.lng }} radius={radiusKm * 1000}
            strokeColor="#0A7A4B" strokeWeight={1.5} strokeOpacity={0.8} fillColor="#0A7A4B" fillOpacity={0.05} clickable={false} />
        )}

        {lines.map((l, i) => <MapLine key={i} {...l} />)}

        {userPosition && (
          <AdvancedMarker position={{ lat: userPosition.lat, lng: userPosition.lng }} title={userPosition.label || 'Search point'}
            anchorLeft="-50%" anchorTop="-50%" zIndex={500}>
            <UserDot heading={userHeading} />
          </AdvancedMarker>
        )}

        {markers.map((m) => (
          <AdvancedMarker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.name}
            zIndex={m.id === selectedId ? 1000 : 1}
            onClick={() => { onSelect?.(m.id); if (renderPopup) setOpenId(m.id); }}
          >
            <AttractionPin source={m.source} selected={m.id === selectedId || m.id === openId}
              label={m.id === selectedId && !renderPopup ? m.name : undefined} />
          </AdvancedMarker>
        ))}

        {open && (
          <InfoWindow position={{ lat: open.lat, lng: open.lng }} pixelOffset={[0, -34]} onCloseClick={() => setOpenId(null)} headerDisabled>
            {renderPopup(open)}
          </InfoWindow>
        )}

        {children}
      </Map>
    </div>
  );
}
