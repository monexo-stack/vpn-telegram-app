import {
  Users,
  Globe,
  Key,
  CreditCard,
  Tag,
  UserPlus,
  Link2,
  Megaphone,
  MessageSquare,
  Settings,
  Moon,
  Sun,
  Receipt,
  Wallet,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PageType } from '../App';
import { useTheme } from '../context/ThemeContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { NavUser } from './nav-user';

interface AppSidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout: () => void;
  role: string;
  adminName?: string;
}

interface MenuItem {
  id: PageType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: MenuItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Основное',
    items: [
      { id: 'users', label: 'Пользователи', icon: Users },
      { id: 'locations', label: 'Локации', icon: Globe },
      { id: 'keys', label: 'Ключи', icon: Key },
    ],
  },
  {
    label: 'Финансы',
    items: [
      { id: 'payments', label: 'Платежи', icon: CreditCard },
      { id: 'promocodes', label: 'Промокоды', icon: Tag },
      { id: 'referrals', label: 'Рефералы', icon: UserPlus },
      { id: 'withdrawals', label: 'Выводы', icon: Wallet },
      { id: 'nalog', label: 'Мой Налог', icon: Receipt },
    ],
  },
  {
    label: 'Маркетинг',
    items: [
      { id: 'tracking', label: 'Трекинг', icon: Link2 },
      { id: 'broadcasts', label: 'Рассылки', icon: Megaphone },
    ],
  },
  {
    label: 'Поддержка',
    items: [
      { id: 'support', label: 'Чат поддержки', icon: MessageSquare },
    ],
  },
  {
    label: 'Система',
    items: [
      { id: 'settings', label: 'Настройки', icon: Settings },
    ],
  },
];

export function AppSidebar({
  currentPage,
  onPageChange,
  onLogout,
  role,
  adminName = 'Admin',
}: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="cursor-default">
                <div
                  onClick={toggleTheme}
                  className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:opacity-80 transition-opacity cursor-pointer"
                  title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleTheme()}
                >
                  {theme === 'light' ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Панель управления</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <NavLink to={`/${item.id}`}>
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{ name: adminName, role }}
          onLogout={onLogout}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
