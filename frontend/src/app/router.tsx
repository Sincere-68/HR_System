import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/protected-route';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { EmployeeDetailPage } from '../pages/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '../pages/employees/EmployeeFormPage';
import { EmployeeListPage } from '../pages/employees/EmployeeListPage';
import { placeholderRoutes } from '../config/navigation';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/personnel/employees" replace />} />
          <Route path="personnel/employees" element={<EmployeeListPage />} />
          <Route path="personnel/employees/new" element={<EmployeeFormPage />} />
          <Route path="personnel/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="personnel/employees/:id/edit" element={<EmployeeFormPage />} />
          {placeholderRoutes.map((route) => (
            <Route key={route.key} path={route.key.slice(1)} element={<PlaceholderPage title={route.label} />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
