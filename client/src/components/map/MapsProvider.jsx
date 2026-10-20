import { APIProvider } from '@vis.gl/react-google-maps';

export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || '';
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

/**
 * Loads the Google Maps JavaScript API once for the whole app (Section 3.3: Google Maps Platform for maps and routing).
 * Without a key the app still works; maps show a notice instead (see MapView).
 */
export default function MapsProvider({ children }) {
  if (!MAPS_KEY) return children;
  return (
    <APIProvider apiKey={MAPS_KEY} region="NG" language="en-GB" libraries={['marker', 'routes', 'geometry']}>
      {children}
    </APIProvider>
  );
}
