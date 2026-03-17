import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { useBackButton } from '../hooks/useBackButton';

interface PromocodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxUses: number;
    expiryDate: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function PromocodeModal({ isOpen, onClose, onCreate, isSubmitting }: PromocodeModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Валидация
    if (!code || !discountValue || !maxUses || !expiryDate) {
      setSubmitError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    const discountNumber = Number(discountValue);
    const maxUsesNumber = Number(maxUses);

    if (discountNumber <= 0 || maxUsesNumber <= 0) {
      setSubmitError('Скидка и количество использований должны быть больше 0');
      return;
    }

    try {
      await onCreate({
        code,
        discountType,
        discountValue: discountNumber,
        maxUses: maxUsesNumber,
        expiryDate,
      });

      // Закрываем модальное окно и очищаем форму
      handleClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не удалось создать промокод');
    }
  };

  const handleClose = () => {
    setCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMaxUses('');
    setExpiryDate('');
    setSubmitError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} variant="fullscreen">
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg sm:max-h-[90vh]"
      >
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">Создать промокод</DialogTitle>
          <DialogDescription>
            Заполните данные для нового промокода
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
            {/* Код промокода */}
            <div>
              <label className="block text-foreground text-sm mb-1.5">
                Код промокода <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME"
                  className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomCode}
                  className="shrink-0"
                >
                  Сгенерировать
                </Button>
              </div>
            </div>

            {/* Тип скидки */}
            <div>
              <label className="block text-foreground text-sm mb-1.5">
                Тип скидки <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    discountType === 'percentage'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Процент (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    discountType === 'fixed'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Фикс. сумма (₽)
                </button>
              </div>
            </div>

            {/* Значение скидки */}
            <div>
              <label className="block text-foreground text-sm mb-1.5">
                Размер скидки <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '20' : '500'}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  min="1"
                  max={discountType === 'percentage' ? '100' : undefined}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {discountType === 'percentage' ? '%' : '₽'}
                </div>
              </div>
            </div>

            {/* Максимальное количество использований */}
            <div>
              <label className="block text-foreground text-sm mb-1.5">
                Макс. использований <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
                min="1"
              />
            </div>

            {/* Дата истечения */}
            <div>
              <label className="block text-foreground text-sm mb-1.5">
                Дата истечения <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Превью */}
            {code && discountValue && (
              <div className="bg-muted border border-border rounded-lg p-3">
                <div className="text-muted-foreground text-xs mb-2">Превью:</div>
                <div className="flex items-center gap-2">
                  <code className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">{code}</code>
                  <span className="text-sm text-muted-foreground">
                    -{discountType === 'percentage' ? `${discountValue}%` : `₽${discountValue}`}
                  </span>
                </div>
              </div>
            )}

            {submitError && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{submitError}</div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 pt-4 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0 pb-safe">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-12 sm:h-10"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 sm:h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Создание...
                </>
              ) : (
                'Создать'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
