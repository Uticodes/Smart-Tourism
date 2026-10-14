import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl">This page does not exist</h1>
      <p className="mt-3 text-granite-700">The link may be wrong or the page may have moved.</p>
      <Link to="/" className="btn-primary mt-6">Go to Explore</Link>
    </section>
  );
}
