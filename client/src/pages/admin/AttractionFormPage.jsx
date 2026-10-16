import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import FormField from '../../components/FormField.jsx';
import LocationPicker from '../../components/map/LocationPicker.jsx';
import { adminCreateAttraction, adminGetAttraction, adminUpdateAttraction } from '../../api/admin.js';
import { fetchCategories } from '../../api/users.js';
import { errorMessage, fieldErrors } from '../../api/client.js';

const EMPTY = { name: '', category_id: '', description: '', latitude: '', longitude: '', address: '', image_url: '', status: 'active' };

export default function AttractionFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    if (!editing) return;
    adminGetAttraction(id)
      .then((a) => setForm({
        name: a.name, category_id: String(a.category_id), description: a.description || '',
        latitude: Number(a.latitude), longitude: Number(a.longitude), address: a.address || '',
        image_url: a.image_url || '', status: a.status,
      }))
      .catch((err) => setBanner(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const point = form.latitude !== '' && form.longitude !== '' ? { lat: Number(form.latitude), lng: Number(form.longitude) } : null;

  async function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    setBanner('');
    if (!point) {
      setErrors({ latitude: 'Drop a pin on the map or type the coordinates.' });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, category_id: Number(form.category_id), latitude: point.lat, longitude: point.lng };
      if (editing) await adminUpdateAttraction(id, payload);
      else await adminCreateAttraction(payload);
      navigate('/admin/attractions', { replace: true });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      setBanner(Object.keys(fields).length ? 'Fix the highlighted fields and try again.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <AdminNav />
      <Link to="/admin/attractions" className="text-sm font-semibold text-green-700 hover:underline">Back to attractions</Link>
      <h1 className="mt-2 text-3xl">{editing ? 'Edit attraction' : 'Add an attraction'}</h1>

      {loading ? (
        <p className="mt-6 text-granite-500">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            {banner && <p role="alert" className="rounded-md bg-laterite-50 px-4 py-3 text-sm text-laterite-600">{banner}</p>}
            <FormField id="name" label="Name" required value={form.name} onChange={set('name')} error={errors.name} />
            <div>
              <label htmlFor="category_id" className="label">Category</label>
              <select id="category_id" className={`field ${errors.category_id ? 'border-danger' : ''}`} value={form.category_id} onChange={set('category_id')}>
                <option value="">Choose a category</option>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
              {errors.category_id && <p className="mt-1.5 text-sm text-danger">{errors.category_id}</p>}
            </div>
            <div>
              <label htmlFor="description" className="label">Description</label>
              <textarea id="description" rows={5} className="field" value={form.description} onChange={set('description')} />
            </div>
            <FormField id="address" label="Address or area" value={form.address} onChange={set('address')} error={errors.address} />
            <FormField id="image_url" label="Image address (optional)" hint="A link to a photo of the place, starting with https://" value={form.image_url} onChange={set('image_url')} error={errors.image_url} />
            <div>
              <label htmlFor="status" className="label">Status</label>
              <select id="status" className="field" value={form.status} onChange={set('status')}>
                <option value="active">Active: shown in search</option>
                <option value="inactive">Inactive: hidden from search</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add attraction'}</button>
              <Link to="/admin/attractions" className="btn-quiet">Cancel</Link>
            </div>
          </div>

          <div>
            <span className="label">Location</span>
            <LocationPicker
              value={point}
              onChange={(p) => {
                setForm({ ...form, latitude: p.lat, longitude: p.lng });
                setErrors(({ latitude, longitude, ...rest }) => rest);
              }}
              className="h-[380px]"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FormField id="latitude" label="Latitude" inputMode="decimal" value={form.latitude} onChange={set('latitude')} error={errors.latitude} />
              <FormField id="longitude" label="Longitude" inputMode="decimal" value={form.longitude} onChange={set('longitude')} error={errors.longitude} />
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
