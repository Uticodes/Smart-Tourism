/** Read-only star rating, e.g. 4.2 → ★★★★☆ 4.2 (12). Unrated places say so instead of showing zero. */
export default function Stars({ value, count }) {
  if (value == null) return <span className="text-sm text-granite-500">No reviews yet</span>;
  const full = Math.round(Number(value));
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden="true" className="tracking-tight text-[#B7791F]">
        {'★'.repeat(full)}<span className="text-granite-200">{'★'.repeat(5 - full)}</span>
      </span>
      <span className="font-semibold">{Number(value).toFixed(1)}</span>
      {count != null && <span className="text-granite-500">({count})</span>}
      <span className="sr-only">out of 5 stars</span>
    </span>
  );
}
