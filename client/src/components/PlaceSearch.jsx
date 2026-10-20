import { useId } from 'react';

export default function PlaceSearch({ value, onChange }) {
  const id = useId();
  return (
    <div className="mt-4 shrink-0">
      <label htmlFor={id} className="label">Search by place name</label>
      <div className="flex items-center gap-2">
        <input id={id} type="search" className="field" placeholder="Type a place name…" value={value} onChange={(e) => onChange(e.target.value)} />
        {value && <button type="button" className="btn-quiet shrink-0" onClick={() => onChange('')}>Clear</button>}
      </div>
    </div>
  );
}
