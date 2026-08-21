import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from 'antd';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading" aria-label="正在验证登录状态">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
