import { NavLink } from 'react-router-dom';

const tab = ({ isActive }) =>
  `border-b-2 px-1 pb-2 text-[15px] font-semibold ${isActive ? 'border-green-600 text-green-700' : 'border-transparent text-granite-500 hover:text-granite-900'}`;

/** Section tabs shown at the top of every admin page. The analytics tab arrives with F11. */
export default function AdminNav() {
  return (
    <nav aria-label="Admin sections" className="mb-8 flex gap-6 overflow-x-auto border-b border-granite-200">
      <NavLink to="/admin/reports" className={tab}>Review queue</NavLink>
      <NavLink to="/admin/attractions" className={tab}>Attractions</NavLink>
      <NavLink to="/admin/categories" className={tab}>Categories</NavLink>
    </nav>
  );
}
