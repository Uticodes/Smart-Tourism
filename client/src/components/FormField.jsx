/** Label, input and inline error, wired together for screen readers. */
export default function FormField({ id, label, error, hint, ...inputProps }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id}
        name={id}
        className={`field ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-sm text-granite-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
