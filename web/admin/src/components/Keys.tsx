import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, ExternalLink, RefreshCw, MoreHorizontal, Loader2, Trash2, Zap, Search, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';
import { useWebSocket } from '../context/WebSocketContext';
import { useMiniApp } from '../context/MiniAppContext';
import { KeyCard } from './miniapp/KeyCard';
import { Input } from './ui/input';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  type Row,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table';
import { apiClient, Key as ApiKey } from '../services/api';
import { KeyDetailsModal } from './KeyDetailsModal';
import { KeysSkeleton } from './ui/skeletons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useKeysWebSocket } from '../hooks/useKeysWebSocket';
import { cn } from './ui/utils';
import { useIsMobile } from './ui/use-mobile';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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

interface VPNKey {
  id: string;
  key: string;
  userId: string;
  userName: string;
  telegramId: string;
  username: string;
  locationCount: number;
  status: 'active' | 'expired';
  created: string;
  expires: string;
  expiresAt?: string | null;
  trafficBytes: number;
  trafficFormatted: string;
  plan: string;
  daysRemaining?: number | null;
  isTrial: boolean;
  isFreeKey: boolean;
  subscriptionToken?: string;
  botScore: number;
  botConfirmed: boolean;
  locationName: string;
  locationId: string;
}

const formatTraffic = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const mapApiKeyToComponent = (apiKey: ApiKey): VPNKey => {
  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ru-RU');
    } catch {
      return '—';
    }
  };

  const status: 'active' | 'expired' = apiKey.active ? 'active' : 'expired';
  const plan = apiKey.plan_name || (apiKey.trial_period ? 'Пробный' : apiKey.free_key ? 'Бесплатный' : 'Неизвестно');
  const trafficBytes = apiKey.traffic || 0;

  return {
    id: apiKey.id.toString(),
    key: apiKey.subscription_url || apiKey.config || 'N/A',
    userId: apiKey.user_tgid.toString(),
    userName: apiKey.user_fullname || '',
    telegramId: apiKey.user_tgid.toString(),
    username: apiKey.user_username || '',
    locationCount: apiKey.locations_count || 1,
    status,
    created: formatDate(apiKey.created_at || undefined),
    expires: formatDate(apiKey.expires_at || undefined),
    expiresAt: apiKey.expires_at || null,
    trafficBytes,
    trafficFormatted: formatTraffic(trafficBytes),
    plan: plan,
    daysRemaining: apiKey.days_remaining,
    isTrial: apiKey.trial_period ?? false,
    isFreeKey: apiKey.free_key ?? false,
    subscriptionToken: apiKey.subscription_token || undefined,
    botScore: apiKey.user_bot_score ?? 0,
    botConfirmed: apiKey.user_bot_confirmed ?? false,
    locationName: apiKey.location_name || '',
    locationId: apiKey.location_id?.toString() || '',
  };
};

export function Keys() {
  const { keyToken } = useParams<{ keyToken: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMiniApp } = useMiniApp();

  const [keys, setKeys] = useState<VPNKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Table state
  const isMobile = useIsMobile();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [hideInactive, setHideInactive] = useState(() => localStorage.getItem('keys_hide_inactive') === 'true');

  // Location filter from URL params (e.g. /keys?location=Germany)
  const locationFilterFromUrl = searchParams.get('location');
  const toggleHideInactive = () => {
    const next = !hideInactive;
    setHideInactive(next);
    localStorage.setItem('keys_hide_inactive', String(next));
  };

  // Hide columns on mobile
  useEffect(() => {
    if (isMobile) {
      setColumnVisibility({
        trafficFormatted: false,
        plan: false,
        locationName: false,
        expires: false,
      });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  // Apply location filter from URL params
  useEffect(() => {
    if (locationFilterFromUrl) {
      setColumnFilters(prev => {
        const without = prev.filter(f => f.id !== 'locationName');
        return [...without, { id: 'locationName', value: [locationFilterFromUrl] }];
      });
    }
  }, [locationFilterFromUrl]);

  // Modal state derived from URL (find key by subscription token)
  const selectedKey = useMemo(() => {
    if (!keyToken) return null;
    return keys.find(k => k.subscriptionToken === keyToken) || null;
  }, [keyToken, keys]);
  const selectedKeyId = selectedKey ? parseInt(selectedKey.id) : null;
  const isModalOpen = !!keyToken;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Reissue state
  const [reissuingKeyId, setReissuingKeyId] = useState<number | null>(null);
  const [bulkReissueProgress, setBulkReissueProgress] = useState<{ current: number; total: number } | null>(null);

  // Delete state
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // WebSocket для real-time обновлений
  const { isConnected: wsConnected, onlineTelegramIds, onlineCount, connectionStatus, trafficByTelegramId } = useKeysWebSocket();
  const { onKeyEvent, onKeyDeleted, isConnected: wsMainConnected } = useWebSocket();

  // Счетчик новых ключей через WebSocket
  const [newKeysCount, setNewKeysCount] = useState(0);
  const newKeysCountRef = useRef(0);

  // Живой таймер для обновления времени каждую секунду
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Функция форматирования оставшегося времени
  const formatTimeRemaining = useCallback((expiresAt: string | null | undefined): { text: string; color: string; isExpired: boolean } => {
    if (!expiresAt) return { text: '—', color: 'text-muted-foreground', isExpired: false };

    const expiresTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const seconds = Math.floor((expiresTime - now) / 1000);

    if (seconds <= 0) {
      return { text: 'Истекла', color: 'border-red-500/50 text-red-500', isExpired: true };
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let text: string;
    let color: string;

    if (days > 0) {
      text = days === 1 ? `1д ${hours}ч` : days < 5 ? `${days}д ${hours}ч` : `${days} дней`;
      color = days <= 3 ? 'border-orange-500/50 text-orange-500' : days <= 7 ? 'border-yellow-500/50 text-yellow-500' : 'border-green-500/50 text-green-500';
    } else if (hours > 0) {
      text = `${hours}ч ${minutes}м`;
      color = 'border-orange-500/50 text-orange-500';
    } else if (minutes > 0) {
      text = `${minutes}м ${secs}с`;
      color = 'border-red-500/50 text-red-500';
    } else {
      text = `${secs}с`;
      color = 'border-red-500/50 text-red-500';
    }

    return { text, color, isExpired: false };
  }, [tick]); // tick в зависимостях для пересчёта каждую секунду

  const copyToClipboard = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    setCopiedKey(keyValue);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleReissueKey = async (keyId: number) => {
    setReissuingKeyId(keyId);
    try {
      await apiClient.reissueKey(keyId);
      toast.success('Ключ перевыпущен');
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при перевыпуске ключа');
    } finally {
      setReissuingKeyId(null);
    }
  };

  const handleBulkReissue = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    // Если есть выбранные — перевыпускаем только их (активные), иначе все активные
    const now = Date.now();
    const targetKeys = selectedRows.length > 0
      ? selectedRows.map(r => r.original).filter(k => k.expiresAt && new Date(k.expiresAt).getTime() > now)
      : keys.filter(k => k.expiresAt && new Date(k.expiresAt).getTime() > now);

    if (targetKeys.length === 0) {
      toast.error('Нет активных ключей для перевыпуска');
      return;
    }

    setBulkReissueProgress({ current: 0, total: targetKeys.length });

    for (let i = 0; i < targetKeys.length; i++) {
      const key = targetKeys[i];
      setReissuingKeyId(parseInt(key.id));
      setBulkReissueProgress({ current: i + 1, total: targetKeys.length });

      try {
        await apiClient.reissueKey(parseInt(key.id));
      } catch {
        // Continue with next key
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setReissuingKeyId(null);
    setBulkReissueProgress(null);
    setShowBulkReissueConfirm(false);
    table.resetRowSelection();
    toast.success(`Перевыпущено ${targetKeys.length} ключей`);
    await fetchKeys();
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    setBulkDeleteLoading(true);
    let deleted = 0;
    for (const row of selectedRows) {
      try {
        await apiClient.deleteKey(parseInt(row.original.id));
        deleted++;
      } catch {
        // Continue
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setBulkDeleteLoading(false);
    setShowBulkDeleteConfirm(false);
    table.resetRowSelection();
    toast.success(`Удалено ${deleted} ключей`);
    await fetchKeys();
  };

  const getUserDisplayName = (key: VPNKey) => {
    if (key.userName) return key.userName;
    if (key.username) return `@${key.username}`;
    return `ID: ${key.telegramId}`;
  };

  // Bulk delete state
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkReissueConfirm, setShowBulkReissueConfirm] = useState(false);

  const columns: ColumnDef<VPNKey>[] = useMemo(() => [
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
      accessorKey: 'key',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ключ" />
      ),
      cell: ({ row }) => {
        const key = row.original;
        return (
          <div className="flex items-center gap-2">
            <code className="text-foreground bg-muted px-2 py-1 rounded-md font-mono text-xs">
              {key.key.substring(0, 16)}...
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(key.key);
              }}
            >
              {copiedKey === key.key ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'userName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Пользователь" />
      ),
      cell: ({ row }) => {
        const key = row.original;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{getUserDisplayName(key) || 'Без имени'}</span>
              {key.username && (
                <a
                  href={`https://t.me/${key.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={`@${key.username}`}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </a>
              )}
              {key.botConfirmed ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20 text-[10px] px-1.5">
                  Бот ✓
                </Badge>
              ) : key.botScore >= 50 ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20 text-[10px] px-1.5">
                  Бот
                </Badge>
              ) : key.botScore >= 25 ? (
                <Badge variant="outline" className="bg-orange-100/30 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-700 text-[10px] px-1.5">
                  Подозр.
                </Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground text-xs font-mono">{key.telegramId}</div>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const key = row.original;
        const searchLower = value.toLowerCase();
        return (
          (key.userName || '').toLowerCase().includes(searchLower) ||
          (key.username || '').toLowerCase().includes(searchLower) ||
          key.telegramId.includes(value)
        );
      },
    },
    {
      accessorKey: 'trafficFormatted',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Трафик" className="justify-center" />
      ),
      meta: { className: 'text-center' },
      cell: ({ row }) => {
        const key = row.original;
        const realtimeTraffic = trafficByTelegramId.get(key.telegramId);
        const trafficBytes = realtimeTraffic
          ? realtimeTraffic.up_bytes + realtimeTraffic.down_bytes
          : key.trafficBytes;
        const trafficFormatted = realtimeTraffic
          ? formatTraffic(trafficBytes)
          : key.trafficFormatted;

        return (
          <span className={cn(
            "text-sm",
            trafficBytes > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {trafficFormatted}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.trafficBytes - rowB.original.trafficBytes;
      },
    },
    {
      accessorKey: 'plan',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Тариф" className="justify-center" />
      ),
      meta: { className: 'text-center' },
      cell: ({ row }) => {
        const plan = row.getValue('plan') as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              plan === 'Пробный' || plan === 'Пробный период' ? 'border-gray-500/50 text-gray-500' :
              plan === 'Бесплатный' ? 'border-blue-500/50 text-blue-500' :
              plan === '1 месяц' ? 'border-blue-500/50 text-blue-500' :
              plan === '3 месяца' ? 'border-green-500/50 text-green-500' :
              plan === '6 месяцев' ? 'border-purple-500/50 text-purple-500' :
              plan === '1 год' ? 'border-orange-500/50 text-orange-500' :
              'border-muted-foreground/50 text-muted-foreground'
            )}
          >
            {plan}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Статус" className="justify-center" />
      ),
      meta: { className: 'text-center' },
      cell: ({ row }) => {
        const key = row.original;
        // Определяем статус динамически на основе времени истечения
        const timeInfo = formatTimeRemaining(key.expiresAt);
        const isActive = !timeInfo.isExpired && key.expiresAt;
        return (
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={cn(
              isActive
                ? 'bg-teal-500/10 text-teal-500 hover:bg-teal-500/20'
                : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
            )}
          >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {isActive ? 'Активен' : 'Истек'}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      id: 'online',
      header: () => <span>Онлайн</span>,
      meta: { className: 'text-center' },
      cell: ({ row }) => {
        const key = row.original;
        const isOnline = onlineTelegramIds.has(key.telegramId);
        return isOnline ? (
          <div className="relative inline-flex items-center justify-center">
            <span className="absolute h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
        ) : (
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'expires',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Истекает" className="justify-center" />
      ),
      meta: { className: 'text-center' },
      cell: ({ row }) => {
        const key = row.original;
        const timeInfo = formatTimeRemaining(key.expiresAt);
        return (
          <div className="inline-flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-sm">{key.expires}</span>
            {key.expiresAt && (
              <Badge
                variant="outline"
                className={cn('text-xs font-mono', timeInfo.color)}
              >
                {timeInfo.text}
              </Badge>
            )}
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.expiresAt ? new Date(rowA.original.expiresAt).getTime() : 0;
        const b = rowB.original.expiresAt ? new Date(rowB.original.expiresAt).getTime() : 0;
        return a - b;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const key = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenModal(key.subscriptionToken)}>
                Подробнее
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handleReissueKey(parseInt(key.id));
              }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Перевыпустить
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingKeyId(parseInt(key.id));
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [onlineTelegramIds, copiedKey, trafficByTelegramId]);

  const fetchKeys = useCallback(async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const apiKeys = await apiClient.getKeys();
      const mappedKeys = apiKeys.map(mapApiKeyToComponent);
      setKeys(mappedKeys);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки ключей');
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  useAutoRefresh(() => fetchKeys(true), { interval: 30000 });

  // Подписка на события ключей через WebSocket
  useEffect(() => {
    const unsubKeyEvent = onKeyEvent((event) => {
      // Новый ключ создан - обновляем список
      newKeysCountRef.current += 1;
      setNewKeysCount(newKeysCountRef.current);

      toast.success('Новый ключ создан!', {
        description: `Пользователь ID: ${event.user_tgid}, Локаций: ${event.locations_count}`,
      });

      // Перезагружаем список ключей
      fetchKeys(true);
    });

    const unsubKeyDeleted = onKeyDeleted((event) => {
      // Ключ удален - убираем из списка
      setKeys(prev => prev.filter(k => !event.key_ids.includes(parseInt(k.id))));

      toast.info('Ключ удален', {
        description: `Удалено ключей: ${event.deleted_count}`,
      });
    });

    return () => {
      unsubKeyEvent();
      unsubKeyDeleted();
    };
  }, [onKeyEvent, onKeyDeleted, fetchKeys]);

  const handleRefreshCleanup = async () => {
    try {
      setIsRefreshing(true);
      await apiClient.triggerKeysCleanup();
      setTimeout(async () => {
        try {
          const apiKeys = await apiClient.getKeys();
          const mappedKeys = apiKeys.map(mapApiKeyToComponent);
          setKeys(mappedKeys);
        } catch {
          // Ignore refresh errors
        }
      }, 3000);
    } catch {
      // Ignore cleanup errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCloseModal = () => {
    navigate('/keys');
  };

  const handleOpenModal = (token: string | undefined) => {
    if (token) {
      navigate(`/keys/${token}`);
    }
  };

  const handleDeleteKey = (keyId: number) => {
    setKeys(keys.filter(k => parseInt(k.id) !== keyId));
  };

  const handleDeleteKeyFromMenu = async () => {
    if (!deletingKeyId) return;

    setIsDeleteLoading(true);
    try {
      await apiClient.deleteKey(deletingKeyId);
      toast.success('Ключ удалён');
      setKeys(keys.filter(k => parseInt(k.id) !== deletingKeyId));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при удалении ключа');
    } finally {
      setIsDeleteLoading(false);
      setDeletingKeyId(null);
    }
  };


  // Подсчёт активных/истекших на основе реального времени
  // ВАЖНО: Этот useMemo должен быть ДО early returns чтобы соблюдать Rules of Hooks
  const { activeKeys, expiredKeys, trialKeys } = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let expired = 0;
    let trial = 0;
    for (const k of keys) {
      if (k.isTrial) trial++;
      if (k.expiresAt) {
        const expiresTime = new Date(k.expiresAt).getTime();
        if (expiresTime > now) {
          active++;
        } else {
          expired++;
        }
      } else {
        expired++;
      }
    }
    return { activeKeys: active, expiredKeys: expired, trialKeys: trial };
  }, [keys, tick]);

  const totalTraffic = useMemo(() => {
    let total = 0;
    for (const k of keys) {
      const rt = trafficByTelegramId.get(k.telegramId);
      total += rt ? (rt.up_bytes + rt.down_bytes) : k.trafficBytes;
    }
    return total;
  }, [keys, trafficByTelegramId]);

  // Filter keys for Mini App search
  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return keys;
    const query = searchQuery.toLowerCase();
    return keys.filter(key =>
      (key.userName || '').toLowerCase().includes(query) ||
      (key.username || '').toLowerCase().includes(query) ||
      key.telegramId.includes(query)
    );
  }, [keys, searchQuery]);

  // Unique location names for filter options
  const locationOptions = useMemo(() => {
    const names = new Set(keys.map(k => k.locationName).filter(Boolean));
    return Array.from(names).sort().map(name => ({ value: name, label: name }));
  }, [keys]);

  const tableData = useMemo(
    () => hideInactive ? keys.filter(k => k.status === 'active') : keys,
    [keys, hideInactive]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const key = row.original;
      return (
        (key.userName || '').toLowerCase().includes(search) ||
        (key.username || '').toLowerCase().includes(search) ||
        key.telegramId.includes(filterValue) ||
        (key.key || '').toLowerCase().includes(search)
      );
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (loading) {
    return <KeysSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
        {error}
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
            <div className="text-lg font-bold">{keys.length}</div>
            <div className="text-[10px] text-muted-foreground">Всего</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">{activeKeys}</div>
            <div className="text-[10px] text-muted-foreground">Активных</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-cyan-500">{onlineCount}</div>
            <div className="text-[10px] text-muted-foreground">Онлайн</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{formatTraffic(totalTraffic)}</div>
            <div className="text-[10px] text-muted-foreground">Трафик</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, @username, TG ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Keys list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredKeys.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет ключей'}
            </div>
          ) : (
            filteredKeys.map((key) => (
              <KeyCard
                key={key.id}
                keyData={{
                  id: key.id,
                  userName: key.userName,
                  username: key.username,
                  telegramId: key.telegramId,
                  plan: key.plan,
                  status: key.status,
                  trafficFormatted: key.trafficFormatted,
                  expires: key.expires,
                  daysRemaining: key.daysRemaining,
                  isOnline: onlineTelegramIds.has(key.telegramId),
                }}
                onClick={() => handleOpenModal(key.subscriptionToken)}
              />
            ))
          )}
        </div>

        {/* Key details modal */}
        {selectedKeyId && (
          <KeyDetailsModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            keyId={selectedKeyId}
            onDelete={handleDeleteKey}
          />
        )}
      </div>
    );
  }

  // Desktop View - Table
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Всего</div>
            {wsMainConnected && (
              <Zap className="h-3 w-3 text-green-500 animate-pulse" title="WebSocket подключен" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{keys.length}</span>
            {newKeysCount > 0 && (
              <span className="text-xs text-green-500 font-medium">+{newKeysCount} новых</span>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Активные</div>
          <div className="text-2xl font-bold text-green-500">{activeKeys}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Истекшие</div>
          <div className="text-2xl font-bold">{expiredKeys}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Трафик</div>
          <div className="text-2xl font-bold">{formatTraffic(totalTraffic)}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
            <span>Онлайн</span>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              wsConnected ? "bg-green-500" : "bg-red-500"
            )} title={wsConnected ? "WebSocket подключен" : "WebSocket отключен"} />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-cyan-500">{onlineCount}</div>
            {onlineCount > 0 && (
              <div className="relative flex items-center justify-center">
                <span className="absolute h-2.5 w-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-green-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 flex-col gap-4">
        <DataTableToolbar
          table={table}
          searchPlaceholder="Поиск по имени, @username, TG ID..."
          filters={[
            ...(locationOptions.length > 0 ? [{
              columnId: 'locationName',
              title: 'Локация',
              options: locationOptions,
            }] : []),
            {
              columnId: 'plan',
              title: 'Тариф',
              options: [
                { value: 'Пробный', label: 'Пробный' },
                { value: '1 месяц', label: '1 месяц' },
                { value: '3 месяца', label: '3 месяца' },
                { value: '6 месяцев', label: '6 месяцев' },
                { value: '1 год', label: '1 год' },
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
          <Button
            onClick={() => handleBulkReissue()}
            disabled={bulkReissueProgress !== null || activeKeys === 0}
            size="sm"
            className="h-8 gap-2 whitespace-nowrap"
          >
            {bulkReissueProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {Math.round((bulkReissueProgress.current / bulkReissueProgress.total) * 100)}%
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Перевыпустить все
              </>
            )}
          </Button>
        </DataTableToolbar>

        {/* Floating Bulk Actions */}
        <DataTableBulkActions table={table} entityName="выбрано">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowBulkReissueConfirm(true)}
                disabled={bulkReissueProgress !== null}
                className="size-8 text-blue-500 hover:bg-blue-500/10"
              >
                {bulkReissueProgress ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Перевыпустить ({table.getFilteredSelectedRowModel().rows.length})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={bulkDeleteLoading}
                className="size-8 text-red-500 hover:bg-red-500/10"
              >
                {bulkDeleteLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Удалить ({table.getFilteredSelectedRowModel().rows.length})</p>
            </TooltipContent>
          </Tooltip>
        </DataTableBulkActions>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="group/row">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
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
                table.getRowModel().rows.map((row) => {
                  const isReissuing = reissuingKeyId === parseInt(row.original.id);
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn(
                        "group/row cursor-pointer transition-all",
                        isReissuing && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => {
                        if (!isReissuing) {
                          handleOpenModal(row.original.subscriptionToken);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "relative",
                            (cell.column.columnDef.meta as any)?.className
                          )}
                        >
                          {isReissuing && cell.column.id === 'key' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination table={table} />
      </div>

      {/* Modal */}
      {selectedKeyId && (
        <KeyDetailsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          keyId={selectedKeyId}
          onDelete={handleDeleteKey}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deletingKeyId !== null}
        onOpenChange={(open) => !open && setDeletingKeyId(null)}
        onConfirm={handleDeleteKeyFromMenu}
        title="Удалить ключ?"
        description={`Вы уверены, что хотите удалить ключ #${deletingKeyId}? Это действие необратимо.`}
        confirmText="Удалить"
        variant="danger"
        loading={isDeleteLoading}
      />

      {/* Bulk Reissue Confirmation */}
      <ConfirmDialog
        open={showBulkReissueConfirm}
        onOpenChange={setShowBulkReissueConfirm}
        onConfirm={handleBulkReissue}
        title={`Перевыпустить ${table.getFilteredSelectedRowModel().rows.length} ключей?`}
        description="Выбранные активные ключи будут перевыпущены. Истекшие ключи будут пропущены."
        confirmText="Перевыпустить"
        variant="info"
        loading={bulkReissueProgress !== null}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        title={`Удалить ${table.getFilteredSelectedRowModel().rows.length} ключей?`}
        description="Выбранные ключи будут безвозвратно удалены. Это действие необратимо."
        confirmText="Удалить"
        variant="danger"
        loading={bulkDeleteLoading}
      />
    </div>
  );
}
