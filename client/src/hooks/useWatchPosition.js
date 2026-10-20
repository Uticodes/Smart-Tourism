import { useEffect, useRef, useState } from 'react';

/** Follows the device position while `active` is true (navigation). Stops watching when inactive or unmounted. */
export default function useWatchPosition(active) {
  const [state, setState] = useState({ position: null, error: '' });
  const id = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    if (!('geolocation' in navigator)) {
      setState({ position: null, error: 'This browser cannot share your location.' });
      return undefined;
    }
    id.current = navigator.geolocation.watchPosition(
      (pos) => setState({
        position: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) && pos.coords.speed > 0.5 ? pos.coords.heading : null,
          at: pos.timestamp,
        },
        error: '',
      }),
      (err) => setState((s) => ({
        ...s,
        error: err.code === err.PERMISSION_DENIED
          ? 'Location access is blocked, so the map cannot follow you. Allow it in your browser settings.'
          : 'Your location is not available right now.',
      })),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id.current);
  }, [active]);
  return state;
}
