import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { adminDeactivateAttraction, adminListAttractions } from '../../api/admin.js';
import { errorMessage } from '../../api/client.js';

export default function AdminAttractionsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [confirmId, setConfirmId] = useState(null);

  function load() {
    setState({ loading: true, error: '' });
    adminListAttractions({ q: q || undefined, status })
      .then((data) => { setRows(data); setState({ loading: false, error: '' }); })
      .catch((err) => setState({ loading: false, error: errorMessage(err) }));
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate(id) {
    try {
      const updated = await adminDeactivateAttraction(id);
      setRows((rs) => rs.map((r) => (r.attraction_id === id ? updated : r)));
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err) }));
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <AdminNav />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Attractions</h1>
          <p className="mt-1 text-granite-700">{rows.length} shown. Deactivated places stay in the database but leave search and recommendations.</p>
        </div>
        <Link to="/admin/attractions/new" className="btn-primary">Add attraction</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="q">Search attractions</label>
        <input id="q" className="field max-w-sm" placeholder="Search by name or address" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {state.error && <p role="alert" className="mt-4 text-danger">{state.error}</p>}

      <div className="mt-5 overflow-x-auto rounded-lg border border-granite-200 bg-surface">
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="border-b border-granite-200 bg-granite-100/60 text-sm text-granite-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {state.loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-granite-500">Loading…</td></tr>
            )}
            {!state.loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-granite-500">No attractions match.</td></tr>
            )}
            {rows.map((a) => (
              <tr key={a.attraction_id} className="border-b border-granite-100 last:border-0">
                <td className="px-4 py-3">
                  <span className="font-semibold">{a.name}</span>
                  {a.address && <span className="block text-sm text-granite-500">{a.address}</span>}
                </td>
                <td className="px-4 py-3">{a.category_name}</td>
                <td className="px-4 py-3">
                  {a.source === 'community' ? <span className="community-badge">Community</span> : <span className="text-granite-700">Curated</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-granite-100 text-granite-500'}`}>
                    {a.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link to={`/admin/attractions/${a.attraction_id}`} className="font-semibold text-green-700 hover:underline">Edit</Link>
                  {a.status === 'active' && (
                    confirmId === a.attraction_id ? (
                      <span className="ml-4">
                        <button type="button" onClick={() => deactivate(a.attraction_id)} className="font-semibold text-danger hover:underline">Confirm deactivate</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="ml-3 text-granite-500 hover:underline">Cancel</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(a.attraction_id)} className="ml-4 text-granite-700 hover:underline">Deactivate</button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
