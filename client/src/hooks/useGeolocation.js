import { useCallback, useState } from 'react';

/** Asks the browser for the device position once, when `locate()` is called. */
export default function useGeolocation() {
  const [state, setState] = useState({ position: null, status: 'idle', error: '' });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ position: null, status: 'error', error: 'This browser cannot share your location. Choose a point on the map instead.' });
      return;
    }
    setState((s) => ({ ...s, status: 'locating', error: '' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        status: 'ready',
        error: '',
      }),
      (err) => setState({
        position: null,
        status: 'error',
        error: err.code === err.PERMISSION_DENIED
          ? 'Location access was blocked. Allow it in your browser settings, or choose a point on the map.'
          : 'Your location could not be found. Choose a point on the map instead.',
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { ...state, locate };
}
