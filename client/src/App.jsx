import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import AttractionPage from './pages/AttractionPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PreferencesPage from './pages/PreferencesPage.jsx';
import AdminAttractionsPage from './pages/admin/AdminAttractionsPage.jsx';
import AttractionFormPage from './pages/admin/AttractionFormPage.jsx';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const signedIn = (el) => <ProtectedRoute>{el}</ProtectedRoute>;
const adminOnly = (el) => <ProtectedRoute admin>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="attractions/:id" element={<AttractionPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="preferences" element={signedIn(<PreferencesPage />)} />
        <Route path="admin/attractions" element={adminOnly(<AdminAttractionsPage />)} />
        <Route path="admin/attractions/new" element={adminOnly(<AttractionFormPage />)} />
        <Route path="admin/attractions/:id" element={adminOnly(<AttractionFormPage />)} />
        <Route path="admin/categories" element={adminOnly(<AdminCategoriesPage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
