import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  type Row,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Download, ExternalLink, Ban, UserCheck, Clock, X, Loader2, Shield, Check, Zap, Search, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket, useOnlineUsers } from '../context/WebSocketContext';
import { useMiniApp } from '../context/MiniAppContext';
import { UserDetailsModal } from './UserDetailsModal';
import { ConfirmDialog } from './ui/confirm-dialog';
import { apiClient, User as ApiUser } from '../services/api';
import { UsersSkeleton } from './ui/skeletons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { cn } from './ui/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { UserCard } from './miniapp/UserCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  DataTableBulkActions,
  DataTableColumnHeader,
  DataTableToolbar,
  DataTablePagination,
} from './data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

interface AnalyticsMetrics {
  paying_users: number;
  active_trial_subs: number;
  total_users: number;
}

interface User {
  id: string;
  name: string;
  telegramId: string;
  username: string;
  plan: string;
  status: 'active' | 'expired' | 'banned' | 'none';
  registered: string;
  lastActive: string;
  revenue: string;
  expiresAt?: string;
  source: 'organic' | 'referral' | 'ad';
  referredBy?: string;
  adCampaign?: string;
  botScore: number;
  botConfirmed: boolean;
  appOpensCount: number;
}

const mapApiUserToComponent = (apiUser: ApiUser): User => {
  const status: 'active' | 'expired' | 'banned' | 'none' = apiUser.banned
    ? 'banned'
    : apiUser.subscription_active
      ? 'active'
      : (apiUser.keys_count > 0 || apiUser.expires_at)
        ? 'expired'
        : 'none';

  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ru-RU');
    } catch {
      return '—';
    }
  };

  const formatRevenue = (revenue: number | undefined): string => {
    if (revenue === undefined || revenue === null || revenue === 0) {
      return '₽0';
    }
    return `₽${revenue.toFixed(2)}`;
  };

  return {
    id: apiUser.id.toString(),
    name: apiUser.fullname || '',
    telegramId: apiUser.tgid.toString(),
    username: apiUser.username || '',
    plan: apiUser.subscription_type || 'Нет подписки',
    status,
    registered: formatDate(apiUser.created_at || undefined),
    lastActive: formatDate(apiUser.last_active || undefined),
    revenue: formatRevenue(apiUser.revenue),
    source: (apiUser.source as 'organic' | 'referral' | 'ad') || 'organic',
    referredBy: apiUser.referral_user_tgid?.toString(),
    adCampaign: apiUser.ad_campaign || undefined,
    botScore: apiUser.bot_score ?? 0,
    botConfirmed: apiUser.bot_confirmed ?? false,
    appOpensCount: apiUser.app_opens_count ?? 0,
  };
};

// Status badge styles
const statusStyles = new Map([
  ['active', 'bg-teal-100/30 text-teal-900 dark:bg-teal-500/20 dark:text-teal-200 border-teal-200 dark:border-teal-700'],
  ['expired', 'bg-neutral-100/30 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600'],
  ['banned', 'bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20'],
  ['none', 'bg-neutral-100/30 text-neutral-500 dark:bg-neutral-500/20 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600'],
]);

const statusLabels: Record<string, string> = {
  active: 'Активен',
  expired: 'Истёк',
  banned: 'Бан',
  none: '—',
};

// Source badge styles - без окантовки
const sourceStyles = new Map([
  ['organic', 'bg-blue-100/30 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200 border-transparent'],
  ['referral', 'bg-purple-100/30 text-purple-900 dark:bg-purple-500/20 dark:text-purple-200 border-transparent'],
  ['ad', 'bg-orange-100/30 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200 border-transparent'],
]);

const sourceLabels: Record<string, string> = {
  organic: 'Органика',
  referral: 'Реферал',
  ad: 'Реклама',
};

// Plan badge styles - идентично странице Payments
const planStyles = new Map([
  ['Пробный', 'border-muted-foreground/50 text-muted-foreground'],
  ['trial', 'border-muted-foreground/50 text-muted-foreground'],
  ['Trial', 'border-muted-foreground/50 text-muted-foreground'],
  ['1 месяц', 'border-blue-500/50 text-blue-500'],
  ['1 мес.', 'border-blue-500/50 text-blue-500'],
  ['1 month', 'border-blue-500/50 text-blue-500'],
  ['3 месяца', 'border-green-500/50 text-green-500'],
  ['3 мес.', 'border-green-500/50 text-green-500'],
  ['3 months', 'border-green-500/50 text-green-500'],
  ['6 месяцев', 'border-purple-500/50 text-purple-500'],
  ['6 мес.', 'border-purple-500/50 text-purple-500'],
  ['6 months', 'border-purple-500/50 text-purple-500'],
  ['1 год', 'border-orange-500/50 text-orange-500'],
  ['12 мес.', 'border-orange-500/50 text-orange-500'],
  ['1 year', 'border-orange-500/50 text-orange-500'],
  ['12 months', 'border-orange-500/50 text-orange-500'],
]);

const planLabels: Record<string, string> = {
  '1 month': '1 месяц',
  '1 мес.': '1 месяц',
  '3 months': '3 месяца',
  '3 мес.': '3 месяца',
  '6 months': '6 месяцев',
  '6 мес.': '6 месяцев',
  '1 year': '1 год',
  '12 months': '1 год',
  '12 мес.': '1 год',
  'trial': 'Пробный',
  'Trial': 'Пробный',
};

// Стиль для множественных тарифов (2 тарифа, 3 тарифа и т.д.)
const getMultiplePlanStyle = (plan: string) => {
  if (/\d+\s*(тариф|tariff)/i.test(plan)) {
    return 'border-cyan-500/50 text-cyan-500';
  }
  return null;
};

// План для массового назначения
const BULK_PLANS = [
  { id: 'trial', name: 'Пробный', duration: '3 дня' },
  { id: '1month', name: '1 месяц', duration: '30 дней' },
  { id: '3months', name: '3 месяца', duration: '90 дней' },
  { id: '6months', name: '6 месяцев', duration: '180 дней' },
  { id: '12months', name: '1 год', duration: '365 дней' },
];

export function Users() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isMiniApp } = useMiniApp();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket для real-time обновлений
  const { onUserEvent, onUserDeleted, isConnected } = useWebSocket();
  const { isConnected: wsOnlineConnected, appOnlineCount } = useOnlineUsers();

  const fetchUsers = useCallback(async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const [apiUsers, analytics] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getAnalytics().catch(() => null)
      ]);
      const mappedUsers = apiUsers.map(mapApiUserToComponent);
      setUsers(mappedUsers);
      if (analytics?.metrics) {
        setMetrics(analytics.metrics as AnalyticsMetrics);
      }
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки пользователей');
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useAutoRefresh(() => fetchUsers(true), { interval: 30000 });

  // Real-time обновления через WebSocket
  useEffect(() => {
    const unsubUserEvent = onUserEvent((event) => {
      console.log('[Users] User event via WebSocket:', event);

      // Обновляем статус пользователя в списке
      setUsers(prev => prev.map(user => {
        if (user.telegramId === event.tgid.toString()) {
          return {
            ...user,
            status: event.action === 'banned' ? 'banned' : (user.plan !== 'Нет подписки' ? 'active' : 'none')
          };
        }
        return user;
      }));

      // Показываем уведомление
      const actionText = event.action === 'banned' ? 'заблокирован' : 'разблокирован';
      toast.info(`Пользователь ${actionText}`, {
        description: event.fullname || event.username || `ID: ${event.tgid}`,
        duration: 3000,
      });
    });

    const unsubUserDeleted = onUserDeleted((event) => {
      console.log('[Users] User deleted via WebSocket:', event);

      // Удаляем пользователя из списка
      setUsers(prev => prev.filter(user => user.telegramId !== event.tgid.toString()));

      // Показываем уведомление
      toast.info('Пользователь удалён', {
        description: event.fullname || event.username || `ID: ${event.tgid}`,
        duration: 3000,
      });
    });

    return () => {
      unsubUserEvent();
      unsubUserDeleted();
    };
  }, [onUserEvent, onUserDeleted]);

  // Modal state derived from URL
  const selectedUser = useMemo(() => {
    if (!userId) return null;
    return users.find(u => u.telegramId === userId) || null;
  }, [userId, users]);
  const isModalOpen = !!userId;

  // Bulk operations
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showUnbanConfirm, setShowUnbanConfirm] = useState(false);
  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hideInactive, setHideInactive] = useState(() => localStorage.getItem('users_hide_inactive') === 'true');
  const toggleHideInactive = () => {
    const next = !hideInactive;
    setHideInactive(next);
    localStorage.setItem('users_hide_inactive', String(next));
  };

  const handleUserClick = (user: User) => {
    navigate(`/users/${user.telegramId}`);
  };

  const handleCloseModal = () => {
    navigate('/users');
  };

  const handleExport = async () => {
    try {
      const blob = await apiClient.exportUsers('all');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error('Ошибка экспорта пользователей');
    }
  };

  // Column definitions
  const columns: ColumnDef<User>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Выбрать все"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Выбрать строку"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Пользователь" />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{user.name || 'Без имени'}</span>
              {user.username && (
                <a
                  href={`https://t.me/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={`@${user.username}`}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </a>
              )}
              {user.botConfirmed ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20 text-[10px] px-1.5">
                  Бот ✓
                </Badge>
              ) : user.botScore >= 50 ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20 text-[10px] px-1.5">
                  Бот
                </Badge>
              ) : user.botScore >= 25 ? (
                <Badge variant="outline" className="bg-orange-100/30 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-700 text-[10px] px-1.5">
                  Подозр.
                </Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground text-xs font-mono">{user.telegramId}</div>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const user = row.original;
        const searchLower = value.toLowerCase();
        return (
          (user.name || '').toLowerCase().includes(searchLower) ||
          (user.username || '').toLowerCase().includes(searchLower) ||
          (user.telegramId || '').includes(value)
        );
      },
      enableHiding: false,
    },
    {
      accessorKey: 'source',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Источник" className="justify-center" />
      ),
      cell: ({ row }) => {
        const source = row.getValue('source') as string;
        return (
          <Badge variant="outline" className={cn('capitalize', sourceStyles.get(source))}>
            {sourceLabels[source] || source}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'botScore',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Score" className="justify-center" />
      ),
      cell: ({ row }) => {
        const score = row.getValue('botScore') as number;
        const confirmed = row.original.botConfirmed;
        if (confirmed) {
          return <span className="text-destructive font-semibold text-xs">{score} ✓</span>;
        }
        if (score >= 50) {
          return <span className="text-destructive font-medium text-xs">{score}</span>;
        }
        if (score >= 25) {
          return <span className="text-orange-600 dark:text-orange-400 font-medium text-xs">{score}</span>;
        }
        return <span className="text-muted-foreground text-xs">{score}</span>;
      },
      filterFn: (row, id, value) => {
        const score = row.getValue(id) as number;
        if (value.includes('bot')) return score >= 50;
        if (value.includes('suspicious')) return score >= 25;
        return true;
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'plan',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Тариф" className="justify-center" />
      ),
      cell: ({ row }) => {
        const plan = row.getValue('plan') as string;
        if (plan === 'Нет подписки') {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        const displayName = planLabels[plan] || plan;
        const style = planStyles.get(plan) || getMultiplePlanStyle(plan) || 'border-muted-foreground/50 text-muted-foreground';
        return (
          <Badge variant="outline" className={cn(style)}>
            {displayName}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Статус" className="justify-center" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        if (status === 'none') {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <Badge variant="outline" className={cn('capitalize', statusStyles.get(status))}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      enableHiding: false,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'registered',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('registered')}</span>
      ),
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'revenue',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Доход" className="justify-center" />
      ),
      cell: ({ row }) => {
        const revenue = row.getValue('revenue') as string;
        const hasRevenue = revenue !== '₽0' && revenue !== '₽0.00';
        return (
          <span className={cn('font-medium', hasRevenue ? 'text-green-600' : 'text-muted-foreground')}>
            {revenue}
          </span>
        );
      },
      meta: { className: 'text-center' },
    },
  ], []);

  const tableData = useMemo(
    () => hideInactive ? users.filter(u => u.status === 'active' || u.status === 'banned') : users,
    [users, hideInactive]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  // Smart filtering for bulk operations
  const usersToBan = useMemo(() =>
    selectedRows.filter(row => row.original.status !== 'banned'),
    [selectedRows]
  );
  const usersToUnban = useMemo(() =>
    selectedRows.filter(row => row.original.status === 'banned'),
    [selectedRows]
  );
  const usersToAssignPlan = useMemo(() =>
    selectedRows.filter(row => row.original.status !== 'active'),
    [selectedRows]
  );
  const usersToExtend = useMemo(() =>
    selectedRows.filter(row => row.original.status === 'active'),
    [selectedRows]
  );

  const clearSelection = () => {
    table.resetRowSelection();
  };

  const handleBulkBan = async () => {
    if (usersToBan.length === 0) return;
    setBulkActionLoading(true);
    try {
      const toBanIds = new Set(usersToBan.map((row: Row<User>) => row.original.id));
      const promises = usersToBan.map((row: Row<User>) => {
        return apiClient.banUser(parseInt(row.original.telegramId));
      });
      await Promise.all(promises);

      setUsers(prev => prev.map(u =>
        toBanIds.has(u.id) ? { ...u, status: 'banned' as const } : u
      ));
      clearSelection();
      setShowBanConfirm(false);
      toast.success(`${usersToBan.length} пользователей заблокировано`);
    } catch (err) {
      console.error('Bulk ban error:', err);
      toast.error('Ошибка при блокировке пользователей');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (usersToUnban.length === 0) return;
    setBulkActionLoading(true);
    try {
      const toUnbanIds = new Set(usersToUnban.map((row: Row<User>) => row.original.id));
      const promises = usersToUnban.map((row: Row<User>) => {
        return apiClient.unbanUser(parseInt(row.original.telegramId));
      });
      await Promise.all(promises);

      setUsers(prev => prev.map(u =>
        toUnbanIds.has(u.id) ? { ...u, status: u.plan !== 'Нет подписки' ? 'active' as const : 'none' as const } : u
      ));
      clearSelection();
      setShowUnbanConfirm(false);
      toast.success(`${usersToUnban.length} пользователей разблокировано`);
    } catch (err) {
      console.error('Bulk unban error:', err);
      toast.error('Ошибка при разблокировке пользователей');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkAssignPlan = async () => {
    if (usersToAssignPlan.length === 0 || !selectedPlanId) return;
    setBulkActionLoading(true);
    try {
      const promises = usersToAssignPlan.map((row: Row<User>) => {
        return apiClient.createSubscriptionForUser(parseInt(row.original.telegramId), selectedPlanId);
      });
      await Promise.all(promises);

      const apiUsers = await apiClient.getUsers();
      const mappedUsers = apiUsers.map(mapApiUserToComponent);
      setUsers(mappedUsers);

      clearSelection();
      setShowAssignPlanModal(false);
      setSelectedPlanId(null);
      toast.success(`Тариф подключен ${usersToAssignPlan.length} пользователям`);
    } catch (err) {
      console.error('Bulk assign plan error:', err);
      toast.error('Ошибка при подключении тарифа');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkExtend = async () => {
    if (usersToExtend.length === 0) return;
    setBulkActionLoading(true);
    try {
      const promises = usersToExtend.map((row: Row<User>) => {
        return apiClient.extendUserSubscription(parseInt(row.original.telegramId), extendDays);
      });
      await Promise.all(promises);

      const apiUsers = await apiClient.getUsers();
      const mappedUsers = apiUsers.map(mapApiUserToComponent);
      setUsers(mappedUsers);

      clearSelection();
      setShowExtendModal(false);
      toast.success(`Подписка продлена ${usersToExtend.length} пользователям на ${extendDays} дней`);
    } catch (err) {
      console.error('Bulk extend error:', err);
      toast.error('Ошибка при продлении подписок');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const expiredUsers = users.filter(u => u.status === 'expired').length;
  const bannedUsers = users.filter(u => u.status === 'banned').length;

  // Filter users for Mini App search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.telegramId.includes(query)
    );
  }, [users, searchQuery]);

  if (loading) {
    return <UsersSkeleton />;
  }

  if (error) {
    return (
      <div className="">
        <div className="bg-destructive/10 border border-destructive rounded-xl p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  // Mini App View - Cards instead of table
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Stats row - compact */}
        <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
          <div className="text-center">
            <div className="text-lg font-bold">{users.length}</div>
            <div className="text-[10px] text-muted-foreground">Всего</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">{metrics?.paying_users || 0}</div>
            <div className="text-[10px] text-muted-foreground">Платящих</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-cyan-500">{appOnlineCount}</div>
            <div className="text-[10px] text-muted-foreground">Онлайн</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{expiredUsers}</div>
            <div className="text-[10px] text-muted-foreground">Истёкших</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, username, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Users list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет пользователей'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <UserCard
                key={user.telegramId}
                user={{
                  telegramId: user.telegramId,
                  name: user.name,
                  username: user.username,
                  status: user.status,
                  plan: user.plan !== 'Нет подписки' ? user.plan : undefined,
                  revenue: user.revenue,
                }}
                onClick={() => navigate(`/users/${user.telegramId}`)}
              />
            ))
          )}
        </div>

        {/* User details modal */}
        <UserDetailsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          user={selectedUser}
        />
      </div>
    );
  }

  // Desktop View - Table
  return (
    <div className="flex flex-1 flex-col">
      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Всего</div>
          <div className="text-2xl font-bold">{users.length.toLocaleString('ru-RU')}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Платящих</div>
          <div className="text-2xl font-bold text-green-500">{metrics?.paying_users || 0}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Пробные</div>
          <div className="text-2xl font-bold">{metrics?.active_trial_subs || 0}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Истекшие / Забл.</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{expiredUsers}</span>
            {bannedUsers > 0 && (
              <span className="text-sm font-medium text-red-500">/ {bannedUsers}</span>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
            <span>В приложении</span>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              wsOnlineConnected ? "bg-green-500" : "bg-red-500"
            )} />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-cyan-500">{appOnlineCount}</div>
            {appOnlineCount > 0 && (
              <div className="relative flex items-center justify-center">
                <span className="absolute h-2.5 w-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-green-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Toolbar */}
        <DataTableToolbar
          table={table}
          searchPlaceholder="Поиск по имени, username, ID..."
          searchKey="name"
          filters={[
            {
              columnId: 'status',
              title: 'Статус',
              options: [
                { label: 'Заблокирован', value: 'banned' },
              ],
            },
            {
              columnId: 'source',
              title: 'Источник',
              options: [
                { label: 'Органика', value: 'organic' },
                { label: 'Реферал', value: 'referral' },
                { label: 'Реклама', value: 'ad' },
              ],
            },
            {
              columnId: 'botScore',
              title: 'Бот-скор',
              options: [
                { label: 'Боты (50+)', value: 'bot' },
                { label: 'Подозр. (25+)', value: 'suspicious' },
              ],
            },
            {
              columnId: 'plan',
              title: 'Тариф',
              options: [
                { label: 'Пробный', value: 'Пробный' },
                { label: '1 месяц', value: '1 месяц' },
                { label: '3 месяца', value: '3 месяца' },
                { label: '6 месяцев', value: '6 месяцев' },
                { label: '1 год', value: '1 год' },
              ],
            },
          ]}
        >
          <Button
            variant={hideInactive ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 gap-1.5 whitespace-nowrap"
            onClick={toggleHideInactive}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {hideInactive ? 'Показать всех' : 'Скрыть неактивных'}
          </Button>
          <Button onClick={handleExport} size="sm" className="h-8">
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
        </DataTableToolbar>

        {/* Floating Bulk Actions */}
        <DataTableBulkActions table={table} entityName="выбрано">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowBanConfirm(true)}
                disabled={bulkActionLoading || usersToBan.length === 0}
                className="size-8 text-red-500 hover:bg-red-500/10"
              >
                {bulkActionLoading ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Заблокировать ({usersToBan.length} из {selectedRows.length})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowUnbanConfirm(true)}
                disabled={bulkActionLoading || usersToUnban.length === 0}
                className="size-8 text-green-500 hover:bg-green-500/10"
              >
                {bulkActionLoading ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Разблокировать ({usersToUnban.length} из {selectedRows.length})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAssignPlanModal(true)}
                disabled={bulkActionLoading || usersToAssignPlan.length === 0}
                className="size-8 text-purple-500 hover:bg-purple-500/10"
              >
                {bulkActionLoading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Подключить тариф ({usersToAssignPlan.length} из {selectedRows.length})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowExtendModal(true)}
                disabled={bulkActionLoading || usersToExtend.length === 0}
                className="size-8 text-blue-500 hover:bg-blue-500/10"
              >
                {bulkActionLoading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Продлить подписку ({usersToExtend.length} из {selectedRows.length})</p>
            </TooltipContent>
          </Tooltip>
        </DataTableBulkActions>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="group/row">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "whitespace-nowrap",
                        (header.column.columnDef.meta as any)?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="group/row cursor-pointer"
                    onClick={() => handleUserClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={(cell.column.columnDef.meta as any)?.className}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Нет данных
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} />
      </div>

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        user={selectedUser}
      />

      {/* Extend Subscription Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExtendModal(false)}>
          <div className="bg-card rounded-lg border border-border p-5 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Продлить подписку</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExtendModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="text-muted-foreground mb-4 space-y-1">
              <p>Будет продлено: <span className="text-foreground font-medium">{usersToExtend.length}</span> из {selectedRows.length} пользователей</p>
              {selectedRows.length - usersToExtend.length > 0 && (
                <p className="text-xs text-amber-500">
                  {selectedRows.length - usersToExtend.length} пользователей без активной подписки будут пропущены
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-muted-foreground mb-2 text-sm uppercase tracking-wider">
                Количество дней
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[7, 14, 30, 90].map(days => (
                  <Button
                    key={days}
                    variant={extendDays === days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExtendDays(days)}
                  >
                    {days} дн.
                  </Button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="365"
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                placeholder="Введите количество дней"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExtendModal(false)}
              >
                Отмена
              </Button>
              <Button
                className="flex-1"
                onClick={handleBulkExtend}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Продление...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Продлить на {extendDays} дн.
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {showAssignPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignPlanModal(false)}>
          <div className="bg-card rounded-lg border border-border p-5 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Подключить тариф</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAssignPlanModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="text-muted-foreground mb-4 space-y-1">
              <p>Тариф будет подключен: <span className="text-foreground font-medium">{usersToAssignPlan.length}</span> из {selectedRows.length} пользователей</p>
              {selectedRows.length - usersToAssignPlan.length > 0 && (
                <p className="text-xs text-amber-500">
                  {selectedRows.length - usersToAssignPlan.length} пользователей уже с активной подпиской будут пропущены
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-muted-foreground mb-2 text-sm uppercase tracking-wider">
                Выберите тариф
              </label>
              <div className="space-y-2">
                {BULK_PLANS.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                      selectedPlanId === plan.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-sm">{plan.duration}</span>
                    {selectedPlanId === plan.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAssignPlanModal(false);
                  setSelectedPlanId(null);
                }}
              >
                Отмена
              </Button>
              <Button
                className="flex-1"
                onClick={handleBulkAssignPlan}
                disabled={bulkActionLoading || !selectedPlanId}
              >
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Подключение...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Подключить
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation */}
      <ConfirmDialog
        open={showBanConfirm}
        onOpenChange={setShowBanConfirm}
        onConfirm={handleBulkBan}
        title={`Заблокировать ${usersToBan.length} пользователей?`}
        description={
          selectedRows.length === usersToBan.length
            ? "Выбранные пользователи потеряют доступ к VPN."
            : `Будет заблокировано ${usersToBan.length} из ${selectedRows.length} пользователей. ${selectedRows.length - usersToBan.length} уже заблокированы и будут пропущены.`
        }
        confirmText="Заблокировать"
        variant="danger"
        loading={bulkActionLoading}
      />

      {/* Unban Confirmation */}
      <ConfirmDialog
        open={showUnbanConfirm}
        onOpenChange={setShowUnbanConfirm}
        onConfirm={handleBulkUnban}
        title={`Разблокировать ${usersToUnban.length} пользователей?`}
        description={
          selectedRows.length === usersToUnban.length
            ? "Выбранные пользователи снова получат доступ к VPN."
            : `Будет разблокировано ${usersToUnban.length} из ${selectedRows.length} пользователей. ${selectedRows.length - usersToUnban.length} не заблокированы и будут пропущены.`
        }
        confirmText="Разблокировать"
        variant="info"
        loading={bulkActionLoading}
      />
    </div>
  );
}
