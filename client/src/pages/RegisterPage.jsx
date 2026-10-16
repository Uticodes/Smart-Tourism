import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage, fieldErrors } from '../api/client.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', display_name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setBanner('');
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'The passwords do not match.' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { confirm, ...data } = form;
      await register(data);
      navigate('/preferences', { replace: true, state: { welcome: true } });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      setBanner(Object.keys(fields).length ? 'Fix the highlighted fields and try again.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      intro="An account lets you get recommendations for the kinds of places you like, review attractions and report places that are missing from the map."
      aside={
        <>
          <h2 className="text-lg">Know a place that isn’t on the map?</h2>
          <p className="mt-2 text-granite-700">
            Waterfalls, hills, craft villages and heritage sites that only locals know about can be reported here.
            Once other residents confirm a site and it has been reviewed, it appears for everyone, marked:
          </p>
          <p className="mt-3"><span className="community-badge">Community-discovered</span></p>
        </>
      }
    >
      {banner && <p role="alert" className="mb-5 rounded-md bg-laterite-50 px-4 py-3 text-sm text-laterite-600">{banner}</p>}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField id="full_name" label="Full name" autoComplete="name" required value={form.full_name} onChange={set('full_name')} error={errors.full_name} />
        <FormField id="display_name" label="Display name (optional)" hint="Shown on your reviews and on places you report. Leave blank to use your first name." autoComplete="nickname" value={form.display_name} onChange={set('display_name')} error={errors.display_name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." required value={form.password} onChange={set('password')} error={errors.password} />
        <FormField id="confirm" label="Confirm password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-granite-700">
        Already have an account? <Link to="/login" className="font-semibold text-green-700 underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
