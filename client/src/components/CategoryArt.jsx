// Stand-in artwork for attractions without a photo: a simple line drawing per category,
// on green for curated places and laterite for community-discovered ones.
const GLYPHS = {
  'Historical Sites': (
    <>
      <path d="M8 24h32M10 24v14M18 24v14M30 24v14M38 24v14M6 40h36" />
      <path d="M6 22 24 10l18 12z" />
    </>
  ),
  'Parks & Nature': (
    <>
      <path d="M5 40h38M16 40v-9" />
      <circle cx="16" cy="23" r="8" />
      <path d="m33 12-7 11h4l-5 8h16l-5-8h4zM33 31v9" />
    </>
  ),
  'Arts & Culture': (
    <>
      <rect x="8" y="9" width="32" height="26" rx="2" />
      <path d="m12 31 8-9 6 6 4-4 6 7M33 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM16 35v5M32 35v5" />
    </>
  ),
  'Religious Sites': (
    <>
      <path d="M10 40V24a14 14 0 0 1 28 0v16M6 40h36M24 10V5M21 7h6" />
      <path d="M19 40v-8a5 5 0 0 1 10 0v8" />
    </>
  ),
  'Educational Sites': (
    <>
      <path d="M24 14c-5-3-11-4-17-3v26c6-1 12 0 17 3 5-3 11-4 17-3V11c-6-1-12 0-17 3zM24 14v26" />
    </>
  ),
};

export default function CategoryArt({ category, community = false, className = '' }) {
  const tone = community ? 'bg-laterite-50 text-laterite-600' : 'bg-green-50 text-green-700';
  return (
    <div className={`grid place-items-center ${tone} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-1/2 max-h-20 w-auto" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[category] || GLYPHS['Historical Sites']}
      </svg>
    </div>
  );
}
