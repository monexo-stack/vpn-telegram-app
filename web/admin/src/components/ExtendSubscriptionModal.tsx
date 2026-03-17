import React, { useState, useEffect } from 'react';
import { Calendar, Check, Info, Loader2, AlertCircle, Clock, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { cn } from './ui/utils';
import { apiClient, SubscriptionPlan } from '../services/api';
import { useBackButton } from '../hooks/useBackButton';

interface User {
  id: string;
  name: string;
  telegramId: string;
  username: string;
  plan: string;
  expiresAt?: string;
  status?: 'active' | 'expired' | 'banned' | 'none';
}

interface ExtendSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (days: number) => void;
  onSwitchToCreate?: () => void; // Callback to open SelectPlanModal instead
  user: User | null;
  // Legacy props - kept for backwards compatibility but not used
  userKeys?: any[];
  selectedKey?: any | null;
  onKeySelect?: (key: any | null) => void;
}

export function ExtendSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  onSwitchToCreate,
  user,
}: ExtendSubscriptionModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<string>('');
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  // Load plans from API and check subscription status
  useEffect(() => {
    if (isOpen && user) {
      loadPlans();
      checkSubscriptionStatus();
      // Reset state
      setSelectedPlan(null);
      setCustomDays('');
      setUseCustomDays(false);
    }
  }, [isOpen, user]);

  const loadPlans = async () => {
    setLoadingPlans(true);
    setError(null);
    try {
      const data = await apiClient.getPlans();
      // Filter out trial, sort by duration
      const sorted = data
        .filter(p => p.plan_id !== 'trial' && p.active)
        .sort((a, b) => a.duration_days - b.duration_days);
      setPlans(sorted);
    } catch (err) {
      setError('Не удалось загрузить периоды');
      console.error('Failed to load plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!user) return;
    setCheckingSubscription(true);
    try {
      const tgid = parseInt(user.telegramId);
      const userData = await apiClient.getUserByTgid(tgid);
      // User has subscription if expires_at exists (even if expired)
      setHasSubscription(!!userData.expires_at);
    } catch (err) {
      console.error('Failed to check subscription:', err);
      // If user prop has expiresAt, use that
      setHasSubscription(!!user.expiresAt);
    } finally {
      setCheckingSubscription(false);
    }
  };

  if (!user) return null;

  const getUserDisplayName = () => {
    if (user.name) return user.name;
    if (user.username) return `@${user.username}`;
    return `ID: ${user.telegramId}`;
  };

  const getCurrentExpiry = () => {
    if (!user.expiresAt) return null;
    try {
      const date = new Date(user.expiresAt);
      if (isNaN(date.getTime())) return null;
      return date;
    } catch {
      return null;
    }
  };

  const calculateNewExpiryDate = (days: number) => {
    const currentExpiry = getCurrentExpiry();
    const baseDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + days);
    return newExpiry.toLocaleDateString('ru-RU');
  };

  const getDaysRemaining = () => {
    const expiry = getCurrentExpiry();
    if (!expiry) return null;
    const diff = expiry.getTime() - Date.now();
    if (diff < 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleConfirm = () => {
    let days = 0;

    if (useCustomDays && customDays) {
      days = parseInt(customDays);
      if (isNaN(days) || days <= 0) return;
    } else if (selectedPlan) {
      const planDetails = plans.find(p => p.plan_id === selectedPlan);
      if (planDetails) {
        days = planDetails.duration_days;
      }
    }

    if (days > 0) {
      onConfirm(days);
      setSelectedPlan(null);
      setCustomDays('');
      setUseCustomDays(false);
    }
  };

  const handleClose = () => {
    setSelectedPlan(null);
    setCustomDays('');
    setUseCustomDays(false);
    onClose();
  };

  const handleSwitchToCreate = () => {
    handleClose();
    onSwitchToCreate?.();
  };

  const selectedPlanDetails = plans.find(p => p.plan_id === selectedPlan);
  const daysToAdd = useCustomDays && customDays ? parseInt(customDays) : (selectedPlanDetails?.duration_days || 0);
  const newExpiryDate = daysToAdd > 0 ? calculateNewExpiryDate(daysToAdd) : '';
  const canConfirm = hasSubscription && (selectedPlan || (useCustomDays && customDays && !isNaN(parseInt(customDays)) && parseInt(customDays) > 0));
  const currentExpiry = getCurrentExpiry();
  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;

  const formatDuration = (days: number) => {
    if (days === 30) return '1 месяц';
    if (days === 90) return '3 месяца';
    if (days === 180) return '6 месяцев';
    if (days === 365) return '1 год';
    return `${days} дней`;
  };

  const formatPrice = (price: number) => {
    return `₽${price}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 max-h-[85vh] sm:max-w-[480px]"
      >
        <DialogHeader className="p-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">Продление подписки</DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-1 flex-wrap">
            <span>{getUserDisplayName()}</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ID: {user.telegramId}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
          {checkingSubscription ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSubscription ? (
            // No subscription - suggest creating one
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Нет подписки</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[300px]">
                У пользователя нет активной подписки. Сначала нужно подключить тариф, чтобы создать ключи на всех локациях.
              </p>
              {onSwitchToCreate && (
                <Button onClick={handleSwitchToCreate} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Подключить тариф
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Current subscription info */}
              {currentExpiry && (
                <div className={cn(
                  "rounded-lg border p-3",
                  isExpired
                    ? "border-destructive/30 bg-destructive/5"
                    : isExpiringSoon
                    ? "border-orange-500/30 bg-orange-500/5"
                    : "border-green-500/30 bg-green-500/5"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        isExpired
                          ? "text-destructive"
                          : isExpiringSoon
                          ? "text-orange-500"
                          : "text-green-500"
                      )}>
                        {isExpired ? 'Истекла' : isExpiringSoon ? 'Истекает' : 'Активна'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        до {currentExpiry.toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    {!isExpired && daysRemaining !== null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {daysRemaining === 0 ? 'сегодня' : `${daysRemaining} дн.`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Extension periods */}
              {loadingPlans ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-10 h-10 text-destructive/50 mb-3" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={loadPlans} className="mt-3">
                    Повторить
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Период продления
                  </h3>

                  {plans.map(plan => {
                    const isSelected = selectedPlan === plan.plan_id && !useCustomDays;

                    return (
                      <button
                        key={plan.plan_id}
                        onClick={() => {
                          setSelectedPlan(plan.plan_id);
                          setUseCustomDays(false);
                        }}
                        className={cn(
                          'w-full rounded-lg border p-3 transition-all text-left',
                          'hover:border-primary/50 hover:bg-muted/30',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{plan.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDuration(plan.duration_days)}
                              {isSelected && newExpiryDate && (
                                <span className="text-green-500 ml-2">→ {newExpiryDate}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold">{formatPrice(plan.price)}</span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom period */}
                  <div className={cn(
                    "rounded-lg border p-3 space-y-2 transition-all",
                    useCustomDays ? "border-primary bg-primary/5" : "border-border bg-card"
                  )}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={useCustomDays}
                        onCheckedChange={(checked) => {
                          setUseCustomDays(!!checked);
                          if (checked) setSelectedPlan(null);
                        }}
                      />
                      <span className="font-medium text-sm">Произвольный период</span>
                    </label>
                    {useCustomDays && (
                      <div className="space-y-2 pl-6">
                        <Input
                          type="number"
                          min="1"
                          max="730"
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          placeholder="Количество дней"
                          className="max-w-[160px] h-9"
                        />
                        {customDays && !isNaN(parseInt(customDays)) && parseInt(customDays) > 0 && newExpiryDate && (
                          <div className="text-xs text-green-500">
                            Новая дата: {newExpiryDate}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <p className="text-xs text-muted-foreground px-1">
                {isExpired
                  ? 'Подписка истекла — период добавится с текущей даты.'
                  : 'Период добавится к дате истечения подписки.'
                }
              </p>
            </>
          )}
        </div>

        <div className="p-5 pt-4 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0 pb-safe">
          <Button variant="outline" onClick={handleClose} className="h-12 sm:h-10">
            Отмена
          </Button>
          {hasSubscription && (
            <Button onClick={handleConfirm} disabled={!canConfirm} className="h-12 sm:h-10">
              {canConfirm ? (
                useCustomDays
                  ? `Продлить на ${customDays} дн.`
                  : `Продлить на ${formatDuration(selectedPlanDetails?.duration_days || 0)}`
              ) : (
                'Выберите период'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
