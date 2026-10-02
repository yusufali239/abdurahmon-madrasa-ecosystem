import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, authHeader } from './lib/api';
import { MeContext } from './lib/me';
import { tg } from './lib/telegram';
import type { Me } from './lib/types';
import { Layout } from './components/Layout';
import { DevLogin, GateScreen } from './pages/Gate';
import HomePage from './pages/Home';
import LessonsPage from './pages/Lessons';
import LessonDetailPage from './pages/LessonDetail';
import NewsPage from './pages/News';
import FundPage from './pages/Fund';
import ProfilePage from './pages/Profile';
import TeacherPage from './pages/teacher/TeacherHome';
import TeacherLessonPage from './pages/teacher/TeacherLesson';

const ROOT_TABS = ['/', '/lessons', '/news', '/fund', '/profile'];

/** Кнопка «Назад» Telegram на вложенных страницах */
function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const isRoot = ROOT_TABS.includes(location.pathname);
      const back = () => navigate(-1);
      if (isRoot) tg.BackButton.hide();
      else tg.BackButton.show();
      tg.BackButton.onClick(back);
      return () => {
        tg.BackButton.offClick(back);
      };
    } catch {
      return undefined;
    }
  }, [location.pathname, navigate]);
}

export default function App() {
  useTelegramBackButton();
  const hasAuth = !!authHeader();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), enabled: hasAuth, retry: false });

  if (!hasAuth) return <DevLogin />;
  if (me.isLoading) return <GateScreen kind="loading" />;
  if (me.error) {
    const status = (me.error as ApiError).status;
    return <GateScreen kind={status === 401 ? 'unregistered' : 'error'} message={(me.error as Error).message} />;
  }
  const user = me.data!;
  if (user.status !== 'APPROVED') return <GateScreen kind="pending" me={user} />;

  return (
    <MeContext.Provider value={user}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="lessons" element={<LessonsPage />} />
          <Route path="lessons/:id" element={<LessonDetailPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="fund" element={<FundPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="teacher" element={<TeacherPage />} />
          <Route path="teacher/lessons/:id" element={<TeacherLessonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MeContext.Provider>
  );
}
