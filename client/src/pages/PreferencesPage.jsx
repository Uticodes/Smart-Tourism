import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchCategories, fetchPreferences, savePreferences } from '../api/users.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function PreferencesPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const welcome = useLocation().state?.welcome;
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', saved: false });

  useEffect(() => {
    Promise.all([fetchCategories(), fetchPreferences()])
      .then(([cats, prefs]) => {
        setCategories(cats);
        setSelected(new Set(prefs.map((p) => p.category_id)));
        setStatus((s) => ({ ...s, loading: false }));
      })
      .catch((err) => setStatus((s) => ({ ...s, loading: false, error: errorMessage(err) })));
  }, []);

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setStatus((s) => ({ ...s, saved: false }));
  }

  async function onSave() {
    setStatus((s) => ({ ...s, saving: true, error: '' }));
    try {
      await savePreferences([...selected]);
      await refresh();
      if (welcome) return navigate('/', { replace: true });
      setStatus((s) => ({ ...s, saving: false, saved: true }));
    } catch (err) {
      setStatus((s) => ({ ...s, saving: false, error: errorMessage(err) }));
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-4xl">{welcome ? 'What do you like to visit?' : 'Your interests'}</h1>
      <p className="mt-3 max-w-2xl text-granite-700">
        Places in the categories you choose are ranked higher in your recommendations. Other places still appear,
        just lower down. You can change this at any time.
      </p>

      {status.loading && <p className="mt-8 text-granite-500">Loading categories…</p>}

      {!status.loading && (
        <fieldset className="mt-8">
          <legend className="sr-only">Categories</legend>
          <ul className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => {
              const on = selected.has(c.category_id);
              return (
                <li key={c.category_id}>
                  <label
                    className={`flex h-full cursor-pointer gap-3 rounded-lg border bg-surface p-4 transition-colors ${
                      on ? 'border-green-600 ring-1 ring-green-600' : 'border-granite-200 hover:border-granite-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-green-600"
                      checked={on}
                      onChange={() => toggle(c.category_id)}
                    />
                    <span>
                      <span className="block font-semibold">{c.category_name}</span>
                      {c.description && <span className="mt-0.5 block text-sm text-granite-700">{c.description}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {status.error && <p role="alert" className="mt-5 text-danger">{status.error}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={onSave} disabled={status.loading || status.saving}>
          {status.saving ? 'Saving…' : welcome ? 'Save and continue' : 'Save interests'}
        </button>
        {welcome && (
          <button type="button" className="btn-quiet" onClick={() => navigate('/', { replace: true })}>
            Skip for now
          </button>
        )}
        <span role="status" className="text-sm text-green-700">{status.saved && 'Interests saved.'}</span>
      </div>
    </section>
  );
}
