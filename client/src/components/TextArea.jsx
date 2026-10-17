/** Multi-line version of FormField, with an optional character count. */
export default function TextArea({ id, label, error, hint, value, maxLength, minLength, rows = 4, ...props }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const short = minLength && value.trim().length < minLength;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        className={`field resize-y ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      <div className="mt-1.5 flex justify-between gap-3 text-sm">
        {error ? <p id={`${id}-error`} className="text-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="text-granite-500">{hint}</p> : <span />}
        {maxLength && (
          <span className={`shrink-0 tabular-nums ${short ? 'text-granite-500' : 'text-granite-500'}`}>
            {minLength && short ? `${minLength - value.trim().length} more needed` : `${value.length}/${maxLength}`}
          </span>
        )}
      </div>
    </div>
  );
}
