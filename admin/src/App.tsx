import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './lib/api';
import { AdminLayout } from './components/AdminLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import TeachersPage from './pages/Teachers';
import LessonsPage from './pages/Lessons';
import PaymentsPage from './pages/Payments';
import FundPage from './pages/Fund';
import NewsPage from './pages/News';
import SubjectsPage from './pages/Subjects';

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="fund" element={<FundPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
