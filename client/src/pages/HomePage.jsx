import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Recommendations replace the lower half of this page in F5.
export default function HomePage() {
  const { user } = useAuth();
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="max-w-3xl text-4xl leading-[1.08] sm:text-6xl">
        Find the places Abuja knows about, even the ones the maps don’t.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-granite-700">
        Get recommendations near you, directions to each site, and add attractions that only
        locals know so others can find them too.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/explore" className="btn-primary">Explore attractions near you</Link>
        {!user && <Link to="/register" className="btn-quiet">Create an account</Link>}
      </div>
    </section>
  );
}
