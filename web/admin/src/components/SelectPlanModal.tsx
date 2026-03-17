import React, { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle, Ban } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
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
  trialUsed?: boolean;
}

interface SelectPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (planId: string) => void;
  user: User | null;
  isLoading?: boolean;
}

export function SelectPlanModal({
  isOpen,
  onClose,
  onConfirm,
  user,
  isLoading = false
}: SelectPlanModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);

  // Load plans from API and check trial status
  useEffect(() => {
    if (isOpen && user) {
      loadPlans();
      checkTrialStatus();
    }
  }, [isOpen, user]);

  const loadPlans = async () => {
    setLoadingPlans(true);
    setError(null);
    try {
      const data = await apiClient.getPlans();
      // Sort: trial first, then by duration
      const sorted = data.sort((a, b) => {
        if (a.plan_id === 'trial') return -1;
        if (b.plan_id === 'trial') return 1;
        return a.duration_days - b.duration_days;
      });
      setPlans(sorted.filter(p => p.active));
    } catch (err) {
      setError('Не удалось загрузить тарифы');
      console.error('Failed to load plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkTrialStatus = async () => {
    if (!user) return;
    try {
      const tgid = parseInt(user.telegramId);
      const userData = await apiClient.getUserByTgid(tgid);
      // Check if trial_period flag is set (means trial was already used)
      // trial_period=true means user has already activated trial once
      setTrialUsed(userData.trial_period === true);
    } catch (err) {
      console.error('Failed to check trial status:', err);
    }
  };

  if (!user) return null;

  const getUserDisplayName = () => {
    if (user.name) return user.name;
    if (user.username) return `@${user.username}`;
    return `ID: ${user.telegramId}`;
  };

  const handleConfirm = () => {
    if (selectedPlan) {
      onConfirm(selectedPlan);
      setSelectedPlan(null);
    }
  };

  const handleClose = () => {
    setSelectedPlan(null);
    onClose();
  };

  const selectedPlanDetails = plans.find(p => p.plan_id === selectedPlan);

  const formatDuration = (days: number) => {
    if (days === 1) return '1 день';
    if (days <= 3) return `${days} дня`;
    if (days < 30) return `${days} дней`;
    if (days === 30) return '1 месяц';
    if (days === 90) return '3 месяца';
    if (days === 180) return '6 месяцев';
    if (days === 365) return '1 год';
    return `${days} дней`;
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Бесплатно';
    return `₽${price}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 max-h-[85vh] sm:max-w-[480px]"
      >
        <DialogHeader className="p-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">Подключение тарифа</DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-1 flex-wrap">
            <span>{getUserDisplayName()}</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ID: {user.telegramId}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 overscroll-contain">
          {loadingPlans ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-10 h-10 text-destructive/50 mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={loadPlans} className="mt-3">
                Повторить
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Нет доступных тарифов</p>
            </div>
          ) : (
            <>
              {plans.map(plan => {
                const isSelected = selectedPlan === plan.plan_id;
                const isTrial = plan.plan_id === 'trial';
                const isTrialDisabled = isTrial && trialUsed;

                return (
                  <button
                    key={plan.plan_id}
                    onClick={() => !isTrialDisabled && setSelectedPlan(plan.plan_id)}
                    disabled={isLoading || isTrialDisabled}
                    className={cn(
                      'w-full rounded-lg border p-3 transition-all text-left',
                      isTrialDisabled
                        ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                        : 'hover:border-primary/50 hover:bg-muted/30',
                      isSelected && !isTrialDisabled
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card',
                      isLoading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium",
                            isTrialDisabled && "text-muted-foreground"
                          )}>
                            {plan.name}
                          </span>
                          {isTrialDisabled && (
                            <Ban className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className={cn(
                          "text-xs mt-0.5",
                          isTrialDisabled ? "text-muted-foreground/70" : "text-muted-foreground"
                        )}>
                          {isTrialDisabled
                            ? 'Уже использован'
                            : formatDuration(plan.duration_days)
                          }
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isTrialDisabled && (
                          <span className={cn(
                            "font-semibold",
                            isTrial ? 'text-blue-500' : ''
                          )}>
                            {formatPrice(plan.price)}
                          </span>
                        )}
                        {isSelected && !isTrialDisabled && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <p className="text-xs text-muted-foreground mt-3 px-1">
                Будут созданы ключи на всех локациях. Текущая подписка будет заменена.
              </p>
            </>
          )}
        </div>

        <div className="p-5 pt-4 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0 pb-safe">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="h-12 sm:h-10"
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlan || isLoading || loadingPlans}
            className="h-12 sm:h-10"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Подключение...
              </>
            ) : selectedPlan ? (
              selectedPlanDetails?.price === 0
                ? 'Подключить бесплатно'
                : `Подключить за ${formatPrice(selectedPlanDetails?.price || 0)}`
            ) : (
              'Выберите тариф'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
