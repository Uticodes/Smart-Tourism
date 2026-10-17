import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import TextArea from '../components/TextArea.jsx';
import LocationPicker from '../components/map/LocationPicker.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import { fetchCategories } from '../api/users.js';
import { submitReport } from '../api/reports.js';
import { errorMessage, fieldErrors } from '../api/client.js';
import { inFCT } from '../lib/format.js';

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const EMPTY = { site_name: '', local_name: '', category_id: '', description: '', access_notes: '' };

function DuplicateDialog({ nearby, onCancel, onDifferent, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCancel]);
  const isAttraction = nearby.kind === 'attraction';
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-granite-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="dup-title" tabIndex={-1} ref={ref}
        className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl outline-none">
        <h2 id="dup-title" className="text-xl">Is this the same place?</h2>
        <p className="mt-2 text-granite-700">
          {isAttraction ? 'A place on the map is' : 'Someone has already reported a place'} {Math.round(nearby.distance_m)} m from your pin:
        </p>
        <div className="mt-3 rounded-md border border-granite-200 p-3">
          <p className="font-semibold">{nearby.name}</p>
          <p className="text-sm text-granite-700">
            {nearby.category_name} · {isAttraction ? 'on the map' : 'waiting for checks'}
          </p>
          {isAttraction && (
            <Link to={`/attractions/${nearby.id}`} target="_blank" className="mt-1 inline-block text-sm font-semibold text-green-700 hover:underline">
              Open it in a new tab
            </Link>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-quiet" onClick={onCancel}>Same place, cancel</button>
          <button type="button" className="btn-primary" onClick={onDifferent} disabled={busy}>
            {busy ? 'Sending…' : 'Different place, send it'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportSitePage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const [form, setForm] = useState(EMPTY);
  const [point, setPoint] = useState(null);
  const [photos, setPhotos] = useState([]); // { file, url }
  const [publicAccess, setPublicAccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Free the preview URLs when photos are removed or the page closes.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geo.status !== 'ready' || !geo.position) return;
    const p = { lat: Number(geo.position.lat.toFixed(6)), lng: Number(geo.position.lng.toFixed(6)) };
    if (inFCT(p)) {
      setPoint(p);
      clearError('latitude');
    } else {
      setErrors((e) => ({ ...e, latitude: 'You appear to be outside the FCT. Drop the pin on the place instead.' }));
    }
  }, [geo.status, geo.position]);

  // Editing a field clears its error, and the banner once nothing is left to fix.
  const clearError = (key) => setErrors((er) => {
    const next = { ...er, [key]: undefined };
    if (!Object.values(next).some(Boolean)) setBanner('');
    return next;
  });
  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); clearError(key); };

  function addPhotos(e) {
    const chosen = [...e.target.files];
    e.target.value = '';
    const problems = [];
    const ok = [];
    for (const file of chosen) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) problems.push(`${file.name} is not a JPEG or PNG.`);
      else if (file.size > MAX_BYTES) problems.push(`${file.name} is larger than 5 MB.`);
      else ok.push({ file, url: URL.createObjectURL(file) });
    }
    const room = MAX_PHOTOS - photos.length;
    if (ok.length > room) {
      problems.push(`Only ${MAX_PHOTOS} photos can be added.`);
      ok.splice(room).forEach((p) => URL.revokeObjectURL(p.url));
    }
    setPhotos([...photos, ...ok]);
    if (problems.length) setErrors((er) => ({ ...er, photos: problems.join(' ') }));
    else clearError('photos');
  }

  function removePhoto(i) {
    URL.revokeObjectURL(photos[i].url);
    setPhotos(photos.filter((_, j) => j !== i));
  }

  function pickPoint(p) {
    if (!inFCT(p)) {
      setErrors((e) => ({ ...e, latitude: 'That point is outside the FCT. Only places in the FCT can be reported.' }));
      return;
    }
    setPoint(p);
    clearError('latitude');
  }

  function check() {
    const e = {};
    if (form.site_name.trim().length < 2) e.site_name = 'Enter the name of the place.';
    if (!form.category_id) e.category_id = 'Choose a category.';
    if (form.description.trim().length < 20) e.description = 'Describe the place in at least 20 characters.';
    if (!point) e.latitude = 'Drop a pin on the place, or use your location if you are there now.';
    if (photos.length === 0) e.photos = 'Add at least one photo.';
    if (!publicAccess) e.public_access = 'Confirm that the public can visit this place.';
    return e;
  }

  async function send(differentPlace = false) {
    setBusy(true);
    setBanner('');
    try {
      await submitReport(
        { ...form, latitude: point.lat, longitude: point.lng, public_access: true, different_place: differentPlace || undefined },
        photos.map((p) => p.file)
      );
      navigate('/reports/mine', { replace: true, state: { submitted: form.site_name.trim() } });
    } catch (err) {
      setDuplicate(null);
      if (err.response?.status === 409 && err.response.data?.code === 'DUPLICATE') {
        setDuplicate(err.response.data.nearby);
      } else {
        const fields = fieldErrors(err);
        setErrors(fields);
        setBanner(Object.keys(fields).length ? 'Fix the highlighted fields and try again.' : errorMessage(err));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) {
      setBanner('Fix the highlighted fields and try again.');
      document.getElementById(Object.keys(found)[0] === 'latitude' ? 'location' : Object.keys(found)[0])?.focus();
      return;
    }
    send(false);
  }

  const section = 'rounded-lg border border-granite-200 bg-surface p-5 sm:p-6';

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl sm:text-4xl">Add a place that isn’t on the map</h1>
      <p className="mt-3 max-w-2xl text-granite-700">
        Tell others about a site worth visiting that the maps miss. Nearby residents can confirm it, and an administrator
        checks every report before it is published with the <span className="community-badge align-middle">Community-discovered</span> badge.
      </p>

      {banner && <p role="alert" className="mt-6 rounded-md bg-[#FBE9E7] px-4 py-3 text-danger">{banner}</p>}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <fieldset className={section}>
          <legend className="sr-only">About the place</legend>
          <h2 className="text-lg">About the place</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField id="site_name" label="Name" value={form.site_name} onChange={set('site_name')} error={errors.site_name} maxLength={150} />
            <FormField id="local_name" label="Local name (optional)" hint="What people nearby call it" value={form.local_name} onChange={set('local_name')} maxLength={150} />
          </div>
          <div className="mt-4">
            <label htmlFor="category_id" className="label">Category</label>
            <select id="category_id" className={`field ${errors.category_id ? 'border-danger' : ''}`} value={form.category_id} onChange={set('category_id')}
              aria-invalid={errors.category_id ? 'true' : undefined} aria-describedby={errors.category_id ? 'category_id-error' : undefined}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
            {errors.category_id && <p id="category_id-error" className="mt-1.5 text-sm text-danger">{errors.category_id}</p>}
          </div>
          <div className="mt-4">
            <TextArea id="description" label="What makes it worth visiting?" value={form.description} onChange={set('description')}
              error={errors.description} minLength={20} maxLength={2000} rows={5} />
          </div>
          <div className="mt-4">
            <TextArea id="access_notes" label="How to get there (optional)" hint="Landmarks, the best path, opening times, any fee"
              value={form.access_notes} onChange={set('access_notes')} maxLength={500} rows={2} />
          </div>
        </fieldset>

        <fieldset className={section}>
          <legend className="sr-only">Location</legend>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="location" tabIndex={-1} className="text-lg outline-none">Where is it?</h2>
            <button type="button" className="btn-quiet !py-2" onClick={geo.locate} disabled={geo.status === 'locating'}>
              {geo.status === 'locating' ? 'Finding you…' : 'I’m there now: use my location'}
            </button>
          </div>
          <div className="mt-4">
            <LocationPicker value={point} onChange={pickPoint} className="h-[340px]" />
          </div>
          {(errors.latitude || geo.error) && <p className="mt-1.5 text-sm text-danger" role="alert">{errors.latitude || geo.error}</p>}
        </fieldset>

        <fieldset className={section}>
          <legend className="sr-only">Photos</legend>
          <h2 className="text-lg">Photos</h2>
          <p className="mt-1 text-sm text-granite-700">1 to 3 photos, JPEG or PNG, up to 5 MB each. Location data stored inside the photos is removed when they are uploaded.</p>
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <li key={p.url} className="relative">
                <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
                <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-granite-900/75 text-lg leading-none text-white hover:bg-granite-900">
                  ×
                </button>
              </li>
            ))}
            {photos.length < MAX_PHOTOS && (
              <li>
                <button type="button" id="photos" onClick={() => fileInput.current?.click()}
                  className={`grid aspect-square w-full place-items-center rounded-md border-2 border-dashed text-sm font-semibold text-granite-700 hover:border-green-600 hover:text-green-700 ${errors.photos ? 'border-danger' : 'border-granite-200'}`}>
                  <span className="text-center"><span className="block text-2xl" aria-hidden="true">+</span>Add photo</span>
                </button>
              </li>
            )}
          </ul>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple className="sr-only" tabIndex={-1} onChange={addPhotos} aria-label="Choose photos" />
          {errors.photos && <p className="mt-2 text-sm text-danger" role="alert">{errors.photos}</p>}
        </fieldset>

        <div className={section}>
          <label className="flex cursor-pointer items-start gap-3">
            <input id="public_access" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-green-600" checked={publicAccess}
              onChange={(e) => { setPublicAccess(e.target.checked); clearError('public_access'); }} />
            <span>
              <span className="font-semibold">The public can visit this place.</span>
              <span className="block text-sm text-granite-700">It is not a private home, a restricted government or military site, or somewhere visitors need special permission to enter.</span>
            </span>
          </label>
          {errors.public_access && <p className="mt-2 text-sm text-danger">{errors.public_access}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
          <Link to="/reports/mine" className="btn-quiet">Your reports</Link>
        </div>
      </form>

      {duplicate && (
        <DuplicateDialog nearby={duplicate} busy={busy} onCancel={() => setDuplicate(null)} onDifferent={() => send(true)} />
      )}
    </section>
  );
}
