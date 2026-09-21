import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { PlaceDetailsPage } from './pages/PlaceDetailsPage';
import { SearchPage } from './pages/SearchPage';
import { AuthProvider } from './auth/AuthProvider';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { AddPlacePage } from './pages/AddPlacePage';

export function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route path="/register" element={<AuthPage key="register" mode="register" />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/places/new" element={<AddPlacePage />} />
          <Route path="/places/:placeId" element={<PlaceDetailsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthProvider>
  );
}
