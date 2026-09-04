import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccessRestrictedPage } from '../../pages/AccessRestrictedPage';
import { useAuth } from './auth-context';

export function AdministratorRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role === 'VIEWER') {
    return <AccessRestrictedPage />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
