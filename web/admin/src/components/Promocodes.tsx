import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Copy, Check, Trash2, XCircle, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { PromocodeModal } from './PromocodeModal';
import { apiClient, apiCache, Promocode as ApiPromocode } from '../services/api';
import { PromocodesSkeleton } from './ui/skeletons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useMiniApp } from '../context/MiniAppContext';
import { PromocodeCard } from './miniapp/PromocodeCard';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface Promocode {
  id: string;
  code: string;
  discount: string;
  type: 'percentage' | 'fixed';
  uses: number;
  maxUses: number;
  status: 'active' | 'expired' | 'disabled';
  created: string;
  expires: string;
  validityDays: number | null;
  totalDiscountGiven: number;
}

interface PromocodeStats {
  total: number;
  active: number;
  totalUses: number;
  avgPercent: number;
  totalDiscountGiven: number;
}

// Преобразование API Promocode в компонент Promocode
const mapApiPromocodeToComponent = (apiPromo: ApiPromocode): Promocode => {
  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ru-RU');
    } catch {
      return '—';
    }
  };

  const status: 'active' | 'expired' | 'disabled' =
    apiPromo.status === 'disabled' ? 'disabled' :
    apiPromo.status === 'expired' ? 'expired' :
    (apiPromo.count_use && apiPromo.used_count >= apiPromo.count_use) ? 'expired' :
    'active';
  const maxUses = apiPromo.count_use || 0;
  const discountType: 'percentage' | 'fixed' = apiPromo.discount_type === 'fixed' ? 'fixed' : (apiPromo.amount && apiPromo.discount_type === 'fixed') ? 'fixed' : (apiPromo.percent >= 0 ? 'percentage' : 'fixed');
  const discountValue = discountType === 'fixed'
    ? (apiPromo.amount ?? Math.abs(apiPromo.percent))
    : (apiPromo.percent);

  // Вычисляем срок действия в днях
  let validityDays: number | null = null;
  if (apiPromo.created_at && apiPromo.valid_until) {
    try {
      const createdDate = new Date(apiPromo.created_at);
      const expiresDate = new Date(apiPromo.valid_until);
      const diffTime = expiresDate.getTime() - createdDate.getTime();
      validityDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      validityDays = null;
    }
  }

  return {
    id: apiPromo.id.toString(),
    code: apiPromo.text,
    discount: discountType === 'fixed' ? `₽${discountValue}` : `${discountValue}%`,
    type: discountType,
    uses: apiPromo.used_count || 0,
    maxUses,
    status,
    created: formatDate(apiPromo.created_at || undefined),
    expires: formatDate(apiPromo.valid_until || undefined),
    validityDays,
    totalDiscountGiven: apiPromo.total_discount_given || 0,
  };
};

interface PromocodesProps {
  isModalOpen?: boolean;
  setIsModalOpen?: (open: boolean) => void;
}

// Кэш для мгновенной загрузки без мерцания
const CACHE_KEY = 'promocodes_cache';

function getCachedData(): { promocodes: Promocode[]; stats: PromocodeStats } | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedData(promocodes: Promocode[], stats: PromocodeStats) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ promocodes, stats }));
  } catch {}
}

export function Promocodes({ isModalOpen: externalModalOpen, setIsModalOpen: externalSetIsModalOpen }: PromocodesProps) {
  const { isMiniApp } = useMiniApp();

  // Ленивая инициализация из кэша (вызывается только один раз)
  const [promocodes, setPromocodes] = useState<Promocode[]>(() => getCachedData()?.promocodes ?? []);
  const [stats, setStats] = useState<PromocodeStats | null>(() => getCachedData()?.stats ?? null);
  const [loading, setLoading] = useState(() => !getCachedData());
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use external modal state if provided, otherwise use internal
  const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setIsModalOpen = externalSetIsModalOpen || setInternalModalOpen;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingPromocodes, setTogglingPromocodes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPromocodes = useCallback(async (isAutoRefresh = false) => {
    try {
      const [apiPromocodes, apiStats] = await Promise.all([
        apiClient.getPromocodes(),
        apiClient.getPromocodesStats(),
      ]);
      const mappedPromocodes = apiPromocodes.map(mapApiPromocodeToComponent);
      const mappedStats = {
        total: apiStats?.total ?? 0,
        active: apiStats?.active ?? 0,
        totalUses: apiStats?.total_uses ?? 0,
        avgPercent: apiStats?.avg_percent ?? 0,
        totalDiscountGiven: apiStats?.total_discount_given ?? 0,
      };

      setPromocodes(mappedPromocodes);
      setStats(mappedStats);
      setError(null);
      setLoading(false);

      // Сохраняем в кэш
      setCachedData(mappedPromocodes, mappedStats);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки промокодов');
      console.error('Promocodes error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromocodes();
  }, []);

  // Автообновление каждые 30 секунд (без показа загрузки)
  useAutoRefresh(() => loadPromocodes(true), { interval: 30000 });

  const copyToClipboard = (promoId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(promoId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeletePromocode = async (promoId: string) => {
    try {
      await apiClient.deletePromocode(parseInt(promoId));
      // Invalidate cache before reload
      apiCache.forceRefresh('/promocodes');
      apiCache.forceRefresh('/stats/promocodes');
      await loadPromocodes();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleTogglePromocode = async (promoId: string) => {
    // Find current promo
    const currentPromo = promocodes.find(p => p.id === promoId);
    if (!currentPromo) return;

    const wasActive = currentPromo.status === 'active';
    const newStatus = wasActive ? 'disabled' : 'active';

    // Save original state for rollback
    const originalPromocodes = [...promocodes];
    const originalStats = stats ? { ...stats } : null;

    // Prepare updated data for optimistic update
    const updatedPromocodes = promocodes.map(p =>
      p.id === promoId
        ? { ...p, status: newStatus as 'active' | 'disabled' | 'expired' }
        : p
    );
    const updatedStats = stats ? {
      ...stats,
      active: wasActive ? stats.active - 1 : stats.active + 1
    } : null;

    try {
      // Add to toggling set
      setTogglingPromocodes(prev => new Set(prev).add(promoId));

      // Optimistically update UI and cache immediately
      setPromocodes(updatedPromocodes);
      setStats(updatedStats);
      if (updatedStats) setCachedData(updatedPromocodes, updatedStats);

      // Call API
      const response = await apiClient.togglePromocode(parseInt(promoId));

      // Invalidate frontend cache for next full reload
      apiCache.forceRefresh('/promocodes');
      apiCache.forceRefresh('/stats/promocodes');

      // Verify server state matches our optimistic update
      if (response.active !== !wasActive) {
        // Server state differs, reload to sync
        await loadPromocodes();
      }
    } catch (err) {
      console.error('Toggle error:', err);
      // Revert to original state on error
      setPromocodes(originalPromocodes);
      setStats(originalStats);
      if (originalStats) setCachedData(originalPromocodes, originalStats);
    } finally {
      // Remove from toggling set
      setTogglingPromocodes(prev => {
        const next = new Set(prev);
        next.delete(promoId);
        return next;
      });
    }
  };

  const handleCreatePromocode = async (data: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxUses: number;
    expiryDate: string;
  }) => {
    try {
      setCreateLoading(true);
      const expires_at = data.expiryDate
        ? new Date(`${data.expiryDate}T23:59:59Z`).toISOString()
        : null;

      await apiClient.createPromocode({
        text: data.code.trim().toUpperCase(),
        percent: data.discountType === 'percentage' ? Number(data.discountValue) : 0,
        amount: data.discountType === 'fixed' ? Number(data.discountValue) : undefined,
        count_use: Number(data.maxUses),
        expires_at,
        discount_type: data.discountType,
      });

      // Invalidate cache before reload
      apiCache.forceRefresh('/promocodes');
      apiCache.forceRefresh('/stats/promocodes');
      await loadPromocodes();
      setIsModalOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Не удалось создать промокод';
      throw new Error(message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Filter promocodes for Mini App search
  const filteredPromocodes = useMemo(() => {
    if (!searchQuery.trim()) return promocodes;
    const query = searchQuery.toLowerCase();
    return promocodes.filter(promo =>
      promo.code.toLowerCase().includes(query)
    );
  }, [promocodes, searchQuery]);

  // Расчёт метрик эффективности
  const effectivenessMetrics = useMemo(() => {
    const usedPromocodes = promocodes.filter(p => p.uses > 0);
    const totalUses = promocodes.reduce((sum, p) => sum + p.uses, 0);
    const totalDiscount = stats?.totalDiscountGiven || 0;

    // Стоимость привлечения (потери на 1 использование)
    const costPerUse = totalUses > 0 ? totalDiscount / totalUses : 0;

    // Эффективные промокоды (более 3 использований)
    const effectivePromocodes = promocodes.filter(p => p.uses >= 3);

    // Топ промокодов по использованию
    const topByUses = [...promocodes]
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    // Топ промокодов по потерям
    const topByLoss = [...promocodes]
      .filter(p => p.totalDiscountGiven > 0)
      .sort((a, b) => b.totalDiscountGiven - a.totalDiscountGiven)
      .slice(0, 5);

    return {
      costPerUse,
      usedCount: usedPromocodes.length,
      effectiveCount: effectivePromocodes.length,
      avgUsesPerPromo: promocodes.length > 0 ? totalUses / promocodes.length : 0,
      topByUses,
      topByLoss
    };
  }, [promocodes, stats]);

  // Показываем скелетон только если нет данных вообще
  if (loading && promocodes.length === 0) {
    return <PromocodesSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive rounded-xl p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  // Mini App View - Compact card list
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Stats row - compact */}
        <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
          <div className="text-center">
            <div className="text-lg font-bold">{stats?.total ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Всего</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">{stats?.active ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Активных</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats?.totalUses ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Исп-ний</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-500">₽{(stats?.totalDiscountGiven || 0).toLocaleString('ru-RU')}</div>
            <div className="text-[10px] text-muted-foreground">Потери</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск промокода..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Promocodes list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredPromocodes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет промокодов'}
            </div>
          ) : (
            filteredPromocodes.map((promo) => (
              <PromocodeCard
                key={promo.id}
                promocode={{
                  id: promo.id,
                  code: promo.code,
                  discount: promo.discount,
                  type: promo.type,
                  uses: promo.uses,
                  maxUses: promo.maxUses,
                  status: promo.status,
                  totalDiscountGiven: promo.totalDiscountGiven,
                }}
                isCopied={copiedId === promo.id}
                onCopy={copyToClipboard}
              />
            ))
          )}
        </div>

        {/* Modal */}
        <PromocodeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleCreatePromocode}
          isSubmitting={createLoading}
        />
      </div>
    );
  }

  // Desktop View
  return (
    <div className="">
      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Всего</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats?.total ?? 0}</span>
            <span className="text-green-500 text-sm">/ {stats?.active ?? 0}</span>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Использований</div>
          <div className="text-2xl font-bold">{stats?.totalUses ?? 0}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Конверсия</div>
          <div className="text-2xl font-bold">
            {promocodes.length > 0
              ? `${((promocodes.filter(p => p.uses > 0).length / promocodes.length) * 100).toFixed(0)}%`
              : '0%'}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Потери</div>
          <div className="text-2xl font-bold text-red-500">
            ₽{effectivenessMetrics.costPerUse.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Аналитика эффективности */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Топ по использованию */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <h3 className="text-foreground font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Топ-5 по использованию
          </h3>
          {effectivenessMetrics.topByUses.length > 0 ? (
            <div className="space-y-3">
              {effectivenessMetrics.topByUses.map((promo, index) => (
                <div key={promo.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">{index + 1}.</span>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{promo.code}</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-foreground font-medium">{promo.uses} исп.</span>
                    <span className="text-muted-foreground text-sm">{promo.discount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-4">Нет данных</div>
          )}
        </div>

        {/* Топ по потерям (ROI) */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <h3 className="text-foreground font-medium mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Топ-5 по потерям
          </h3>
          {effectivenessMetrics.topByLoss.length > 0 ? (
            <div className="space-y-3">
              {effectivenessMetrics.topByLoss.map((promo, index) => {
                const lossPerUse = promo.uses > 0 ? promo.totalDiscountGiven / promo.uses : 0;
                return (
                  <div key={promo.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-5">{index + 1}.</span>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{promo.code}</code>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-red-500 font-medium">
                        ₽{promo.totalDiscountGiven.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        (₽{lossPerUse.toFixed(0)}/исп.)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-4">Нет данных</div>
          )}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Общие потери:</span>
              <span className="text-red-500 font-medium">
                ₽{(stats?.totalDiscountGiven || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Список промокодов */}
      {filteredPromocodes.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-6 text-muted-foreground text-center">
          Нет данных
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromocodes.map((promo) => {
            const usagePercent = promo.maxUses ? Math.min((promo.uses / promo.maxUses) * 100, 100) : 0;
            const isToggling = togglingPromocodes.has(promo.id);

            return (
          <div key={promo.id} className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="font-mono font-bold text-lg text-foreground">{promo.code}</code>
                  <button
                    onClick={() => copyToClipboard(promo.id, promo.code)}
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
                    title="Копировать промокод"
                  >
                    {copiedId === promo.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {promo.status === 'expired' ? (
                  <span className="text-xs text-red-500 font-medium">Истёк</span>
                ) : (
                  <label className={`ios-toggle ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      checked={promo.status === 'active'}
                      onChange={() => handleTogglePromocode(promo.id)}
                      disabled={isToggling}
                    />
                    <div className="ios-toggle-track"></div>
                  </label>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              {/* Discount */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold">{promo.discount}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  promo.type === 'percentage' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                }`}>
                  {promo.type === 'percentage' ? 'Процент' : 'Сумма'}
                </span>
              </div>

              {/* Usage with progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Использовано</span>
                  <span className="font-medium">{promo.uses} / {promo.maxUses || '∞'}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {/* Losses */}
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-muted-foreground">Потери</span>
                <span className="font-medium text-red-500">₽{promo.totalDiscountGiven.toLocaleString('ru-RU')}</span>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border text-sm">
                <div>
                  <span className="text-muted-foreground">Создан: </span>
                  <span className="font-medium">{promo.created}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">До: </span>
                  <span className={`font-medium ${promo.status === 'expired' ? 'text-red-500' : ''}`}>
                    {promo.expires}
                  </span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => setDeleteConfirmId(promo.id)}
                className="w-full mt-4 py-2 text-sm text-red-500 hover:bg-red-500/5 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </div>
          </div>
            );
          })}
      </div>
      )}

      {/* Modal */}
      <PromocodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreatePromocode}
        isSubmitting={createLoading}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border max-w-sm w-full p-5">
            <h3 className="text-foreground text-base font-medium mb-2">Удалить промокод?</h3>
            <p className="text-muted-foreground text-sm mb-5">
              Это действие нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-3 py-2 bg-muted text-foreground rounded-md hover:bg-muted/70"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeletePromocode(deleteConfirmId)}
                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
