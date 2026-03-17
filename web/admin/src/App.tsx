import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { MiniAppProvider, useMiniApp } from './context/MiniAppContext';
import { BackButtonProvider } from './context/BackButtonContext';
import { AppSidebar } from './components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { Separator } from './components/ui/separator';
import { Button } from './components/ui/button';
import { Login } from './components/Login';
import { Users } from './components/Users';
import { Locations } from './components/Locations';
import { Keys } from './components/Keys';
import { Payments } from './components/Payments';
import { Promocodes } from './components/Promocodes';
import { Referrals } from './components/Referrals';
import { Tracking } from './components/Tracking';
import { Settings } from './components/Settings';
import { Broadcasts } from './components/Broadcasts';
import { SupportChat } from './components/SupportChat';
import { NalogIntegration } from './components/NalogIntegration';
import { Withdrawals } from './components/Withdrawals';
import { SetupWizard } from './components/SetupWizard';
import { GeneralError, MaintenanceError } from './components/errors';
import { Toaster } from './components/ui/sonner';
import { isTokenExpired } from './utils/token';
import { MiniAppLayout } from './components/miniapp/MiniAppLayout';

// Маппинг путей на их названия
const PAGE_LABELS: Record<string, string> = {
  '/users': 'Пользователи',
  '/locations': 'Локации',
  '/keys': 'Ключи',
  '/payments': 'Платежи',
  '/promocodes': 'Промокоды',
  '/referrals': 'Рефералы',
  '/withdrawals': 'Выводы',
  '/tracking': 'Трекинг',
  '/broadcasts': 'Рассылки',
  '/support': 'Поддержка',
  '/settings': 'Настройки',
  '/nalog': 'Мой Налог',
};

// Error Boundary для перехвата ошибок React
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <GeneralError />;
    }
    return this.props.children;
  }
}

export type PageType =
  | 'users'
  | 'locations'
  | 'keys'
  | 'payments'
  | 'promocodes'
  | 'referrals'
  | 'withdrawals'
  | 'tracking'
  | 'broadcasts'
  | 'support'
  | 'settings'
  | 'nalog';

// Функция для декодирования JWT
function getPayloadFromToken(token: string): { role: string; username: string } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      role: payload.role || 'admin',
      username: payload.username || 'Admin'
    };
  } catch {
    return { role: 'admin', username: 'Admin' };
  }
}

// Компонент для Mini App лейаута
function MiniAppAppLayout() {
  const location = useLocation();

  // Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isPromocodeModalOpen, setIsPromocodeModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  const currentPath = location.pathname;
  const basePath = '/' + currentPath.split('/')[1];

  // Header actions based on current page
  const headerAction = (() => {
    if (basePath === '/locations') {
      return (
        <Button size="sm" className="h-8" onClick={() => setIsLocationModalOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      );
    }
    if (basePath === '/promocodes') {
      return (
        <Button size="sm" className="h-8" onClick={() => setIsPromocodeModalOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      );
    }
    if (basePath === '/tracking') {
      return (
        <Button size="sm" className="h-8" onClick={() => setIsTrackingModalOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      );
    }
    if (basePath === '/broadcasts') {
      return (
        <Button size="sm" className="h-8" onClick={() => setIsBroadcastModalOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      );
    }
    return null;
  })();

  return (
    <WebSocketProvider>
      <MiniAppLayout headerAction={headerAction}>
        <Routes>
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:userId" element={<Users />} />
          <Route path="/locations" element={<Locations isModalOpen={isLocationModalOpen} setIsModalOpen={setIsLocationModalOpen} />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/keys/:keyToken" element={<Keys />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/promocodes" element={<Promocodes isModalOpen={isPromocodeModalOpen} setIsModalOpen={setIsPromocodeModalOpen} />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/referrals/:referralId" element={<Referrals />} />
          <Route path="/withdrawals" element={<Withdrawals />} />
          <Route path="/tracking" element={<Tracking isModalOpen={isTrackingModalOpen} setIsModalOpen={setIsTrackingModalOpen} />} />
          <Route path="/broadcasts" element={<Broadcasts isModalOpen={isBroadcastModalOpen} setIsModalOpen={setIsBroadcastModalOpen} />} />
          <Route path="/support" element={<SupportChat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/nalog" element={<NalogIntegration />} />
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </MiniAppLayout>
    </WebSocketProvider>
  );
}

// Компонент для основного лейаута приложения (desktop)
function DesktopAppLayout({ userRole, adminName, onLogout }: {
  userRole: string;
  adminName: string;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Modal states (для управления из хедера)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isPromocodeModalOpen, setIsPromocodeModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Получаем текущий путь для определения страницы
  const currentPath = location.pathname;
  const pageLabel = PAGE_LABELS[currentPath] || '';

  const handlePageChange = (page: PageType) => {
    navigate(`/${page}`);
  };

  // Определяем текущую страницу из URL
  const getCurrentPage = (): PageType => {
    const path = location.pathname.replace(/^\//, '').split('/')[0] || 'users';
    const validPages: PageType[] = ['users', 'locations', 'keys', 'payments', 'promocodes', 'referrals', 'withdrawals', 'tracking', 'broadcasts', 'support', 'settings', 'nalog'];
    return validPages.includes(path as PageType) ? (path as PageType) : 'users';
  };

  return (
    <WebSocketProvider>
      <SidebarProvider>
        <AppSidebar
          currentPage={getCurrentPage()}
          onPageChange={handlePageChange}
          onLogout={onLogout}
          role={userRole}
          adminName={adminName}
        />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 px-3 sticky top-0 z-10 bg-background border-b rounded-t-xl">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="flex-1 font-medium">{pageLabel}</span>
            {currentPath === '/locations' && (
              <Button size="sm" className="h-8" onClick={() => setIsLocationModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            )}
            {currentPath === '/promocodes' && (
              <Button size="sm" className="h-8" onClick={() => setIsPromocodeModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Создать
              </Button>
            )}
            {currentPath === '/tracking' && (
              <Button size="sm" className="h-8" onClick={() => setIsTrackingModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Создать
              </Button>
            )}
            {currentPath === '/broadcasts' && (
              <Button size="sm" className="h-8" onClick={() => setIsBroadcastModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Создать
              </Button>
            )}
          </header>
          <main className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/users" replace />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/:userId" element={<Users />} />
              <Route path="/locations" element={<Locations isModalOpen={isLocationModalOpen} setIsModalOpen={setIsLocationModalOpen} />} />
              <Route path="/keys" element={<Keys />} />
              <Route path="/keys/:keyToken" element={<Keys />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/promocodes" element={<Promocodes isModalOpen={isPromocodeModalOpen} setIsModalOpen={setIsPromocodeModalOpen} />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/referrals/:referralId" element={<Referrals />} />
              <Route path="/withdrawals" element={<Withdrawals />} />
              <Route path="/tracking" element={<Tracking isModalOpen={isTrackingModalOpen} setIsModalOpen={setIsTrackingModalOpen} />} />
              <Route path="/broadcasts" element={<Broadcasts isModalOpen={isBroadcastModalOpen} setIsModalOpen={setIsBroadcastModalOpen} />} />
              <Route path="/support" element={<SupportChat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/nalog" element={<NalogIntegration />} />
              <Route path="*" element={<Navigate to="/users" replace />} />
            </Routes>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  );
}

// Wrapper that chooses layout based on Mini App detection
function AppLayout({ userRole, adminName, onLogout }: {
  userRole: string;
  adminName: string;
  onLogout: () => void;
}) {
  const { isMiniApp } = useMiniApp();

  if (isMiniApp) {
    return <MiniAppAppLayout />;
  }

  return (
    <DesktopAppLayout
      userRole={userRole}
      adminName={adminName}
      onLogout={onLogout}
    />
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [adminName, setAdminName] = useState<string>('Admin');
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Setup status
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [serverError, setServerError] = useState(false);

  // Проверяем статус первоначальной настройки
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/setup/status');
        if (response.ok) {
          const data = await response.json();
          setSetupRequired(data.setup_required);
        }
      } catch (e) {
        // Если не удалось проверить - показываем ошибку сервера
        console.error('Failed to check setup status:', e);
        setServerError(true);
      } finally {
        setIsCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, []);

  const handleSetupComplete = () => {
    setSetupRequired(false);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_login_time');
    setIsAuthenticated(false);
    setUserRole('viewer');
  }, []);

  // Функция для проверки токена и редиректа при истечении
  const checkTokenAndRedirect = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      // Если токена нет, но пользователь авторизован - разлогиниваем
      if (isAuthenticated) {
        handleLogout();
      }
      return;
    }

    // Проверяем, истек ли токен
    if (isTokenExpired(token)) {
      // Токен истек - очищаем данные и перенаправляем на авторизацию
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_login_time');
      setIsAuthenticated(false);

      // Перенаправляем на страницу авторизации
      window.location.href = window.location.origin + '/admin';
    }
  }, [isAuthenticated, handleLogout]);

  useEffect(() => {
    // Проверяем наличие токена при загрузке
    const token = localStorage.getItem('admin_token');
    if (token) {
      // Проверяем, не истек ли токен сразу при загрузке
      if (isTokenExpired(token)) {
        // Токен уже истек - очищаем и не авторизуем
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_login_time');
        setIsAuthenticated(false);
        setUserRole('viewer');
        setAdminName('Admin');
      } else {
        const { role, username } = getPayloadFromToken(token);
        setIsAuthenticated(true);
        setUserRole(role);
        setAdminName(username);
      }
    }
  }, []);

  // Периодическая проверка токена (каждую минуту)
  useEffect(() => {
    if (isAuthenticated) {
      // Проверяем токен каждую минуту
      checkIntervalRef.current = setInterval(() => {
        checkTokenAndRedirect();
      }, 60000); // 60 секунд

      // Также проверяем при фокусе окна
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          checkTokenAndRedirect();
        }
      };

      // Проверяем при возврате фокуса на окно
      const handleFocus = () => {
        checkTokenAndRedirect();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);

      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      // Очищаем интервал, если пользователь не авторизован
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }
  }, [isAuthenticated, checkTokenAndRedirect]);

  const handleLogin = (role?: string) => {
    setIsAuthenticated(true);
    // Читаем данные из токена
    const token = localStorage.getItem('admin_token');
    if (token) {
      const payload = getPayloadFromToken(token);
      setUserRole(role || payload.role);
      setAdminName(payload.username);
    }
  };

  // Показываем загрузку пока проверяем статус setup
  if (isCheckingSetup) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-muted">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <MiniAppProvider>
        <ThemeProvider>
          <BackButtonProvider>
            {serverError ? (
              <MaintenanceError />
            ) : setupRequired ? (
              <SetupWizard onComplete={handleSetupComplete} />
            ) : !isAuthenticated ? (
              <Login onLogin={handleLogin} />
            ) : (
              <AppLayout
                userRole={userRole}
                adminName={adminName}
                onLogout={handleLogout}
              />
            )}
            <Toaster />
          </BackButtonProvider>
        </ThemeProvider>
      </MiniAppProvider>
    </ErrorBoundary>
  );
}
