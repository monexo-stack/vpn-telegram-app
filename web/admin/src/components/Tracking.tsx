import React, { useState, useEffect } from 'react';
import { Search, Copy, Plus, X, Check, Trash2, Edit2, Users, Target, BarChart3, RefreshCw, ExternalLink, Loader2, TrendingUp, CheckCircle, User, Link2 } from 'lucide-react';
import { useMiniApp } from '../context/MiniAppContext';
import { useBackButton } from '../hooks/useBackButton';
import { TrackingLinkCard } from './miniapp/TrackingLinkCard';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { apiClient } from '../services/api';
import { cn } from './ui/utils';

interface TrackingUser {
  id: string;
  username: string;
  telegramId: string;
  fullName: string;
  plan: string;
  revenue: number;
  registered: string;
  converted: boolean;
  lastActive: string;
  sessionsCount: number;
  trafficUsed: string;
  activeDevices: number;
  timeToPurchase?: string;
  suspiciousActivity: boolean;
  botScore: number;
  botConfirmed: boolean;
  appOpensCount: number;
  accountAge: string;
  tgAccountAge?: string;
  isNewTgAccount?: boolean;
}

interface TrackingLink {
  id: string;
  name: string;
  slug: string;
  url: string;
  registrations: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  created: string;
  source?: string | null;
  alerts?: string[];
  botCount: number;
  suspiciousCount: number;
  linkType?: string;
}

interface TrackingProps {
  isModalOpen?: boolean;
  setIsModalOpen?: (open: boolean) => void;
}

export function Tracking({ isModalOpen: externalModalOpen, setIsModalOpen: externalSetIsModalOpen }: TrackingProps) {
  const { isMiniApp } = useMiniApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCreateModalOpen, setInternalCreateModalOpen] = useState(false);

  // Use external modal state if provided, otherwise use internal
  const isCreateModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalCreateModalOpen;
  const setIsCreateModalOpen = externalSetIsModalOpen || setInternalCreateModalOpen;
  const [selectedLink, setSelectedLink] = useState<TrackingLink | null>(null);
  const [editingLink, setEditingLink] = useState<TrackingLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState('');
  const [miniAppShortName, setMiniAppShortName] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<TrackingLink | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [links, settings] = await Promise.all([
        apiClient.getTrackingLinks(),
        apiClient.getSettings()
      ]);

      if (settings?.bot_username) {
        setBotUsername(settings.bot_username);
      }
      if (settings?.mini_app_short_name) {
        setMiniAppShortName(settings.mini_app_short_name);
      }

      const mappedLinks: TrackingLink[] = links.map((link: any) => ({
        id: link.id,
        name: link.name,
        slug: link.slug,
        url: link.url,
        registrations: link.registrations ?? 0,
        conversions: link.conversions ?? 0,
        revenue: link.revenue ?? 0,
        conversionRate: link.conversion_rate ?? 0,
        source: link.source ?? null,
        alerts: link.alerts || [],
        created: link.created || '',
        botCount: link.bot_count ?? 0,
        suspiciousCount: link.suspicious_count ?? 0,
        linkType: link.link_type ?? 'bot'
      }));

      setTrackingLinks(mappedLinks);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Ошибка загрузки данных';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Tracking error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLinks = trackingLinks.filter(link => {
    const matchesSearch =
      link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === 'all' || (link.source || 'other') === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const handleCopyLink = (link: TrackingLink, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const fullUrl = `https://${link.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = async (link: TrackingLink) => {
    setDeletingId(link.id);
    try {
      await apiClient.deleteTrackingLink(link.slug);
      setTrackingLinks(prev => prev.filter(l => l.id !== link.id));
      toast.success('Ссылка удалена');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  // Статистика
  const totalRegistrations = trackingLinks.reduce((sum, l) => sum + l.registrations, 0);
  const totalConversions = trackingLinks.reduce((sum, l) => sum + l.conversions, 0);
  const totalRevenue = trackingLinks.reduce((sum, l) => sum + l.revenue, 0);
  const avgConversionRate = totalRegistrations > 0 ? (totalConversions / totalRegistrations * 100) : 0;

  const uniqueSources = Array.from(new Set(trackingLinks.map(l => l.source || 'other').filter(Boolean)));

  // Топ кампании по доходу
  const topCampaigns = [...trackingLinks].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Загрузка...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive rounded-xl p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  // Mini App mobile view
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact stats row */}
        <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
          <div className="text-center">
            <div className="text-lg font-bold">{trackingLinks.length}</div>
            <div className="text-[10px] text-muted-foreground">Кампаний</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{totalRegistrations}</div>
            <div className="text-[10px] text-muted-foreground">Рег.</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{totalConversions}</div>
            <div className="text-[10px] text-muted-foreground">Конв.</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">₽{(totalRevenue / 1000).toFixed(0)}k</div>
            <div className="text-[10px] text-muted-foreground">Доход</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск кампании..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Links list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredLinks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет кампаний'}
            </div>
          ) : (
            filteredLinks.map((link) => (
              <TrackingLinkCard
                key={link.id}
                link={link}
                onClick={() => setSelectedLink(link)}
              />
            ))
          )}
        </div>

        {/* Modals */}
        {isCreateModalOpen && (
          <CreateLinkModal
            botUsername={botUsername}
            miniAppShortName={miniAppShortName}
            onClose={() => setIsCreateModalOpen(false)}
            onCreated={(link) => {
              setTrackingLinks(prev => [link, ...prev]);
              setIsCreateModalOpen(false);
            }}
          />
        )}

        {editingLink && (
          <EditLinkModal
            link={editingLink}
            onClose={() => setEditingLink(null)}
            onUpdated={(updated) => {
              setTrackingLinks(prev => prev.map(l => l.id === updated.id ? updated : l));
              setEditingLink(null);
            }}
          />
        )}

        {selectedLink && (
          <UsersModal
            link={selectedLink}
            onClose={() => setSelectedLink(null)}
          />
        )}

        <ConfirmDialog
          open={linkToDelete !== null}
          onOpenChange={(open) => !open && setLinkToDelete(null)}
          onConfirm={() => {
            if (linkToDelete) {
              handleDeleteLink(linkToDelete);
              setLinkToDelete(null);
            }
          }}
          title="Удалить ссылку?"
          description={`Вы уверены, что хотите удалить ссылку "${linkToDelete?.name}"?`}
          confirmText="Удалить"
          variant="danger"
        />
      </div>
    );
  }

  return (
    <div className="">
      {/* Общая статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Кампаний"
          value={trackingLinks.length}
          color="text-foreground"
        />
        <StatCard
          label="Регистраций"
          value={totalRegistrations}
          color="text-foreground"
        />
        <StatCard
          label="Конверсий"
          value={totalConversions}
          color="text-green-500"
        />
        <StatCard
          label="CR"
          value={`${avgConversionRate.toFixed(1)}%`}
          color="text-foreground"
        />
        <StatCard
          label="Доход"
          value={`₽${totalRevenue.toLocaleString('ru-RU')}`}
          color="text-green-500"
        />
      </div>

      {/* Топ кампании */}
      {topCampaigns.length > 0 && topCampaigns[0].revenue > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-5 mb-6">
          <h3 className="text-foreground font-semibold mb-3.5">Топ кампании по доходу</h3>
          <div className="space-y-2.5">
            {topCampaigns.filter(c => c.revenue > 0).map((campaign, idx) => {
              const maxRevenue = topCampaigns[0].revenue || 1;
              const percentage = (campaign.revenue / maxRevenue) * 100;
              return (
                <div key={campaign.id} className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-foreground text-sm font-medium truncate">{campaign.name}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex-shrink-0">₽{campaign.revenue.toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Поиск и фильтры */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по названию или slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[200px] lg:w-[350px] pl-9 pr-3 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              sourceFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            Все
          </button>
          {uniqueSources.map(source => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                sourceFilter === source
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {source}
            </button>
            ))}
        </div>

        {/* Антибот бейдж с тултипом */}
        <AntibotBadge />
      </div>

      {/* Список кампаний */}
      {filteredLinks.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-foreground text-lg mb-2">Нет кампаний</h3>
          <p className="text-muted-foreground mb-6">
            Создайте первую tracking ссылку для отслеживания трафика
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90"
          >
            Создать кампанию
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLinks.map(link => (
            <CampaignCard
              key={link.id}
              link={link}
              botUsername={botUsername}
              copiedId={copiedId}
              deletingId={deletingId}
              onCopy={handleCopyLink}
              onDelete={(link) => setLinkToDelete(link)}
              onEdit={(l) => setEditingLink(l)}
              onViewUsers={() => setSelectedLink(link)}
            />
          ))}
        </div>
      )}

      {/* Модалки */}
      {isCreateModalOpen && (
        <CreateLinkModal
          botUsername={botUsername}
          miniAppShortName={miniAppShortName}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(link) => {
            setTrackingLinks(prev => [link, ...prev]);
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onUpdated={(updated) => {
            setTrackingLinks(prev => prev.map(l => l.id === updated.id ? updated : l));
            setEditingLink(null);
          }}
        />
      )}

      {selectedLink && (
        <UsersModal
          link={selectedLink}
          onClose={() => setSelectedLink(null)}
        />
      )}

      <ConfirmDialog
        open={linkToDelete !== null}
        onOpenChange={(open) => !open && setLinkToDelete(null)}
        onConfirm={() => {
          if (linkToDelete) {
            handleDeleteLink(linkToDelete);
            setLinkToDelete(null);
          }
        }}
        title="Удалить ссылку?"
        description={`Вы уверены, что хотите удалить ссылку "${linkToDelete?.name}"?`}
        confirmText="Удалить"
        variant="danger"
      />
    </div>
  );
}

// Компонент статистики
function StatCard({ label, value, color, gradient }: { label: string; value: string | number; color: string; gradient?: string }) {
  return (
    <div className={`${gradient || 'bg-card'} rounded-lg border p-3 sm:p-4`}>
      <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// Карточка кампании
function CampaignCard({
  link,
  botUsername,
  copiedId,
  deletingId,
  onCopy,
  onDelete,
  onEdit,
  onViewUsers
}: {
  link: TrackingLink;
  botUsername: string;
  copiedId: string | null;
  deletingId: string | null;
  onCopy: (link: TrackingLink, e?: React.MouseEvent) => void;
  onDelete: (link: TrackingLink) => void;
  onEdit: (link: TrackingLink) => void;
  onViewUsers: () => void;
}) {
  const fullUrl = link.url;
  const hasAlerts = link.alerts && link.alerts.length > 0;

  return (
    <div className={`bg-card rounded-lg border overflow-hidden transition-all duration-200 hover:border-primary/50 ${
      hasAlerts ? 'border-orange-500/50' : 'border-border'
    }`}>
      <div className="p-4 sm:p-5">
        {/* Заголовок с действиями */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="text-foreground font-semibold truncate">{link.name}</h3>
              {link.linkType === 'app' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-xs font-medium">
                  Mini App
                </span>
              )}
              {link.source && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                  {link.source}
                </span>
              )}
              {hasAlerts && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded text-xs font-medium">
                  {link.alerts![0]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">{link.slug}</code>
              <span>•</span>
              <span>{link.created || '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => onCopy(link, e)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="Копировать ссылку"
            >
              {copiedId === link.id ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => onEdit(link)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(link);
              }}
              disabled={deletingId === link.id}
              className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
              title="Удалить"
            >
              <Trash2 className={`w-4 h-4 ${deletingId === link.id ? 'text-muted-foreground animate-pulse' : 'text-destructive'}`} />
            </button>
          </div>
        </div>

        {/* URL - компактный */}
        <div className="mb-4 p-2.5 bg-muted/50 rounded-lg flex items-center justify-between gap-2 group">
          <code className="text-xs text-foreground/80 truncate font-mono">https://{fullUrl}</code>
          <a
            href={`https://${fullUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-background rounded transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </div>

        {/* Метрики - компактная сетка */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
          <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">Рег.</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{link.registrations}</span>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-xs">Конв.</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{link.conversions}</span>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs">CR</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{link.conversionRate}%</span>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-xs">₽</span>
                <span className="text-xs">Доход</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{link.revenue.toLocaleString('ru-RU')}</span>
            </div>
          </div>
        </div>

        {/* Качество трафика */}
        {link.registrations > 0 && (link.botCount > 0 || link.suspiciousCount > 0) && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-muted-foreground">Качество:</span>
            {link.botCount > 0 && (
              <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded font-medium">
                {link.botCount} ботов ({Math.round(link.botCount / link.registrations * 100)}%)
              </span>
            )}
            {link.suspiciousCount > link.botCount && (
              <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded font-medium">
                {link.suspiciousCount - link.botCount} подозр.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Футер - компактный */}
      <div className="px-4 sm:px-5 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
        <span className="text-muted-foreground text-xs sm:text-sm">
          {link.registrations} {link.registrations === 1 ? 'пользователь' : 'пользователей'}
        </span>
        <button
          onClick={onViewUsers}
          className="flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <Users className="w-3.5 h-3.5" />
          Показать
        </button>
      </div>
    </div>
  );
}

function MetricCell({ label, value, color = 'text-foreground', className = '' }: { label: string; value: string | number; color?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-muted-foreground text-xs sm:text-sm uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm sm:text-lg ${color}`}>{value}</div>
    </div>
  );
}

// Модалка создания
function CreateLinkModal({
  botUsername,
  miniAppShortName,
  onClose,
  onCreated
}: {
  botUsername: string;
  miniAppShortName: string;
  onClose: () => void;
  onCreated: (link: TrackingLink) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [source, setSource] = useState('');
  const [linkType, setLinkType] = useState<'bot' | 'app'>('bot');
  const [loading, setLoading] = useState(false);

  const generateSlug = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    setSlug(`${timestamp}${random}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Заполните название и slug');
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient.createTrackingLink({ name, slug, source: source || undefined, link_type: linkType });

      const generatedUrl = linkType === 'app' && miniAppShortName
        ? `t.me/${botUsername}/${miniAppShortName}?startapp=${slug}`
        : `t.me/${botUsername}?start=${slug}`;

      onCreated({
        id: result.id || slug,
        name: result.name || name,
        slug: result.slug || slug,
        url: result.url || generatedUrl,
        registrations: 0,
        conversions: 0,
        revenue: 0,
        conversionRate: 0,
        source: source || null,
        alerts: [],
        created: result.created || new Date().toLocaleDateString('ru-RU'),
        botCount: 0,
        suspiciousCount: 0,
        linkType
      });
      toast.success('Кампания создана');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
          <DialogTitle>Новая кампания</DialogTitle>
          <DialogDescription className="mt-1.5">
            Создайте tracking ссылку для отслеживания трафика
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 space-y-4">
          <div>
            <label className="block text-muted-foreground text-sm mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Telegram Ads - Январь"
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-2">Slug</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="tg-ads-jan"
                className="flex-1 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground font-mono"
              />
              <button
                type="button"
                onClick={generateSlug}
                className="px-3 py-2 bg-muted border border-input rounded-md hover:bg-muted/80 text-sm"
              >
                Сгенерировать
              </button>
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-2">Источник (опционально)</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="telegram, vk, google..."
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-2">Тип ссылки</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLinkType('bot')}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  linkType === 'bot'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-input text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Бот
              </button>
              <button
                type="button"
                onClick={() => setLinkType('app')}
                disabled={!miniAppShortName}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-40 ${
                  linkType === 'app'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-input text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Mini App
              </button>
            </div>
            {!miniAppShortName && (
              <p className="text-orange-500 text-xs mt-1">Укажите Short name Mini App в настройках бота</p>
            )}
            <div className="mt-3 p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Как работает Short name?</p>
              <p><span className="font-medium">Бот-ссылка</span> — формат <code className="text-primary bg-primary/10 px-1 rounded">t.me/bot?start=slug</code>. Пользователь сначала попадает в чат с ботом, затем нажимает «Старт».</p>
              <p><span className="font-medium">Mini App-ссылка</span> — формат <code className="text-primary bg-primary/10 px-1 rounded">t.me/bot/shortname?startapp=slug</code>. Пользователь сразу открывает веб-приложение внутри Telegram.</p>
              <p>Чтобы использовать Mini App-ссылки, создайте Mini App через <span className="font-medium">@BotFather → /newapp</span>, скопируйте выданный short name и укажите его в <span className="font-medium">Настройки → Short name Mini App</span>.</p>
            </div>
          </div>

          {slug && (
            <div className="p-3 bg-muted rounded-md border border-border">
              <div className="text-muted-foreground text-xs font-medium uppercase mb-2">Ссылка</div>
              <code className="text-foreground text-sm break-all">
                {linkType === 'app' && miniAppShortName
                  ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${slug}`
                  : `https://t.me/${botUsername}?start=${slug}`
                }
              </code>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t flex gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={loading || !name || !slug}
            onClick={handleSubmit}
            className="flex-1"
          >
            {loading ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Модалка редактирования
function EditLinkModal({
  link,
  onClose,
  onUpdated
}: {
  link: TrackingLink;
  onClose: () => void;
  onUpdated: (link: TrackingLink) => void;
}) {
  const [name, setName] = useState(link.name);
  const [source, setSource] = useState(link.source || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Введите название');
      return;
    }

    setLoading(true);

    try {
      await apiClient.updateTrackingLink(link.slug, { name, source: source || undefined });
      onUpdated({ ...link, name, source: source || null });
      toast.success('Кампания обновлена');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка обновления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
          <DialogTitle>Редактировать кампанию</DialogTitle>
          <DialogDescription className="mt-1.5">
            Измените название и источник кампании
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 space-y-4">
          <div>
            <label className="block text-muted-foreground text-sm mb-2">Slug</label>
            <input
              type="text"
              value={link.slug}
              disabled
              className="w-full px-3 py-2 bg-muted/30 border border-input rounded-md text-muted-foreground font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-2">Источник</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="telegram, vk, google..."
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t flex gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={loading || !name}
            onClick={handleSubmit}
            className="flex-1"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Модалка пользователей
function UsersModal({ link, onClose }: { link: TrackingLink; onClose: () => void }) {
  const { isMiniApp } = useMiniApp();
  useBackButton(true, onClose);
  const [users, setUsers] = useState<TrackingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'converted' | 'notConverted' | 'suspicious'>('all');
  const [banningBots, setBanningBots] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);

  const handleBanBots = async () => {
    try {
      setBanningBots(true);
      const result = await apiClient.banCampaignBots(link.slug, 50);
      toast.success(`Заблокировано ботов: ${result.banned_count}`);
      setShowBanConfirm(false);
      // Refresh users
      const data = await apiClient.getTrackingLinkUsers(link.slug);
      setUsers(data.map((u: any) => ({
        id: u.id,
        username: u.username || '',
        telegramId: u.telegramId || '',
        fullName: u.fullName || '',
        plan: u.plan || 'Нет',
        revenue: u.revenue || 0,
        registered: u.registered || '—',
        converted: u.converted || false,
        lastActive: u.lastActive || '—',
        sessionsCount: u.sessionsCount || 0,
        trafficUsed: u.trafficUsed || '0',
        activeDevices: u.activeDevices || 0,
        timeToPurchase: u.timeToPurchase,
        suspiciousActivity: u.suspiciousActivity || false,
        botScore: u.botScore ?? 0,
        botConfirmed: u.botConfirmed ?? false,
        appOpensCount: u.appOpensCount ?? 0,
        accountAge: u.accountAge || '—',
        tgAccountAge: u.tgAccountAge || '—',
        isNewTgAccount: u.isNewTgAccount || false
      })));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка блокировки ботов');
    } finally {
      setBanningBots(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getTrackingLinkUsers(link.slug);
        setUsers(data.map((u: any) => ({
          id: u.id,
          username: u.username || '',
          telegramId: u.telegramId || '',
          fullName: u.fullName || '',
          plan: u.plan || 'Нет',
          revenue: u.revenue || 0,
          registered: u.registered || '—',
          converted: u.converted || false,
          lastActive: u.lastActive || '—',
          sessionsCount: u.sessionsCount || 0,
          trafficUsed: u.trafficUsed || '0',
          activeDevices: u.activeDevices || 0,
          timeToPurchase: u.timeToPurchase,
          suspiciousActivity: u.suspiciousActivity || false,
          botScore: u.botScore ?? 0,
          botConfirmed: u.botConfirmed ?? false,
          appOpensCount: u.appOpensCount ?? 0,
          accountAge: u.accountAge || '—',
          tgAccountAge: u.tgAccountAge || '—',
          isNewTgAccount: u.isNewTgAccount || false
        })));
        setError(null);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Ошибка загрузки';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [link.slug]);

  const filteredUsers = users.filter(u => {
    if (filter === 'converted') return u.converted;
    if (filter === 'notConverted') return !u.converted;
    if (filter === 'suspicious') return u.botScore >= 25;
    return true;
  });

  const convertedCount = users.filter(u => u.converted).length;
  const botCount = users.filter(u => u.botScore >= 50).length;
  const suspiciousCount = users.filter(u => u.botScore >= 25).length;

  return (
    <>
    <Dialog open={true} onOpenChange={onClose} variant={isMiniApp ? "fullscreen" : "default"}>
      <DialogContent hideCloseButton className="sm:max-w-[800px] sm:max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
          <div className={cn("flex items-center justify-between gap-3 sm:gap-4 flex-wrap", !isMiniApp && "pr-6 sm:pr-8")}>
            <div className={cn("min-w-0 flex-1", isMiniApp && "text-center")}>
              <DialogTitle className="text-xl">{link.name}</DialogTitle>
              <DialogDescription className={cn("mt-1.5", isMiniApp && "flex items-center justify-center gap-2")}>
                <span>{link.registrations} пользователей</span>
                <span>•</span>
                <span>{link.conversions} конверсий</span>
              </DialogDescription>
            </div>
            {botCount > 0 && !isMiniApp && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowBanConfirm(true)}
                disabled={banningBots}
                className="h-8 gap-1.5"
              >
                {banningBots ? 'Блокировка...' : `Забанить ботов (${botCount})`}
              </Button>
            )}
          </div>

          {/* Stats Row - симметричный вид */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{link.registrations}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{link.conversions}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{link.conversionRate}%</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-green-500">₽{link.revenue.toLocaleString('ru-RU')}</span>
            </div>
          </div>

          {/* Фильтры */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
            {[
              { key: 'all', label: 'Все', count: users.length },
              { key: 'converted', label: 'Купили', count: convertedCount },
              { key: 'notConverted', label: 'Не купили', count: users.length - convertedCount },
              { key: 'suspicious', label: 'Подозрительные', count: suspiciousCount },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  filter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 min-h-[200px] sm:min-h-[300px] pb-safe overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[200px]">
              <p className="text-destructive">{error}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px]">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">Нет пользователей</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map(user => {
                const isBot = user.botScore >= 50;
                const isSuspicious = user.botScore >= 25 && user.botScore < 50;
                const isConverted = user.converted && user.botScore < 25;

                return (
                  <div key={user.id} className="rounded-lg bg-muted/50 p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isBot ? 'bg-red-500/10' :
                        isSuspicious ? 'bg-orange-500/10' :
                        isConverted ? 'bg-green-500/10' : 'bg-muted'
                      )}>
                        <User className={cn("w-4 h-4",
                          isBot ? 'text-red-500' :
                          isSuspicious ? 'text-orange-500' :
                          isConverted ? 'text-green-500' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{user.fullName || 'Без имени'}</span>
                          {isMiniApp && <span className="font-mono text-xs text-muted-foreground">{user.telegramId}</span>}
                          {user.botConfirmed ? (
                            <Badge variant="outline" className="border-destructive/50 text-destructive text-xs">Бот ✓</Badge>
                          ) : isBot ? (
                            <Badge variant="outline" className="border-destructive/50 text-destructive text-xs">Бот ({user.botScore})</Badge>
                          ) : isSuspicious ? (
                            <Badge variant="outline" className="border-orange-500/50 text-orange-500 text-xs">Подозр. ({user.botScore})</Badge>
                          ) : isConverted ? (
                            <Badge variant="outline" className="border-green-500/50 text-green-500 text-xs">Купил</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.username && <span>@{user.username}</span>}
                          {user.username && <span className="mx-1">•</span>}
                          {!isMiniApp && (
                            <>
                              <span className="font-mono">{user.telegramId}</span>
                              <span className="mx-1">•</span>
                            </>
                          )}
                          <span>{user.registered}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {user.converted ? (
                        <>
                          <div className="text-sm font-bold text-green-500">+₽{user.revenue.toLocaleString('ru-RU')}</div>
                          <div className="text-xs text-muted-foreground">{user.plan}</div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          TG: <span className={user.isNewTgAccount ? 'text-orange-500' : ''}>{user.tgAccountAge}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>

      <ConfirmDialog
        open={showBanConfirm}
        onOpenChange={setShowBanConfirm}
        title="Заблокировать ботов"
        description={`Заблокировать ${botCount} пользователей с bot_score >= 50? Их ключи будут деактивированы, а IP заблокированы через fail2ban.`}
        confirmText={banningBots ? 'Блокировка...' : 'Заблокировать'}
        variant="danger"
        onConfirm={handleBanBots}
      />
    </>
  );
}

// Компактный бейдж антибот системы с тултипом
function AntibotBadge() {
  return (
    <div className="relative group ml-auto">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-md cursor-help">
        <Target className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-xs font-medium text-orange-500">Антибот</span>
      </div>

      {/* Тултип */}
      <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-card border border-border rounded-lg shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
        <div className="text-sm font-medium text-foreground mb-3">Скоринг ботов (0-100):</div>
        <div className="space-y-2 text-xs">
          {[
            { pts: 25, text: 'Оплатил, 0 трафика, 3+ дня' },
            { pts: 20, text: 'Есть ключ, 0 трафика, 48ч+' },
            { pts: 15, text: 'Никогда не открывал приложение, 24ч+' },
            { pts: 20, text: 'IP-кластер: 3+ юзеров с одной /24 подсети' },
            { pts: 10, text: 'UA-кластер: 5+ юзеров с идентичным UA' },
            { pts: 10, text: 'Новый TG (2024+) + нет трафика и app opens' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="w-5 h-4 rounded bg-orange-500/20 text-orange-500 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                +{item.pts}
              </div>
              <span className="text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border space-y-1 text-[10px] text-muted-foreground">
          <div><span className="text-destructive font-medium">50+</span> — Бот (красный)</div>
          <div><span className="text-orange-500 font-medium">25-49</span> — Подозрительный (жёлтый)</div>
          <div>Пересчёт каждые 30 мин + при старте сервера</div>
        </div>
      </div>
    </div>
  );
}


<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
