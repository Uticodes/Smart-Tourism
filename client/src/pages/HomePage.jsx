import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';

// F0 placeholder: confirms the client, API and database are connected.
// Replaced by the recommendations view in F5.
export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="max-w-3xl text-4xl leading-[1.08] sm:text-6xl">
        Find the places Abuja knows about, even the ones the maps don’t.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-granite-700">
        Get recommendations near you, directions to each site, and add attractions that only
        locals know so others can find them too.
      </p>

      <div className="mt-10 max-w-md rounded-lg border border-granite-200 bg-surface p-5" role="status">
        <h2 className="text-base">System status</h2>
        {error && <p className="mt-2 text-danger">{error}</p>}
        {!error && !health && <p className="mt-2 text-granite-500">Checking the server…</p>}
        {health && (
          <p className="mt-2 text-granite-700">
            Server and database connected. {health.attractions} attractions loaded.
          </p>
        )}
      </div>
    </section>
  );
}
