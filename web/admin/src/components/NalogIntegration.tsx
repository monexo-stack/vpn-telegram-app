import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Check, X, CircleCheck,
  Phone, Shield, Send, ToggleLeft, ToggleRight, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../services/api';
import { useMiniApp } from '../context/MiniAppContext';
import { cn } from './ui/utils';

interface NalogSettings {
  nalog_token: string;
  nalog_phone: string;
  nalog_inn: string;
  nalog_enabled: boolean;
  nalog_send_to_user: boolean;
  nalog_service_name: string;
  nalog_default_delivery: 'telegram' | 'none';
}


export function NalogIntegration() {
  const { isMiniApp } = useMiniApp();

  // Connection state
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState('');
  const [inn, setInn] = useState('');

  // SMS flow
  const [smsStep, setSmsStep] = useState<'idle' | 'sms_sent'>('idle');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');

  // Settings
  const [enabled, setEnabled] = useState(false);
  const [sendToUser, setSendToUser] = useState(false);
  const [serviceName, setServiceName] = useState('Подписка VPN');
  const [saving, setSaving] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);

  // Per-payment system toggles
  const [nalogYookassa, setNalogYookassa] = useState(true);
  const [nalogStars, setNalogStars] = useState(true);
  const [nalogCryptobot, setNalogCryptobot] = useState(false);
  const [nalogYoomoney, setNalogYoomoney] = useState(true);

  // Which payment systems are enabled (from settings)
  const [enabledPaymentSystems, setEnabledPaymentSystems] = useState<Record<string, boolean>>({});


  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSettings();
      const s = data.settings || data;

      const hasToken = !!(s.nalog_token && s.nalog_token !== '' && s.nalog_token !== '***configured***');
      setConnected(hasToken);
      setPhone(s.nalog_phone || '');
      setInn(s.nalog_inn || '');
      setEnabled(s.nalog_enabled === true || s.nalog_enabled === 'true');
      setSendToUser(s.nalog_send_to_user === true || s.nalog_send_to_user === 'true');
      setServiceName(s.nalog_service_name || 'Подписка VPN');
      // Per-payment system toggles (default: true for all except cryptobot)
      setNalogYookassa(s.nalog_yookassa !== false && s.nalog_yookassa !== 'false');
      setNalogStars(s.nalog_stars !== false && s.nalog_stars !== 'false');
      setNalogCryptobot(s.nalog_cryptobot === true || s.nalog_cryptobot === 'true');
      setNalogYoomoney(s.nalog_yoomoney !== false && s.nalog_yoomoney !== 'false');

      // Which payment systems are configured
      setEnabledPaymentSystems({
        yookassa: !!(s.yookassa_enabled === true || s.yookassa_enabled === 'true'),
        stars: !!(s.telegram_stars_enabled === true || s.telegram_stars_enabled === 'true'),
        cryptobot: !!(s.cryptobot_enabled === true || s.cryptobot_enabled === 'true'),
        yoomoney: !!(s.yoomoney_enabled === true || s.yoomoney_enabled === 'true'),
      });

      if (!hasToken) {
        setSmsPhone(s.nalog_phone || '');
      }
    } catch (e) {
      console.error('Failed to load nalog settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRequestSMS = async () => {
    if (!smsPhone.trim()) return;
    setSmsLoading(true);
    setSmsError('');
    try {
      const res = await fetch('/api/settings/nalog/sms/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ phone: smsPhone }),
      });
      if (!res.ok && res.status >= 500) { setSmsError(`Ошибка сервера (${res.status})`); return; }
      const data = await res.json();
      if (data?.ok) {
        setChallengeToken(data.challengeToken || '');
        setSmsStep('sms_sent');
        toast.success('SMS-код отправлен');
      } else {
        setSmsError(data.error || 'Ошибка отправки SMS');
      }
    } catch {
      setSmsError('Ошибка сети');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleVerifySMS = async () => {
    if (!smsCode.trim()) return;
    setSmsLoading(true);
    setSmsError('');
    try {
      const res = await fetch('/api/settings/nalog/sms/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ phone: smsPhone, code: smsCode, challengeToken }),
      });
      if (!res.ok && res.status >= 500) { setSmsError(`Ошибка сервера (${res.status})`); return; }
      const data = await res.json();
      if (data?.ok) {
        setConnected(true);
        setPhone(smsPhone);
        setInn(data.inn || '');
        setSmsStep('idle');
        setSmsCode('');
        setChallengeToken('');
        toast.success('Мой Налог подключён');
      } else {
        setSmsError(data.error || data.detail || 'Неверный код');
      }
    } catch {
      setSmsError('Ошибка сети');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setSmsLoading(true);
    try {
      await fetch('/api/settings/nalog/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
      });
      setConnected(false);
      setPhone('');
      setInn('');
      setEnabled(false);
      setSendToUser(false);
      setSmsPhone('');
      toast.success('Мой Налог отключён');
    } catch {
      toast.error('Ошибка отключения');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await apiClient.updateSettings({
        nalog_enabled: enabled,
        nalog_send_to_user: sendToUser,
        nalog_service_name: serviceName,
        nalog_default_delivery: sendToUser ? 'telegram' : 'none',
        nalog_yookassa: nalogYookassa,
        nalog_stars: nalogStars,
        nalog_cryptobot: nalogCryptobot,
        nalog_yoomoney: nalogYoomoney,
      });
      setSettingsChanged(false);
      toast.success('Настройки сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn(isMiniApp ? 'p-3 space-y-4' : 'space-y-6 max-w-3xl')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Мой Налог</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Автоматические чеки для самозанятых через ФНС
          </p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              enabled
                ? "bg-green-500/10 text-green-600"
                : "bg-muted text-muted-foreground"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", enabled ? "bg-green-500" : "bg-muted-foreground")} />
              {enabled ? 'Активно' : 'Выключено'}
            </span>
          </div>
        )}
      </div>

      {/* Connection Card */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Подключение</span>
        </div>

        <div className="p-4">
          {connected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Телефон</div>
                  <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {phone || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">ИНН</div>
                  <div className="text-sm font-medium text-foreground">{inn || 'Не определён'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CircleCheck className="w-3.5 h-3.5" /> Подключено к ФНС
                </span>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={smsLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-destructive/40 text-destructive rounded-md hover:bg-destructive/5 disabled:opacity-50 transition-colors ml-auto"
                >
                  {smsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Отключить
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Подключите аккаунт самозанятого для автоматического формирования чеков при каждой оплате.
              </p>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Номер телефона (как в Мой Налог)</label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => { setSmsPhone(e.target.value); setSmsError(''); setSmsStep('idle'); }}
                  placeholder="79001234567"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={smsStep === 'sms_sent'}
                />
              </div>

              {smsStep === 'sms_sent' && (
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Код из SMS</label>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => { setSmsCode(e.target.value); setSmsError(''); }}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                </div>
              )}

              {smsError && (
                <p className="text-xs text-destructive">{smsError}</p>
              )}

              <div className="flex items-center gap-2">
                {smsStep === 'idle' ? (
                  <button
                    type="button"
                    disabled={smsLoading || !smsPhone.trim()}
                    onClick={handleRequestSMS}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {smsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Получить SMS
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={smsLoading || !smsCode.trim()}
                      onClick={handleVerifySMS}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {smsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Подтвердить
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSmsStep('idle'); setSmsCode(''); setSmsError(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Изменить номер
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Card — only if connected */}
      {connected && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Настройки чеков</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Toggle: создание чеков */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Автоматические чеки</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Создавать чек в ФНС при каждой успешной оплате
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEnabled(!enabled); setSettingsChanged(true); }}
                className="text-foreground"
              >
                {enabled
                  ? <ToggleRight className="w-8 h-8 text-green-500" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                }
              </button>
            </div>

            {/* Toggle: отправка юзеру */}
            <div className={cn("flex items-center justify-between transition-opacity", !enabled && "opacity-40 pointer-events-none")}>
              <div>
                <div className="text-sm font-medium text-foreground">Отправлять чек клиенту</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Клиент сможет выбрать: Telegram или отказаться
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSendToUser(!sendToUser); setSettingsChanged(true); }}
                className="text-foreground"
              >
                {sendToUser
                  ? <ToggleRight className="w-8 h-8 text-green-500" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                }
              </button>
            </div>

            {/* Service name */}
            <div className={cn("transition-opacity", !enabled && "opacity-40 pointer-events-none")}>
              <label className="text-xs font-medium text-foreground block mb-1">Название услуги в чеке</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => { setServiceName(e.target.value); setSettingsChanged(true); }}
                placeholder="Подписка VPN"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                В чеке будет: "{serviceName} на N мес."
              </p>
            </div>

            {/* Per-payment system toggles */}
            <div className={cn("transition-opacity", !enabled && "opacity-40 pointer-events-none")}>
              <label className="text-xs font-medium text-foreground block mb-2">Чеки по платёжным системам</label>
              <div className="space-y-2">
                {([
                  { key: 'yookassa', label: 'YooKassa', state: nalogYookassa, setter: setNalogYookassa },
                  { key: 'stars', label: 'Telegram Stars', state: nalogStars, setter: setNalogStars },
                  { key: 'cryptobot', label: 'CryptoBot', state: nalogCryptobot, setter: setNalogCryptobot },
                  { key: 'yoomoney', label: 'YooMoney', state: nalogYoomoney, setter: setNalogYoomoney },
                ] as const).filter(ps => enabledPaymentSystems[ps.key]).map(ps => (
                  <div key={ps.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/30">
                    <span className="text-sm text-foreground">{ps.label}</span>
                    <button
                      type="button"
                      onClick={() => { ps.setter(!ps.state); setSettingsChanged(true); }}
                      className="text-foreground"
                    >
                      {ps.state
                        ? <ToggleRight className="w-7 h-7 text-green-500" />
                        : <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                      }
                    </button>
                  </div>
                ))}
                {Object.values(enabledPaymentSystems).every(v => !v) && (
                  <p className="text-xs text-muted-foreground">Нет подключённых платёжных систем. Настройте их на вкладке Платежи.</p>
                )}
              </div>
            </div>


            {/* Save */}
            {settingsChanged && (
              <div className="flex justify-end pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Сохранить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
