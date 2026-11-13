import { useState } from 'react';

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

/**
 * Label, input and inline error, wired together for screen readers.
 * Password fields get a show/hide button so people can check what they typed.
 */
export default function FormField({ id, label, error, hint, type, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && visible ? 'text' : type}
          className={`field ${isPassword ? 'pr-12' : ''} ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...(isPassword ? { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } : {})}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
            aria-controls={id}
            title={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-granite-500 hover:text-granite-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/40"
          >
            <EyeIcon open={!visible} />
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-sm text-granite-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
