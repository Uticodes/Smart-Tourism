import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage, fieldErrors } from '../api/client.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    setBanner('');
    setBusy(true);
    try {
      const user = await login(form);
      const next = location.state?.from || (user.preference_count === 0 ? '/preferences' : '/');
      navigate(next, { replace: true });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      setBanner(Object.keys(fields).length ? 'Fix the highlighted fields and try again.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" intro="Welcome back. Sign in to see recommendations based on your interests.">
      {banner && <p role="alert" className="mb-5 rounded-md bg-laterite-50 px-4 py-3 text-sm text-laterite-600">{banner}</p>}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} error={errors.password} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-granite-700">
        New here? <Link to="/register" className="font-semibold text-green-700 underline-offset-2 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
