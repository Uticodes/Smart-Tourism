import { useEffect, useState } from 'react';
import AdminNav from '../../components/AdminNav.jsx';
import { adminCreateCategory, adminDeleteCategory, adminListCategories, adminUpdateCategory } from '../../api/admin.js';
import { errorMessage } from '../../api/client.js';

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ category_name: '', description: '' });
  const [editing, setEditing] = useState(null); // { id, category_name, description }

  useEffect(() => {
    adminListCategories().then(setRows).catch((err) => setError(errorMessage(err)));
  }, []);

  async function run(action) {
    setError('');
    try {
      setRows(await action());
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (await run(() => adminCreateCategory(draft))) setDraft({ category_name: '', description: '' });
  }

  async function onSave() {
    if (await run(() => adminUpdateCategory(editing.id, editing))) setEditing(null);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <AdminNav />
      <h1 className="text-3xl">Categories</h1>
      <p className="mt-1 text-granite-700">A category that still has attractions or reports cannot be deleted.</p>
      {error && <p role="alert" className="mt-4 rounded-md bg-laterite-50 px-4 py-3 text-sm text-laterite-600">{error}</p>}

      <ul className="mt-6 divide-y divide-granite-100 rounded-lg border border-granite-200 bg-surface">
        {rows.map((c) => (
          <li key={c.category_id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            {editing?.id === c.category_id ? (
              <>
                <input aria-label="Category name" className="field max-w-xs" value={editing.category_name} onChange={(e) => setEditing({ ...editing, category_name: e.target.value })} />
                <input aria-label="Description" className="field flex-1" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <button type="button" className="btn-primary !py-2" onClick={onSave}>Save</button>
                <button type="button" className="text-granite-500 hover:underline" onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.category_name}</p>
                  {c.description && <p className="text-sm text-granite-700">{c.description}</p>}
                </div>
                <span className="text-sm text-granite-500">{c.attraction_count} {c.attraction_count === 1 ? 'attraction' : 'attractions'}</span>
                <button type="button" className="font-semibold text-green-700 hover:underline" onClick={() => setEditing({ id: c.category_id, category_name: c.category_name, description: c.description })}>Rename</button>
                <button type="button" className="text-granite-700 hover:underline disabled:opacity-40" disabled={c.attraction_count > 0} onClick={() => run(() => adminDeleteCategory(c.category_id))}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-granite-200 bg-surface p-4">
        <div className="w-full sm:w-64">
          <label htmlFor="new-name" className="label">New category</label>
          <input id="new-name" className="field" value={draft.category_name} onChange={(e) => setDraft({ ...draft, category_name: e.target.value })} />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="new-desc" className="label">Description (optional)</label>
          <input id="new-desc" className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={!draft.category_name.trim()}>Add category</button>
      </form>
    </section>
  );
}
