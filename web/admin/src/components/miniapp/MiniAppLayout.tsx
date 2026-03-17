import { ReactNode, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useBackButtonContext } from '../../context/BackButtonContext';
import { closeTelegramWebApp } from '../../utils/telegram';

// Page labels for header
const PAGE_LABELS: Record<string, string> = {
  '/users': 'Пользователи',
  '/locations': 'Локации',
  '/keys': 'Ключи',
  '/payments': 'Платежи',
  '/promocodes': 'Промокоды',
  '/referrals': 'Рефералы',
  '/tracking': 'Трекинг',
  '/broadcasts': 'Рассылки',
  '/support': 'Поддержка',
  '/settings': 'Настройки',
};

// Main routes (first level)
const MAIN_ROUTES = ['/users', '/locations', '/keys', '/payments', '/promocodes', '/referrals', '/tracking', '/broadcasts', '/support', '/settings'];

interface MiniAppLayoutProps {
  children: ReactNode;
  headerAction?: ReactNode;
}

export function MiniAppLayout({ children, headerAction }: MiniAppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const backButtonContext = useBackButtonContext();
  const currentPath = location.pathname;

  // Get page label, handle nested routes like /users/:id
  const basePath = '/' + currentPath.split('/')[1];
  const pageLabel = PAGE_LABELS[basePath] || '';

  // Check if we're on a detail page (nested route like /users/123)
  const isDetailPage = !MAIN_ROUTES.includes(currentPath);

  // Track navigation history for back button
  const historyStackRef = useRef<string[]>([]);

  // Update history stack on navigation
  useEffect(() => {
    const stack = historyStackRef.current;
    // Don't add duplicates
    if (stack[stack.length - 1] !== currentPath) {
      // If navigating to a main route, clear history
      if (MAIN_ROUTES.includes(currentPath)) {
        historyStackRef.current = [currentPath];
      } else {
        stack.push(currentPath);
      }
    }
  }, [currentPath]);

  // Handle back button press
  const handleBackPress = useCallback(() => {
    const stack = historyStackRef.current;

    if (stack.length > 1) {
      // Go back to previous page
      stack.pop(); // Remove current
      const previousPath = stack[stack.length - 1];
      navigate(previousPath);
    } else if (isDetailPage) {
      // On detail page with no history, go to main route
      navigate(basePath);
    } else {
      // On main page, close the Mini App
      closeTelegramWebApp();
    }
  }, [navigate, isDetailPage, basePath]);

  // Stable ref for the callback
  const handleBackPressRef = useRef(handleBackPress);
  handleBackPressRef.current = handleBackPress;

  const stableBackHandler = useRef(() => {
    handleBackPressRef.current();
  });

  // Register base navigation handler with BackButtonContext only on detail pages
  useEffect(() => {
    if (!backButtonContext) return;

    // Only show back button on detail pages (nested routes like /users/123)
    // On main routes (/users, /keys, etc.) - no back button
    if (isDetailPage) {
      backButtonContext.pushHandler(stableBackHandler.current);
      return () => {
        backButtonContext.popHandler();
      };
    }
  }, [backButtonContext, isDetailPage]);

  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between px-4 bg-background border-b">
        <h1 className="font-semibold text-base">{pageLabel}</h1>
        {headerAction}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
