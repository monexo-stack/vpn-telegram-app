import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Copy, Check, Trash2, Loader2, ExternalLink, Calendar, Key as KeyIcon,
  User, Globe, Server as ServerIcon, Wifi, WifiOff, Ban,
  Shield, Clock, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';
import { apiClient, KeyDetails, DeviceHistoryItem } from '../services/api';
import { useKeyConnections } from '../hooks/useKeyConnections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { useBackButton } from '../hooks/useBackButton';

interface KeyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyId: number;
  onDelete?: (keyId: number) => void;
}

interface DeviceLocationData {
  location_id: number;
  location_name: string;
  location_flag: string;
  server_id: number;
  status: string;
  client_email?: string;
  is_online?: boolean;
  online_ips?: string[];
  online_ip_count?: number;
  banned_ips?: string[];
  error?: string;
}

interface DevicesData {
  subscription_token: string;
  total_online_ips: number;
  device_limit: number;
  is_over_limit: boolean;
  locations: DeviceLocationData[];
}

export function KeyDetailsModal({ isOpen, onClose, keyId, onDelete }: KeyDetailsModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [keyDetails, setKeyDetails] = useState<KeyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [devicesData, setDevicesData] = useState<DevicesData | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [unbanningIP, setUnbanningIP] = useState<string | null>(null);
  const [banningIP, setBanningIP] = useState<string | null>(null);
  const [banConfirm, setBanConfirm] = useState<{ serverId: number; ip: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Живой таймер обратного отсчёта
  useEffect(() => {
    if (!keyDetails?.expires_at) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const expiresAt = new Date(keyDetails.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [keyDetails?.expires_at]);

  const formatTimeRemaining = useCallback((seconds: number): string => {
    if (seconds <= 0) return 'Истекла';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) {
      if (days === 1) return `1 день ${hours}ч`;
      if (days < 5) return `${days} дня ${hours}ч`;
      return `${days} дней`;
    }
    if (hours > 0) return `${hours}ч ${minutes}м`;
    if (minutes > 0) return `${minutes}м ${secs}с`;
    return `${secs}с`;
  }, []);

  const getTimeRemainingColor = useCallback((seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return 'border-red-500/50 text-red-500';
    if (seconds < 3600) return 'border-red-500/50 text-red-500';
    if (seconds < 86400) return 'border-orange-500/50 text-orange-500';
    if (seconds < 3 * 86400) return 'border-orange-500/50 text-orange-500';
    if (seconds < 7 * 86400) return 'border-yellow-500/50 text-yellow-500';
    return 'border-green-500/50 text-green-500';
  }, []);

  // Real-time подключения через WebSocket
  const telegramId = keyDetails?.user?.tgid;
  const { connections: wsConnections, uniqueIps: wsOnlineIps, isConnected: wsConnected } = useKeyConnections(telegramId);

  // Группируем WebSocket подключения по server_id
  const wsConnectionsByServer = useMemo(() => {
    const map = new Map<number, { ips: Set<string>; emails: Set<string>; isOnline: boolean }>();
    for (const conn of wsConnections) {
      if (!map.has(conn.serverId)) {
        map.set(conn.serverId, { ips: new Set(), emails: new Set(), isOnline: false });
      }
      const entry = map.get(conn.serverId)!;
      entry.isOnline = true;
      const ipsToAdd = conn.allIps && conn.allIps.length > 0
        ? conn.allIps
        : (conn.clientIp && conn.clientIp !== 'online' && conn.clientIp !== 'traffic-detected'
          ? [conn.clientIp]
          : []);
      for (const ip of ipsToAdd) {
        if (ip && ip !== 'online' && ip !== 'traffic-detected') {
          entry.ips.add(ip);
        }
      }
      entry.emails.add(conn.clientEmail);
    }
    return map;
  }, [wsConnections]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  useEffect(() => {
    if (isOpen && keyId) {
      fetchKeyDetails();
    }
  }, [isOpen, keyId]);

  const fetchKeyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await apiClient.getKeyDetails(keyId);
      setKeyDetails(details);
      if (details.subscription_token) {
        fetchDevicesData(details.subscription_token);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки данных ключа');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevicesData = async (token: string) => {
    try {
      setDevicesLoading(true);
      const result = await apiClient.getSubscriptionOnlineDevices(token);
      setDevicesData(result);
    } catch (err: any) {
      console.error('Error fetching devices data:', err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleUnbanIP = async (serverId: number, ip: string) => {
    try {
      setUnbanningIP(ip);
      const result = await apiClient.unbanIP(serverId, ip);
      if (result.success) {
        toast.success(`IP ${ip} разбанен`);
        await fetchKeyDetails();
        if (keyDetails?.subscription_token) {
          await fetchDevicesData(keyDetails.subscription_token);
        }
      } else {
        toast.error(result.message || 'Ошибка разбана IP');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка разбана IP');
    } finally {
      setUnbanningIP(null);
    }
  };

  const handleBanIP = async (serverId: number, ip: string) => {
    try {
      setBanningIP(ip);
      setBanConfirm(null);
      const result = await apiClient.banIP(serverId, ip);
      if (result.success) {
        toast.success(`IP ${ip} забанен`);
        await fetchKeyDetails();
        if (keyDetails?.subscription_token) {
          await fetchDevicesData(keyDetails.subscription_token);
        }
      } else {
        toast.error(result.message || 'Ошибка бана IP');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка бана IP');
    } finally {
      setBanningIP(null);
    }
  };

  const formatTimeAgo = useCallback((dateString: string): string => {
    // Backend sends UTC without 'Z' suffix — ensure correct parsing
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);
    if (diffSec < 60) return 'только что';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}м назад`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}ч назад`;
    if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}д назад`;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const handleDelete = async () => {
    if (!keyDetails) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteKey(keyId);
      toast.success('Ключ удалён');
      onDelete?.(keyId);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка при удалении ключа');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} variant="fullscreen">
        <DialogContent hideCloseButton className="sm:max-w-[700px] sm:max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
            {loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <DialogTitle className="text-xl">Загрузка...</DialogTitle>
              </div>
            ) : error ? (
              <DialogTitle className="text-xl text-destructive">Ошибка</DialogTitle>
            ) : keyDetails ? (
              <>
                <div className="flex items-center gap-2 flex-wrap pr-8">
                  <DialogTitle className="text-xl flex items-center gap-2">
                    Ключ #{keyId}
                    {wsConnections.length > 0 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                      </span>
                    )}
                  </DialogTitle>
                  <Badge variant="outline" className={cn("text-xs",
                    keyDetails.user?.subscription_active
                      ? 'border-green-500/50 text-green-500'
                      : 'border-orange-500/50 text-orange-500'
                  )}>
                    {keyDetails.user?.subscription_active ? 'Активна' : 'Истекла'}
                  </Badge>
                </div>

                <DialogDescription className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {keyDetails.user?.username ? (
                    <button
                      onClick={() => copyToClipboard(`@${keyDetails.user.username}`, 'username')}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <a
                        href={`https://t.me/${keyDetails.user.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        @{keyDetails.user.username}
                      </a>
                      {copiedField === 'username' ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  ) : keyDetails.user?.fullname ? (
                    <span className="text-sm text-muted-foreground">{keyDetails.user.fullname}</span>
                  ) : null}
                  <button
                    onClick={() => copyToClipboard(String(keyDetails.user?.tgid || ''), 'tgid')}
                    className="flex items-center gap-1.5 text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors group"
                  >
                    <code>ID: {keyDetails.user?.tgid}</code>
                    {copiedField === 'tgid' ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </DialogDescription>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {keyDetails.subscription_token && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(keyDetails.subscription_token || '', 'token')}
                      className="h-9 sm:h-8 gap-1.5 flex-1 sm:flex-none"
                    >
                      {copiedField === 'token' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Токен
                    </Button>
                  )}
                  {keyDetails.subscription_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(keyDetails.subscription_url || '', 'url')}
                      className="h-9 sm:h-8 gap-1.5 flex-1 sm:flex-none"
                    >
                      {copiedField === 'url' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      URL
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="h-9 sm:h-8 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Удалить
                  </Button>
                </div>
              </>
            ) : null}
          </DialogHeader>

          {/* Content — всё на одной странице */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-safe overscroll-contain">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive text-sm">
                {error}
              </div>
            )}

            {keyDetails && !loading && (
              <>
                {/* Stats Row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
                    <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                    {keyDetails.expires_at ? (
                      <span className={cn(
                        'text-xs font-medium font-mono',
                        timeRemaining !== null && timeRemaining <= 0 ? 'text-red-500' :
                        timeRemaining !== null && timeRemaining < 3 * 86400 ? 'text-orange-500' :
                        'text-foreground'
                      )}>
                        {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : '—'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">
                      {keyDetails.plan?.name || (keyDetails.trial_period ? 'Пробный' : keyDetails.free_key ? 'Бесплатный' : 'Платный')}
                    </span>
                  </div>
                  <div className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2",
                    wsConnections.length > 0 ? 'border-green-500/30 bg-green-500/5' : 'bg-card'
                  )}>
                    <Wifi className={cn("w-3.5 h-3.5", wsConnections.length > 0 ? 'text-green-500' : 'text-muted-foreground')} />
                    <span className={cn("text-xs font-medium", wsConnections.length > 0 ? 'text-green-500' : 'text-muted-foreground')}>
                      {wsConnections.length > 0 ? (wsOnlineIps.length > 0 ? `${wsOnlineIps.length} IP` : 'Да') : 'Нет'}
                    </span>
                  </div>
                </div>

                {/* Info List */}
                <div className="rounded-lg border divide-y">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Создана</span>
                    </div>
                    <span className="font-medium">{formatDate(keyDetails.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Истекает</span>
                    </div>
                    <span className="font-medium">{formatDate(keyDetails.expires_at)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm">Стоимость</span>
                    </div>
                    <span className="font-medium">
                      {keyDetails.plan?.price !== null && keyDetails.plan?.price !== undefined
                        ? (keyDetails.plan.price === 0 ? 'Бесплатно' : `${keyDetails.plan.price} \u20BD`)
                        : '—'
                      }
                    </span>
                  </div>
                </div>

                {/* Токен и URL */}
                {(keyDetails.subscription_token || keyDetails.subscription_url) && (
                  <div className="rounded-lg border divide-y">
                    {keyDetails.subscription_token && (
                      <button
                        onClick={() => copyToClipboard(keyDetails.subscription_token || '', 'token-full')}
                        className="flex items-center gap-2 p-3 w-full text-left hover:bg-muted/50 transition-colors group"
                      >
                        <KeyIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <code className="text-xs font-mono text-muted-foreground truncate flex-1">
                          {keyDetails.subscription_token}
                        </code>
                        {copiedField === 'token-full' ? (
                          <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </button>
                    )}
                    {keyDetails.subscription_url && (
                      <button
                        onClick={() => copyToClipboard(keyDetails.subscription_url || '', 'url-full')}
                        className="flex items-center gap-2 p-3 w-full text-left hover:bg-muted/50 transition-colors group"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <code className="text-xs font-mono text-muted-foreground truncate flex-1">
                          {keyDetails.subscription_url}
                        </code>
                        {copiedField === 'url-full' ? (
                          <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Локации */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    Локации ({keyDetails.locations.length})
                  </div>

                  {keyDetails.locations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">Нет доступных локаций</p>
                    </div>
                  ) : (
                    keyDetails.locations.map((location) => {
                      const deviceLocation = devicesData?.locations.find(
                        dl => dl.location_id === location.location_id
                      );

                      // WS online IPs for this location
                      const locationOnlineIPs = new Set<string>();
                      const locationServerIds: number[] = [];
                      let isLocationOnline = false;

                      for (const server of location.servers) {
                        const wsData = wsConnectionsByServer.get(server.server_id);
                        if (wsData) {
                          wsData.ips.forEach(ip => locationOnlineIPs.add(ip));
                          locationServerIds.push(server.server_id);
                          if (wsData.isOnline) isLocationOnline = true;
                        }
                      }
                      const serverIdForBan = deviceLocation?.server_id || locationServerIds[0] || location.servers[0]?.server_id;

                      // Merge device_history (DB) with WS online status
                      const locationHistory = (keyDetails.device_history || []).filter(
                        dh => dh.location_id === location.location_id
                      );

                      // Build merged IP list: DB history + any WS-only IPs
                      const mergedIPs: Array<{
                        ip: string;
                        isOnline: boolean;
                        isBanned: boolean;
                        lastSeen: string | null;
                        bannedAt: string | null;
                        banReason: string | null;
                      }> = [];
                      const seenIPs = new Set<string>();

                      for (const dh of locationHistory) {
                        seenIPs.add(dh.ip_address);
                        mergedIPs.push({
                          ip: dh.ip_address,
                          isOnline: locationOnlineIPs.has(dh.ip_address),
                          isBanned: dh.is_banned,
                          lastSeen: dh.last_seen_at,
                          bannedAt: dh.banned_at,
                          banReason: dh.ban_reason,
                        });
                      }
                      // Add WS-only IPs not in DB yet
                      for (const ip of locationOnlineIPs) {
                        if (!seenIPs.has(ip)) {
                          mergedIPs.push({
                            ip,
                            isOnline: true,
                            isBanned: false,
                            lastSeen: null,
                            bannedAt: null,
                            banReason: null,
                          });
                        }
                      }
                      // Sort: online first, then banned, then offline
                      mergedIPs.sort((a, b) => {
                        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
                        if (a.isBanned !== b.isBanned) return a.isBanned ? -1 : 1;
                        return 0;
                      });

                      const onlineCount = mergedIPs.filter(m => m.isOnline).length;
                      const bannedCount = mergedIPs.filter(m => m.isBanned).length;

                      return (
                        <div key={location.location_id} className="rounded-lg border bg-card overflow-hidden">
                          {/* Location header */}
                          <div className="p-3 flex items-center justify-between border-b bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg">
                                {location.flag}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{location.location_name}</span>
                                  {location.is_trial && (
                                    <Badge variant="outline" className="text-[10px] border-gray-500/50 text-gray-500">
                                      Пробная
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{location.country}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isLocationOnline ? (
                                <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-500 gap-1">
                                  <Wifi className="w-3 h-3" />
                                  {onlineCount > 0 ? `${onlineCount} IP` : 'Онлайн'}
                                </Badge>
                              ) : (
                                <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              {bannedCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500 gap-1">
                                  <Ban className="w-3 h-3" />
                                  {bannedCount}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Devices — all IPs from DB + WS */}
                          {mergedIPs.length > 0 && (
                            <div className="px-2 pt-2 space-y-1">
                              {mergedIPs.map((device) => (
                                <div
                                  key={device.ip}
                                  className={cn(
                                    "flex items-center justify-between px-2.5 py-1.5 rounded border",
                                    device.isBanned
                                      ? "bg-red-500/5 border-red-500/20"
                                      : device.isOnline
                                      ? "bg-green-500/5 border-green-500/20"
                                      : "bg-muted/30 border-border/50"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {device.isBanned ? (
                                      <Ban className="w-3 h-3 text-red-500 flex-shrink-0" />
                                    ) : device.isOnline ? (
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                    )}
                                    <code className={cn(
                                      "text-xs font-mono",
                                      device.isBanned ? "text-red-500" : device.isOnline ? "" : "text-muted-foreground"
                                    )}>{device.ip}</code>
                                    {device.isBanned ? (
                                      <span className="text-[10px] text-red-400 flex-shrink-0">заблокирован</span>
                                    ) : !device.isOnline && device.lastSeen ? (
                                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                        {formatTimeAgo(device.lastSeen)}
                                      </span>
                                    ) : null}
                                  </div>
                                  {device.isBanned ? (
                                    <button
                                      onClick={() => serverIdForBan && handleUnbanIP(serverIdForBan, device.ip)}
                                      disabled={unbanningIP === device.ip}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-green-500 hover:bg-green-500/10 transition-colors flex-shrink-0"
                                    >
                                      {unbanningIP === device.ip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                                      Разбанить
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => serverIdForBan && setBanConfirm({ serverId: serverIdForBan, ip: device.ip })}
                                      disabled={banningIP === device.ip}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                    >
                                      {banningIP === device.ip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                                      Забанить
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Servers */}
                          <div className="p-2 space-y-1.5">
                            {location.servers.map((server) => (
                              <div key={server.server_id} className="rounded bg-muted/30 overflow-hidden">
                                <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
                                  <ServerIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{server.server_name || server.server_ip}</span>
                                    {server.server_ip && server.server_name && (
                                      <span className="text-[10px] font-mono text-muted-foreground">{server.server_ip}</span>
                                    )}
                                  </div>
                                  <Badge variant="outline" className={cn(
                                    'text-[10px] flex-shrink-0',
                                    server.vpn_type_name === 'Outline'
                                      ? 'border-blue-500/50 text-blue-500'
                                      : server.vpn_type_name === 'VLESS'
                                      ? 'border-purple-500/50 text-purple-500'
                                      : 'border-green-500/50 text-green-500'
                                  )}>
                                    {server.vpn_type_name}
                                  </Badge>
                                  <span className={cn(
                                    'inline-flex items-center gap-1 text-[10px] ml-auto flex-shrink-0',
                                    server.status === 'online' ? 'text-green-500' : 'text-red-500'
                                  )}>
                                    <span className={cn(
                                      'w-1.5 h-1.5 rounded-full',
                                      server.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                                    )} />
                                    {server.status === 'online' ? 'Работает' : 'Не работает'}
                                  </span>
                                </div>
                                {server.config && (
                                  <button
                                    onClick={() => copyToClipboard(server.config || '', `config-${server.server_id}`)}
                                    className="flex items-center gap-2 w-full px-2.5 py-1.5 border-t border-border/50 hover:bg-muted/50 transition-colors group"
                                  >
                                    <KeyIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <code className="text-[10px] font-mono text-muted-foreground truncate flex-1 text-left">
                                      {server.config}
                                    </code>
                                    {copiedField === `config-${server.server_id}` ? (
                                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        title="Удалить ключ?"
        description={`Вы уверены, что хотите удалить ключ #${keyDetails?.id}? Это действие необратимо.`}
        confirmText="Удалить"
        variant="danger"
        loading={isDeleting}
      />

      <ConfirmDialog
        open={!!banConfirm}
        onOpenChange={(open) => !open && setBanConfirm(null)}
        onConfirm={() => {
          if (banConfirm) {
            handleBanIP(banConfirm.serverId, banConfirm.ip);
          }
        }}
        title="Забанить IP?"
        description={`Вы уверены, что хотите забанить IP ${banConfirm?.ip}? Устройство с этим IP потеряет доступ к VPN.`}
        confirmText="Забанить"
        variant="danger"
        loading={banningIP === banConfirm?.ip}
      />
    </>
  );
}
