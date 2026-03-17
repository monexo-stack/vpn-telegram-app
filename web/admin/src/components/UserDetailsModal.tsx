import React, { useState, useEffect, useCallback } from 'react';
import {
  User as UserIcon,
  Shield,
  Calendar,
  Clock,
  CreditCard,
  Ban,
  CheckCircle,
  Plus,
  RefreshCw,
  Loader2,
  ExternalLink,
  Key,
  TrendingUp,
  Users,
  Copy,
  Check,
  Timer,
  Trash2,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';
import { ExtendSubscriptionModal } from './ExtendSubscriptionModal';
import { SelectPlanModal } from './SelectPlanModal';
import { apiClient } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { useBackButton } from '../hooks/useBackButton';

interface User {
  id: string;
  name: string;
  telegramId: string;
  username: string;
  plan: string;
  status: 'active' | 'expired' | 'banned' | 'none';
  registered: string;
  lastActive: string;
  lastActiveTimestamp?: string | Date;
  revenue: string;
  expiresAt?: string;
  source?: 'organic' | 'referral' | 'ad';
}

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

interface Transaction {
  id: string;
  date: string;
  amount: string;
  plan: string;
  status: string;
}

interface Referral {
  id: string;
  name: string;
  username: string;
  date: string;
  earned: string;
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '—';

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 120) return 'Сейчас в приложении';

    if (diffMinutes < 60) {
      const lastDigit = diffMinutes % 10;
      const lastTwoDigits = diffMinutes % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${diffMinutes} минут назад`;
      if (lastDigit === 1) return `${diffMinutes} минуту назад`;
      if (lastDigit >= 2 && lastDigit <= 4) return `${diffMinutes} минуты назад`;
      return `${diffMinutes} минут назад`;
    }

    if (diffHours < 24) {
      const lastDigit = diffHours % 10;
      if (diffHours === 1) return 'час назад';
      if (lastDigit >= 2 && lastDigit <= 4 && (diffHours < 12 || diffHours > 14)) return `${diffHours} часа назад`;
      return `${diffHours} часов назад`;
    }

    if (diffDays < 30) {
      const lastDigit = diffDays % 10;
      const lastTwoDigits = diffDays % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${diffDays} дней назад`;
      if (lastDigit === 1) return `${diffDays} день назад`;
      if (lastDigit >= 2 && lastDigit <= 4) return `${diffDays} дня назад`;
      return `${diffDays} дней назад`;
    }

    if (diffMonths < 12) {
      const lastDigit = diffMonths % 10;
      const lastTwoDigits = diffMonths % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${diffMonths} месяцев назад`;
      if (lastDigit === 1) return `${diffMonths} месяц назад`;
      if (lastDigit >= 2 && lastDigit <= 4) return `${diffMonths} месяца назад`;
      return `${diffMonths} месяцев назад`;
    }

    const lastDigit = diffYears % 10;
    const lastTwoDigits = diffYears % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${diffYears} лет назад`;
    if (lastDigit === 1) return `${diffYears} год назад`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${diffYears} года назад`;
    return `${diffYears} лет назад`;
  } catch {
    return '—';
  }
}

function isOnline(lastActive: string | Date | null | undefined): boolean {
  if (!lastActive) return false;
  try {
    const dateObj = typeof lastActive === 'string' ? new Date(lastActive) : lastActive;
    if (isNaN(dateObj.getTime())) return false;
    const diffMs = Date.now() - dateObj.getTime();
    return diffMs < 120000; // 2 minutes
  } catch {
    return false;
  }
}

function getDaysRemaining(expiresAt: string | number | null | undefined): number | null {
  if (!expiresAt) return null;
  try {
    let expiresDate: Date;
    if (typeof expiresAt === 'number') {
      expiresDate = new Date(expiresAt * 1000);
    } else {
      expiresDate = new Date(expiresAt);
    }
    if (isNaN(expiresDate.getTime())) return null;
    const diffMs = expiresDate.getTime() - Date.now();
    if (diffMs < 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

const SOURCE_LABELS: Record<string, string> = {
  organic: 'Органика',
  referral: 'Реферал',
  ad: 'Реклама',
};

const SOURCE_STYLES: Record<string, string> = {
  organic: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  referral: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ad: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export function UserDetailsModal({ isOpen, onClose, user }: UserDetailsModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<string>('info');
  const [showSelectPlanModal, setShowSelectPlanModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState<string>('₽0');
  const [userData, setUserData] = useState<User | null>(user);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [userKeys, setUserKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [userKeysHistory, setUserKeysHistory] = useState<any[]>([]);
  const [loadingKeysHistory, setLoadingKeysHistory] = useState(false);
  const [timeUpdateTrigger, setTimeUpdateTrigger] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  const formatCurrency = (value: number) => `₽${value.toFixed(2)}`;
  const normalizeAmount = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 0;
    const numeric = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const getStatusMeta = (status?: string | null) => {
    const normalized = (status || '').toLowerCase();
    if (['pending', 'process', 'processing', 'created'].includes(normalized)) {
      return { label: 'В обработке', color: 'text-orange-500', dot: 'bg-orange-500' };
    }
    if (['failed', 'error', 'canceled', 'cancelled'].includes(normalized)) {
      return { label: 'Неуспешно', color: 'text-red-500', dot: 'bg-red-500' };
    }
    if (['refunded', 'returned'].includes(normalized)) {
      return { label: 'Возврат', color: 'text-blue-500', dot: 'bg-blue-500' };
    }
    return { label: 'Успешно', color: 'text-green-500', dot: 'bg-green-500' };
  };

  useEffect(() => {
    setUserData(user);
  }, [user]);

  // Load all data at once when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const tgid = parseInt(user.telegramId);

      // Load everything in parallel
      refreshUserData();
      loadUserKeys();
      loadUserKeysHistory();
      loadTransactions(tgid);
      loadReferrals(tgid);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTimeUpdateTrigger(prev => prev + 1), 60000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const loadTransactions = async (tgid: number) => {
    setLoadingTransactions(true);
    try {
      const payments = await apiClient.getUserPayments(tgid);
      const formattedTransactions: Transaction[] = payments.map(payment => {
        let dateStr = '—';
        if (payment.date) {
          try {
            const date = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
            dateStr = date.toLocaleDateString('ru-RU');
          } catch {
            dateStr = String(payment.date);
          }
        }
        return {
          id: payment.id.toString(),
          date: dateStr,
          amount: formatCurrency(normalizeAmount(payment.amount)),
          plan: payment.plan || 'Неизвестно',
          status: payment.status || 'success'
        };
      });
      setTransactions(formattedTransactions);
      // Also calculate revenue from same data
      const total = payments.reduce((sum, payment) => sum + normalizeAmount(payment.amount), 0);
      setTotalRevenue(formatCurrency(total));
    } catch {
      setTransactions([]);
      setTotalRevenue('₽0');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadReferrals = async (tgid: number) => {
    setLoadingReferrals(true);
    try {
      const refs = await apiClient.getUserReferrals(tgid);
      const formattedReferrals: Referral[] = refs.map(ref => ({
        id: ref.id.toString(),
        name: ref.name || '',
        username: ref.username || '',
        date: ref.date || '—',
        earned: ref.earned || '₽0'
      }));
      setReferrals(formattedReferrals);
    } catch {
      setReferrals([]);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const loadUserKeys = async () => {
    if (!user) return;
    setLoadingKeys(true);
    try {
      const tgid = parseInt(user.telegramId);
      const keys = await apiClient.getUserKeys(tgid);
      setUserKeys(keys.filter(key => key.active === true));
    } catch {
      setUserKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadUserKeysHistory = async () => {
    if (!user) return;
    setLoadingKeysHistory(true);
    try {
      const tgid = parseInt(user.telegramId);
      const keys = await apiClient.getUserKeysHistory(tgid);
      setUserKeysHistory(keys);
    } catch {
      setUserKeysHistory([]);
    } finally {
      setLoadingKeysHistory(false);
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    setLoadingUserData(true);
    try {
      const tgid = parseInt(user.telegramId);
      const apiUser = await apiClient.getUserByTgid(tgid);
      const updatedUser: User = {
        ...user,
        status: apiUser.banned ? 'banned' : apiUser.subscription_active ? 'active' : 'none',
        plan: apiUser.subscription_type || 'Нет подписки',
        expiresAt: apiUser.expires_at || undefined,
        registered: apiUser.created_at ? new Date(apiUser.created_at).toLocaleDateString('ru-RU') : user.registered,
        lastActive: apiUser.last_active ? new Date(apiUser.last_active).toLocaleDateString('ru-RU') : user.lastActive,
        lastActiveTimestamp: apiUser.last_active || undefined,
        source: apiUser.source || user.source,
      };
      setUserData(updatedUser);
    } catch {
      // Error handled silently
    } finally {
      setLoadingUserData(false);
    }
  };

  // Группировка ключей по токену подписки (должно быть до условного return)
  const groupedSubscriptions = React.useMemo(() => {
    const groups = new Map<string, { token: string; keys: typeof userKeysHistory; plan?: string; expiresAt?: Date; isActive: boolean; isTrial: boolean }>();

    for (const key of userKeysHistory) {
      const token = key.subscription_token || `single_${key.id}`;
      if (!groups.has(token)) {
        const expiresDate = key.subscription > 0 ? new Date(key.subscription * 1000) : undefined;
        groups.set(token, {
          token,
          keys: [],
          plan: key.plan_name || (key.trial_period ? 'Пробный' : 'Платный'),
          expiresAt: expiresDate,
          isActive: false, // Будет обновлено ниже
          isTrial: key.trial_period || false
        });
      }
      const group = groups.get(token)!;
      group.keys.push(key);
      // Подписка активна, если хотя бы один ключ активен
      if (key.active) {
        group.isActive = true;
      }
    }

    return Array.from(groups.values());
  }, [userKeysHistory]);

  if (!user) return null;

  const getUserDisplayName = (u: User | Referral) => {
    if ('name' in u && u.name) return u.name;
    if ('username' in u && u.username) return `@${u.username}`;
    if ('telegramId' in u) return `ID: ${u.telegramId}`;
    return 'Пользователь';
  };

  const currentUser = userData || user;

  const handleBanUser = async () => {
    if (!user) return;
    const isBanned = currentUser.status === 'banned';

    setIsLoading(true);

    try {
      const tgid = parseInt(user.telegramId);
      if (isBanned) {
        await apiClient.unbanUser(tgid);
        toast.success('Пользователь успешно разблокирован');
      } else {
        await apiClient.banUser(tgid);
        toast.success('Пользователь успешно заблокирован');
      }
      await refreshUserData();
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Ошибка при ${isBanned ? 'разблокировке' : 'блокировке'} пользователя`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignPlan = async (planId: string) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const tgid = parseInt(user.telegramId);
      const result = await apiClient.createSubscriptionForUser(tgid, planId);
      toast.success(`Подписка создана! Ключей: ${result.successful_locations}/${result.total_locations}`);
      setShowSelectPlanModal(false);
      await refreshUserData();
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при создании подписки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendPlan = () => {
    setShowExtendModal(true);
  };

  const handleConfirmExtend = async (days: number) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const tgid = parseInt(user.telegramId);
      const result = await apiClient.extendUserSubscription(tgid, days);
      toast.success(`Подписка продлена на ${days} дней! Ключей: ${result.extended_keys}`);
      setShowExtendModal(false);
      await refreshUserData();
      await loadUserKeys();
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при продлении подписки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      await apiClient.deleteUser(parseInt(user.id));
      toast.success('Пользователь удалён');
      onClose();
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при удалении пользователя');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} variant="fullscreen">
        <DialogContent
          hideCloseButton
          className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-[700px] sm:max-h-[90vh]"
        >
          {/* Header */}
          <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 flex-wrap pr-8">
              <DialogTitle className="text-xl flex items-center gap-2">
                {getUserDisplayName(currentUser)}
                {isOnline(currentUser.lastActiveTimestamp) && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                )}
              </DialogTitle>
              {currentUser.source && (
                <Badge variant="outline" className={cn("text-xs", SOURCE_STYLES[currentUser.source])}>
                  {SOURCE_LABELS[currentUser.source]}
                </Badge>
              )}
            </div>
            <DialogDescription className="flex items-center gap-2 mt-1.5 flex-wrap">
              {currentUser.username && (
                <button
                  onClick={() => copyToClipboard(`@${currentUser.username}`, 'username')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                >
                  <a
                    href={`https://t.me/${currentUser.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    @{currentUser.username}
                  </a>
                  {copiedField === 'username' ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              )}
              <button
                onClick={() => copyToClipboard(currentUser.telegramId, 'id')}
                className="flex items-center gap-1.5 text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors group"
              >
                <code>ID: {currentUser.telegramId}</code>
                {copiedField === 'id' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              {loadingUserData && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </DialogDescription>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {/* Кнопка "Тариф" - только если нет подписки (ключей ещё нет) */}
              {(currentUser.status === 'none' && !currentUser.expiresAt) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSelectPlanModal(true)}
                  disabled={isLoading}
                  className="h-9 sm:h-8 gap-1.5 flex-1 sm:flex-none"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span className="max-sm:sr-only">Тариф</span>
                  <span className="sm:hidden">Тариф</span>
                </Button>
              )}
              {/* Кнопка "Продлить" - только если есть подписка (ключи созданы) */}
              {(currentUser.status !== 'none' || currentUser.expiresAt) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtendPlan}
                  disabled={isLoading}
                  className="h-9 sm:h-8 gap-1.5 border-green-500/50 text-green-500 hover:bg-green-500/10 flex-1 sm:flex-none"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Продлить
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBanConfirm(true)}
                disabled={isLoading}
                className={cn("h-9 sm:h-8 gap-1.5 flex-1 sm:flex-none",
                  currentUser.status === 'banned'
                    ? 'border-green-500/50 text-green-500 hover:bg-green-500/10'
                    : 'border-destructive/50 text-destructive hover:bg-destructive/10'
                )}
              >
                <Ban className="w-3.5 h-3.5" />
                <span className="sm:hidden">{currentUser.status === 'banned' ? 'Разбан' : 'Бан'}</span>
                <span className="max-sm:hidden">{currentUser.status === 'banned' ? 'Разбанить' : 'Забанить'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="h-9 sm:h-8 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="max-sm:sr-only">Удалить</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 sm:px-6 pt-4 shrink-0">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                  <UserIcon className="w-4 h-4" />
                  <span className="max-sm:hidden">Обзор</span>
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                  <CreditCard className="w-4 h-4" />
                  <span className="max-sm:hidden">Платежи</span>
                </TabsTrigger>
                <TabsTrigger value="referrals" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                  <Users className="w-4 h-4" />
                  <span className="max-sm:hidden">Рефералы</span>
                </TabsTrigger>
                <TabsTrigger value="keys-history" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                  <Key className="w-4 h-4" />
                  <span className="max-sm:hidden">Подписки</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 min-h-0 pb-safe overscroll-contain">
              <TabsContent value="info" className="mt-0 space-y-4">
                {/* Stats Row - компактный вид */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs">Доход</span>
                      </div>
                      <span className="text-sm font-semibold text-green-500">{totalRevenue}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-xs">Статус</span>
                      </div>
                      <Badge variant="outline" className={cn("text-xs",
                        currentUser.status === 'active' ? 'border-green-500/50 text-green-500' :
                        currentUser.status === 'banned' ? 'border-destructive/50 text-destructive' :
                        currentUser.status === 'expired' ? 'border-orange-500/50 text-orange-500' : 'border-muted-foreground/50 text-muted-foreground'
                      )}>
                        {currentUser.status === 'active' ? 'Активен' :
                         currentUser.status === 'banned' ? 'Забанен' :
                         currentUser.status === 'expired' ? 'Истёк' : 'Нет'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Info List */}
                <div className="rounded-lg border divide-y">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm">Тариф</span>
                    </div>
                    <span className="font-medium">{currentUser.plan || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Регистрация</span>
                    </div>
                    <span className="font-medium">{currentUser.registered}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Активность</span>
                    </div>
                    <span className="font-medium" key={timeUpdateTrigger}>
                      {formatRelativeTime(currentUser.lastActiveTimestamp || currentUser.lastActive)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Key className="w-4 h-4" />
                      <span className="text-sm">Подписок</span>
                    </div>
                    <span className="font-medium">{loadingKeysHistory ? '...' : groupedSubscriptions.filter(s => s.isActive).length}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="mt-0 space-y-2">
                {loadingTransactions ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Нет платежей</p>
                  </div>
                ) : (
                  transactions.map(transaction => {
                    const statusMeta = getStatusMeta(transaction.status);
                    return (
                      <div key={transaction.id} className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                            statusMeta.color === 'text-green-500' ? 'bg-green-500/10' :
                            statusMeta.color === 'text-orange-500' ? 'bg-orange-500/10' :
                            statusMeta.color === 'text-red-500' ? 'bg-red-500/10' : 'bg-blue-500/10'
                          )}>
                            <CreditCard className={cn("w-4 h-4", statusMeta.color)} />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{transaction.plan}</div>
                            <div className="text-xs text-muted-foreground">{transaction.date}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{transaction.amount}</div>
                          <div className={cn("text-xs flex items-center gap-1 justify-end", statusMeta.color)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                            {statusMeta.label}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="referrals" className="mt-0 space-y-2">
                {loadingReferrals ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Нет рефералов</p>
                  </div>
                ) : (
                  referrals.map(referral => (
                    <div key={referral.id} className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{getUserDisplayName(referral)}</div>
                        {referral.date && referral.date !== '—' && (
                          <div className="text-xs text-muted-foreground">{referral.date}</div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-green-500 flex-shrink-0">{referral.earned}</span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="keys-history" className="mt-0 space-y-3">
                {loadingKeysHistory ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : groupedSubscriptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <Key className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Нет подписок</p>
                  </div>
                ) : (
                  groupedSubscriptions.map((sub) => {
                    const daysLeft = sub.isActive && sub.expiresAt ? getDaysRemaining(sub.expiresAt.getTime() / 1000) : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft <= 3;
                    const displayToken = sub.token.startsWith('single_') ? null : sub.token;

                    return (
                      <div key={sub.token} className="rounded-lg border bg-card overflow-hidden">
                        {/* Заголовок подписки */}
                        <div className="p-3 flex items-center justify-between border-b bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                              sub.isActive ? 'bg-green-500/10' : 'bg-muted'
                            )}>
                              <Key className={cn("w-4 h-4", sub.isActive ? 'text-green-500' : 'text-muted-foreground')} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{sub.plan}</span>
                                <Badge variant="outline" className={cn("text-xs",
                                  sub.isActive
                                    ? isExpiringSoon
                                      ? 'border-orange-500/50 text-orange-500'
                                      : 'border-green-500/50 text-green-500'
                                    : 'border-muted-foreground/50 text-muted-foreground'
                                )}>
                                  {sub.isActive ? (isExpiringSoon ? 'Истекает' : 'Активен') : 'Истёк'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                до {sub.expiresAt?.toLocaleDateString('ru-RU') || '—'}
                                {sub.isActive && daysLeft !== null && (
                                  <span className={cn(
                                    "flex items-center gap-0.5",
                                    isExpiringSoon ? 'text-orange-500' : 'text-muted-foreground'
                                  )}>
                                    <Timer className="w-3 h-3" />
                                    {daysLeft === 0 ? 'сегодня' : `${daysLeft} дн.`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {sub.keys.length} {sub.keys.length === 1 ? 'локация' : sub.keys.length < 5 ? 'локации' : 'локаций'}
                          </span>
                        </div>

                        {/* Токен подписки */}
                        {displayToken && (
                          <div className="px-3 py-2 border-b bg-muted/10">
                            <button
                              onClick={() => copyToClipboard(displayToken, `token_${sub.token}`)}
                              className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors group w-full"
                            >
                              <span className="truncate flex-1 text-left">
                                {displayToken}
                              </span>
                              {copiedField === `token_${sub.token}` ? (
                                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Локации */}
                        <div className="p-2 space-y-1">
                          {sub.keys.map((key) => (
                            <div key={key.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 text-xs">
                              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{key.server_name || key.location_name || 'Локация'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <SelectPlanModal
        isOpen={showSelectPlanModal}
        onClose={() => setShowSelectPlanModal(false)}
        onConfirm={handleAssignPlan}
        user={user}
        isLoading={isLoading}
      />

      <ExtendSubscriptionModal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        onConfirm={handleConfirmExtend}
        onSwitchToCreate={() => {
          setShowExtendModal(false);
          setShowSelectPlanModal(true);
        }}
        user={user}
      />

      <ConfirmDialog
        open={showBanConfirm}
        onOpenChange={setShowBanConfirm}
        onConfirm={() => {
          setShowBanConfirm(false);
          handleBanUser();
        }}
        title={currentUser.status === 'banned' ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?'}
        description={`Вы уверены, что хотите ${currentUser.status === 'banned' ? 'разблокировать' : 'заблокировать'} пользователя ${getUserDisplayName(currentUser)}?`}
        confirmText={currentUser.status === 'banned' ? 'Разблокировать' : 'Заблокировать'}
        variant={currentUser.status === 'banned' ? 'info' : 'danger'}
        loading={isLoading}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDeleteUser();
        }}
        title="Удалить пользователя?"
        description={`Вы уверены, что хотите удалить пользователя ${getUserDisplayName(currentUser)}? Будут удалены все данные: ключи, подписки, платежи, рефералы. Это действие необратимо.`}
        confirmText="Удалить навсегда"
        variant="danger"
        loading={isLoading}
      />
    </>
  );
}
