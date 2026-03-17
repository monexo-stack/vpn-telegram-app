import { useLocation, useNavigate } from 'react-router-dom';
import { Users, MapPin, Key, CreditCard, Settings, MoreHorizontal } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const mainTabs = [
  { path: '/users', label: 'Юзеры', icon: Users },
  { path: '/locations', label: 'Локации', icon: MapPin },
  { path: '/keys', label: 'Ключи', icon: Key },
  { path: '/payments', label: 'Платежи', icon: CreditCard },
];

const moreTabs = [
  { path: '/promocodes', label: 'Промокоды' },
  { path: '/referrals', label: 'Рефералы' },
  { path: '/tracking', label: 'Трекинг' },
  { path: '/broadcasts', label: 'Рассылки' },
  { path: '/support', label: 'Поддержка' },
  { path: '/settings', label: 'Настройки' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isMoreActive = moreTabs.some(tab => currentPath.startsWith(tab.path));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPath.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isMoreActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">Ещё</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 mb-2">
            {moreTabs.map((tab) => (
              <DropdownMenuItem
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  currentPath.startsWith(tab.path) && "bg-accent"
                )}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
