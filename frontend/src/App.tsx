import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './features/auth/RequireAuth';
import { ToastProvider } from './shared/ui/Toast';
import { createQueryClient } from './app/query-client';
import { ActivityPage } from './pages/ActivityPage';
import { AdminPage } from './pages/AdminPage';
import { ArticleListPage } from './pages/ArticleListPage';
import { DashboardPage } from './pages/DashboardPage';
import { KbDetailPage } from './pages/KbDetailPage';
import { KbListPage } from './pages/KbListPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ReviewInboxPage } from './pages/ReviewInboxPage';
import { SearchPage } from './pages/SearchPage';
import { AppShell } from './shared/layout/AppShell';

// Tiptap is the heaviest dependency — split the two routes that render it.
const ArticleEditorPage = lazy(() =>
  import('./pages/ArticleEditorPage').then((m) => ({ default: m.ArticleEditorPage })),
);
const ArticleViewPage = lazy(() =>
  import('./pages/ArticleViewPage').then((m) => ({ default: m.ArticleViewPage })),
);

function RouteFallback(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-3 py-8" aria-label="loading">
      <div className="skeleton h-8 w-2/5" />
      <div className="surface p-8">
        <div className="skeleton h-48" />
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const client = useMemo(() => createQueryClient(), []);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="/kbs" element={<KbListPage />} />
              <Route path="/kbs/:id" element={<KbDetailPage />} />
              <Route path="/kbs/:kbId/articles" element={<ArticleListPage />} />
              <Route path="/kbs/:kbId/articles/new" element={<Suspense fallback={<RouteFallback />}><ArticleEditorPage /></Suspense>} />
              <Route path="/kbs/:kbId/articles/:articleId" element={<Suspense fallback={<RouteFallback />}><ArticleViewPage /></Suspense>} />
              <Route path="/kbs/:kbId/articles/:articleId/edit" element={<Suspense fallback={<RouteFallback />}><ArticleEditorPage /></Suspense>} />
              <Route path="/reviews" element={<ReviewInboxPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
