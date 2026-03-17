import React, { useState, useEffect, memo } from 'react';
import Lottie from 'lottie-react';
import { Save, Bot, DollarSign, CreditCard, Users, ExternalLink, Bell, Loader2, Check, X, Plus, Trash2, Eye, EyeOff, ScrollText, ChevronLeft, ChevronRight, Sparkles, Globe, Power, Database, Download, RefreshCw, ArrowRightLeft, CircleCheck, CircleX, Server, Palette, ChevronDown, Home, MessageCircle, ShoppingCart, User, Settings2, Gift, RotateCcw, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useMiniApp } from '../context/MiniAppContext';
import { Combobox } from './ui/combobox';
import { ConfirmDialog } from './ui/confirm-dialog';
import { apiClient, Settings as SettingsType } from '../services/api';
import { cn } from './ui/utils';

// Error Boundary — ловит крэши Lottie и других компонентов, показывает fallback вместо белого экрана
class LottieErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.warn('LottieErrorBoundary caught:', error); }
  render() {
    if (this.state.hasError) return (this.props.fallback ?? <div className="flex items-center justify-center w-full h-full text-muted-foreground"><Sparkles className="w-8 h-8 opacity-30" /></div>) as React.ReactElement;
    return this.props.children;
  }
}

type TabType = 'bot' | 'subscription' | 'payments' | 'referral' | 'notifications' | 'ai' | 'logs' | 'domain' | 'maintenance' | 'database' | 'theme';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'bot', label: 'Telegram бот', icon: <Bot className="w-4 h-4" /> },
  { id: 'subscription', label: 'Тарифы', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'payments', label: 'Платежи', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'referral', label: 'Рефералы', icon: <Users className="w-4 h-4" /> },
  { id: 'notifications', label: 'Уведомления', icon: <Bell className="w-4 h-4" /> },
  { id: 'ai', label: 'ИИ-поддержка', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'domain', label: 'Домен подписок', icon: <Globe className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Тех. работы', icon: <Power className="w-4 h-4" /> },
  { id: 'logs', label: 'Логи', icon: <ScrollText className="w-4 h-4" /> },
  { id: 'database', label: 'База данных', icon: <Database className="w-4 h-4" /> },
  { id: 'theme', label: 'Оформление', icon: <Palette className="w-4 h-4" /> },
];

export function Settings() {
  const { isMiniApp } = useMiniApp();
  const [activeTab, setActiveTab] = useState<TabType>('bot');
  const [settings, setSettings] = useState<Partial<SettingsType>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'theme') {
      setShowThemeModal(true);
    } else {
      setActiveTab(tabId);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSettings();
      setSettings(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedSettings: Partial<SettingsType>) => {
    try {
      setSaving(true);
      await apiClient.updateSettings(updatedSettings);
      setSettings(prev => ({ ...prev, ...updatedSettings }));
      toast.success('Настройки сохранены');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mini App View
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Tab selector */}
        <div className="p-3 border-b bg-muted/30">
          <Combobox
            value={activeTab}
            onChange={(value) => handleTabClick(value as TabType)}
            options={tabs.map(t => ({ value: t.id, label: t.label }))}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'bot' && <BotSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'subscription' && <SubscriptionSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'payments' && <PaymentSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'referral' && <ReferralSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'notifications' && <NotificationSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'ai' && <AISettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'maintenance' && <MaintenanceSettings settings={settings} onSave={handleSave} saving={saving} isMiniApp />}
          {activeTab === 'domain' && <DomainSettings isMiniApp />}
          {activeTab === 'logs' && <LogsSettings isMiniApp />}
          {activeTab === 'database' && <DatabaseSettings isMiniApp />}
        </div>

        {showThemeModal && (
          <ThemeEditorModal settings={settings} onSave={handleSave} saving={saving} onClose={() => setShowThemeModal(false)} />
        )}
      </div>
    );
  }

  // Desktop View
  return (
    <div className="space-y-6">
      {/* Layout */}
      <div className="flex flex-col lg:flex-row lg:gap-8">
        {/* Mobile Select */}
        <div className="lg:hidden mb-6">
          <Combobox
            value={activeTab}
            onChange={(value) => handleTabClick(value as TabType)}
            options={tabs.map(t => ({ value: t.id, label: t.label }))}
          />
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'bot' && <BotSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'subscription' && <SubscriptionSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'payments' && <PaymentSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'referral' && <ReferralSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'notifications' && <NotificationSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'ai' && <AISettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'maintenance' && <MaintenanceSettings settings={settings} onSave={handleSave} saving={saving} />}
          {activeTab === 'domain' && <DomainSettings />}
          {activeTab === 'logs' && <LogsSettings />}
          {activeTab === 'database' && <DatabaseSettings />}
        </div>
      </div>

      {showThemeModal && (
        <ThemeEditorModal settings={settings} onSave={handleSave} saving={saving} onClose={() => setShowThemeModal(false)} />
      )}
    </div>
  );
}

// Content Section wrapper
function ContentSection({ title, desc, children, isMiniApp }: { title: string; desc: string; children: React.ReactNode; isMiniApp?: boolean }) {
  if (isMiniApp) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
      <div className="h-px bg-gradient-to-r from-border to-transparent" />
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}

// Form Field wrapper
function FormField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

interface SettingsTabProps {
  settings: Partial<SettingsType>;
  onSave: (settings: Partial<SettingsType>) => Promise<void>;
  saving: boolean;
}

function SecretInput({ value, onChange, placeholder, secretKey }: { value: string; onChange: (v: string) => void; placeholder: string; secretKey: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
      </button>
    </div>
  );
}

function BotSettings({ settings, onSave, saving }: SettingsTabProps) {
  const [botName, setBotName] = useState(settings.bot_name || '');
  const [botToken, setBotToken] = useState(settings.bot_token || '');
  const [adminTgid, setAdminTgid] = useState(settings.admin_tgid || '');
  const [miniAppShortName, setMiniAppShortName] = useState(settings.mini_app_short_name || '');
  const [supportBotToken, setSupportBotToken] = useState(settings.support_bot_token || '');
  const [supportType, setSupportType] = useState<'bot' | 'personal'>(settings.support_type || (settings.support_bot_token ? 'bot' : 'personal'));
  const [supportUsername, setSupportUsername] = useState(settings.support_username || '');
  const [domain, setDomain] = useState((settings as any).domain || '');
  const [showToken, setShowToken] = useState(false);
  const [showSupportToken, setShowSupportToken] = useState(false);

  useEffect(() => {
    setBotName(settings.bot_name || '');
    setBotToken(settings.bot_token || '');
    setAdminTgid(settings.admin_tgid || '');
    setMiniAppShortName(settings.mini_app_short_name || '');
    setSupportBotToken(settings.support_bot_token || '');
    setSupportType(settings.support_type || (settings.support_bot_token ? 'bot' : 'personal'));
    setSupportUsername(settings.support_username || '');
    setDomain((settings as any).domain || '');
  }, [settings]);

  const handleSubmit = () => {
    const data: any = {
      bot_name: botName,
      bot_token: botToken,
      admin_tgid: adminTgid,
      mini_app_short_name: miniAppShortName,
      support_type: supportType,
      domain: domain,
    };
    if (supportType === 'bot') {
      data.support_bot_token = supportBotToken;
    } else {
      const clean = supportUsername.replace('@', '').trim();
      data.support_username = clean;
      data.support_bot_username = clean;
    }
    onSave(data);
  };

  return (
    <>
    <ContentSection title="Telegram бот" desc="Настройки подключения и основные параметры бота">
      <div className="space-y-6">
        <FormField label="Название бота" description="Отображается в Mini App и подписках">
          <input
            type="text"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Введите название"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Telegram ID администратора">
          <input
            type="text"
            value={adminTgid}
            onChange={(e) => setAdminTgid(e.target.value)}
            placeholder="123456789"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <a
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-xs hover:underline mt-1"
          >
            Получить ID в @userinfobot
            <ExternalLink className="w-3 h-3" />
          </a>
        </FormField>

        <FormField label="Токен бота">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
            >
              {showToken ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-xs hover:underline mt-1"
          >
            Получить у @BotFather
            <ExternalLink className="w-3 h-3" />
          </a>
          {settings.bot_username && (
            <p className="text-green-500 text-xs mt-1">Подключен: @{settings.bot_username}</p>
          )}
        </FormField>

        <FormField label="Short name Mini App" description="Имя Mini App из BotFather (для прямых ссылок t.me/bot/app)">
          <input
            type="text"
            value={miniAppShortName}
            onChange={(e) => setMiniAppShortName(e.target.value)}
            placeholder="app"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {settings.bot_username && miniAppShortName && (
            <p className="text-muted-foreground text-xs mt-1">
              Ссылка: t.me/{settings.bot_username}/{miniAppShortName}
            </p>
          )}
          <div className="mt-3 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground/80">Как получить Short name?</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Откройте <span className="font-medium">@BotFather</span> в Telegram</li>
              <li>Отправьте команду <code className="text-primary">/newapp</code></li>
              <li>Выберите вашего бота</li>
              <li>Следуйте инструкциям (название, описание, фото, URL веб-приложения)</li>
              <li>На последнем шаге BotFather попросит указать <span className="font-medium">short name</span> — это и есть нужное значение</li>
            </ol>
            <p className="pt-1">Short name используется для формирования прямых ссылок на Mini App: <code className="text-primary">t.me/bot/<span className="italic">shortname</span></code>. Такие ссылки открывают веб-приложение напрямую, без перехода в чат с ботом.</p>
          </div>
        </FormField>

        <FormField label="Поддержка" description="Куда пользователь попадёт при нажатии кнопки «Поддержка» в Mini App">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSupportType('bot')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                supportType === 'bot'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Бот поддержки
            </button>
            <button
              type="button"
              onClick={() => setSupportType('personal')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                supportType === 'personal'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Личный аккаунт
            </button>
          </div>

          {supportType === 'bot' ? (
            <>
              <div className="relative">
                <input
                  type={showSupportToken ? 'text' : 'password'}
                  value={supportBotToken}
                  onChange={(e) => setSupportBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowSupportToken(!showSupportToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                >
                  {showSupportToken ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-muted-foreground text-xs mt-1">Токен отдельного бота для поддержки (создайте через @BotFather)</p>
              {settings.support_bot_username && supportType === 'bot' && (
                <p className="text-green-500 text-xs mt-1">Подключен: @{settings.support_bot_username}</p>
              )}
            </>
          ) : (
            <>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={supportUsername}
                  onChange={(e) => setSupportUsername(e.target.value.replace('@', ''))}
                  placeholder="username"
                  className="w-full pl-7 pr-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-muted-foreground text-xs mt-1">Username вашего личного Telegram аккаунта</p>
              {supportUsername && (
                <p className="text-green-500 text-xs mt-1">Пользователи будут писать: @{supportUsername.replace('@', '')}</p>
              )}
            </>
          )}
        </FormField>

        {domain && (
          <FormField label="Домен" description="Настраивается через переменную DOMAIN в .env">
            <div className="w-full px-3 py-2 bg-muted/50 border border-input rounded-md text-sm text-foreground font-mono select-all">
              {domain}
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Админка Mini App: https://{domain}/admin
            </p>
          </FormField>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>

      </div>
    </ContentSection>
    </>
  );
}

function SubscriptionSettings({ settings, onSave, saving }: SettingsTabProps) {
  const [plans, setPlans] = useState<Array<{ plan_id: string; name: string; price: number; duration_days: number; device_limit?: number }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlans, setSavingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [deviceSurchargePrice, setDeviceSurchargePrice] = useState<number>(settings.device_surcharge_price ?? 50);

  // Загружаем планы при монтировании
  useEffect(() => {
    loadPlans();
  }, []);

  // Обновляем deviceSurchargePrice при изменении settings
  useEffect(() => {
    setDeviceSurchargePrice(settings.device_surcharge_price ?? 50);
  }, [settings]);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      setPlansError(null);
      const data = await apiClient.getPlans();
      setPlans(data);
    } catch (err: any) {
      setPlansError(err?.response?.data?.detail || err?.message || 'Ошибка загрузки тарифов');
      toast.error('Ошибка загрузки тарифов');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handlePlanChange = (planId: string, field: 'price' | 'duration_days', value: string) => {
    // Убираем ведущие нули и парсим как число
    const cleanValue = value.replace(/^0+(?=\d)/, '');
    const numValue = cleanValue === '' ? 0 : parseInt(cleanValue, 10);
    setPlans(prev => prev.map(p => p.plan_id === planId ? { ...p, [field]: isNaN(numValue) ? 0 : numValue } : p));
  };

  // Валидация перед сохранением
  const validatePlans = (): string | null => {
    for (const plan of plans) {
      if (plan.duration_days < 1) {
        return `Длительность тарифа "${planLabels[plan.plan_id] || plan.name}" должна быть минимум 1 день`;
      }
      if (plan.plan_id !== 'trial' && plan.price < 10) {
        return `Цена тарифа "${planLabels[plan.plan_id] || plan.name}" должна быть минимум 10 ₽`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    // Валидация
    const validationError = validatePlans();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSavingPlans(true);
    try {
      // Отправляем все планы с price, duration_days и device_limit (для trial)
      await apiClient.updatePlans(plans.map(p => ({
        plan_id: p.plan_id,
        price: p.price,
        duration_days: p.duration_days,
        // device_limit только для trial плана
        ...(p.plan_id === 'trial' && { device_limit: p.device_limit || 0 }),
      })));

      // Сохраняем настройку наценки за устройства
      await onSave({ device_surcharge_price: deviceSurchargePrice });

      toast.success('Тарифы и настройки сохранены');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingPlans(false);
    }
  };

  const planLabels: Record<string, string> = {
    'trial': 'Пробный период',
    '1month': '1 месяц',
    '3months': '3 месяца',
    '6months': '6 месяцев',
    '1year': '1 год',
  };

  // Разделяем trial и платные планы
  const trialPlan = plans.find(p => p.plan_id === 'trial');
  const paidPlans = plans.filter(p => p.plan_id !== 'trial');

  return (
    <ContentSection title="Тарифы и подписки" desc="Стоимость подписок и лимиты">
      <div className="space-y-6">
        {/* Пробный период */}
        {trialPlan && (
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <label className="text-sm font-medium text-foreground mb-3 block">Пробный период</label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Длительность</span>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="1"
                    value={trialPlan.duration_days || ''}
                    onChange={(e) => handlePlanChange('trial', 'duration_days', e.target.value)}
                    className="w-full px-3 py-1.5 pr-10 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">дн</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Устройств</span>
                <div className="relative w-20">
                  <input
                    type="number"
                    min="0"
                    value={trialPlan.device_limit || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/^0+(?=\d)/, '');
                      setPlans(prev => prev.map(p => p.plan_id === 'trial' ? { ...p, device_limit: val === '' ? 0 : parseInt(val, 10) || 0 } : p));
                    }}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <span className="text-xs text-muted-foreground">(0 = ∞)</span>
              </div>
            </div>
          </div>
        )}

        {/* Платные тарифы */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <label className="text-sm font-medium text-foreground mb-3 block">Стоимость подписок</label>
          {loadingPlans ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : plansError ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-sm text-red-500">{plansError}</p>
              <button onClick={loadPlans} className="mt-1 text-xs text-red-500 hover:underline">
                Повторить
              </button>
            </div>
          ) : paidPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Тарифы не найдены</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {paidPlans.map(plan => (
                <div key={plan.plan_id} className="flex items-center gap-2">
                  <span className="text-sm text-foreground w-20 flex-shrink-0">
                    {planLabels[plan.plan_id] || plan.name}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="10"
                      value={plan.price || ''}
                      onChange={(e) => handlePlanChange(plan.plan_id, 'price', e.target.value)}
                      className="w-full px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₽</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Наценка за дополнительные устройства */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <label className="text-sm font-medium text-foreground mb-2 block">Наценка за устройства</label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">+</span>
            <div className="relative w-24">
              <input
                type="number"
                min="0"
                value={deviceSurchargePrice}
                onChange={(e) => setDeviceSurchargePrice(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₽</span>
            </div>
            <span className="text-sm text-muted-foreground">за каждое устройство сверх первого</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || savingPlans}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {(saving || savingPlans) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>
    </ContentSection>
  );
}

function PaymentSettings({ settings, onSave, saving }: SettingsTabProps) {
  const [starsEnabled, setStarsEnabled] = useState(settings.telegram_stars_enabled || false);
  const [yoomoneyEnabled, setYoomoneyEnabled] = useState(settings.yoomoney_enabled || false);
  const [yoomoneyToken, setYoomoneyToken] = useState(settings.yoomoney_token || '');
  const [yoomoneyWallet, setYoomoneyWallet] = useState(settings.yoomoney_wallet || '');
  const [yookassaEnabled, setYookassaEnabled] = useState(settings.yookassa_enabled || false);
  const [yookassaShopId, setYookassaShopId] = useState(settings.yookassa_shop_id || '');
  const [yookassaSecretKey, setYookassaSecretKey] = useState(settings.yookassa_secret_key || '');
  const [yookassaReceiptEmail, setYookassaReceiptEmail] = useState(settings.yookassa_receipt_email || '');
  const [cryptobotEnabled, setCryptobotEnabled] = useState(settings.cryptobot_enabled || false);
  const [cryptobotToken, setCryptobotToken] = useState(settings.cryptobot_token || '');
  const [freekassaEnabled, setFreekassaEnabled] = useState(settings.freekassa_enabled || false);
  const [freekassaMerchantId, setFreekassaMerchantId] = useState(settings.freekassa_merchant_id || '');
  const [freekassaSecretWord1, setFreekassaSecretWord1] = useState(settings.freekassa_secret_word_1 || '');
  const [freekassaSecretWord2, setFreekassaSecretWord2] = useState(settings.freekassa_secret_word_2 || '');
  const [copied, setCopied] = useState<string | null>(null);

  const webhookDomain = settings.domain ? `https://${settings.domain}` : '';

  const copyWebhookUrl = (provider: string) => {
    const url = `${webhookDomain}/api/webhooks/${provider}`;
    navigator.clipboard.writeText(url);
    setCopied(provider);
    setTimeout(() => setCopied(null), 2000);
  };

  const WebhookUrl = ({ provider, hint }: { provider: string; hint: string }) => {
    if (!webhookDomain) return null;
    const url = `${webhookDomain}/api/webhooks/${provider}`;
    return (
      <div className="mt-3 p-3 bg-background/50 rounded-md border border-dashed border-border">
        <div className="text-xs text-muted-foreground mb-1.5">Webhook URL — укажите в личном кабинете {hint}</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono text-foreground truncate">{url}</code>
          <button
            type="button"
            onClick={() => copyWebhookUrl(provider)}
            className="shrink-0 px-2.5 py-1.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
          >
            {copied === provider ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    setStarsEnabled(settings.telegram_stars_enabled || false);
    setYoomoneyEnabled(settings.yoomoney_enabled || false);
    setYoomoneyToken(settings.yoomoney_token || '');
    setYoomoneyWallet(settings.yoomoney_wallet || '');
    setYookassaEnabled(settings.yookassa_enabled || false);
    setYookassaShopId(settings.yookassa_shop_id || '');
    setYookassaSecretKey(settings.yookassa_secret_key || '');
    setYookassaReceiptEmail(settings.yookassa_receipt_email || '');
    setCryptobotEnabled(settings.cryptobot_enabled || false);
    setCryptobotToken(settings.cryptobot_token || '');
    setFreekassaEnabled(settings.freekassa_enabled || false);
    setFreekassaMerchantId(settings.freekassa_merchant_id || '');
    setFreekassaSecretWord1(settings.freekassa_secret_word_1 || '');
    setFreekassaSecretWord2(settings.freekassa_secret_word_2 || '');
  }, [settings]);

  const handleSubmit = () => {
    onSave({
      telegram_stars_enabled: starsEnabled,
      yoomoney_enabled: yoomoneyEnabled,
      yoomoney_token: yoomoneyToken,
      yoomoney_wallet: yoomoneyWallet,
      yookassa_enabled: yookassaEnabled,
      yookassa_shop_id: yookassaShopId,
      yookassa_secret_key: yookassaSecretKey,
      yookassa_receipt_email: yookassaReceiptEmail,
      cryptobot_enabled: cryptobotEnabled,
      cryptobot_token: cryptobotToken,
      freekassa_enabled: freekassaEnabled,
      freekassa_merchant_id: freekassaMerchantId,
      freekassa_secret_word_1: freekassaSecretWord1,
      freekassa_secret_word_2: freekassaSecretWord2,
    });
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="ios-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="ios-toggle-track"></div>
    </label>
  );


  return (
    <ContentSection title="Платежные системы" desc="Настройка способов оплаты">
      <div className="space-y-6">
        {/* Telegram Stars */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div>
            <div className="font-medium text-sm text-foreground">Telegram Stars</div>
            <div className="text-xs text-muted-foreground mt-0.5">Встроенная система Telegram</div>
          </div>
          <Toggle checked={starsEnabled} onChange={setStarsEnabled} />
        </div>

        {/* YooKassa */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">YooKassa (СБП)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Оплата через СБП</div>
            </div>
            <Toggle checked={yookassaEnabled} onChange={setYookassaEnabled} />
          </div>
          {yookassaEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <FormField label="Shop ID">
                <input
                  type="text"
                  value={yookassaShopId}
                  onChange={(e) => setYookassaShopId(e.target.value)}
                  placeholder="ID магазина"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>
              <FormField label="Secret Key">
                <SecretInput value={yookassaSecretKey} onChange={setYookassaSecretKey} placeholder="Секретный ключ" secretKey="yookassa" />
              </FormField>
              <FormField label="Email для чеков (54-ФЗ)">
                <input
                  type="email"
                  value={yookassaReceiptEmail}
                  onChange={(e) => setYookassaReceiptEmail(e.target.value)}
                  placeholder="receipts@example.com"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="text-xs text-muted-foreground mt-1">Если указан — к каждому платежу будет прикреплён фискальный чек. Оставьте пустым для работы без чеков.</div>
              </FormField>
              <WebhookUrl provider="yookassa" hint="YooKassa → Настройки → HTTP-уведомления" />
            </div>
          )}
        </div>

        {/* YooMoney */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">YooMoney</div>
              <div className="text-xs text-muted-foreground mt-0.5">Кошелек YooMoney</div>
            </div>
            <Toggle checked={yoomoneyEnabled} onChange={setYoomoneyEnabled} />
          </div>
          {yoomoneyEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <FormField label="Токен">
                <SecretInput value={yoomoneyToken} onChange={setYoomoneyToken} placeholder="Токен" secretKey="yoomoney" />
              </FormField>
              <FormField label="Номер кошелька">
                <input
                  type="text"
                  value={yoomoneyWallet}
                  onChange={(e) => setYoomoneyWallet(e.target.value)}
                  placeholder="410011234567890"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>
              <WebhookUrl provider="yoomoney" hint="YooMoney → Уведомления" />
            </div>
          )}
        </div>

        {/* CryptoBot */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">CryptoBot</div>
              <div className="text-xs text-muted-foreground mt-0.5">Криптовалютные платежи</div>
            </div>
            <Toggle checked={cryptobotEnabled} onChange={setCryptobotEnabled} />
          </div>
          {cryptobotEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <FormField label="API Token">
                <SecretInput value={cryptobotToken} onChange={setCryptobotToken} placeholder="API токен" secretKey="cryptobot" />
              </FormField>
              <WebhookUrl provider="cryptobot" hint="CryptoBot → My Apps → Webhooks" />
            </div>
          )}
        </div>

        {/* FreeKassa */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">FreeKassa</div>
              <div className="text-xs text-muted-foreground mt-0.5">Банковские карты, СБП, электронные кошельки</div>
            </div>
            <Toggle checked={freekassaEnabled} onChange={setFreekassaEnabled} />
          </div>
          {freekassaEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <FormField label="Merchant ID">
                <input
                  type="text"
                  value={freekassaMerchantId}
                  onChange={(e) => setFreekassaMerchantId(e.target.value)}
                  placeholder="ID магазина"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>
              <FormField label="Секретное слово 1">
                <SecretInput value={freekassaSecretWord1} onChange={setFreekassaSecretWord1} placeholder="Секретное слово 1" secretKey="freekassa1" />
              </FormField>
              <FormField label="Секретное слово 2">
                <SecretInput value={freekassaSecretWord2} onChange={setFreekassaSecretWord2} placeholder="Секретное слово 2" secretKey="freekassa2" />
              </FormField>
              <WebhookUrl provider="freekassa" hint="FreeKassa → Настройки → URL оповещения (POST)" />
              <div className="p-3 bg-background/50 rounded-md border border-dashed border-border">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>URL успешной оплаты и URL возврата — укажите ссылку на вашего бота, например <code className="bg-muted px-1 py-0.5 rounded font-mono">https://t.me/ваш_бот</code></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>
    </ContentSection>
  );
}

function MaintenanceSettings({ settings, onSave, saving }: SettingsTabProps) {
  const [enabled, setEnabled] = useState(settings.maintenance_mode === true || settings.maintenance_mode === 'true');
  const [message, setMessage] = useState(
    (settings as any).maintenance_message || 'Сервис на техническом обслуживании. Скоро вернёмся!'
  );

  useEffect(() => {
    setEnabled(settings.maintenance_mode === true || settings.maintenance_mode === 'true');
    setMessage((settings as any).maintenance_message || 'Сервис на техническом обслуживании. Скоро вернёмся!');
  }, [settings]);

  const handleSubmit = () => {
    onSave({
      maintenance_mode: enabled,
      maintenance_message: message,
    } as any);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="ios-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="ios-toggle-track"></div>
    </label>
  );

  return (
    <ContentSection title="Режим техработ" desc="Временное отключение бота и Mini App для пользователей">
      <div className="space-y-6">
        <div className={`p-4 rounded-lg border space-y-4 ${enabled ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">Режим техработ</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {enabled ? 'Бот и Mini App недоступны для пользователей' : 'Сервис работает в обычном режиме'}
              </div>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
          {enabled && (
            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                <Power className="w-4 h-4 shrink-0" />
                <span>Бот будет отвечать сообщением о техработах. Mini App покажет страницу обслуживания. Админ-панель и вебхуки оплат продолжат работать.</span>
              </div>
              <FormField label="Сообщение для пользователей">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Сервис на техническом обслуживании..."
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>
    </ContentSection>
  );
}

function ReferralSettings({ settings, onSave, saving }: SettingsTabProps) {
  const [referralMode, setReferralMode] = useState<'days' | 'money'>(
    settings.referral_mode === 'money' ? 'money' : 'days'
  );
  const [inviteBonusDays, setInviteBonusDays] = useState(settings.referral_invite_bonus_days || '3');
  const [purchaseBonusDays, setPurchaseBonusDays] = useState<{
    '1month': number; '3months': number; '6months': number; '1year': number;
  }>(() => {
    try {
      const parsed = typeof settings.referral_purchase_bonus_days === 'string'
        ? JSON.parse(settings.referral_purchase_bonus_days)
        : settings.referral_purchase_bonus_days;
      return parsed || { '1month': 14, '3months': 30, '6months': 60, '1year': 120 };
    } catch {
      return { '1month': 14, '3months': 30, '6months': 60, '1year': 120 };
    }
  });

  // Денежная модель
  const [referralPercent, setReferralPercent] = useState(settings.referral_percent || '10');
  const [minWithdrawal, setMinWithdrawal] = useState(settings.referral_min_withdrawal || '500');
  const [freekassaApiKey, setFreekassaApiKey] = useState(settings.freekassa_api_key || '');

  useEffect(() => {
    setReferralMode(settings.referral_mode === 'money' ? 'money' : 'days');
    setInviteBonusDays(settings.referral_invite_bonus_days || '3');
    try {
      const parsed = typeof settings.referral_purchase_bonus_days === 'string'
        ? JSON.parse(settings.referral_purchase_bonus_days)
        : settings.referral_purchase_bonus_days;
      setPurchaseBonusDays(parsed || { '1month': 14, '3months': 30, '6months': 60, '1year': 120 });
    } catch {
      setPurchaseBonusDays({ '1month': 14, '3months': 30, '6months': 60, '1year': 120 });
    }
    setReferralPercent(settings.referral_percent || '10');
    setMinWithdrawal(settings.referral_min_withdrawal || '500');
    setFreekassaApiKey(settings.freekassa_api_key || '');
  }, [settings]);

  const handleSubmit = () => {
    onSave({
      referral_mode: referralMode,
      referral_invite_bonus_days: inviteBonusDays,
      referral_purchase_bonus_days: JSON.stringify(purchaseBonusDays),
      referral_percent: referralPercent,
      referral_min_withdrawal: minWithdrawal,
      freekassa_api_key: freekassaApiKey,
    });
  };

  const tariffLabels: Record<string, string> = {
    '1month': '1 месяц', '3months': '3 месяца', '6months': '6 месяцев', '1year': '1 год',
  };

  const radioClass = (active: boolean) =>
    `p-4 rounded-lg border-2 cursor-pointer transition-all ${
      active
        ? 'border-primary bg-primary/5'
        : 'border-border bg-muted/30 hover:border-muted-foreground/30'
    }`;

  return (
    <ContentSection title="Реферальная программа" desc="Бонусы за приглашения и покупки рефералов">
      <div className="space-y-6">
        <div className="text-sm font-medium text-foreground">Режим реферальной программы</div>

        {/* Бонусные дни */}
        <div className={radioClass(referralMode === 'days')} onClick={() => setReferralMode('days')}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              referralMode === 'days' ? 'border-primary' : 'border-muted-foreground/40'
            }`}>
              {referralMode === 'days' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">Бонусные дни</div>
              <div className="text-xs text-muted-foreground mt-0.5">Реферер получает дни подписки за приглашения и покупки друзей</div>
            </div>
          </div>
          {referralMode === 'days' && (
            <div className="space-y-3 pt-3 mt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
              <FormField label="Бонус за приглашение (дней)" description="Когда приглашенный активирует триал и использует ≥3 МБ">
                <input
                  type="number"
                  value={inviteBonusDays}
                  onChange={(e) => setInviteBonusDays(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Бонус за покупку реферала</label>
                <p className="text-xs text-muted-foreground mb-3">Дни подписки рефереру при покупке</p>
                <div className="space-y-2">
                  {(Object.keys(tariffLabels) as Array<keyof typeof purchaseBonusDays>).map((tariff) => (
                    <div key={tariff} className="flex items-center gap-4">
                      <span className="text-sm text-foreground w-24">{tariffLabels[tariff]}</span>
                      <div className="relative flex-1 max-w-32">
                        <input
                          type="number"
                          value={purchaseBonusDays[tariff] || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/^0+(?=\d)/, '');
                            setPurchaseBonusDays((prev: typeof purchaseBonusDays) => ({ ...prev, [tariff]: val === '' ? 0 : parseInt(val, 10) || 0 }));
                          }}
                          min="0"
                          className="w-full px-3 py-1.5 pr-12 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">дней</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Денежный бонус */}
        <div className={radioClass(referralMode === 'money')} onClick={() => setReferralMode('money')}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              referralMode === 'money' ? 'border-primary' : 'border-muted-foreground/40'
            }`}>
              {referralMode === 'money' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">Денежный бонус</div>
              <div className="text-xs text-muted-foreground mt-0.5">Реферер получает % от оплат друзей на баланс с возможностью вывода</div>
            </div>
          </div>
          {referralMode === 'money' && (
            <div className="space-y-3 pt-3 mt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground w-40">Процент от оплаты</span>
                <div className="relative flex-1 max-w-32">
                  <input
                    type="number"
                    value={referralPercent}
                    onChange={(e) => setReferralPercent(e.target.value)}
                    min="1"
                    max="50"
                    className="w-full px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground w-40">Мин. сумма вывода</span>
                <div className="relative flex-1 max-w-32">
                  <input
                    type="number"
                    value={minWithdrawal}
                    onChange={(e) => setMinWithdrawal(e.target.value)}
                    min="100"
                    className="w-full px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₽</span>
                </div>
              </div>
              <FormField label="FreeKassa API-ключ" description="Для автоматических выводов (раздел API в ЛК FreeKassa)">
                <SecretInput value={freekassaApiKey} onChange={setFreekassaApiKey} placeholder="API-ключ" secretKey="freekassa_api" />
              </FormField>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>
    </ContentSection>
  );
}

function NotificationSettings({ settings, onSave, saving }: SettingsTabProps) {
  const defaultNotifications = {
    server_down: true, server_recovered: true, suspicious_activity: true,
    tracking_bots: true, new_payment: false, daily_report: false,
    tracking_bots_threshold: 5, cooldown_minutes: 60,
  };

  const [notifications, setNotifications] = useState(settings.notifications || defaultNotifications);
  const [testingNotification, setTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setNotifications(settings.notifications || defaultNotifications);
  }, [settings]);

  const handleSubmit = () => {
    onSave({ notifications });
  };

  const handleTestNotification = async () => {
    try {
      setTestingNotification(true);
      setTestResult(null);
      const result = await apiClient.sendTestNotification();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.detail || 'Ошибка' });
    } finally {
      setTestingNotification(false);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="ios-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="ios-toggle-track"></div>
    </label>
  );

  const notificationItems = [
    { key: 'server_down', label: 'Сервер недоступен', desc: 'Уведомление когда сервер offline' },
    { key: 'server_recovered', label: 'Сервер восстановлен', desc: 'Уведомление когда сервер online' },
    { key: 'suspicious_activity', label: 'Подозрительная активность', desc: 'Аномальное поведение' },
    { key: 'tracking_bots', label: 'Боты в трекинге', desc: 'Обнаружены боты' },
    { key: 'new_payment', label: 'Новые платежи', desc: 'Каждый платеж' },
    { key: 'daily_report', label: 'Ежедневный отчет', desc: 'Сводка за день' },
  ];

  return (
    <ContentSection title="Уведомления" desc="Настройка Telegram уведомлений">
      <div className="space-y-6">
        <div className="space-y-1">
          {notificationItems.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <div className="text-sm text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Toggle
                checked={notifications[item.key as keyof typeof notifications] as boolean}
                onChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Порог ботов">
            <input
              type="number"
              value={notifications.tracking_bots_threshold || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/^0+(?=\d)/, '');
                setNotifications({ ...notifications, tracking_bots_threshold: val === '' ? 5 : parseInt(val, 10) || 5 });
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
          <FormField label="Cooldown (мин)">
            <input
              type="number"
              value={notifications.cooldown_minutes || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/^0+(?=\d)/, '');
                setNotifications({ ...notifications, cooldown_minutes: val === '' ? 60 : parseInt(val, 10) || 60 });
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
        </div>

        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <div className="text-sm font-medium text-foreground mb-2">Тестирование</div>
          <button
            onClick={handleTestNotification}
            disabled={testingNotification}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {testingNotification ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
            Отправить тест
          </button>
          {testResult && (
            <div className={`mt-2 text-xs ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>
    </ContentSection>
  );
}

function AISettings({ settings, onSave, saving }: SettingsTabProps) {
  const [aiEnabled, setAiEnabled] = useState(settings.ai_enabled === 'true' || settings.ai_enabled === true);
  const [aiProviderUrl, setAiProviderUrl] = useState(settings.ai_provider_url || '');
  const [aiApiKey, setAiApiKey] = useState(settings.ai_api_key || '');
  const [aiModel, setAiModel] = useState(settings.ai_model || 'gpt-4o-mini');
  const [aiTemperature, setAiTemperature] = useState(settings.ai_temperature || '0.3');
  const [showAiKey, setShowAiKey] = useState(false);

  useEffect(() => {
    setAiEnabled(settings.ai_enabled === 'true' || settings.ai_enabled === true);
    setAiProviderUrl(settings.ai_provider_url || '');
    setAiApiKey(settings.ai_api_key || '');
    setAiModel(settings.ai_model || 'gpt-4o-mini');
    setAiTemperature(settings.ai_temperature || '0.3');
  }, [settings]);

  const handleSubmit = () => {
    onSave({
      ai_enabled: aiEnabled ? 'true' : 'false',
      ai_provider_url: aiProviderUrl,
      ai_api_key: aiApiKey,
      ai_model: aiModel,
      ai_temperature: aiTemperature,
    });
  };

  return (
    <ContentSection title="ИИ-поддержка" desc="Автоматические ответы на вопросы пользователей через AI">
      <div className="space-y-6">
        <FormField label="Включить ИИ" description="ИИ будет автоматически отвечать на вопросы пользователей в чате поддержки">
          <div className="flex items-center gap-3">
            <label className="ios-toggle">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
              <div className="ios-toggle-track"></div>
            </label>
            <span className="text-sm">{aiEnabled ? 'Включено' : 'Выключено'}</span>
          </div>
        </FormField>

        <FormField label="API URL провайдера" description="OpenAI-совместимый API URL (Timeweb Cloud, OpenAI и т.д.). Оставьте пустым для OpenAI по умолчанию">
          <input
            value={aiProviderUrl}
            onChange={(e) => setAiProviderUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="API ключ" description="Ключ доступа к AI провайдеру">
          <div className="relative">
            <input
              type={showAiKey ? 'text' : 'password'}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowAiKey(!showAiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FormField>

        <FormField label="Модель" description="Название модели LLM">
          <input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <FormField label="Температура" description="Креативность ответов (0.0 = точные, 1.0 = креативные). Рекомендуется 0.3">
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={aiTemperature}
            onChange={(e) => setAiTemperature(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>

        <div className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>
    </ContentSection>
  );
}



function LogsSettings() {
  const [logs, setLogs] = useState<Array<{
    id: number; admin_id: number | null; admin_username: string; action: string;
    entity_type: string; entity_id: string | null; entity_name: string | null;
    details: Record<string, any> | null; ip_address: string | null; created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    actions: Array<{ value: string; label: string }>;
    entity_types: Array<{ value: string; label: string }>;
  }>({ actions: [], entity_types: [] });
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [logSource, setLogSource] = useState<'admin' | 'system'>('admin');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const limit = 20;

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit, offset: page * limit, source: logSource };
      if (selectedAction) params.action = selectedAction;
      if (selectedEntityType) params.entity_type = selectedEntityType;
      const data = await apiClient.getAdminLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      // Error silently handled - logs will not be displayed
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const data = await apiClient.getAdminLogsFilters();
      setFilters(data);
    } catch (err) {
      // Error silently handled - filters will remain empty
    }
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, selectedAction, selectedEntityType, logSource]);

  // Reset page when switching source
  useEffect(() => {
    setPage(0);
    setSelectedAction('');
    setSelectedEntityType('');
  }, [logSource]);

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'text-green-500 bg-green-500/10',
      update: 'text-blue-500 bg-blue-500/10',
      delete: 'text-red-500 bg-red-500/10',
      ban: 'text-red-500 bg-red-500/10',
      unban: 'text-green-500 bg-green-500/10',
      login: 'text-purple-500 bg-purple-500/10',
      logout: 'text-gray-500 bg-gray-500/10',
      extend: 'text-blue-500 bg-blue-500/10',
      activate: 'text-green-500 bg-green-500/10',
      deactivate: 'text-orange-500 bg-orange-500/10',
      error: 'text-red-500 bg-red-500/10',
      warning: 'text-yellow-500 bg-yellow-500/10',
      info: 'text-blue-500 bg-blue-500/10',
    };
    return colors[action] || 'text-gray-500 bg-gray-500/10';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <ContentSection title="Логи" desc="История действий и системные события">
      <div className="space-y-4">
        {/* Source tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            onClick={() => setLogSource('admin')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              logSource === 'admin' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Действия
          </button>
          <button
            onClick={() => setLogSource('system')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              logSource === 'system' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Системные
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <Combobox
              value={selectedAction}
              onChange={setSelectedAction}
              options={[{ value: '', label: 'Все действия' }, ...filters.actions]}
            />
          </div>
          <div className="w-40">
            <Combobox
              value={selectedEntityType}
              onChange={setSelectedEntityType}
              options={[{ value: '', label: 'Все типы' }, ...filters.entity_types]}
            />
          </div>
          {(selectedAction || selectedEntityType) && (
            <button
              onClick={() => { setSelectedAction(''); setSelectedEntityType(''); setPage(0); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !logs?.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {logSource === 'system' ? 'Нет системных событий' : 'Нет данных'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Дата</th>
                      {logSource === 'admin' && (
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">Админ</th>
                      )}
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">
                        {logSource === 'system' ? 'Уровень' : 'Действие'}
                      </th>
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">
                        {logSource === 'system' ? 'Модуль' : 'Объект'}
                      </th>
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">
                        {logSource === 'system' ? 'Сообщение' : 'Описание'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`hover:bg-muted/30 ${logSource === 'system' && log.details ? 'cursor-pointer' : ''}`}
                        onClick={() => logSource === 'system' && log.details && setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-2 text-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                        {logSource === 'admin' && (
                          <td className="px-4 py-2 text-foreground">{log.admin_username || 'System'}</td>
                        )}
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                            {filters.actions.find(a => a.value === log.action)?.label || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          <span className="text-muted-foreground">
                            {filters.entity_types.find(t => t.value === log.entity_type)?.label || log.entity_type}
                          </span>
                          {logSource === 'admin' && log.entity_id && <span className="ml-1">#{log.entity_id}</span>}
                        </td>
                        <td className="px-4 py-2 text-foreground max-w-md">
                          <span className="truncate block" title={log.entity_name || ''}>
                            {log.entity_name || (log.entity_id ? `#${log.entity_id}` : '')}
                          </span>
                          {logSource === 'system' && expandedLog === log.id && log.details && (
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    {page * limit + 1}–{Math.min((page + 1) * limit, total)} из {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-foreground px-2">{page + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {logSource === 'system' && (
          <p className="text-xs text-muted-foreground">
            Системные логи хранятся 2 дня. Нажмите на строку для просмотра деталей.
          </p>
        )}
      </div>
    </ContentSection>
  );
}

// Domain Settings Component
function DomainSettings() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [newDomain, setNewDomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dnsCheck, setDnsCheck] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSubscriptionDomainStatus();
      setStatus(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки статуса домена');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckDNS = async () => {
    if (!newDomain.trim()) {
      toast.error('Введите доменное имя');
      return;
    }

    try {
      setChecking(true);
      setDnsCheck(null);
      const data = await apiClient.checkSubscriptionDomainDNS(newDomain.trim());
      setDnsCheck(data);

      if (data.valid) {
        toast.success('DNS настроен правильно');
      } else {
        toast.error(data.error || 'DNS настроен неправильно');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка проверки DNS');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    if (!newDomain.trim()) {
      toast.error('Введите доменное имя');
      return;
    }

    if (!dnsCheck?.valid) {
      toast.error('Сначала проверьте DNS конфигурацию');
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmApply = async () => {
    try {
      setApplying(true);
      setShowConfirmDialog(false);

      toast.loading('Установка SSL и настройка Nginx...', { id: 'domain-apply' });

      const data = await apiClient.applySubscriptionDomain(newDomain.trim());

      if (data.success) {
        toast.success(data.message, { id: 'domain-apply' });
        setNewDomain('');
        setDnsCheck(null);
        await loadStatus();
      } else {
        toast.error(data.error || data.message, { id: 'domain-apply' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка применения домена', { id: 'domain-apply' });
    } finally {
      setApplying(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить домен подписок? Будет использоваться домен по умолчанию.')) {
      return;
    }

    try {
      const data = await apiClient.removeSubscriptionDomain();
      toast.success(data.message);
      await loadStatus();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка удаления домена');
    }
  };

  if (loading) {
    return (
      <ContentSection title="Домен подписок" desc="Настройка отдельного домена для VPN ключей">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ContentSection>
    );
  }

  return (
    <ContentSection
      title="Домен подписок"
      desc="Настройте отдельный домен для VPN ключей (подписок). Можно использовать поддомен или полностью независимый домен."
    >
      <div className="space-y-6">
        {/* Current Status */}
        {status?.configured && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Текущий домен</h4>
              {status.ready ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  Активен
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <X className="w-3.5 h-3.5" />
                  Требуется настройка
                </span>
              )}
            </div>

            <div className="text-sm text-foreground font-mono bg-muted px-3 py-2 rounded">
              {status.domain}
            </div>

            <div className="text-xs">
              <span className="text-muted-foreground">DNS:</span>{' '}
              <span className={status.dns_valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                {status.dns_valid ? '✓ Настроен' : '✗ Не настроен'}
              </span>
            </div>

            {status.errors && status.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
                {status.errors.map((err: string, i: number) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <button
              onClick={handleRemove}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Удалить домен
            </button>
          </div>
        )}

        {/* Add/Update Domain */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">
            {status?.configured ? 'Изменить домен' : 'Настроить домен'}
          </h4>

          <FormField
            label="Доменное имя"
            description="Укажите поддомен (sub.example.com) или независимый домен (vpnkeys.com)"
          >
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
              placeholder="sub.example.com"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={checking || applying}
            />
          </FormField>

          {/* DNS Check Result */}
          {dnsCheck && (
            <div className={cn(
              "rounded-lg border p-3 text-sm",
              dnsCheck.valid ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            )}>
              <div className="flex items-start gap-2">
                {dnsCheck.valid ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className={dnsCheck.valid ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100"}>
                    {dnsCheck.valid ? 'DNS настроен правильно' : 'DNS требует настройки'}
                  </div>
                  {dnsCheck.server_ip && (
                    <div className="text-xs space-y-0.5 opacity-80">
                      <div>IP сервера: {dnsCheck.server_ip}</div>
                      {dnsCheck.domain_ip && <div>IP домена: {dnsCheck.domain_ip}</div>}
                    </div>
                  )}
                  {dnsCheck.error && (
                    <div className="text-xs opacity-90">{dnsCheck.error}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheckDNS}
              disabled={!newDomain.trim() || checking || applying}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {checking && <Loader2 className="w-4 h-4 animate-spin" />}
              Проверить DNS
            </button>

            <button
              onClick={handleApply}
              disabled={!dnsCheck?.valid || applying || checking}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {applying && <Loader2 className="w-4 h-4 animate-spin" />}
              {status?.configured ? 'Изменить домен' : 'Применить домен'}
            </button>
          </div>

          {/* Instructions */}
          <div className="rounded-lg border bg-muted/50 p-4 text-xs space-y-3">
            <div className="font-medium text-foreground">Инструкция по настройке:</div>
            <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
              <li>Создайте A-запись в DNS вашего домена, указывающую на IP этого сервера</li>
              <li>Дождитесь распространения DNS (обычно 5-15 минут)</li>
              <li>Нажмите "Проверить DNS" для проверки конфигурации</li>
              <li>После успешной проверки нажмите "Применить домен"</li>
              <li>Система автоматически установит SSL сертификат от Let's Encrypt</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmApply}
        title="Применить домен подписок?"
        description={`Система установит SSL сертификат и настроит Nginx для домена ${newDomain}. Это может занять несколько минут.`}
        confirmText="Применить"
        cancelText="Отмена"
      />
    </ContentSection>
  );
}


// ============ DATABASE SETTINGS ============

interface DbStatus {
  online: boolean;
  ping_ms: number | null;
  version: string | null;
  size_bytes: number;
  size_human: string;
  connections: number;
  table_count: number;
  tables: Array<{ name: string; rows: number }>;
  host: string;
  is_external: boolean;
  url_masked: string;
  error?: string;
}

interface MigrationVerification {
  table: string;
  source: number;
  target: number;
  match: boolean;
  error?: string;
}

function DatabaseSettings({ isMiniApp }: { isMiniApp?: boolean }) {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Migration wizard
  const [showMigration, setShowMigration] = useState(false);
  const [migHost, setMigHost] = useState('');
  const [migPort, setMigPort] = useState('5432');
  const [migUser, setMigUser] = useState('');
  const [migPass, setMigPass] = useState('');
  const [migDb, setMigDb] = useState('');
  const [migSsl, setMigSsl] = useState(false);
  const [showMigPass, setShowMigPass] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string; ping_ms?: number; version?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; verification: MigrationVerification[]; message: string } | null>(null);
  const [switching, setSwitching] = useState(false);

  // Confirm dialog
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await apiClient.getDatabaseStatus();
      setStatus(data);
    } catch (err: any) {
      toast.error('Ошибка загрузки статуса БД');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiClient.testDatabaseConnection({
        host: migHost, port: parseInt(migPort), username: migUser,
        password: migPass, database: migDb, ssl: migSsl,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: 'Ошибка запроса' });
    } finally {
      setTesting(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const result = await apiClient.migrateDatabase({
        host: migHost, port: parseInt(migPort), username: migUser,
        password: migPass, database: migDb, ssl: migSsl,
      });
      setMigrationResult(result);
      if (result.success) {
        toast.success('Миграция завершена успешно');
      } else {
        toast.error('Миграция завершена с ошибками');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка миграции');
    } finally {
      setMigrating(false);
    }
  };

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      await apiClient.switchDatabase({
        host: migHost, port: parseInt(migPort), username: migUser,
        password: migPass, database: migDb, ssl: migSsl,
      });
      toast.success('Приложение перезапускается с новой БД...');
      // App will restart, page will reload
      setTimeout(() => window.location.reload(), 5000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка переключения');
    } finally {
      setSwitching(false);
    }
  };

  const handleExport = async (type: string) => {
    try {
      const blob = await apiClient.exportDatabaseData(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Экспорт ${type} скачан`);
    } catch (err: any) {
      toast.error('Ошибка экспорта');
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Status Section */}
      <ContentSection title="Статус подключения" desc="Текущее состояние базы данных" isMiniApp={isMiniApp}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status?.online ? (
                <div className="flex items-center gap-1.5 text-green-600">
                  <CircleCheck className="w-4 h-4" />
                  <span className="text-sm font-medium">Онлайн</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-500">
                  <CircleX className="w-4 h-4" />
                  <span className="text-sm font-medium">Оффлайн</span>
                </div>
              )}
              {status?.is_external && (
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">Внешняя</span>
              )}
            </div>
            <button onClick={handleRefresh} className="text-muted-foreground hover:text-foreground transition-colors" disabled={refreshing}>
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          </div>

          {status?.online && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Хост</div>
                <div className="text-sm font-medium font-mono truncate mt-0.5">{status.host}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Пинг</div>
                <div className="text-sm font-medium mt-0.5">{status.ping_ms} мс</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Размер</div>
                <div className="text-sm font-medium mt-0.5">{status.size_human}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Соединения</div>
                <div className="text-sm font-medium mt-0.5">{status.connections}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Версия</div>
                <div className="text-sm font-medium truncate mt-0.5">{status.version}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Таблицы</div>
                <div className="text-sm font-medium mt-0.5">{status.table_count}</div>
              </div>
            </div>
          )}

          {status?.error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{status.error}</div>
          )}

          {/* Tables list */}
          {status?.tables && status.tables.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground flex justify-between">
                <span>Таблица</span>
                <span>Записей</span>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {status.tables.map(t => (
                  <div key={t.name} className="px-3 py-1.5 text-sm flex justify-between hover:bg-muted/30">
                    <span className="font-mono text-xs">{t.name}</span>
                    <span className="text-muted-foreground text-xs">{t.rows >= 0 ? t.rows.toLocaleString() : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ContentSection>

      {/* Migration Section */}
      <ContentSection title="Миграция базы данных" desc="Перенос данных на внешний сервер PostgreSQL" isMiniApp={isMiniApp}>
        <div className="space-y-4">
          {!showMigration ? (
            <button
              onClick={() => setShowMigration(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Сменить базу данных
            </button>
          ) : (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Подключение к новой БД</h4>
                <button onClick={() => { setShowMigration(false); setTestResult(null); setMigrationResult(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Хост">
                  <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="db.timeweb.cloud" value={migHost} onChange={e => setMigHost(e.target.value)} />
                </FormField>
                <FormField label="Порт">
                  <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="5432" value={migPort} onChange={e => setMigPort(e.target.value)} />
                </FormField>
                <FormField label="Пользователь">
                  <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="vpn" value={migUser} onChange={e => setMigUser(e.target.value)} />
                </FormField>
                <FormField label="Пароль">
                  <div className="relative">
                    <input className="w-full rounded-md border bg-background px-3 py-2 text-sm pr-9" type={showMigPass ? 'text' : 'password'} value={migPass} onChange={e => setMigPass(e.target.value)} />
                    <button onClick={() => setShowMigPass(!showMigPass)} className="absolute right-2.5 top-2.5 text-muted-foreground">
                      {showMigPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>
                <FormField label="База данных">
                  <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="vpn_db" value={migDb} onChange={e => setMigDb(e.target.value)} />
                </FormField>
                <FormField label="SSL">
                  <label className="flex items-center gap-2 py-2">
                    <input type="checkbox" checked={migSsl} onChange={e => setMigSsl(e.target.checked)} className="rounded" />
                    <span className="text-sm">Требовать SSL</span>
                  </label>
                </FormField>
              </div>

              {/* Step 1: Test Connection */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !migHost || !migUser || !migPass || !migDb}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  Проверить подключение
                </button>
              </div>

              {testResult && (
                <div className={cn("p-3 rounded-lg text-sm", testResult.success ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400")}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CircleCheck className="w-4 h-4" /> : <CircleX className="w-4 h-4" />}
                    {testResult.message}
                  </div>
                  {testResult.success && testResult.ping_ms && (
                    <div className="text-xs mt-1 opacity-75">Пинг: {testResult.ping_ms} мс | {testResult.version}</div>
                  )}
                </div>
              )}

              {/* Step 2: Migrate */}
              {testResult?.success && !migrationResult && (
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {migrating ? 'Миграция...' : 'Начать миграцию'}
                </button>
              )}

              {migrating && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Идёт миграция данных. Не закрывайте страницу...
                  </div>
                </div>
              )}

              {/* Step 3: Verification */}
              {migrationResult && (
                <div className="space-y-3">
                  <div className={cn("p-3 rounded-lg text-sm", migrationResult.success ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400")}>
                    <div className="flex items-center gap-2">
                      {migrationResult.success ? <CircleCheck className="w-4 h-4" /> : <CircleX className="w-4 h-4" />}
                      {migrationResult.message}
                    </div>
                  </div>

                  {/* Verification table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-4">
                      <span>Таблица</span>
                      <span className="text-right">Источник</span>
                      <span className="text-right">Целевая</span>
                      <span className="text-right">Статус</span>
                    </div>
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {migrationResult.verification?.map(v => (
                        <div key={v.table} className="px-3 py-1.5 text-xs grid grid-cols-4">
                          <span className="font-mono">{v.table}</span>
                          <span className="text-right text-muted-foreground">{v.source}</span>
                          <span className="text-right text-muted-foreground">{v.target}</span>
                          <span className="text-right">{v.match ? <CircleCheck className="w-3.5 h-3.5 text-green-500 inline" /> : <CircleX className="w-3.5 h-3.5 text-red-500 inline" />}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Switch */}
                  {migrationResult.success && (
                    <button
                      onClick={() => setShowSwitchConfirm(true)}
                      disabled={switching}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Переключиться на новую БД
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ContentSection>

      {/* Export Section */}
      <ContentSection title="Экспорт данных" desc="Скачать данные в формате CSV" isMiniApp={isMiniApp}>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExport('users')} className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm">
            <Download className="w-4 h-4" />
            Пользователи
          </button>
          <button onClick={() => handleExport('payments')} className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm">
            <Download className="w-4 h-4" />
            Платежи
          </button>
          <button onClick={() => handleExport('keys')} className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm">
            <Download className="w-4 h-4" />
            Ключи
          </button>
        </div>
      </ContentSection>

      {/* Switch Confirmation Dialog */}
      <ConfirmDialog
        open={showSwitchConfirm}
        onOpenChange={setShowSwitchConfirm}
        onConfirm={handleSwitch}
        title="Переключить базу данных?"
        description="Приложение сохранит новый адрес БД и перезапустится. Это займёт несколько секунд. Убедитесь, что миграция данных прошла успешно."
        confirmText="Переключить и перезапустить"
        cancelText="Отмена"
      />
    </div>
  );
}

// ==================== THEME SETTINGS ====================

const TEMPLATE_LIST = [
  {
    id: 'default',
    name: 'Default',
    desc: 'Glass-morphism, Lottie-стикер',
    colors: { primary: '#3b82f6', success: '#10b981', danger: '#ef4444' },
    bgPreview: 'linear-gradient(180deg, #0f0f0f 0%, #000000 100%)',
    bgLight: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
  },
  {
    id: 'neon',
    name: 'Neon',
    desc: 'Неоновое свечение, щит VPN',
    colors: { primary: '#8b5cf6', success: '#06d6a0', danger: '#ff006e' },
    bgPreview: 'linear-gradient(135deg, #0a0e1a 0%, #12062e 50%, #0a0e1a 100%)',
    bgLight: 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 50%, #f5f3ff 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    desc: 'Тёплый закат, солнце',
    colors: { primary: '#f97316', success: '#84cc16', danger: '#ef4444' },
    bgPreview: 'linear-gradient(160deg, #1a0a00 0%, #2d1810 30%, #1a0505 60%, #0d0d0d 100%)',
    bgLight: 'linear-gradient(160deg, #fff7ed 0%, #ffedd5 30%, #fef2f2 60%, #fafafa 100%)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    desc: 'Глубокий океан, капля',
    colors: { primary: '#0ea5e9', success: '#2dd4bf', danger: '#f43f5e' },
    bgPreview: 'linear-gradient(180deg, #0a1628 0%, #0c1e3a 40%, #0a1a2e 100%)',
    bgLight: 'linear-gradient(180deg, #ecfeff 0%, #e0f2fe 40%, #f0f9ff 100%)',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    desc: 'Матрица, терминал',
    colors: { primary: '#22c55e', success: '#22c55e', danger: '#ef4444' },
    bgPreview: 'linear-gradient(180deg, #020d02 0%, #041a04 40%, #010a01 100%)',
    bgLight: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 40%, #f0fdf4 100%)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Чистый минимализм',
    colors: { primary: '#6b7280', success: '#10b981', danger: '#ef4444' },
    bgPreview: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
    bgLight: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    desc: 'Северное сияние, волны',
    colors: { primary: '#06b6d4', success: '#34d399', danger: '#f472b6' },
    bgPreview: 'linear-gradient(160deg, #0a0a1a 0%, #0d1a2d 30%, #0a1a1a 60%, #0d0d1a 100%)',
    bgLight: 'linear-gradient(160deg, #ecfeff 0%, #f0fdfa 30%, #ecfeff 60%, #f5f3ff 100%)',
  },
];

const COLOR_PRESETS = [
  { name: 'Blue', primary: '#3b82f6' },
  { name: 'Purple', primary: '#8b5cf6' },
  { name: 'Green', primary: '#10b981' },
  { name: 'Orange', primary: '#f97316' },
  { name: 'Red', primary: '#ef4444' },
  { name: 'Pink', primary: '#ec4899' },
  { name: 'Cyan', primary: '#06b6d4' },
  { name: 'Indigo', primary: '#6366f1' },
];

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '59, 130, 246';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function darkenHex(hex: string, amount = 0.15): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '#2563eb';
  const r = Math.max(0, Math.round(parseInt(result[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(result[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(result[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Render template-specific icon/visual at given size
function renderTemplateIcon(templateId: string, colors: { primary: string; success?: string; danger?: string }, size: number) {
  const s = size;
  switch (templateId) {
    case 'neon':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <path d="M80 16L32 40V76C32 108 52 136 80 148C108 136 128 108 128 76V40L80 16Z" fill={colors.primary} fillOpacity="0.8" stroke={colors.primary} strokeWidth="2" strokeOpacity="0.5" />
          <rect x="64" y="72" width="32" height="26" rx="4" fill="rgba(255,255,255,0.9)" />
          <path d="M68 72V64C68 57.4 73.4 52 80 52C86.6 52 92 57.4 92 64V72" stroke="rgba(255,255,255,0.9)" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'sunset':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="32" fill={colors.primary} fillOpacity="0.85" />
          <circle cx="80" cy="80" r="28" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 80 + Math.cos(rad) * 42;
            const y1 = 80 + Math.sin(rad) * 42;
            const x2 = 80 + Math.cos(rad) * 56;
            const y2 = 80 + Math.sin(rad) * 56;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.primary} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.7" />;
          })}
        </svg>
      );
    case 'ocean':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <path d="M80 20C80 20 60 50 60 90C60 112 68 130 80 140C92 130 100 112 100 90C100 50 80 20 80 20Z" fill={colors.primary} fillOpacity="0.8" />
          <path d="M80 28C80 28 66 54 66 88C66 106 72 122 80 130C88 122 94 106 94 88C94 54 80 28 80 28Z" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <path d="M66 85C72 80 76 84 80 80C84 76 88 82 94 78" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M68 96C73 92 76 95 80 92C84 89 87 93 92 90" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'cyber':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <text x="30" y="95" fontFamily="monospace" fontSize="48" fontWeight="bold" fill={colors.primary} fillOpacity="0.9">&lt;/&gt;</text>
          <rect x="72" y="108" width="16" height="3" rx="1" fill={colors.primary} fillOpacity="0.8" />
        </svg>
      );
    case 'minimal':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="40" stroke={colors.primary} strokeWidth="1.5" strokeOpacity="0.5" fill="none" />
          <circle cx="80" cy="80" r="26" stroke={colors.primary} strokeWidth="1" strokeOpacity="0.3" fill="none" />
          <circle cx="80" cy="80" r="12" fill={colors.primary} fillOpacity="0.15" />
          <circle cx="80" cy="80" r="4" fill={colors.primary} fillOpacity="0.5" />
        </svg>
      );
    case 'aurora':
      return (
        <svg width={s} height={s} viewBox="0 0 160 160" fill="none">
          <path d="M20 100C40 70 60 90 80 60C100 30 120 70 140 50" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" fill="none" />
          <path d="M20 110C40 85 60 100 80 75C100 50 120 80 140 65" stroke={colors.success || colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.6" fill="none" />
          <path d="M20 120C40 100 60 110 80 90C100 70 120 95 140 80" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" fill="none" />
        </svg>
      );
    default:
      return (
        <div style={{
          width: `${s * 0.7}px`, height: `${s * 0.7}px`, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={s * 0.4} height={s * 0.4} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
            <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5-3 6.5V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 14 5 12 5 9a7 7 0 0 1 7-7z" />
          </svg>
        </div>
      );
  }
}

// Render large hero visual for phone preview
function renderPreviewHero(templateId: string, primary: string, primaryDark: string, primaryRgb: string, success: string, previewDark: boolean, isNeon: boolean) {
  const pFgMuted = previewDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
  switch (templateId) {
    case 'neon':
      return (
        <svg width="78" height="78" viewBox="0 0 160 160" fill="none">
          <defs>
            <linearGradient id="prev-shield" x1="40" y1="20" x2="120" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={primary} stopOpacity="0.9" />
              <stop offset="100%" stopColor={primaryDark} stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d="M80 16L32 40V76C32 108 52 136 80 148C108 136 128 108 128 76V40L80 16Z" fill="url(#prev-shield)" stroke={primary} strokeWidth="1.5" strokeOpacity="0.6" />
          <path d="M80 28L42 48V76C42 103 58 128 80 138C102 128 118 103 118 76V48L80 28Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <rect x="64" y="72" width="32" height="26" rx="4" fill="rgba(255,255,255,0.95)" />
          <path d="M68 72V64C68 57.4 73.4 52 80 52C86.6 52 92 57.4 92 64V72" stroke="rgba(255,255,255,0.95)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="80" cy="82" r="4" fill={primaryDark} />
          <rect x="78.5" y="84" width="3" height="6" rx="1.5" fill={primaryDark} />
        </svg>
      );
    case 'sunset':
      return (
        <svg width="90" height="90" viewBox="0 0 160 160" fill="none">
          <defs>
            <radialGradient id="prev-sun-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={primary} stopOpacity="0.3" />
              <stop offset="100%" stopColor={primary} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="prev-sun" x1="50" y1="40" x2="110" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={primary} />
              <stop offset="100%" stopColor={primaryDark} />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="70" fill="url(#prev-sun-glow)" />
          <circle cx="80" cy="80" r="36" fill="url(#prev-sun)" />
          <circle cx="80" cy="80" r="32" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 80 + Math.cos(rad) * 46;
            const y1 = 80 + Math.sin(rad) * 46;
            const x2 = 80 + Math.cos(rad) * 62;
            const y2 = 80 + Math.sin(rad) * 62;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={primary} strokeWidth="3.5" strokeLinecap="round" strokeOpacity={0.6 + (i % 2) * 0.2} />;
          })}
        </svg>
      );
    case 'ocean':
      return (
        <svg width="85" height="85" viewBox="0 0 160 160" fill="none">
          <defs>
            <linearGradient id="prev-drop" x1="70" y1="20" x2="90" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={primary} stopOpacity="0.5" />
              <stop offset="100%" stopColor={primaryDark} stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d="M80 18C80 18 52 56 52 94C52 110 62 130 80 142C98 130 108 110 108 94C108 56 80 18 80 18Z" fill="url(#prev-drop)" />
          <path d="M80 30C80 30 58 62 58 92C58 106 66 124 80 134C94 124 102 106 102 92C102 62 80 30 80 30Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <path d="M58 88C66 82 72 87 80 82C88 77 94 84 102 80" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M60 100C67 95 72 99 80 95C88 91 93 96 100 93" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M64 111C69 108 74 110 80 108C86 106 91 109 96 107" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'cyber':
      return (
        <svg width="90" height="90" viewBox="0 0 160 160" fill="none">
          <text x="18" y="100" fontFamily="monospace" fontSize="52" fontWeight="bold" fill={primary} fillOpacity="0.85">&lt;/&gt;</text>
          <rect x="64" y="115" width="32" height="4" rx="2" fill={primary} fillOpacity="0.7">
            <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" />
          </rect>
          <text x="30" y="50" fontFamily="monospace" fontSize="11" fill={primary} fillOpacity="0.2">01101001</text>
          <text x="85" y="42" fontFamily="monospace" fontSize="9" fill={primary} fillOpacity="0.15">SECURE</text>
          <text x="40" y="140" fontFamily="monospace" fontSize="10" fill={primary} fillOpacity="0.15">VPN.CONNECT</text>
        </svg>
      );
    case 'minimal':
      return (
        <svg width="85" height="85" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="55" stroke={primary} strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
          <circle cx="80" cy="80" r="38" stroke={primary} strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <circle cx="80" cy="80" r="20" stroke={primary} strokeWidth="0.8" strokeOpacity="0.15" fill="none" />
          <circle cx="80" cy="80" r="6" fill={primary} fillOpacity="0.3" />
          <line x1="80" y1="25" x2="80" y2="135" stroke={primary} strokeWidth="0.5" strokeOpacity="0.1" />
          <line x1="25" y1="80" x2="135" y2="80" stroke={primary} strokeWidth="0.5" strokeOpacity="0.1" />
        </svg>
      );
    case 'aurora':
      return (
        <svg width="90" height="90" viewBox="0 0 160 160" fill="none">
          <defs>
            <linearGradient id="prev-aurora1" x1="0" y1="0" x2="160" y2="0">
              <stop offset="0%" stopColor={primary} stopOpacity="0.8" />
              <stop offset="50%" stopColor={success} stopOpacity="0.6" />
              <stop offset="100%" stopColor={primary} stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="prev-aurora2" x1="0" y1="0" x2="160" y2="0">
              <stop offset="0%" stopColor={success} stopOpacity="0.6" />
              <stop offset="50%" stopColor={primary} stopOpacity="0.4" />
              <stop offset="100%" stopColor={success} stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path d="M10 90C30 55 55 75 80 45C105 15 130 55 150 35" stroke="url(#prev-aurora1)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M10 105C30 75 55 90 80 65C105 40 130 70 150 55" stroke="url(#prev-aurora2)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M10 118C30 95 55 105 80 85C105 65 130 88 150 75" stroke="url(#prev-aurora1)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M10 130C30 112 55 118 80 104C105 90 130 105 150 95" stroke="url(#prev-aurora2)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.35" />
        </svg>
      );
    default:
      return (
        <div style={{
          width: '70px', height: '70px', borderRadius: '50%',
          background: previewDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={pFgMuted} strokeWidth="1.5">
            <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5-3 6.5V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 14 5 12 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 22h6" />
          </svg>
        </div>
      );
  }
}

// Утилита для отключения scale анимации на корневом слое — идентична мини-аппу
function fixRootScaleAnimation(animationData: any): any {
  if (!animationData?.layers) return animationData;
  const data = JSON.parse(JSON.stringify(animationData));
  const expand = 0.5;
  const w = data.w || 512;
  const h = data.h || 512;
  data.w = Math.round(w * (1 + expand * 2));
  data.h = Math.round(h * (1 + expand * 2));
  const offsetX = Math.round(w * expand);
  const offsetY = Math.round(h * expand);
  const scaleCompensation = (1 + expand * 2) * 100;
  data.layers.forEach((layer: any, index: number) => {
    if (layer.parent === undefined && layer.ks?.p) {
      if (layer.ks.p.a === 0 && Array.isArray(layer.ks.p.k)) {
        layer.ks.p.k[0] += offsetX;
        layer.ks.p.k[1] += offsetY;
      } else if (layer.ks.p.a === 1 && Array.isArray(layer.ks.p.k)) {
        layer.ks.p.k.forEach((kf: any) => {
          if (kf.s) { kf.s[0] += offsetX; kf.s[1] += offsetY; }
          if (kf.e) { kf.e[0] += offsetX; kf.e[1] += offsetY; }
        });
      }
    }
    if (layer.ks?.s?.a === 1 && (index === 0 || layer.parent === undefined)) {
      const keyframes = layer.ks.s.k;
      if (Array.isArray(keyframes)) {
        const values: number[] = [];
        keyframes.forEach((kf: any) => { if (kf.s) values.push(kf.s[0], kf.s[1]); });
        const range = Math.max(...values) - Math.min(...values);
        if (range > 20) {
          layer.ks.s = { a: 0, k: [scaleCompensation, scaleCompensation, 100] };
        }
      }
    }
  });
  return data;
}

// Lottie preview for uploaded JSON stickers (converted from TGS)
const LottiePreview = memo(function LottiePreview({ url, className, style, scaleFix }: { url: string; className?: string; style?: React.CSSProperties; scaleFix?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    setData(null);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => {
        if (!d?.layers && !d?.assets) throw new Error('Not a Lottie JSON');
        setData(scaleFix ? fixRootScaleAnimation(d) : d);
      })
      .catch(() => { setData(null); setError(true); });
  }, [url, scaleFix]);
  if (error) return <div className={cn("flex items-center justify-center", className)} style={style}><Sparkles className="w-8 h-8 text-muted-foreground opacity-30" /></div>;
  if (!data) return <div className={className} style={style} />;
  return (
    <LottieErrorBoundary fallback={<div className={cn("flex items-center justify-center", className)} style={style}><Sparkles className="w-8 h-8 text-muted-foreground opacity-30" /></div>}>
      <div style={{ width: '100%', height: '100%', overflow: 'visible', ...style }}>
        <Lottie
          animationData={data}
          loop
          autoplay
          renderer="svg"
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet', viewBoxOnly: false }}
          className={className}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        />
      </div>
    </LottieErrorBoundary>
  );
});

// Background presets — each is a self-contained gradient with matching header color
const BG_PRESETS = [
  { id: 'default', name: 'Classic Dark', dark: 'linear-gradient(180deg, #0f0f0f 0%, #000000 100%)', light: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)', headerDark: '#0f0f0f', headerLight: '#f8f9fa' },
  { id: 'neon', name: 'Neon Night', dark: 'linear-gradient(135deg, #0a0e1a 0%, #12062e 50%, #0a0e1a 100%)', light: 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 50%, #f5f3ff 100%)', headerDark: '#0a0e1a', headerLight: '#f5f3ff' },
  { id: 'sunset', name: 'Warm Sunset', dark: 'linear-gradient(160deg, #1a0a00 0%, #2d1810 30%, #1a0505 60%, #0d0d0d 100%)', light: 'linear-gradient(160deg, #fff7ed 0%, #ffedd5 30%, #fef2f2 60%, #fafafa 100%)', headerDark: '#1a0a00', headerLight: '#fff7ed' },
  { id: 'ocean', name: 'Deep Ocean', dark: 'linear-gradient(180deg, #0a1628 0%, #0c1e3a 40%, #0a1a2e 100%)', light: 'linear-gradient(180deg, #ecfeff 0%, #e0f2fe 40%, #f0f9ff 100%)', headerDark: '#0a1628', headerLight: '#ecfeff' },
  { id: 'cyber', name: 'Cyber Matrix', dark: 'linear-gradient(180deg, #020d02 0%, #041a04 40%, #010a01 100%)', light: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 40%, #f0fdf4 100%)', headerDark: '#020d02', headerLight: '#f0fdf4' },
  { id: 'minimal', name: 'Minimal', dark: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)', light: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)', headerDark: '#111111', headerLight: '#ffffff' },
  { id: 'aurora', name: 'Aurora', dark: 'linear-gradient(160deg, #0a0a1a 0%, #0d1a2d 30%, #0a1a1a 60%, #0d0d1a 100%)', light: 'linear-gradient(160deg, #ecfeff 0%, #f0fdfa 30%, #ecfeff 60%, #f5f3ff 100%)', headerDark: '#0a0a1a', headerLight: '#ecfeff' },
  // VPN-themed pattern backgrounds
  { id: 'matrix-grid', name: 'Матрица', dark: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 32px), #0a0a0a', light: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 32px), #f8f8f8', headerDark: '#0a0a0a', headerLight: '#f8f8f8' },
  { id: 'circuit', name: 'Схема', dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='rgba(255,255,255,0.08)'/%3E%3Cpath d='M20 0v8M20 32v8M0 20h8M32 20h8' stroke='rgba(255,255,255,0.05)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E") 0 0 / 40px 40px, #0b0b0f`, light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='rgba(0,0,0,0.07)'/%3E%3Cpath d='M20 0v8M20 32v8M0 20h8M32 20h8' stroke='rgba(0,0,0,0.05)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E") 0 0 / 40px 40px, #f6f6fa`, headerDark: '#0b0b0f', headerLight: '#f6f6fa' },
  { id: 'hexagon', name: 'Гексагон', dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='rgba(255,255,255,0.04)' fill-rule='evenodd'/%3E%3C/svg%3E") 0 0 / 28px 49px, #08080e`, light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='rgba(0,0,0,0.05)' fill-rule='evenodd'/%3E%3C/svg%3E") 0 0 / 28px 49px, #f4f4f8`, headerDark: '#08080e', headerLight: '#f4f4f8' },
  { id: 'diamonds', name: 'Ромбы', dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 0L24 12L12 24L0 12Z' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='0.6'/%3E%3C/svg%3E") 0 0 / 24px 24px, #0a0a10`, light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 0L24 12L12 24L0 12Z' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='0.6'/%3E%3C/svg%3E") 0 0 / 24px 24px, #f5f5f9`, headerDark: '#0a0a10', headerLight: '#f5f5f9' },
  { id: 'radar', name: 'Радар', dark: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 18px, rgba(255,255,255,0.03) 18px, rgba(255,255,255,0.03) 19px), #0a0a0e', light: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 18px, rgba(0,0,0,0.03) 18px, rgba(0,0,0,0.03) 19px), #f6f6fa', headerDark: '#0a0a0e', headerLight: '#f6f6fa' },
  // Rich gradient backgrounds
  { id: 'midnight-galaxy', name: 'Космос', dark: 'linear-gradient(150deg, #0a0015 0%, #120a2e 25%, #0d1b3e 50%, #1a0a30 75%, #050510 100%)', light: 'linear-gradient(150deg, #f0ecff 0%, #e8e0f8 25%, #dfeaf8 50%, #f0e0f5 75%, #f5f3ff 100%)', headerDark: '#0a0015', headerLight: '#f0ecff' },
  { id: 'deep-ember', name: 'Угли', dark: 'linear-gradient(160deg, #0d0000 0%, #1a0808 25%, #200a05 50%, #150505 75%, #0a0000 100%)', light: 'linear-gradient(160deg, #fef5f0 0%, #fde8e0 25%, #fce4d8 50%, #fde8e0 75%, #fef5f0 100%)', headerDark: '#0d0000', headerLight: '#fef5f0' },
  { id: 'emerald-abyss', name: 'Изумруд', dark: 'linear-gradient(170deg, #000d0a 0%, #021a12 30%, #0a2818 55%, #031a10 80%, #000a08 100%)', light: 'linear-gradient(170deg, #ecfdf5 0%, #d1fae5 30%, #a7f3d0 55%, #d1fae5 80%, #ecfdf5 100%)', headerDark: '#000d0a', headerLight: '#ecfdf5' },
  { id: 'royal-blue', name: 'Сапфир', dark: 'linear-gradient(165deg, #000510 0%, #041030 30%, #081845 55%, #041030 80%, #000510 100%)', light: 'linear-gradient(165deg, #eff6ff 0%, #dbeafe 30%, #bfdbfe 55%, #dbeafe 80%, #eff6ff 100%)', headerDark: '#000510', headerLight: '#eff6ff' },
  { id: 'obsidian', name: 'Обсидиан', dark: 'linear-gradient(180deg, #0e0e12 0%, #16161e 30%, #1c1c28 50%, #16161e 70%, #0e0e12 100%)', light: 'linear-gradient(180deg, #f4f4f6 0%, #e8e8ee 30%, #dcdce6 50%, #e8e8ee 70%, #f4f4f6 100%)', headerDark: '#0e0e12', headerLight: '#f4f4f6' },
  { id: 'northern-lights', name: 'Сияние', dark: 'linear-gradient(140deg, #020210 0%, #0a1025 20%, #051a20 40%, #0d0a25 60%, #08051a 80%, #020210 100%)', light: 'linear-gradient(140deg, #f0f5ff 0%, #e0f0f5 20%, #e5f8f5 40%, #e8e0f8 60%, #f0eaff 80%, #f0f5ff 100%)', headerDark: '#020210', headerLight: '#f0f5ff' },
  // Solid rich colors
  { id: 'solid-black', name: 'Чёрный', dark: '#000000', light: '#f5f5f5', headerDark: '#000000', headerLight: '#f5f5f5' },
  { id: 'solid-graphite', name: 'Графит', dark: '#121218', light: '#eeeef2', headerDark: '#121218', headerLight: '#eeeef2' },
  { id: 'solid-navy', name: 'Тёмно-синий', dark: '#0a1128', light: '#e8edf5', headerDark: '#0a1128', headerLight: '#e8edf5' },
  { id: 'solid-wine', name: 'Бордо', dark: '#1a0a10', light: '#f5e8ee', headerDark: '#1a0a10', headerLight: '#f5e8ee' },
  { id: 'solid-forest', name: 'Хвоя', dark: '#0a1510', light: '#e8f2ed', headerDark: '#0a1510', headerLight: '#e8f2ed' },
  { id: 'solid-charcoal', name: 'Антрацит', dark: '#18181b', light: '#e4e4e7', headerDark: '#18181b', headerLight: '#e4e4e7' },
  { id: 'solid-plum', name: 'Слива', dark: '#140a1a', light: '#f0e8f5', headerDark: '#140a1a', headerLight: '#f0e8f5' },
  { id: 'solid-steel', name: 'Сталь', dark: '#0f1218', light: '#e8eaee', headerDark: '#0f1218', headerLight: '#e8eaee' },
  { id: 'solid-obsidian', name: 'Обсидиан', dark: '#0b0b0f', light: '#ebebef', headerDark: '#0b0b0f', headerLight: '#ebebef' },
  { id: 'solid-espresso', name: 'Эспрессо', dark: '#1a120d', light: '#f2ece8', headerDark: '#1a120d', headerLight: '#f2ece8' },
  { id: 'solid-midnight', name: 'Полночь', dark: '#070b1a', light: '#e6e8f2', headerDark: '#070b1a', headerLight: '#e6e8f2' },
  { id: 'solid-emerald', name: 'Малахит', dark: '#071210', light: '#e6f0ee', headerDark: '#071210', headerLight: '#e6f0ee' },
  { id: 'solid-ash', name: 'Пепел', dark: '#1c1c1c', light: '#e8e8e8', headerDark: '#1c1c1c', headerLight: '#e8e8e8' },
  { id: 'solid-ink', name: 'Чернила', dark: '#0d0a18', light: '#eae8f2', headerDark: '#0d0a18', headerLight: '#eae8f2' },
  { id: 'solid-bronze', name: 'Бронза', dark: '#181008', light: '#f2ece4', headerDark: '#181008', headerLight: '#f2ece4' },
  { id: 'solid-onyx', name: 'Оникс', dark: '#101014', light: '#ededf0', headerDark: '#101014', headerLight: '#ededf0' },
];

// Logo presets — grid of visual options
const LOGO_PRESETS: { id: string; name: string }[] = [
  { id: 'lottie_default', name: 'По умолчанию' },
  { id: 'custom_sticker', name: 'Своё' },
  { id: 'none', name: 'Без лого' },
];

// ==================== PHONE PREVIEW ====================
interface PreviewIframeProps {
  isDark: boolean;
  templateId: string;
  primary: string;
  primaryDark: string;
  primaryRgb: string;
  heroType: string;
  heroStickerUrl: string;
  stickerPaymentUrl: string;
  stickerSetupUrl: string;
  bgDark: string;
  bgLight: string;
  headerDark: string;
  headerLight: string;
  botName?: string;
}

const PREVIEW_PAGES = [
  { id: 'home', label: 'Главная' },
  { id: 'payment-success', label: 'Оплата' },
  { id: 'setup', label: 'Настройка' },
] as const;

// Стикер (Lottie JSON или картинка) для превью
const PreviewSticker = memo(function PreviewSticker({ url, size, scaleFix }: { url: string; size: string; scaleFix?: boolean }) {
  if (!url) return null;
  return (
    <LottieErrorBoundary>
      <div style={{ width: size, height: size, overflow: 'visible' }}>
        {url.endsWith('.json') ? (
          <LottiePreview url={url} style={{ width: '100%', height: '100%' }} scaleFix={scaleFix} />
        ) : (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>
    </LottieErrorBoundary>
  );
});

const PreviewIframe = memo(function PreviewIframe(props: PreviewIframeProps) {
  const [activePage, setActivePage] = useState('home');
  const isDark = props.isDark;
  const fg = isDark ? '#fff' : '#000';
  const fgMuted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const fgMuted6 = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  const fgMuted7 = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.7)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)';
  const btnSecBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)';
  const btnSecBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const success = '#10b981';

  const getStickerUrl = (page: string) => {
    if (page === 'payment-success') return props.stickerPaymentUrl || (props.heroType === 'custom_sticker' ? props.heroStickerUrl : '');
    if (page === 'setup') return props.stickerSetupUrl || (props.heroType === 'custom_sticker' ? props.heroStickerUrl : '');
    return props.heroType === 'custom_sticker' ? props.heroStickerUrl : '';
  };

  // Градиент кнопки
  const btnGradient = `linear-gradient(135deg, ${props.primary} 0%, ${props.primaryDark} 100%)`;
  const btnShadow = `0 4px 20px rgba(${props.primaryRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`;

  // Стикер-область для hero
  const renderHeroSticker = () => {
    const stickerUrl = getStickerUrl('home');
    const isCustom = !!stickerUrl;
    return (
      <div style={{ position: 'relative', width: '220px', height: '220px' }}>
        {/* Glow */}
        {!isCustom && (
          <div style={{
            position: 'absolute', inset: '20px',
            background: isDark
              ? `radial-gradient(circle, rgba(${props.primaryRgb}, 0.15) 0%, transparent 70%)`
              : `radial-gradient(circle, rgba(${props.primaryRgb}, 0.1) 0%, transparent 70%)`,
            borderRadius: '50%', filter: 'blur(30px)',
          }} />
        )}
        {/* Glass container */}
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          ...(isCustom ? {} : {
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
            borderRadius: '50%',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)'}`,
            boxShadow: isDark
              ? `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(${props.primaryRgb}, 0.1)`
              : `0 20px 40px rgba(0, 0, 0, 0.08), 0 0 80px rgba(${props.primaryRgb}, 0.05)`,
            padding: '20px',
          }),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isCustom ? (
            <PreviewSticker url={stickerUrl} size="220px" />
          ) : props.heroType === 'none' ? null : (
            renderPreviewHero(props.templateId, props.primary, props.primaryDark, props.primaryRgb, success, isDark, props.templateId === 'neon')
          )}
        </div>
      </div>
    );
  };

  // ===================== HOME PAGE =====================
  const renderHomePage = () => (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Hero sticker */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0 20px 0', flexShrink: 0 }}>
        {renderHeroSticker()}
      </div>

      {/* Bottom card */}
      <div style={{ padding: '0 16px 24px 16px', marginTop: 'auto' }}>
        <div style={{
          padding: '24px', borderRadius: '24px',
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: isDark
            ? '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 20px 60px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: fg, margin: 0, letterSpacing: '-0.5px' }}>{props.botName || 'VPN'}</h2>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: success, boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' }} />
              </div>
              <p style={{ fontSize: '14px', color: fgMuted, margin: 0, fontWeight: '500' }}>online</p>
            </div>
            <div style={{
              textAlign: 'right', padding: '8px 12px', borderRadius: '12px',
              background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}>
              <p style={{ fontSize: '12px', color: fgMuted6, margin: '0 0 4px 0', fontWeight: '500' }}>
                до <strong style={{ fontWeight: '700' }}>14.04.2026</strong>
              </p>
              <p style={{ fontSize: '13px', color: success, margin: 0, fontWeight: '700', letterSpacing: '-0.2px' }}>30 дней</p>
            </div>
          </div>

          {/* Main button */}
          <div style={{
            width: '100%', padding: '18px 20px', borderRadius: '16px', border: 'none',
            background: btnGradient, color: '#fff', fontSize: '16px', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '12px', letterSpacing: '-0.3px', boxShadow: btnShadow,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
              Продлить подписку
            </span>
            <span style={{ opacity: 0.95 }}>от 199 ₽</span>
          </div>

          {/* Setup button */}
          <div style={{
            width: '100%', padding: '16px', borderRadius: '16px',
            border: `1px solid ${btnSecBorder}`, background: btnSecBg,
            color: fg, fontSize: '15px', fontWeight: '600',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginBottom: '12px', letterSpacing: '-0.2px',
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Настройка VPN
          </div>

          {/* Profile & Support */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {['Профиль', 'Поддержка'].map(label => (
              <div key={label} style={{
                padding: '16px 14px', borderRadius: '16px',
                border: `1px solid ${btnSecBorder}`, background: btnSecBg,
                color: fg, fontSize: '14px', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                letterSpacing: '-0.2px',
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {label === 'Профиль'
                    ? <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>
                    : <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></>
                  }
                </svg>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ===================== PAYMENT SUCCESS =====================
  const renderPaymentSuccessPage = () => {
    const stickerUrl = getStickerUrl('payment-success');
    const hasSticker = !!stickerUrl;
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%',
          background: `radial-gradient(circle, rgba(${props.primaryRgb}, 0.15) 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '10%', width: '250px', height: '250px',
          background: `radial-gradient(circle, rgba(${props.primaryRgb}, 0.12) 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        {/* Sticker */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: hasSticker ? '340px' : '260px',
          height: hasSticker ? '340px' : '260px',
          marginBottom: '32px',
        }}>
          {!hasSticker && (
            <div style={{
              position: 'absolute', inset: '20px',
              background: isDark
                ? `radial-gradient(circle, rgba(${props.primaryRgb}, 0.15) 0%, transparent 70%)`
                : `radial-gradient(circle, rgba(${props.primaryRgb}, 0.1) 0%, transparent 70%)`,
              borderRadius: '50%', filter: 'blur(30px)',
            }} />
          )}
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            ...(hasSticker ? {} : {
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
              borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)'}`,
              boxShadow: isDark
                ? `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(${props.primaryRgb}, 0.1)`
                : `0 20px 40px rgba(0, 0, 0, 0.08), 0 0 80px rgba(${props.primaryRgb}, 0.05)`,
              padding: '20px',
            }),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {hasSticker ? (
              <PreviewSticker url={stickerUrl} size={hasSticker ? '340px' : '260px'} scaleFix />
            ) : (
              <Sparkles size={80} strokeWidth={2} color={isDark ? props.primary : props.primaryDark} />
            )}
          </div>
        </div>

        {/* Text */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', width: '100%' }}>
          <h1 style={{ fontSize: '42px', fontWeight: '700', color: fg, margin: 0, marginBottom: '16px', letterSpacing: '-1px', textAlign: 'center' }}>
            Оплата успешна!
          </h1>
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: fgMuted7, textAlign: 'center', margin: 0, marginBottom: '40px', maxWidth: '340px' }}>
            Ваша поддержка помогает нам развивать сервис и делать его лучше для каждого пользователя.
          </p>
          <div style={{
            width: '100%', padding: '18px', borderRadius: '16px', border: 'none',
            background: btnGradient, color: '#fff', fontSize: '16px', fontWeight: '700',
            letterSpacing: '-0.3px', textAlign: 'center',
            boxShadow: `0 8px 24px rgba(${props.primaryRgb}, 0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Установка и настройка
          </div>
        </div>
      </div>
    );
  };

  // ===================== SETUP STEP 3 =====================
  const renderSetupPage = () => {
    const stickerUrl = getStickerUrl('setup');
    const hasSticker = !!stickerUrl;
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        paddingTop: '20px', paddingBottom: '20px',
      }}>
        {/* Step indicators */}
        <div style={{ padding: '0 20px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: success, color: '#fff', fontSize: '13px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}>
                  <Check size={16} strokeWidth={3} />
                </div>
                {s < 3 && <div style={{ flex: 1, height: '3px', background: success, borderRadius: '2px' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px', maxWidth: '400px', width: '100%', margin: '0 auto',
        }}>
          {/* Sticker */}
          <div style={{
            position: 'relative',
            width: hasSticker ? '340px' : '260px',
            height: hasSticker ? '340px' : '260px',
            marginBottom: '20px',
          }}>
            {!hasSticker && (
              <div style={{
                position: 'absolute', inset: '20px',
                background: isDark
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 60%)'
                  : 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
                borderRadius: '50%', pointerEvents: 'none',
              }} />
            )}
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              ...(hasSticker ? {} : {
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                borderRadius: '50%',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)'}`,
                boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.2)' : '0 10px 30px rgba(0, 0, 0, 0.06)',
                padding: '20px',
              }),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {hasSticker ? (
                <PreviewSticker url={stickerUrl} size={hasSticker ? '340px' : '260px'} scaleFix />
              ) : (
                <Check size={60} strokeWidth={3} color={isDark ? success : '#059669'} />
              )}
            </div>
          </div>

          {/* Text */}
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: fg, margin: 0, letterSpacing: '-1px', textAlign: 'center' }}>
            Готово!
          </h1>
          <p style={{ fontSize: '16px', color: fgMuted6, margin: '12px 0 0 0', lineHeight: '1.5', textAlign: 'center', maxWidth: '280px', fontWeight: '500' }}>
            Включите VPN в приложении v2RayTun
          </p>
          <div style={{
            width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
            background: btnGradient, color: '#fff', fontSize: '15px', fontWeight: '700',
            textAlign: 'center', marginTop: '10px', letterSpacing: '-0.3px',
            boxShadow: `0 8px 24px rgba(${props.primaryRgb}, 0.35)`,
          }}>
            Завершить
          </div>
        </div>
      </div>
    );
  };

  // Парсим background CSS в React style (поддержка gradient, url(), цвет)
  const parseBg = (bgStr: string): React.CSSProperties => {
    if (!bgStr) return {};
    if (bgStr.includes('url(') || bgStr.includes('gradient') || bgStr.includes(',')) {
      return { background: bgStr };
    }
    return { backgroundColor: bgStr };
  };

  return (
    <div>
      {/* Page navigation pills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {PREVIEW_PAGES.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePage(p.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              activePage === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* iPhone 16 frame — pixel-perfect replica */}
      {(() => {
        const phoneW = 393;
        const phoneH = 852;
        const frameW = 300;
        const s = frameW / phoneW; // scale ~0.763
        const frameH = Math.round(phoneH * s);
        // iPhone 16 bezel — тонкий, edge-to-edge
        const bezel = Math.round(3 * s);
        const outerW = frameW + bezel * 2;
        const outerH = frameH + bezel * 2;
        // iPhone 16 display corner radius = 55pt
        const screenR = Math.round(55 * s);
        const frameR = screenR + bezel;
        // Status bar height = 59pt (Dynamic Island area), TG header = 56pt
        const statusH = Math.round(59 * s);
        const tgHeaderH = Math.round(56 * s);
        const appH = phoneH - 59 - 56; // content area in phone pts

        return (
          <div style={{
            width: `${outerW}px`,
            height: `${outerH}px`,
            borderRadius: `${frameR}px`,
            // Black Titanium frame — always dark
            background: 'linear-gradient(145deg, #3a3a3c 0%, #2c2c2e 30%, #1c1c1e 100%)',
            padding: `${bezel}px`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.15)',
            position: 'relative',
          }}>
            {/* Side button — power (right side) */}
            <div style={{
              position: 'absolute', right: '0px', top: `${Math.round(105 * s)}px`,
              width: '1.5px', height: `${Math.round(60 * s)}px`,
              borderRadius: '0 1px 1px 0',
              background: '#48484a',
            }} />
            {/* Action button (left, small) */}
            <div style={{
              position: 'absolute', left: '0px', top: `${Math.round(75 * s)}px`,
              width: '1.5px', height: `${Math.round(20 * s)}px`,
              borderRadius: '1px 0 0 1px',
              background: '#48484a',
            }} />
            {/* Volume up */}
            <div style={{
              position: 'absolute', left: '0px', top: `${Math.round(108 * s)}px`,
              width: '1.5px', height: `${Math.round(32 * s)}px`,
              borderRadius: '1px 0 0 1px',
              background: '#48484a',
            }} />
            {/* Volume down */}
            <div style={{
              position: 'absolute', left: '0px', top: `${Math.round(150 * s)}px`,
              width: '1.5px', height: `${Math.round(32 * s)}px`,
              borderRadius: '1px 0 0 1px',
              background: '#48484a',
            }} />

            {/* Screen */}
            <div style={{
              width: `${frameW}px`,
              height: `${frameH}px`,
              borderRadius: `${screenR}px`,
              overflow: 'hidden',
              position: 'relative',
              background: '#000',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Dynamic Island */}
              <div style={{
                position: 'absolute',
                top: `${Math.round(11 * s)}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${Math.round(126 * s)}px`,
                height: `${Math.round(37 * s)}px`,
                borderRadius: `${Math.round(20 * s)}px`,
                background: '#000',
                zIndex: 20,
              }} />

              {/* iOS Status Bar — 59pt */}
              <div style={{
                height: `${statusH}px`,
                background: '#000',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                padding: `0 ${Math.round(50 * s)}px ${Math.round(14 * s)}px`,
                fontFamily: '-apple-system, "SF Pro Text", sans-serif',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: `${Math.round(15 * s)}px`,
                  fontWeight: '600',
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}>9:41</span>
                <div style={{ display: 'flex', gap: `${Math.round(5 * s)}px`, alignItems: 'center' }}>
                  {/* Cellular signal */}
                  <svg width={Math.round(17 * s)} height={Math.round(12 * s)} viewBox="0 0 17 12">
                    <rect x="0" y="9" width="3" height="3" rx="0.5" fill="#fff" />
                    <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="#fff" />
                    <rect x="9" y="3" width="3" height="9" rx="0.5" fill="#fff" />
                    <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="#fff" opacity="0.3" />
                  </svg>
                  {/* WiFi */}
                  <svg width={Math.round(15 * s)} height={Math.round(12 * s)} viewBox="0 0 15 12">
                    <path d="M7.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="#fff" />
                    <path d="M4.1 7.6a4.8 4.8 0 016.8 0" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M1.1 4.6a9 9 0 0112.8 0" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  {/* Battery */}
                  <svg width={Math.round(27 * s)} height={Math.round(13 * s)} viewBox="0 0 27 13">
                    <rect x="0.5" y="0.5" width="23" height="12" rx="2.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.35" />
                    <rect x="2" y="2" width="20" height="9" rx="1.5" fill="#30d158" />
                    <path d="M25 4.5v4a2 2 0 000-4z" fill="#fff" opacity="0.4" />
                  </svg>
                </div>
              </div>

              {/* Bottom sheet (Telegram header + mini app) */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderTopLeftRadius: `${Math.round(32 * s)}px`,
                borderTopRightRadius: `${Math.round(32 * s)}px`,
                background: isDark ? (props.headerDark || '#1c1c1e') : (props.headerLight || '#fff'),
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* Drag handle pill */}
                <div style={{
                  display: 'flex', justifyContent: 'center',
                  padding: `${Math.round(8 * s)}px 0 ${Math.round(4 * s)}px`,
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: `${Math.round(36 * s)}px`,
                    height: `${Math.round(5 * s)}px`,
                    borderRadius: `${Math.round(3 * s)}px`,
                    background: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                  }} />
                </div>

                {/* TG Header */}
                <div style={{
                  height: `${Math.round(44 * s)}px`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: `0 ${Math.round(16 * s)}px`,
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  <span style={{
                    fontSize: `${Math.round(17 * s)}px`,
                    color: isDark ? '#0a84ff' : '#007aff',
                    fontWeight: '400',
                    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
                  }}>
                    Закрыть
                  </span>
                  <div style={{
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                    textAlign: 'center', lineHeight: '1',
                  }}>
                    <div style={{
                      fontSize: `${Math.round(17 * s)}px`, fontWeight: '600',
                      color: isDark ? '#fff' : '#000',
                      marginBottom: `${Math.round(2 * s)}px`,
                    }}>
                      {props.botName || 'VPN Bot'}
                    </div>
                    <div style={{
                      fontSize: `${Math.round(13 * s)}px`,
                      color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(60,60,67,0.6)',
                    }}>
                      мини-приложение
                    </div>
                  </div>
                  <div style={{
                    marginLeft: 'auto',
                    width: `${Math.round(30 * s)}px`,
                    height: `${Math.round(30 * s)}px`,
                    borderRadius: '50%',
                    border: `${Math.round(1.5 * s)}px solid ${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(60,60,67,0.3)'}`,
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={Math.round(14 * s)} height={Math.round(4 * s)} viewBox="0 0 14 4">
                      <circle cx="2" cy="2" r="1.5" fill={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(60,60,67,0.55)'} />
                      <circle cx="7" cy="2" r="1.5" fill={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(60,60,67,0.55)'} />
                      <circle cx="12" cy="2" r="1.5" fill={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(60,60,67,0.55)'} />
                    </svg>
                  </div>
                </div>

                {/* Mini App Content */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${phoneW}px`,
                    height: `${appH}px`,
                    transformOrigin: 'top left',
                    transform: `scale(${s})`,
                    ...parseBg(isDark ? props.bgDark : props.bgLight),
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
                  }}>
                    {activePage === 'home' && renderHomePage()}
                    {activePage === 'payment-success' && renderPaymentSuccessPage()}
                    {activePage === 'setup' && renderSetupPage()}
                  </div>
                </div>
              </div>

              {/* Home indicator */}
              <div style={{
                position: 'absolute',
                bottom: `${Math.round(8 * s)}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${Math.round(140 * s)}px`,
                height: `${Math.round(5 * s)}px`,
                borderRadius: `${Math.round(3 * s)}px`,
                background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
                zIndex: 10,
              }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
});

// ==================== FULLSCREEN THEME EDITOR MODAL ====================
type ThemeSection = 'appearance' | 'stickers' | 'bot' | 'texts';
const THEME_SECTIONS: { id: ThemeSection; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Внешний вид', icon: <Palette className="w-4 h-4" /> },
  { id: 'stickers', label: 'Стикеры', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'bot', label: 'Бот /start', icon: <Bot className="w-4 h-4" /> },
  { id: 'texts', label: 'Тексты', icon: <ScrollText className="w-4 h-4" /> },
];

// Default texts for mini-app (mirrors TextsContext defaults)
const TEXT_GROUPS: { id: string; label: string; icon: LucideIcon; fields: { key: string; label: string; default: string }[] }[] = [
  { id: 'home', label: 'Главная', icon: Home, fields: [
    { key: 'home_buy', label: 'Кнопка покупки', default: 'Купить подписку' },
    { key: 'home_renew', label: 'Кнопка продления', default: 'Продлить подписку' },
    { key: 'home_trial_btn', label: 'Кнопка триала', default: 'Попробовать' },
    { key: 'home_profile', label: 'Кнопка профиля', default: 'Профиль' },
    { key: 'home_support', label: 'Кнопка поддержки', default: 'Поддержка' },
    { key: 'home_setup_prefix', label: 'Кнопка установки (префикс)', default: 'Установка и настройка' },
    { key: 'home_sub_until', label: 'Подписка до ({date})', default: 'Подписка до {date}' },
    { key: 'home_days_left', label: 'Осталось дней ({days})', default: 'Осталось {days}' },
    { key: 'home_not_active', label: 'Не активна', default: 'Не активна' },
    { key: 'home_try_free', label: 'Попробуй бесплатно', default: 'Попробуй бесплатно' },
    { key: 'home_no_subscription', label: 'Нет подписки', default: 'нет подписки' },
    { key: 'home_expired', label: 'Подписка истекла', default: 'Подписка истекла' },
    { key: 'home_loading', label: 'Загрузка', default: 'загрузка...' },
    { key: 'home_trial_activating', label: 'Активация триала', default: 'Активация...' },
    { key: 'home_price_from', label: 'Цена от ({price})', default: 'от {price} ₽' },
  ]},
  { id: 'support', label: 'Поддержка', icon: MessageCircle, fields: [
    { key: 'support_title', label: 'Заголовок', default: 'Мы на связи 24/7' },
    { key: 'support_subtitle', label: 'Подзаголовок', default: 'Напишите нам — поможем!' },
    { key: 'support_btn', label: 'Кнопка', default: 'Написать в поддержку' },
    { key: 'support_msg', label: 'Текст сообщения ({tgid})', default: 'Добрый день. У меня вопрос. Мой id: {tgid}' },
  ]},
  { id: 'trial_modal', label: 'Триал / Нет подписки', icon: Sparkles, fields: [
    { key: 'trial_modal_title', label: 'Заголовок', default: 'Попробуйте бесплатно!' },
    { key: 'trial_modal_desc', label: 'Описание ({days})', default: 'Активируйте пробный период на {days} — это бесплатно и без обязательств. Оцените скорость и стабильность нашего VPN!' },
    { key: 'trial_modal_btn', label: 'Кнопка ({days})', default: 'Попробовать {days} бесплатно' },
    { key: 'no_sub_title', label: 'Заголовок (нет подписки)', default: 'Подписка не активна' },
    { key: 'no_sub_desc', label: 'Описание (нет подписки)', default: 'Для настройки VPN необходима активная подписка. Выберите удобный тариф и пользуйтесь безопасным интернетом без ограничений!' },
    { key: 'no_sub_btn', label: 'Кнопка (нет подписки)', default: 'Выбрать тариф' },
  ]},
  { id: 'purchase', label: 'Покупка', icon: ShoppingCart, fields: [
    { key: 'purchase_pay', label: 'Кнопка оплаты ({price})', default: 'Оплатить {price} ₽' },
    { key: 'purchase_device_1', label: '1 устройство', default: 'Устройство' },
    { key: 'purchase_device_2', label: '2-4 устройства', default: 'Устройства' },
    { key: 'purchase_device_5', label: '5+ устройств', default: 'Устройств' },
    { key: 'plan_1month', label: 'Тариф 1 месяц', default: '1 месяц' },
    { key: 'plan_3months', label: 'Тариф 3 месяца', default: '3 месяца' },
    { key: 'plan_6months', label: 'Тариф 6 месяцев', default: '6 месяцев' },
    { key: 'plan_1year', label: 'Тариф 1 год', default: '1 год' },
  ]},
  { id: 'payment', label: 'Оплата', icon: CreditCard, fields: [
    { key: 'payment_promo_label', label: 'Промокод лейбл', default: 'Промокод' },
    { key: 'payment_promo_placeholder', label: 'Промокод placeholder', default: 'Введите промокод' },
    { key: 'payment_method_yookassa', label: 'YooKassa', default: 'Карты, СБП, Кошельки' },
    { key: 'payment_method_yoomoney', label: 'YooMoney', default: 'ЮMoney кошелёк' },
    { key: 'payment_method_freekassa', label: 'FreeKassa', default: 'Карты, СБП, Криптовалюта' },
    { key: 'payment_method_cryptobot', label: 'CryptoBot', default: 'Криптовалюта' },
    { key: 'payment_method_stars', label: 'Telegram Stars', default: 'Telegram Stars' },
    { key: 'payment_method_card', label: 'Оплата картой', default: 'Оплата картой' },
    { key: 'waiting_title', label: 'Ожидание — заголовок', default: 'Ожидание оплаты' },
    { key: 'waiting_desc', label: 'Ожидание — описание', default: 'Завершите оплату в открывшемся окне. Страница обновится автоматически.' },
    { key: 'waiting_check', label: 'Кнопка проверки', default: 'Проверить оплату' },
    { key: 'waiting_checking', label: 'Проверяем...', default: 'Проверяем...' },
    { key: 'success_title', label: 'Успех — заголовок', default: 'Оплата успешна!' },
    { key: 'success_subtitle', label: 'Успех — подзаголовок', default: 'Спасибо!' },
  ]},
  { id: 'profile', label: 'Профиль', icon: User, fields: [
    { key: 'profile_transactions', label: 'Транзакции', default: 'Мои транзакции' },
    { key: 'profile_referral', label: 'Реферальная', default: 'Реферальная программа' },
    { key: 'profile_support', label: 'Поддержка', default: 'Связаться с поддержкой' },
    { key: 'profile_agreement', label: 'Соглашение', default: 'Пользовательское соглашение' },
    { key: 'profile_share_text', label: 'Текст шаринга', default: 'Юзаю этот впн, норм работает — залетай' },
  ]},
  { id: 'setup', label: 'Настройка', icon: Settings2, fields: [
    { key: 'setup_title', label: 'Заголовок', default: 'Установка' },
    { key: 'setup_desc', label: 'Описание', default: 'Настройка VPN занимает пару минут' },
    { key: 'setup_this_device', label: 'Это устройство', default: 'Это устройство' },
    { key: 'setup_other_device', label: 'Другое устройство', default: 'Другое устройство' },
    { key: 'setup_done', label: 'Готово', default: 'Готово!' },
    { key: 'setup_finish', label: 'Завершить', default: 'Завершить' },
    { key: 'setup_enable_vpn', label: 'Включите VPN', default: 'Включите VPN в приложении v2RayTun' },
    { key: 'other_device_title', label: 'Другое устройство — заголовок', default: 'Другое устройство' },
    { key: 'other_device_desc', label: 'Другое устройство — описание', default: 'Скопируйте ссылку для импорта конфигурации' },
    { key: 'other_device_link_label', label: 'Ссылка на подписку', default: 'Ссылка на подписку' },
    { key: 'other_device_instructions', label: 'Инструкции по платформам', default: 'Инструкции по платформам' },
  ]},
  { id: 'referral', label: 'Реферальная', icon: Gift, fields: [
    { key: 'ref_how_title', label: 'Заголовок "Как работает"', default: 'Как начисляются бонусы' },
    { key: 'ref_money_desc', label: 'Описание (деньги, {percent})', default: 'Друг купил подписку — вы получаете {percent}% от суммы' },
    { key: 'ref_money_auto', label: 'Авто-зачисление', default: 'Бонус зачисляется на баланс автоматически' },
    { key: 'ref_money_use', label: 'Использование баланса', default: 'Баланс можно вывести или обменять на дни подписки' },
    { key: 'ref_days_invite', label: 'Бонус за приглашение', default: 'Друг начал пользоваться — вы получаете' },
    { key: 'ref_days_purchase', label: 'Бонус за покупку', default: 'Друг купил тариф — вы получаете бонус:' },
    { key: 'ref_days_auto', label: 'Авто-зачисление (дни)', default: 'Всё начисляется автоматически' },
    { key: 'ref_min_withdrawal', label: 'Мин. вывод ({amount})', default: 'Мин. сумма вывода: {amount} ₽' },
    { key: 'ref_amount_placeholder', label: 'Сумма placeholder', default: 'Сумма ₽' },
    { key: 'ref_card_placeholder', label: 'Карта placeholder', default: 'Номер карты' },
  ]},
  { id: 'downloads', label: 'Скачивание', icon: Download, fields: [
    { key: 'download_appstore', label: 'App Store', default: 'Скачать из App Store' },
    { key: 'download_gplay', label: 'Google Play', default: 'Скачать из Google Play' },
    { key: 'download_macos', label: 'macOS', default: 'Скачать для macOS' },
    { key: 'download_windows', label: 'Windows', default: 'Скачать для Windows' },
    { key: 'download_linux', label: 'Linux', default: 'Скачать для Linux' },
  ]},
];

function ThemeEditorModal({ settings, onSave, saving, onClose }: SettingsTabProps & { onClose: () => void }) {
  const s = settings as any;
  const [section, setSection] = useState<ThemeSection>('appearance');

  // --- All state ---
  const initBgId = () => {
    if (s.bg_gradient_dark) {
      const match = BG_PRESETS.find(p => p.dark === s.bg_gradient_dark);
      return match ? match.id : 'custom';
    }
    return s.template_id || 'default';
  };
  const [bgPresetId, setBgPresetId] = useState(initBgId());
  const [primary, setPrimary] = useState(settings.theme_primary || '#3b82f6');
  const [heroType, setHeroType] = useState(s.hero_type || 'lottie_default');
  const [heroStickerUrl, setHeroStickerUrl] = useState(s.hero_sticker_url || '');
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [stickerPaymentUrl, setStickerPaymentUrl] = useState(s.sticker_payment_url || '');
  const [stickerSetupUrl, setStickerSetupUrl] = useState(s.sticker_setup_url || '');
  const [uploadingPaymentSticker, setUploadingPaymentSticker] = useState(false);
  const [uploadingSetupSticker, setUploadingSetupSticker] = useState(false);
  const [previewDark, setPreviewDark] = useState(true);

  const DEFAULT_WELCOME = '👋 Привет, <b>{name}</b>!\n\n<b>TMA VPN</b> — быстрый и надёжный VPN прямо в Telegram. 🛡️\n\n<b>Что вы получаете:</b>\n• Безлимитный трафик\n• Серверы в нескольких странах\n• Управление через мини-приложение\n• Реферальная программа с бонусами';
  const [welcomeText, setWelcomeText] = useState(s.bot_welcome_text || DEFAULT_WELCOME);
  const [btnOpenText, setBtnOpenText] = useState(s.bot_btn_open_text || '🚀 Открыть приложение');
  const [btnOpenEmoji, setBtnOpenEmoji] = useState(s.bot_btn_open_emoji || '');
  const [btnSupportText, setBtnSupportText] = useState(s.bot_btn_support_text || '💬 Поддержка');
  const [btnSupportEmoji, setBtnSupportEmoji] = useState(s.bot_btn_support_emoji || '');
  const [btnReferralText, setBtnReferralText] = useState(s.bot_btn_referral_text || '🎁 Реферальная система');
  const [btnReferralEmoji, setBtnReferralEmoji] = useState(s.bot_btn_referral_emoji || '');
  const [btnShareText, setBtnShareText] = useState(s.bot_btn_share_text || '🔗 Поделиться с другом');
  const [btnShareEmoji, setBtnShareEmoji] = useState(s.bot_btn_share_emoji || '');
  const [btnBackText, setBtnBackText] = useState(s.bot_btn_back_text || '◀️ Назад в меню');
  const [btnBackEmoji, setBtnBackEmoji] = useState(s.bot_btn_back_emoji || '');
  const [shareText, setShareText] = useState(s.bot_share_text || 'Советую этот VPN — быстрый и надёжный! 🛡️');
  const [btnOpenStyle, setBtnOpenStyle] = useState(s.bot_btn_open_style || 'primary');
  const [btnSupportStyle, setBtnSupportStyle] = useState(s.bot_btn_support_style || '');
  const [btnReferralStyle, setBtnReferralStyle] = useState(s.bot_btn_referral_style || '');
  const [btnShareStyle, setBtnShareStyle] = useState(s.bot_btn_share_style || '');
  const [btnBackStyle, setBtnBackStyle] = useState(s.bot_btn_back_style || '');

  // App texts overrides
  const [appTexts, setAppTexts] = useState<Record<string, string>>(() => {
    try {
      const raw = s.app_texts;
      if (typeof raw === 'string') return JSON.parse(raw);
      if (typeof raw === 'object' && raw !== null) return raw;
    } catch {}
    return {};
  });
  const [openTextGroups, setOpenTextGroups] = useState<Set<string>>(new Set());
  const toggleTextGroup = (id: string) => setOpenTextGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const updateText = (key: string, value: string) => {
    setAppTexts(prev => {
      const defaultVal = TEXT_GROUPS.flatMap(g => g.fields).find(f => f.key === key)?.default || '';
      if (value === defaultVal || value === '') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const primaryDark = darkenHex(primary);
  const primaryRgb = hexToRgb(primary);
  const currentBg = BG_PRESETS.find(p => p.id === bgPresetId) || BG_PRESETS[0];

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSticker(true);
    try {
      const resp = await apiClient.uploadSticker(file);
      setHeroStickerUrl(resp.url);
      setHeroType('custom_sticker');
      toast.success('Стикер загружен');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки стикера');
    } finally {
      setUploadingSticker(false);
    }
  };

  const handlePageStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const resp = await apiClient.uploadSticker(file);
      setter(resp.url);
      toast.success('Стикер загружен');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки стикера');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({
      template_id: bgPresetId,
      theme_primary: primary,
      theme_primary_dark: primaryDark,
      theme_primary_rgb: primaryRgb,
      theme_success: '#10b981',
      theme_danger: '#ef4444',
      hero_type: heroType,
      hero_sticker_url: heroStickerUrl,
      sticker_payment_url: stickerPaymentUrl,
      sticker_setup_url: stickerSetupUrl,
      bg_gradient_dark: currentBg.dark,
      bg_gradient_light: currentBg.light,
      bg_header_dark: currentBg.headerDark,
      bg_header_light: currentBg.headerLight,
      bot_welcome_text: welcomeText,
      bot_btn_open_text: btnOpenText,
      bot_btn_open_emoji: btnOpenEmoji,
      bot_btn_support_text: btnSupportText,
      bot_btn_support_emoji: btnSupportEmoji,
      bot_btn_referral_text: btnReferralText,
      bot_btn_referral_emoji: btnReferralEmoji,
      bot_btn_share_text: btnShareText,
      bot_btn_share_emoji: btnShareEmoji,
      bot_btn_back_text: btnBackText,
      bot_btn_back_emoji: btnBackEmoji,
      bot_share_text: shareText,
      bot_btn_open_style: btnOpenStyle,
      bot_btn_support_style: btnSupportStyle,
      bot_btn_referral_style: btnReferralStyle,
      bot_btn_share_style: btnShareStyle,
      bot_btn_back_style: btnBackStyle,
      app_texts: JSON.stringify(appTexts),
    });
  };

  // --- Render sections ---
  const renderAppearance = () => (
    <div className="space-y-6">
      {/* Background */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-foreground">Фон</label>

        {/* Градиенты */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Градиенты</span>
          <div className="grid grid-cols-3 gap-2">
            {BG_PRESETS.filter(bg => !bg.id.startsWith('solid-') && !['matrix-grid','circuit','hexagon','diamonds','radar'].includes(bg.id)).map(bg => (
              <button key={bg.id} onClick={() => setBgPresetId(bg.id)}
                className={cn("relative rounded-xl border-2 overflow-hidden transition-all h-16",
                  bgPresetId === bg.id ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-muted-foreground/30")}>
                <div className="absolute inset-0" style={{ background: previewDark ? bg.dark : bg.light }} />
                <div className="relative h-full flex items-end p-1.5">
                  <span className={cn("text-[10px] font-medium px-1 py-0.5 rounded", previewDark ? "text-white/80 bg-black/30" : "text-black/80 bg-white/50")}>{bg.name}</span>
                </div>
                {bgPresetId === bg.id && <div className="absolute top-1 right-1"><Check className="w-3.5 h-3.5 text-primary drop-shadow-md" /></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Однотонные */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Однотонные</span>
          <div className="grid grid-cols-4 gap-2">
            {BG_PRESETS.filter(bg => bg.id.startsWith('solid-')).map(bg => (
              <button key={bg.id} onClick={() => setBgPresetId(bg.id)}
                className={cn("relative rounded-xl border-2 overflow-hidden transition-all h-14",
                  bgPresetId === bg.id ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-muted-foreground/30")}>
                <div className="absolute inset-0" style={{ background: previewDark ? bg.dark : bg.light }} />
                <div className="relative h-full flex items-end justify-center p-1">
                  <span className={cn("text-[10px] font-medium px-1 py-0.5 rounded", previewDark ? "text-white/80 bg-black/30" : "text-black/80 bg-white/50")}>{bg.name}</span>
                </div>
                {bgPresetId === bg.id && <div className="absolute top-1 right-1"><Check className="w-3 h-3 text-primary drop-shadow-md" /></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Паттерны */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Паттерны</span>
          <div className="grid grid-cols-3 gap-2">
            {BG_PRESETS.filter(bg => ['matrix-grid','circuit','hexagon','diamonds','radar'].includes(bg.id)).map(bg => (
              <button key={bg.id} onClick={() => setBgPresetId(bg.id)}
                className={cn("relative rounded-xl border-2 overflow-hidden transition-all h-16",
                  bgPresetId === bg.id ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-muted-foreground/30")}>
                <div className="absolute inset-0" style={{ background: previewDark ? bg.dark : bg.light }} />
                <div className="relative h-full flex items-end p-1.5">
                  <span className={cn("text-[10px] font-medium px-1 py-0.5 rounded", previewDark ? "text-white/80 bg-black/30" : "text-black/80 bg-white/50")}>{bg.name}</span>
                </div>
                {bgPresetId === bg.id && <div className="absolute top-1 right-1"><Check className="w-3.5 h-3.5 text-primary drop-shadow-md" /></div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accent color */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Акцентный цвет</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => setPrimary(preset.primary)}
              className={cn(
                "w-8 h-8 rounded-lg border-2 transition-all flex-shrink-0",
                primary === preset.primary
                  ? "border-foreground scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              )}
              style={{ background: preset.primary }}
              title={preset.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 max-w-[180px]">
          <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
            className="w-8 h-8 rounded-md border border-input cursor-pointer bg-transparent p-0.5 flex-shrink-0" />
          <input type="text" value={primary} onChange={e => setPrimary(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-input rounded-md text-xs font-mono text-foreground" />
        </div>
      </div>

    </div>
  );

  const renderStickers = () => (
    <div className="space-y-6">
      {/* Logo on home */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Логотип на главной</label>
        <p className="text-xs text-muted-foreground">Стикер на главном экране мини-приложения (TGS, PNG, GIF).</p>
        <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
          <div className="flex items-center gap-2">
            {LOGO_PRESETS.map(logo => (
              <button key={logo.id} onClick={() => setHeroType(logo.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                  heroType === logo.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:border-muted-foreground/30"
                )}
              >{logo.name}</button>
            ))}
          </div>
          {heroType === 'custom_sticker' && (
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                {uploadingSticker ? 'Загрузка...' : 'Загрузить'}
                <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={handleStickerUpload} className="hidden" disabled={uploadingSticker} />
              </label>
              {heroStickerUrl && (
                <div className="w-10 h-10 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
                  {heroStickerUrl.endsWith('.json') ? <LottiePreview url={heroStickerUrl} className="w-full h-full" /> : <img src={heroStickerUrl} alt="" className="w-full h-full object-contain" />}
                </div>
              )}
              {heroStickerUrl && <button onClick={() => setHeroStickerUrl('')} className="text-xs text-muted-foreground hover:text-destructive">Сбросить</button>}
              {!heroStickerUrl && <span className="text-xs text-muted-foreground">Загрузите файл</span>}
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      <p className="text-sm text-muted-foreground">Стикеры на страницах. Если не задан — используется стандартный.</p>

      {/* Payment success sticker */}
      <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-medium">Успешная оплата</span>
          {stickerPaymentUrl && <button onClick={() => setStickerPaymentUrl('')} className="text-xs text-muted-foreground hover:text-destructive">Сбросить</button>}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            {uploadingPaymentSticker ? 'Загрузка...' : 'Загрузить'}
            <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={(e) => handlePageStickerUpload(e, setStickerPaymentUrl, setUploadingPaymentSticker)} className="hidden" disabled={uploadingPaymentSticker} />
          </label>
          {stickerPaymentUrl && (
            <div className="w-10 h-10 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
              {stickerPaymentUrl.endsWith('.json') ? <LottiePreview url={stickerPaymentUrl} className="w-full h-full" /> : <img src={stickerPaymentUrl} alt="" className="w-full h-full object-contain" />}
            </div>
          )}
          {!stickerPaymentUrl && <span className="text-xs text-muted-foreground">По умолчанию</span>}
        </div>
      </div>

      {/* Setup sticker */}
      <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-medium">Завершение настройки</span>
          {stickerSetupUrl && <button onClick={() => setStickerSetupUrl('')} className="text-xs text-muted-foreground hover:text-destructive">Сбросить</button>}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            {uploadingSetupSticker ? 'Загрузка...' : 'Загрузить'}
            <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={(e) => handlePageStickerUpload(e, setStickerSetupUrl, setUploadingSetupSticker)} className="hidden" disabled={uploadingSetupSticker} />
          </label>
          {stickerSetupUrl && (
            <div className="w-10 h-10 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
              {stickerSetupUrl.endsWith('.json') ? <LottiePreview url={stickerSetupUrl} className="w-full h-full" /> : <img src={stickerSetupUrl} alt="" className="w-full h-full object-contain" />}
            </div>
          )}
          {!stickerSetupUrl && <span className="text-xs text-muted-foreground">По умолчанию</span>}
        </div>
      </div>
    </div>
  );

  const renderBotSection = () => (
    <div className="space-y-6">
      {/* Welcome text */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Приветственное сообщение</label>
        <p className="text-xs text-muted-foreground">HTML: b, i, u, code, blockquote. {'{name}'} — имя пользователя.</p>
        <textarea value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} rows={6}
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Кнопки /start</label>
        <div className="rounded-lg border border-input divide-y divide-input overflow-hidden">
          {[
            { label: 'Открыть приложение', text: btnOpenText, setT: setBtnOpenText, emoji: btnOpenEmoji, setE: setBtnOpenEmoji, style: btnOpenStyle, setS: setBtnOpenStyle },
            { label: 'Поддержка', text: btnSupportText, setT: setBtnSupportText, emoji: btnSupportEmoji, setE: setBtnSupportEmoji, style: btnSupportStyle, setS: setBtnSupportStyle },
            { label: 'Реферальная система', text: btnReferralText, setT: setBtnReferralText, emoji: btnReferralEmoji, setE: setBtnReferralEmoji, style: btnReferralStyle, setS: setBtnReferralStyle },
          ].map(({ label, text, setT, emoji, setE, style, setS }) => (
            <div key={label} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-1.5">
                  {([['', '#2b3d4f', 'Обычный'], ['primary', '#5288c1', 'Синий'], ['success', '#4cae4c', 'Зелёный'], ['danger', '#e53935', 'Красный']] as [string, string, string][]).map(([v, color, title]) => (
                    <button key={v} type="button" onClick={() => setS(v)} title={title}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${style === v ? 'ring-2 ring-offset-1 ring-ring scale-110' : 'opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: color, borderColor: v ? color : '#3a4f63' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={text} onChange={(e) => setT(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="text" value={emoji} onChange={(e) => setE(e.target.value)} placeholder="Emoji ID"
                  className="w-28 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral buttons */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Кнопки «Реферальная система»</label>
        <div className="rounded-lg border border-input divide-y divide-input overflow-hidden">
          {[
            { label: 'Поделиться', text: btnShareText, setT: setBtnShareText, emoji: btnShareEmoji, setE: setBtnShareEmoji, style: btnShareStyle, setS: setBtnShareStyle },
            { label: 'Назад в меню', text: btnBackText, setT: setBtnBackText, emoji: btnBackEmoji, setE: setBtnBackEmoji, style: btnBackStyle, setS: setBtnBackStyle },
          ].map(({ label, text, setT, emoji, setE, style, setS }) => (
            <div key={label} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-1.5">
                  {([['', '#2b3d4f', 'Обычный'], ['primary', '#5288c1', 'Синий'], ['success', '#4cae4c', 'Зелёный'], ['danger', '#e53935', 'Красный']] as [string, string, string][]).map(([v, color, title]) => (
                    <button key={v} type="button" onClick={() => setS(v)} title={title}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${style === v ? 'ring-2 ring-offset-1 ring-ring scale-110' : 'opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: color, borderColor: v ? color : '#3a4f63' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={text} onChange={(e) => setT(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="text" value={emoji} onChange={(e) => setE(e.target.value)} placeholder="Emoji ID"
                  className="w-28 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          ))}
          <div className="p-3">
            <label className="text-xs text-muted-foreground block mb-1">Текст при шаре</label>
            <input type="text" value={shareText} onChange={(e) => setShareText(e.target.value)}
              className="w-full px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ animation: 'themeEditorIn 0.25s ease-out' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Оформление</h2>
          </div>
          {/* Section tabs */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {THEME_SECTIONS.map(sec => (
              <button key={sec.id} onClick={() => setSection(sec.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  section === sec.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sec.icon}
                {sec.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main area: controls + preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — controls */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            {section === 'appearance' && renderAppearance()}
            {section === 'stickers' && renderStickers()}
            {section === 'bot' && renderBotSection()}
            {section === 'texts' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Нажмите на группу для редактирования. Пустое поле = значение по умолчанию.</p>
                {TEXT_GROUPS.map(group => {
                  const Icon = group.icon;
                  const changedCount = group.fields.filter(f => appTexts[f.key]).length;
                  const isOpen = openTextGroups.has(group.id);
                  const changedFields = group.fields.filter(f => appTexts[f.key]);
                  return (
                    <div key={group.id} className={cn("rounded-xl border transition-all", isOpen ? "border-primary/30 bg-primary/[0.02]" : "border-border hover:border-border/80")}>
                      {/* Header — always visible */}
                      <button
                        onClick={() => toggleTextGroup(group.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", changedCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{group.label}</span>
                            {changedCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{changedCount}</span>
                            )}
                            <span className="text-[11px] text-muted-foreground/60 ml-auto mr-2">{group.fields.length} полей</span>
                          </div>
                          {/* Preview of changed values when collapsed */}
                          {!isOpen && changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {changedFields.slice(0, 3).map(f => (
                                <span key={f.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-[10px] text-primary/80 max-w-[180px] truncate">
                                  <span className="text-primary/40">{group.fields.find(gf => gf.key === f.key)?.label}:</span>
                                  <span className="font-medium truncate">{appTexts[f.key]}</span>
                                </span>
                              ))}
                              {changedFields.length > 3 && (
                                <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5">+{changedFields.length - 3}</span>
                              )}
                            </div>
                          )}
                          {/* Default values preview when collapsed and nothing changed */}
                          {!isOpen && changedFields.length === 0 && (
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                              {group.fields.slice(0, 3).map(f => f.default).join(' · ')}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform flex-shrink-0", isOpen && "rotate-180")} />
                      </button>
                      {/* Fields — expanded */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2.5 border-t border-border/50 pt-3">
                          {group.fields.map(field => {
                            const isChanged = !!appTexts[field.key];
                            return (
                              <div key={field.key} className="group/field">
                                <div className="flex items-center gap-2 mb-1">
                                  <label className="text-xs text-muted-foreground">{field.label}</label>
                                  {isChanged && (
                                    <button
                                      onClick={() => updateText(field.key, '')}
                                      title="Сбросить"
                                      className="opacity-0 group-hover/field:opacity-100 transition-opacity ml-auto text-muted-foreground hover:text-foreground"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={appTexts[field.key] || ''}
                                  onChange={e => updateText(field.key, e.target.value)}
                                  placeholder={field.default}
                                  className={cn(
                                    "w-full px-2.5 py-1.5 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                                    isChanged
                                      ? "bg-primary/5 border border-primary/20 text-foreground"
                                      : "bg-background border border-input text-foreground placeholder:text-muted-foreground/40"
                                  )}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Summary */}
                {Object.keys(appTexts).length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Изменено: <span className="font-semibold text-foreground">{Object.keys(appTexts).length}</span> из {TEXT_GROUPS.reduce((sum, g) => sum + g.fields.length, 0)}
                    </span>
                    <button
                      onClick={() => setAppTexts({})}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Сбросить все
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — sticky preview */}
        <div className="hidden lg:flex flex-col items-center border-l bg-muted/30 p-6" style={{ width: '340px', flexShrink: 0 }}>
          {section === 'bot' ? (
            <>
              <div className="flex items-center gap-3 mb-4 w-full">
                <span className="text-sm font-medium text-foreground">Превью сообщения</span>
              </div>
              <div className="w-full rounded-2xl overflow-hidden shadow-xl" style={{ maxWidth: '300px' }}>
                {/* Telegram chat header */}
                <div className="bg-[#1f3447] px-4 py-2.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#5288c1] flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{s.bot_name || 'VPN Bot'}</div>
                    <div className="text-[#6c8fa6] text-[11px]">бот</div>
                  </div>
                </div>
                {/* Chat body */}
                <div className="bg-[#0e1621] p-3 space-y-2" style={{ minHeight: '350px' }}>
                  {/* Message bubble */}
                  <div className="bg-[#182533] rounded-2xl rounded-tl-sm px-3 py-2.5">
                    <div className="text-[#e8e8e8] text-[13px] leading-relaxed [&_b]:font-semibold [&_i]:italic [&_u]:underline [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_blockquote]:border-l-2 [&_blockquote]:border-[#5288c1] [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_blockquote]:text-[#9bb6d4]"
                      dangerouslySetInnerHTML={{ __html: welcomeText.replace(/{name}/g, 'Иван').replace(/\n/g, '<br>') }} />
                    <div className="text-[10px] text-[#6c8fa6] text-right mt-1">12:00</div>
                  </div>
                  {/* Buttons */}
                  <div className="space-y-1">
                    {[
                      { text: btnOpenText, style: btnOpenStyle },
                      ...(btnSupportText ? [{ text: btnSupportText, style: btnSupportStyle }] : []),
                      { text: btnReferralText, style: btnReferralStyle },
                    ].map((btn, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 text-center text-[13px] font-medium cursor-default select-none ${
                        btn.style === 'primary' ? 'bg-[#5288c1] text-white' :
                        btn.style === 'success' ? 'bg-[#4cae4c] text-white' :
                        btn.style === 'danger' ? 'bg-[#e53935] text-white' :
                        'bg-[#2b3d4f] text-[#e8e8e8]'
                      }`}>{btn.text}</div>
                    ))}
                  </div>
                </div>
                {/* Input bar */}
                <div className="bg-[#17212b] px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 bg-[#242f3d] rounded-full px-3 py-1.5 text-[#6c8fa6] text-xs">Сообщение...</div>
                  <div className="w-7 h-7 rounded-full bg-[#5288c1] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 w-full">
                <span className="text-sm font-medium text-foreground">Превью</span>
                <div className="flex items-center bg-muted rounded-lg p-0.5 ml-auto">
                  <button onClick={() => setPreviewDark(true)}
                    className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", previewDark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                    Тёмная
                  </button>
                  <button onClick={() => setPreviewDark(false)}
                    className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", !previewDark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                    Светлая
                  </button>
                </div>
              </div>
              <PreviewIframe
                isDark={previewDark}
                templateId={bgPresetId}
                primary={primary}
                primaryDark={primaryDark}
                primaryRgb={primaryRgb}
                heroType={heroType}
                heroStickerUrl={heroStickerUrl}
                stickerPaymentUrl={stickerPaymentUrl}
                stickerSetupUrl={stickerSetupUrl}
                bgDark={currentBg.dark}
                bgLight={currentBg.light}
                headerDark={currentBg.headerDark}
                headerLight={currentBg.headerLight}
                botName={s.bot_name}
              />
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes themeEditorIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ThemeSettings({ settings, onSave, saving, isMiniApp: _isMiniApp }: SettingsTabProps & { isMiniApp?: boolean }) {
  // Background state — store the preset id (or 'custom')
  const s = settings as any;
  const initBgId = () => {
    // Try to match current settings to a preset
    if (s.bg_gradient_dark) {
      const match = BG_PRESETS.find(p => p.dark === s.bg_gradient_dark);
      return match ? match.id : 'custom';
    }
    return s.template_id || 'default';
  };
  const [bgPresetId, setBgPresetId] = useState(initBgId());
  const [primary, setPrimary] = useState(settings.theme_primary || '#3b82f6');
  const [heroType, setHeroType] = useState(s.hero_type || 'lottie_default');
  const [heroStickerUrl, setHeroStickerUrl] = useState(s.hero_sticker_url || '');
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [stickerPaymentUrl, setStickerPaymentUrl] = useState(s.sticker_payment_url || '');
  const [stickerSetupUrl, setStickerSetupUrl] = useState(s.sticker_setup_url || '');
  const [uploadingPaymentSticker, setUploadingPaymentSticker] = useState(false);
  const [uploadingSetupSticker, setUploadingSetupSticker] = useState(false);
  const [previewDark, setPreviewDark] = useState(true);

  // /start message states
  const DEFAULT_WELCOME = '👋 Привет, <b>{name}</b>!\n\n<b>TMA VPN</b> — быстрый и надёжный VPN прямо в Telegram. 🛡️\n\n<b>Что вы получаете:</b>\n• Безлимитный трафик\n• Серверы в нескольких странах\n• Управление через мини-приложение\n• Реферальная программа с бонусами';
  const [welcomeText, setWelcomeText] = useState(s.bot_welcome_text || DEFAULT_WELCOME);
  const [btnOpenText, setBtnOpenText] = useState(s.bot_btn_open_text || '🚀 Открыть приложение');
  const [btnOpenEmoji, setBtnOpenEmoji] = useState(s.bot_btn_open_emoji || '');
  const [btnSupportText, setBtnSupportText] = useState(s.bot_btn_support_text || '💬 Поддержка');
  const [btnSupportEmoji, setBtnSupportEmoji] = useState(s.bot_btn_support_emoji || '');
  const [btnReferralText, setBtnReferralText] = useState(s.bot_btn_referral_text || '🎁 Реферальная система');
  const [btnReferralEmoji, setBtnReferralEmoji] = useState(s.bot_btn_referral_emoji || '');
  const [btnShareText, setBtnShareText] = useState(s.bot_btn_share_text || '🔗 Поделиться с другом');
  const [btnShareEmoji, setBtnShareEmoji] = useState(s.bot_btn_share_emoji || '');
  const [btnBackText, setBtnBackText] = useState(s.bot_btn_back_text || '◀️ Назад в меню');
  const [btnBackEmoji, setBtnBackEmoji] = useState(s.bot_btn_back_emoji || '');
  const [shareText, setShareText] = useState(s.bot_share_text || 'Советую этот VPN — быстрый и надёжный! 🛡️');
  const [btnOpenStyle, setBtnOpenStyle] = useState(s.bot_btn_open_style || 'primary');
  const [btnSupportStyle, setBtnSupportStyle] = useState(s.bot_btn_support_style || '');
  const [btnReferralStyle, setBtnReferralStyle] = useState(s.bot_btn_referral_style || '');
  const [btnShareStyle, setBtnShareStyle] = useState(s.bot_btn_share_style || '');
  const [btnBackStyle, setBtnBackStyle] = useState(s.bot_btn_back_style || '');

  // Derived values
  const primaryDark = darkenHex(primary);
  const primaryRgb = hexToRgb(primary);
  const currentBg = BG_PRESETS.find(p => p.id === bgPresetId) || BG_PRESETS[0];

  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSticker(true);
    try {
      const resp = await apiClient.uploadSticker(file);
      setHeroStickerUrl(resp.url);
      setHeroType('custom_sticker');
      toast.success('Стикер загружен');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки стикера');
    } finally {
      setUploadingSticker(false);
    }
  };

  const handlePageStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const resp = await apiClient.uploadSticker(file);
      setter(resp.url);
      toast.success('Стикер загружен');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки стикера');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({
      template_id: bgPresetId,
      theme_primary: primary,
      theme_primary_dark: primaryDark,
      theme_primary_rgb: primaryRgb,
      theme_success: '#10b981',
      theme_danger: '#ef4444',
      hero_type: heroType,
      hero_sticker_url: heroStickerUrl,
      sticker_payment_url: stickerPaymentUrl,
      sticker_setup_url: stickerSetupUrl,
      bg_gradient_dark: currentBg.dark,
      bg_gradient_light: currentBg.light,
      bg_header_dark: currentBg.headerDark,
      bg_header_light: currentBg.headerLight,
      bot_welcome_text: welcomeText,
      bot_btn_open_text: btnOpenText,
      bot_btn_open_emoji: btnOpenEmoji,
      bot_btn_support_text: btnSupportText,
      bot_btn_support_emoji: btnSupportEmoji,
      bot_btn_referral_text: btnReferralText,
      bot_btn_referral_emoji: btnReferralEmoji,
      bot_btn_share_text: btnShareText,
      bot_btn_share_emoji: btnShareEmoji,
      bot_btn_back_text: btnBackText,
      bot_btn_back_emoji: btnBackEmoji,
      bot_share_text: shareText,
      bot_btn_open_style: btnOpenStyle,
      bot_btn_support_style: btnSupportStyle,
      bot_btn_referral_style: btnReferralStyle,
      bot_btn_share_style: btnShareStyle,
      bot_btn_back_style: btnBackStyle,
    });
  };

  // Preview helpers
  const previewBg = previewDark ? currentBg.dark : currentBg.light;
  const pFg = previewDark ? '#fff' : '#000';
  const pFgMuted = previewDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const pCardBg = previewDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)';
  const pCardBorder = previewDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
  const pBtnBg = previewDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)';
  const pBtnBorder = previewDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const pGlassBg = previewDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';
  const pGlassBorder = previewDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)';
  const successRgb = hexToRgb('#10b981');
  const isNeon = bgPresetId === 'neon';

  return (
    <>
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Оформление мини-приложения</h3>
        <p className="text-sm text-muted-foreground mt-1">Фон, цвет и логотип для Mini App</p>
      </div>
      <div className="h-px bg-gradient-to-r from-border to-transparent" />

      {/* Two-column layout: controls left, preview right */}
      <div className="flex gap-8 items-start">
        {/* Left column — controls */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* === 1. BACKGROUND === */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Фон</label>
            <div className="grid grid-cols-2 gap-2">
              {BG_PRESETS.map(bg => (
                <button
                  key={bg.id}
                  onClick={() => setBgPresetId(bg.id)}
                  className={cn(
                    "relative rounded-xl border-2 overflow-hidden transition-all h-20",
                    bgPresetId === bg.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-input hover:border-muted-foreground/30"
                  )}
                >
                  <div className="absolute inset-0" style={{ background: previewDark ? bg.dark : bg.light }} />
                  <div className="relative h-full flex items-end p-2">
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      previewDark ? "text-white/80 bg-black/30" : "text-black/80 bg-white/50"
                    )}>
                      {bg.name}
                    </span>
                  </div>
                  {bgPresetId === bg.id && (
                    <div className="absolute top-1.5 right-1.5">
                      <Check className="w-4 h-4 text-primary drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* === 2. ACCENT COLOR === */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Акцентный цвет</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setPrimary(preset.primary)}
                  className={cn(
                    "w-9 h-9 rounded-lg border-2 transition-all flex-shrink-0",
                    primary === preset.primary
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ background: preset.primary }}
                  title={preset.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-[200px]">
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="w-9 h-9 rounded-md border border-input cursor-pointer bg-transparent p-0.5 flex-shrink-0"
              />
              <input
                type="text"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-input rounded-md text-xs font-mono text-foreground"
              />
            </div>
          </div>

          {/* === 3. LOGO === */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Логотип на главной</label>
            <p className="text-xs text-muted-foreground">Стикер отображается на главном экране мини-приложения. Можно загрузить свой (TGS, PNG, GIF).</p>

            <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
              <div className="flex items-center gap-2">
                {LOGO_PRESETS.map(logo => (
                  <button
                    key={logo.id}
                    onClick={() => setHeroType(logo.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      heroType === logo.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:border-muted-foreground/30"
                    )}
                  >
                    {logo.name}
                  </button>
                ))}
              </div>
              {heroType === 'custom_sticker' && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    {uploadingSticker ? 'Загрузка...' : 'Загрузить'}
                    <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={handleStickerUpload} className="hidden" disabled={uploadingSticker} />
                  </label>
                  {heroStickerUrl && (
                    <div className="w-12 h-12 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
                      {heroStickerUrl.endsWith('.json') ? (
                        <LottiePreview url={heroStickerUrl} className="w-full h-full" />
                      ) : (
                        <img src={heroStickerUrl} alt="Sticker preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                  )}
                  {heroStickerUrl && (
                    <button onClick={() => setHeroStickerUrl('')} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Сбросить</button>
                  )}
                  {!heroStickerUrl && <span className="text-xs text-muted-foreground">Загрузите файл</span>}
                </div>
              )}
            </div>
          </div>

          {/* === 4. PAGE STICKERS === */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Стикеры на страницах</label>
            <p className="text-xs text-muted-foreground">Можно загрузить свой стикер (TGS, PNG, GIF) для каждой страницы. Если не задан — используется стандартный.</p>

            {/* Payment success sticker */}
            <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-medium">Успешная оплата</span>
                {stickerPaymentUrl && (
                  <button onClick={() => setStickerPaymentUrl('')} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Сбросить</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  {uploadingPaymentSticker ? 'Загрузка...' : 'Загрузить'}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={(e) => handlePageStickerUpload(e, setStickerPaymentUrl, setUploadingPaymentSticker)} className="hidden" disabled={uploadingPaymentSticker} />
                </label>
                {stickerPaymentUrl && (
                  <div className="w-12 h-12 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
                    {stickerPaymentUrl.endsWith('.json') ? (
                      <LottiePreview url={stickerPaymentUrl} className="w-full h-full" />
                    ) : (
                      <img src={stickerPaymentUrl} alt="Payment sticker" className="w-full h-full object-contain" />
                    )}
                  </div>
                )}
                {!stickerPaymentUrl && <span className="text-xs text-muted-foreground">По умолчанию</span>}
              </div>
            </div>

            {/* Setup complete sticker */}
            <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-medium">Завершение настройки</span>
                {stickerSetupUrl && (
                  <button onClick={() => setStickerSetupUrl('')} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Сбросить</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  {uploadingSetupSticker ? 'Загрузка...' : 'Загрузить'}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.tgs" onChange={(e) => handlePageStickerUpload(e, setStickerSetupUrl, setUploadingSetupSticker)} className="hidden" disabled={uploadingSetupSticker} />
                </label>
                {stickerSetupUrl && (
                  <div className="w-12 h-12 rounded-lg border border-input overflow-hidden bg-muted/30 flex-shrink-0">
                    {stickerSetupUrl.endsWith('.json') ? (
                      <LottiePreview url={stickerSetupUrl} className="w-full h-full" />
                    ) : (
                      <img src={stickerSetupUrl} alt="Setup sticker" className="w-full h-full object-contain" />
                    )}
                  </div>
                )}
                {!stickerSetupUrl && <span className="text-xs text-muted-foreground">По умолчанию</span>}
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>

        {/* Right column — sticky live preview */}
        <div className="hidden lg:block sticky top-6" style={{ width: '300px', flexShrink: 0 }}>
          {/* Dark/Light toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Предпросмотр</span>
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setPreviewDark(true)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  previewDark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                Тёмная
              </button>
              <button
                onClick={() => setPreviewDark(false)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  !previewDark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                Светлая
              </button>
            </div>
          </div>

          {/* Live preview iframe — real mini app */}
          <PreviewIframe
            isDark={previewDark}
            templateId={bgPresetId}
            primary={primary}
            primaryDark={primaryDark}
            primaryRgb={primaryRgb}
            heroType={heroType}
            heroStickerUrl={heroStickerUrl}
            stickerPaymentUrl={stickerPaymentUrl}
            stickerSetupUrl={stickerSetupUrl}
            bgDark={currentBg.dark}
            bgLight={currentBg.light}
            headerDark={currentBg.headerDark}
            headerLight={currentBg.headerLight}
            botName={s.bot_name}
          />
        </div>
      </div>
    </div>

    {/* /start message section */}
    <div className="space-y-6 mt-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Сообщение /start</h3>
        <p className="text-sm text-muted-foreground mt-1">Приветственный текст и кнопки, которые бот отправляет при команде /start</p>
      </div>
      <div className="h-px bg-gradient-to-r from-border to-transparent" />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Editor */}
        <div className="flex-1 min-w-0 space-y-6">

        {/* Welcome text */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Приветственное сообщение</label>
          <p className="text-xs text-muted-foreground">HTML: b, i, u, code, blockquote. Переменная {'{name}'} — имя пользователя.</p>
          <textarea
            value={welcomeText}
            onChange={(e) => setWelcomeText(e.target.value)}
            rows={7}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Mobile preview */}
        <div className="lg:hidden space-y-2">
          <label className="text-sm font-medium text-foreground">Предпросмотр</label>
          <div className="rounded-xl bg-[#17212b] p-4">
            <div className="bg-[#182533] rounded-2xl rounded-tl-sm px-3 py-2.5 mb-2">
              <div
                className="text-[#e8e8e8] text-sm leading-relaxed [&_b]:font-semibold [&_i]:italic [&_u]:underline [&_s]:line-through [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-[#5288c1] [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_blockquote]:text-[#9bb6d4]"
                dangerouslySetInnerHTML={{ __html: welcomeText.replace(/{name}/g, 'Иван').replace(/\n/g, '<br>') }}
              />
              <div className="text-[10px] text-[#6c8fa6] text-right mt-1">12:00</div>
            </div>
            <div className="space-y-1">
              {[
                { text: btnOpenText, style: btnOpenStyle },
                ...(btnSupportText ? [{ text: btnSupportText, style: btnSupportStyle }] : []),
                { text: btnReferralText, style: btnReferralStyle },
              ].map((btn, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-center text-sm font-medium cursor-default select-none ${
                  btn.style === 'primary' ? 'bg-[#5288c1] text-white' :
                  btn.style === 'success' ? 'bg-[#4cae4c] text-white' :
                  btn.style === 'danger' ? 'bg-[#e53935] text-white' :
                  'bg-[#2b3d4f] text-[#e8e8e8]'
                }`}>{btn.text}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Button cards — /start */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Кнопки /start</label>
            <p className="text-xs text-muted-foreground mt-0.5">ID эмодзи — через @ShowJsonBot (нужен Telegram Premium).</p>
          </div>
          <div className="rounded-lg border border-input divide-y divide-input overflow-hidden">
            {[
              { label: 'Открыть приложение', text: btnOpenText, setT: setBtnOpenText, emoji: btnOpenEmoji, setE: setBtnOpenEmoji, style: btnOpenStyle, setS: setBtnOpenStyle, hint: 'Всегда видна' },
              { label: 'Поддержка', text: btnSupportText, setT: setBtnSupportText, emoji: btnSupportEmoji, setE: setBtnSupportEmoji, style: btnSupportStyle, setS: setBtnSupportStyle, hint: 'Если указан контакт поддержки' },
              { label: 'Реферальная система', text: btnReferralText, setT: setBtnReferralText, emoji: btnReferralEmoji, setE: setBtnReferralEmoji, style: btnReferralStyle, setS: setBtnReferralStyle, hint: 'Для зарегистрированных' },
            ].map(({ label, text, setT, emoji, setE, style, setS, hint }) => (
              <div key={label} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <div className="flex items-center gap-1.5">
                    {([['', '#2b3d4f', 'Обычный'], ['primary', '#5288c1', 'Синий'], ['success', '#4cae4c', 'Зелёный'], ['danger', '#e53935', 'Красный']] as [string, string, string][]).map(([v, color, title]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setS(v)}
                        title={title}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          style === v ? 'ring-2 ring-offset-1 ring-ring scale-110' : 'opacity-50 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color, borderColor: v ? color : '#3a4f63' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setT(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setE(e.target.value)}
                    placeholder="Emoji ID"
                    className="w-32 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-none">{hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referral page button cards */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Кнопки «Реферальная система»</label>
          <div className="rounded-lg border border-input divide-y divide-input overflow-hidden">
            {[
              { label: 'Поделиться с другом', text: btnShareText, setT: setBtnShareText, emoji: btnShareEmoji, setE: setBtnShareEmoji, style: btnShareStyle, setS: setBtnShareStyle },
              { label: 'Назад в меню', text: btnBackText, setT: setBtnBackText, emoji: btnBackEmoji, setE: setBtnBackEmoji, style: btnBackStyle, setS: setBtnBackStyle },
            ].map(({ label, text, setT, emoji, setE, style, setS }) => (
              <div key={label} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <div className="flex items-center gap-1.5">
                    {([['', '#2b3d4f', 'Обычный'], ['primary', '#5288c1', 'Синий'], ['success', '#4cae4c', 'Зелёный'], ['danger', '#e53935', 'Красный']] as [string, string, string][]).map(([v, color, title]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setS(v)}
                        title={title}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          style === v ? 'ring-2 ring-offset-1 ring-ring scale-110' : 'opacity-50 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color, borderColor: v ? color : '#3a4f63' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setT(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setE(e.target.value)}
                    placeholder="Emoji ID"
                    className="w-32 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            ))}
            <div className="p-3">
              <label className="text-xs text-muted-foreground block mb-1">Текст при шаре</label>
              <input
                type="text"
                value={shareText}
                onChange={(e) => setShareText(e.target.value)}
                className="w-full px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Советую этот VPN — быстрый и надёжный! 🛡️"
              />
            </div>
          </div>
        </div>

        </div>{/* /editor */}

        {/* Desktop preview — sticky sidebar */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-4 space-y-3">
            <label className="text-sm font-medium text-foreground">Предпросмотр</label>
            <div className="rounded-xl bg-[#17212b] p-4">
              <div className="bg-[#182533] rounded-2xl rounded-tl-sm px-3 py-2.5 mb-2">
                <div
                  className="text-[#e8e8e8] text-sm leading-relaxed [&_b]:font-semibold [&_i]:italic [&_u]:underline [&_s]:line-through [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-[#5288c1] [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_blockquote]:text-[#9bb6d4]"
                  dangerouslySetInnerHTML={{ __html: welcomeText.replace(/{name}/g, 'Иван').replace(/\n/g, '<br>') }}
                />
                <div className="text-[10px] text-[#6c8fa6] text-right mt-1">12:00</div>
              </div>
              <div className="space-y-1">
                {[
                  { text: btnOpenText, style: btnOpenStyle },
                  ...(btnSupportText ? [{ text: btnSupportText, style: btnSupportStyle }] : []),
                  { text: btnReferralText, style: btnReferralStyle },
                ].map((btn, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 text-center text-sm font-medium cursor-default select-none ${
                    btn.style === 'primary' ? 'bg-[#5288c1] text-white' :
                    btn.style === 'success' ? 'bg-[#4cae4c] text-white' :
                    btn.style === 'danger' ? 'bg-[#e53935] text-white' :
                    'bg-[#2b3d4f] text-[#e8e8e8]'
                  }`}>{btn.text}</div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">«Поддержка» видна, если указан контакт.</p>
          </div>
        </div>

      </div>{/* /flex */}
    </div>{/* /start section */}
    </>
  );
}
