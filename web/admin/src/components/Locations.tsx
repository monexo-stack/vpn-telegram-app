import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp, MoreVertical, Trash2, Pencil, Check, X, AlertTriangle, Zap, ExternalLink, Eye, EyeOff, Copy, Loader2, RefreshCw, Users, Cpu, MemoryStick, Gauge, ArrowUpDown, User, KeyRound, Wifi, WifiOff, Radio, Server, ChevronRight, Play, TrendingUp, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { LocationModal } from './LocationModal';
import { ServerModal } from './ServerModal';
import { ConfirmDialog } from './ui/confirm-dialog';
import { apiClient, Location as ApiLocation, Server as ApiServer } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { useMiniApp } from '../context/MiniAppContext';
import { cn } from './ui/utils';
import type { AgentComponents, ActiveConnection, SpeedtestEvent } from '../hooks/useServerWebSocket';

interface ServerType {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  load: number;
  users: number;
  maxUsers: number;
  bandwidth: string;
  x3ui_url?: string | null;
  x3ui_username?: string | null;
  x3ui_password?: string | null;
  cpuPercent?: number;
  ramUsed?: number;
  ramTotal?: number;
  diskUsed?: number;
  diskTotal?: number;
  trafficUpGb?: number;
  trafficDownGb?: number;
  // Агент
  agent_status?: 'online' | 'offline' | 'not_installed';
  agent_installed?: boolean;
  components?: AgentComponents;  // Статус компонентов агента
  // Raw API data for editing
  apiData?: ApiServer;
}

interface Location {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  flag: string;
  trafficLimitGb?: number | null;
  // type убран - в новой модели все локации единые
  servers: ServerType[];
  totalUsers: number;
  userTgids: number[];
}

interface SubscriptionPath {
  location_id: number;
  location_name: string;
  server_id: number;
  server_name?: string | null;
  server_ip?: string | null;
  active_users: number;
  max_space: number;
  load_percent: number;
}

// Преобразование API Location в компонент Location
// В новой модели все локации единые - isTrial параметр игнорируется
const mapApiLocationToComponent = async (apiLocation: ApiLocation): Promise<Location> => {
  // Получаем серверы для локации
  const servers = await apiClient.getServersByLocation(apiLocation.id);
  
  const mappedServers: ServerType[] = servers.map(server => {
    // Расчет заполненности сервера (users / max_space * 100)
    const usersCount = server.users_count || 0;
    const maxSpace = server.max_space || 1000;
    const occupancyPercentage = maxSpace > 0 ? Math.round((usersCount / maxSpace) * 100) : 0;

    return {
      id: server.id.toString(),
      name: server.name || server.location || server.ip || `Server ${server.id}`,
      ip: server.ip || 'N/A',
      status: (server.status || 'offline') as 'online' | 'offline' | 'maintenance' | 'degraded',
      load: occupancyPercentage, // Заполненность сервера
      users: usersCount,
      maxUsers: maxSpace,
      bandwidth: server.bandwidth || '—',
      x3ui_url: server.x3ui_url,
      x3ui_username: server.x3ui_username,
      x3ui_password: server.x3ui_password,
      cpuPercent: server.cpu_percent,
      ramUsed: server.ram_used,
      ramTotal: server.ram_total,
      diskUsed: server.disk_used,
      diskTotal: server.disk_total,
      trafficUpGb: server.traffic_up_gb,
      trafficDownGb: server.traffic_down_gb,
      // Агент
      agent_status: (server as any).agent_status || 'not_installed',
      agent_installed: (server as any).agent_installed || false,
      // Raw API data for editing
      apiData: server,
    };
  });

  return {
    id: apiLocation.id.toString(),
    name: apiLocation.name || apiLocation.country,  // Кастомное название (редактируемое)
    country: apiLocation.country || apiLocation.name,  // Название страны (не редактируется)
    countryCode: apiLocation.country_code || undefined,
    flag: apiLocation.flag || '🌍',
    trafficLimitGb: apiLocation.traffic_limit_gb,
    // type убран - в новой модели все локации единые
    servers: mappedServers,
    totalUsers: apiLocation.users_count || 0,
    userTgids: apiLocation.user_tgids || [],
  };
};

interface LocationsProps {
  isModalOpen?: boolean;
  setIsModalOpen?: (open: boolean) => void;
}

export function Locations({ isModalOpen, setIsModalOpen }: LocationsProps) {
  const navigate = useNavigate();
  // Mini App detection
  const { isMiniApp } = useMiniApp();

  // WebSocket для real-time обновлений
  const {
    servers: wsServers,
    isConnected: wsConnected,
    connectionStatus,
    activeConnections,
    onSpeedtestResult
  } = useWebSocket();

  // В новой модели все локации единые - один кэш
  const [locationsCache, setLocationsCache] = useState<Location[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<string[]>([]);

  // Используем пропсы для модального окна, если переданы, иначе внутреннее состояние
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isLocationModalOpen = isModalOpen !== undefined ? isModalOpen : internalModalOpen;
  const setIsLocationModalOpen = setIsModalOpen || setInternalModalOpen;
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [selectedLocationForServer, setSelectedLocationForServer] = useState<Location | null>(null);
  const [editingServer, setEditingServer] = useState<ServerType | null>(null);
  const [deletingServer, setDeletingServer] = useState<{ id: string; name: string; locationId: string } | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<{ id: string; name: string } | null>(null);
  const [restartingServerId, setRestartingServerId] = useState<string | null>(null);
  const [checkingServerId, setCheckingServerId] = useState<string | null>(null);
  const [speedtestServerId, setSpeedtestServerId] = useState<string | null>(null);
  const [installingAgentServerId, setInstallingAgentServerId] = useState<string | null>(null);
  const [premiumPaths, setPremiumPaths] = useState<SubscriptionPath[]>([]);
  const [trialPaths, setTrialPaths] = useState<SubscriptionPath[]>([]);
  const [provisioningLocations, setProvisioningLocations] = useState<Record<string, { status: string; progress: number; created: number; failed: number; total: number }>>({});
  const [provisioningLoading, setProvisioningLoading] = useState<string | null>(null);
  const [rebalancingLocation, setRebalancingLocation] = useState<string | null>(null);
  const [togglingMaintenanceServerId, setTogglingMaintenanceServerId] = useState<string | null>(null);
  const pollingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Используем кэшированные данные с интеграцией WebSocket
  // В новой модели все локации единые
  const locations = useMemo(() => {
    // Мерджим данные от WebSocket с API данными
    return locationsCache.map(location => ({
      ...location,
      servers: location.servers.map(server => {
        const wsServer = wsServers.get(parseInt(server.id));
        if (wsServer) {
          return {
            ...server,
            // Обновляем статус из WebSocket
            status: wsServer.status || server.status,
            agent_status: wsServer.agent_status || server.agent_status,
            // Обновляем метрики из WebSocket
            cpuPercent: wsServer.metrics?.cpu_percent ?? server.cpuPercent,
            ramUsed: wsServer.metrics?.ram_used_gb ?? server.ramUsed,
            ramTotal: wsServer.metrics?.ram_total_gb ?? server.ramTotal,
            diskUsed: wsServer.metrics?.disk_used_gb ?? server.diskUsed,
            diskTotal: wsServer.metrics?.disk_total_gb ?? server.diskTotal,
            // Компоненты агента
            components: wsServer.components ?? server.components,
          };
        }
        return server;
      })
    }));
  }, [locationsCache, wsServers]);

  const existingCountryCodes = useMemo(
    () => Array.from(new Set(locations.map(l => l.countryCode).filter(Boolean))) as string[],
    [locations]
  );

  // Загружаем все данные параллельно при монтировании
  useEffect(() => {
    loadAllLocations(true); // Первоначальная загрузка

    // С WebSocket обновления происходят в реальном времени
    // Polling используем только как fallback каждые 60 секунд
    const refreshInterval = setInterval(() => {
      loadAllLocations(); // Фоновое обновление
    }, 60000);

    return () => {
      clearInterval(refreshInterval);
      // Clean up all provisioning polling timers
      Object.values(pollingTimers.current).forEach(clearTimeout);
      pollingTimers.current = {};
    };
  }, []);

  // Тост при получении speedtest результата через WebSocket
  useEffect(() => {
    const unsub = onSpeedtestResult((event: SpeedtestEvent) => {
      const serverName = event.server_name || `#${event.server_id}`;
      if (event.auto_installed) {
        toast.success(`Speedtest установлен и завершён | ${serverName}: ${event.speed_formatted}`);
      } else {
        toast.info(`Speedtest ${serverName}: ${event.speed_formatted}`);
      }
    });
    return unsub;
  }, [onSpeedtestResult]);

  const loadAllLocations = async (isInitial = false) => {
    try {
      // В новой модели загружаем все локации одним запросом
      const [apiLocations, paths] = await Promise.all([
        apiClient.getLocations(),
        apiClient.getSubscriptionPaths()
      ]);

      const mappedLocations = await Promise.all(
        apiLocations.map(loc => mapApiLocationToComponent(loc))
      );

      setLocationsCache(mappedLocations);
      // В новой модели все пути в premium
      setPremiumPaths(paths.premium);
      setTrialPaths(paths.trial);

      // Check provisioning status for all locations on load
      for (const loc of mappedLocations) {
        try {
          const status = await apiClient.getProvisioningStatus(parseInt(loc.id));
          if (status?.tasks?.length > 0) {
            const latest = status.tasks[0];
            // Показываем бейдж только если running или завершён менее 1 часа назад
            const isRunning = latest.status === 'running';
            const completedAt = latest.completed_at ? new Date(latest.completed_at).getTime() : 0;
            const isRecent = completedAt > 0 && (Date.now() - completedAt) < 3600000; // 1 час
            if (isRunning || isRecent) {
              setProvisioningLocations(prev => ({
                ...prev,
                [loc.id]: {
                  status: latest.status,
                  progress: latest.progress,
                  created: latest.created_keys,
                  failed: latest.failed_keys,
                  total: latest.total_users
                }
              }));
            }
            if (status.has_running) {
              pollProvisioningStatus(loc.id);
            }
          }
        } catch {
          // ignore
        }
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки локаций');
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  };

  // В новой модели показываем все локации без фильтрации
  const filteredLocations = locations;

  const toggleLocation = (locationId: string) => {
    setExpandedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  // В новой модели используем единый список локаций
  const totalServers = locationsCache.reduce((sum, loc) => sum + loc.servers.length, 0);
  const totalUsers = new Set(locationsCache.flatMap(loc => loc.userTgids || [])).size;

  // Вычисляем метрики мониторинга
  const monitoringMetrics = useMemo(() => {
    const allServers = locations.flatMap(loc =>
      loc.servers.map(server => ({ ...server, locationName: loc.name, locationFlag: loc.flag }))
    );

    if (allServers.length === 0) {
      return {
        totalServers: 0,
        onlineServers: 0,
        agentsOnline: 0,
        agentsInstalled: 0,
        problematicServers: [],
        problematicCount: 0,
        availableSubscriptions: 0,
        bottleneckLocation: null,
      };
    }

    const onlineServers = allServers.filter(s => s.status === 'online').length;
    const agentsInstalled = allServers.filter(s => s.agent_installed).length;
    const agentsOnline = allServers.filter(s => s.agent_status === 'online').length;

    // Находим проблемные серверы
    const problematicServers = allServers.filter(s =>
      s.status === 'offline' ||
      s.status === 'degraded' ||
      (s.agent_installed && s.agent_status === 'offline')
    );

    // Сколько подписок ещё можно продать = минимум свободных мест по локациям
    // (1 подписка = 1 ключ на каждую локацию, узкое место — самая заполненная)
    const locationsWithCapacity = locations
      .filter(loc => loc.servers.some(s => s.status === 'online'))
      .map(loc => {
        const onlineInLoc = loc.servers.filter(s => s.status === 'online');
        const free = onlineInLoc.reduce((sum, s) => sum + Math.max(0, (s.maxUsers || 0) - (s.users || 0)), 0);
        return { name: loc.name, flag: loc.flag, free };
      });

    const availableSubscriptions = locationsWithCapacity.length > 0
      ? Math.min(...locationsWithCapacity.map(l => l.free))
      : 0;
    const bottleneckLocation = locationsWithCapacity.length > 0
      ? locationsWithCapacity.reduce((min, l) => l.free < min.free ? l : min)
      : null;

    return {
      totalServers: allServers.length,
      onlineServers,
      agentsInstalled,
      agentsOnline,
      problematicServers,
      problematicCount: problematicServers.length,
      availableSubscriptions,
      bottleneckLocation,
    };
  }, [locations]);

  // В новой модели все пути в одном списке
  const currentPaths = [...premiumPaths, ...trialPaths];

  const handleSaveLocation = async () => {
    try {
      await loadAllLocations();
      setIsLocationModalOpen(false);
    } catch {
      setIsLocationModalOpen(false);
    }
  };

  const handleSaveServer = async (server: any) => {
    try {
      if (editingServer) {
        // Режим редактирования
        const serverId = parseInt(editingServer.id);
        const updateData: any = {
          ip: server.ip,
          login: server.sshUsername || 'root',
          x3ui_url: server.panelUrl,
          x3ui_username: server.panelLogin,
          x3ui_password: server.panelPassword || undefined,
          max_space: parseInt(server.maxUsers) || 100,
          inbound_id: parseInt(server.inbound) || 0,
          bandwidth: server.bandwidth || null,
        };
        if (server.sshKey) {
          updateData.ssh_key = server.sshKey;
        } else if (server.password) {
          updateData.password = server.password;
        }
        await apiClient.updateServer(serverId, updateData);
      } else if (selectedLocationForServer) {
        // Режим создания
        const locationId = parseInt(selectedLocationForServer.id);
        const createData: any = {
          ip: server.ip,
          login: server.sshUsername || 'root',
          x3ui_url: server.panelUrl,
          x3ui_username: server.panelLogin,
          x3ui_password: server.panelPassword,
          max_space: parseInt(server.maxUsers) || 100,
          inbound_id: parseInt(server.inbound) || 0,
          status: 'online',
          type_vpn: 1,
          connection_method: 0,
          bandwidth: server.bandwidth || null,
        };
        if (server.sshKey) {
          createData.ssh_key = server.sshKey;
        } else {
          createData.password = server.password;
        }
        await apiClient.createServer(locationId, createData);
      }
      // Обновляем список локаций
      await loadAllLocations();
      setIsServerModalOpen(false);
      setSelectedLocationForServer(null);
      setEditingServer(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения сервера');
    }
  };

  // Обработчик редактирования сервера
  const handleEditServer = (server: ServerType, location: Location) => {
    setEditingServer(server);
    setSelectedLocationForServer(location);
    setIsServerModalOpen(true);
  };

  // Обработчик удаления сервера
  const handleDeleteServer = async () => {
    if (!deletingServer) return;

    try {
      await apiClient.deleteServer(parseInt(deletingServer.id));
      await loadAllLocations();
      setDeletingServer(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка удаления сервера');
    }
  };

  // Обработчик перезагрузки Xray
  const handleRestartXray = async (serverId: string) => {
    setRestartingServerId(serverId);
    try {
      const result = await apiClient.restartXray(parseInt(serverId));
      if (result.success) {
        toast.success('Xray успешно перезагружен');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка перезагрузки Xray');
    } finally {
      setRestartingServerId(null);
    }
  };

  // Обработчик принудительной проверки сервера
  const handleForceCheck = async (serverId: string) => {
    setCheckingServerId(serverId);
    try {
      const result = await apiClient.forceServerCheck(parseInt(serverId), 'FULL');
      if (result.success) {
        const statusEmoji = result.status === 'online' ? '🟢' : result.status === 'degraded' ? '🟡' : '🔴';
        const latencyInfo = result.ssh_latency_ms ? ` | SSH: ${result.ssh_latency_ms.toFixed(0)}ms` : '';
        toast.success(`${statusEmoji} ${result.server_name}: ${result.status}${latencyInfo}`);
        // Обновляем данные после проверки
        await loadAllLocations();
      } else {
        toast.error(result.error_message || 'Проверка не удалась');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка проверки сервера');
    } finally {
      setCheckingServerId(null);
    }
  };

  // Обработчик теста скорости
  const handleSpeedtest = async (serverId: string) => {
    setSpeedtestServerId(serverId);
    try {
      const result = await apiClient.runServerSpeedtest(parseInt(serverId));
      if (result.success && result.bandwidth) {
        toast.success(`Speedtest завершён | Канал: ${result.bandwidth}`);
        // Обновляем данные после проверки
        await loadAllLocations();
      } else {
        toast.error(result.error || 'Speedtest не удался');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка speedtest');
    } finally {
      setSpeedtestServerId(null);
    }
  };

  // Обработчик установки агента
  const handleInstallAgent = async (serverId: string) => {
    setInstallingAgentServerId(serverId);
    try {
      const result = await apiClient.installAgent(parseInt(serverId));
      if (result.success) {
        toast.success('Агент установлен успешно');
        await loadAllLocations();
      } else {
        toast.error(result.message || 'Ошибка установки агента');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка установки агента');
    } finally {
      setInstallingAgentServerId(null);
    }
  };

  const handleToggleMaintenance = async (serverId: string, currentStatus: string) => {
    setTogglingMaintenanceServerId(serverId);
    try {
      if (currentStatus === 'maintenance') {
        // Включаем сервер
        await apiClient.toggleServerStatus(parseInt(serverId), 'online');
        toast.success('Сервер включён');
      } else {
        // Отключаем сервер (maintenance)
        await apiClient.toggleServerStatus(parseInt(serverId), 'maintenance');
        toast.success('Сервер отключён — конфиги скрыты из подписок');
      }
      await loadAllLocations();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка переключения сервера');
    } finally {
      setTogglingMaintenanceServerId(null);
    }
  };

  const handleRebalance = async (locationId: string) => {
    setRebalancingLocation(locationId);
    try {
      await apiClient.rebalanceLocation(parseInt(locationId));
      toast.success('Ребалансировка запущена');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка запуска ребалансировки');
    } finally {
      // Через 3 сек снимаем loading и обновляем данные
      setTimeout(() => {
        setRebalancingLocation(null);
        loadAllLocations();
      }, 3000);
    }
  };

  const handleProvisionKeys = async (locationId: string) => {
    setProvisioningLoading(locationId);
    try {
      await apiClient.provisionKeys(parseInt(locationId));
      toast.success('Провижининг запущен');
      // Start polling for status
      pollProvisioningStatus(locationId);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('Провижининг уже запущен для этой локации');
      } else {
        toast.error(err?.response?.data?.detail || 'Ошибка запуска провижининга');
      }
    } finally {
      setProvisioningLoading(null);
    }
  };

  const pollProvisioningStatus = useCallback((locationId: string) => {
    // Clear existing timer for this location
    if (pollingTimers.current[locationId]) {
      clearTimeout(pollingTimers.current[locationId]);
    }

    const poll = async () => {
      try {
        const result = await apiClient.getProvisioningStatus(parseInt(locationId));
        if (result?.tasks?.length > 0) {
          const latest = result.tasks[0];
          setProvisioningLocations(prev => ({
            ...prev,
            [locationId]: {
              status: latest.status,
              progress: latest.progress,
              created: latest.created_keys,
              failed: latest.failed_keys,
              total: latest.total_users
            }
          }));
          if (result.has_running) {
            pollingTimers.current[locationId] = setTimeout(poll, 2000);
          } else {
            delete pollingTimers.current[locationId];
            await loadAllLocations();
          }
        }
      } catch {
        // ignore polling errors
      }
    };
    poll();
  }, []);

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return;

    try {
      // В новой модели is_trial не нужен
      await apiClient.deleteLocation(parseInt(deletingLocation.id));
      await loadAllLocations();
      toast.success('Локация удалена');
      setDeletingLocation(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка удаления локации');
    }
  };

  // Показываем загрузку только при первоначальной загрузке, когда нет данных
  if (initialLoading) {
    return (
      <div className="animate-in fade-in duration-300">
        {/* Skeleton metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4">
              <div className="h-3 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-7 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Skeleton location cards */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
                <div className="hidden sm:flex items-center gap-6">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="text-center">
                      <div className="h-6 w-8 bg-muted rounded animate-pulse mb-1 mx-auto" />
                      <div className="h-3 w-14 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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

  // Mini App View
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact stats row */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b">
          <div className="text-center">
            <div className={cn(
              "text-lg font-bold",
              monitoringMetrics.onlineServers === monitoringMetrics.totalServers ? 'text-green-500' :
              monitoringMetrics.onlineServers > 0 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {monitoringMetrics.onlineServers}/{monitoringMetrics.totalServers}
            </div>
            <div className="text-[10px] text-muted-foreground">Серверы</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "text-lg font-bold",
              monitoringMetrics.agentsOnline === monitoringMetrics.agentsInstalled && monitoringMetrics.agentsInstalled > 0 ? 'text-green-500' :
              monitoringMetrics.agentsOnline > 0 ? 'text-yellow-500' : 'text-muted-foreground'
            )}>
              {monitoringMetrics.agentsOnline}/{monitoringMetrics.agentsInstalled}
            </div>
            <div className="text-[10px] text-muted-foreground">Агенты</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "text-lg font-bold",
              monitoringMetrics.problematicCount === 0 ? 'text-green-500' :
              monitoringMetrics.problematicCount < 3 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {monitoringMetrics.problematicCount}
            </div>
            <div className="text-[10px] text-muted-foreground">Проблемы</div>
          </div>
        </div>

        {/* Locations list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {filteredLocations.map((location) => (
              <MiniAppLocationCard
                key={location.id}
                location={location}
                isExpanded={expandedLocations.includes(location.id)}
                onToggle={() => toggleLocation(location.id)}
                onAddServer={() => {
                  setSelectedLocationForServer(location);
                  setEditingServer(null);
                  setIsServerModalOpen(true);
                }}
                onDelete={() => setDeletingLocation({ id: location.id, name: location.name })}
                onEditServer={(server) => handleEditServer(server, location)}
                onDeleteServer={(server) => setDeletingServer({ id: server.id, name: server.name, locationId: location.id })}
                wsConnected={wsConnected}
              />
            ))}

            {filteredLocations.length === 0 && (
              <div className="text-center py-12">
                <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Нет локаций</p>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <LocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          onSave={handleSaveLocation}
          existingCountryCodes={existingCountryCodes}
        />

        <ServerModal
          isOpen={isServerModalOpen}
          onClose={() => {
            setIsServerModalOpen(false);
            setSelectedLocationForServer(null);
            setEditingServer(null);
          }}
          onSave={handleSaveServer}
          locationName={selectedLocationForServer ? `${selectedLocationForServer.flag} ${selectedLocationForServer.name}` : ''}
          server={editingServer?.apiData}
        />

        <ConfirmDialog
          open={deletingServer !== null}
          onOpenChange={(open) => !open && setDeletingServer(null)}
          onConfirm={handleDeleteServer}
          title={`Удалить сервер "${deletingServer?.name}"?`}
          description="Все ключи на этом сервере будут удалены. Это действие нельзя отменить."
          confirmText="Удалить"
          variant="danger"
        />

        <ConfirmDialog
          open={deletingLocation !== null}
          onOpenChange={(open) => !open && setDeletingLocation(null)}
          onConfirm={handleDeleteLocation}
          title={`Удалить локацию "${deletingLocation?.name}"?`}
          description="Все серверы и ключи в этой локации будут удалены. Это действие нельзя отменить."
          confirmText="Удалить"
          variant="danger"
        />
      </div>
    );
  }

  return (
    <div className="">
      {/* Метрики мониторинга */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Серверы онлайн */}
        <div className="bg-card rounded-lg border p-4 hover:scale-[1.02] transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              monitoringMetrics.onlineServers === monitoringMetrics.totalServers ? 'bg-green-500/10' :
              monitoringMetrics.onlineServers > 0 ? 'bg-yellow-500/10' : 'bg-red-500/10'
            )}>
              <Server className={cn(
                "w-4 h-4",
                monitoringMetrics.onlineServers === monitoringMetrics.totalServers ? 'text-green-500' :
                monitoringMetrics.onlineServers > 0 ? 'text-yellow-500' : 'text-red-500'
              )} />
            </div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Серверы</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            monitoringMetrics.onlineServers === monitoringMetrics.totalServers ? 'text-green-500' :
            monitoringMetrics.onlineServers > 0 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {monitoringMetrics.onlineServers} / {monitoringMetrics.totalServers}
          </div>
        </div>

        {/* Агенты онлайн */}
        <div className="bg-card rounded-lg border p-4 hover:scale-[1.02] transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              monitoringMetrics.agentsOnline === monitoringMetrics.agentsInstalled && monitoringMetrics.agentsInstalled > 0 ? 'bg-green-500/10' :
              monitoringMetrics.agentsOnline > 0 ? 'bg-yellow-500/10' : 'bg-muted'
            )}>
              <Shield className={cn(
                "w-4 h-4",
                monitoringMetrics.agentsOnline === monitoringMetrics.agentsInstalled && monitoringMetrics.agentsInstalled > 0 ? 'text-green-500' :
                monitoringMetrics.agentsOnline > 0 ? 'text-yellow-500' : 'text-muted-foreground'
              )} />
            </div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Агенты</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            monitoringMetrics.agentsOnline === monitoringMetrics.agentsInstalled && monitoringMetrics.agentsInstalled > 0 ? 'text-green-500' :
            monitoringMetrics.agentsOnline > 0 ? 'text-yellow-500' : 'text-muted-foreground'
          )}>
            {monitoringMetrics.agentsOnline} / {monitoringMetrics.agentsInstalled}
          </div>
        </div>

        {/* Проблемные серверы */}
        <div className="relative bg-card rounded-lg border p-4 group cursor-help hover:scale-[1.02] transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              monitoringMetrics.problematicCount === 0 ? 'bg-green-500/10' :
              monitoringMetrics.problematicCount < 3 ? 'bg-yellow-500/10' : 'bg-red-500/10'
            )}>
              <AlertTriangle className={cn(
                "w-4 h-4",
                monitoringMetrics.problematicCount === 0 ? 'text-green-500' :
                monitoringMetrics.problematicCount < 3 ? 'text-yellow-500' : 'text-red-500'
              )} />
            </div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Проблемы</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            monitoringMetrics.problematicCount === 0 ? 'text-green-500' :
            monitoringMetrics.problematicCount < 3 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {monitoringMetrics.problematicCount}
          </div>

          {/* Tooltip при наведении */}
          {monitoringMetrics.problematicCount > 0 && (
            <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-card border border-border rounded-xl shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
              <div className="text-sm font-semibold mb-3 text-foreground">Проблемные серверы:</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {monitoringMetrics.problematicServers.slice(0, 5).map((server: any) => (
                  <div key={server.id} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                    <span className="text-lg">{server.locationFlag || '🌍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-xs font-medium truncate">
                        {server.locationName} / {server.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {server.status === 'offline' && '🔴 Сервер offline'}
                        {server.status === 'degraded' && '🟡 Частично работает'}
                        {server.agent_installed && server.agent_status === 'offline' && ' • Агент offline'}
                      </div>
                    </div>
                  </div>
                ))}
                {monitoringMetrics.problematicCount > 5 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    +{monitoringMetrics.problematicCount - 5} ещё...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Доступные подписки */}
        <div className="relative bg-card rounded-lg border p-4 group cursor-help hover:scale-[1.02] transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              monitoringMetrics.availableSubscriptions > 100 ? 'bg-green-500/10' :
              monitoringMetrics.availableSubscriptions > 20 ? 'bg-yellow-500/10' : 'bg-red-500/10'
            )}>
              <KeyRound className={cn(
                "w-4 h-4",
                monitoringMetrics.availableSubscriptions > 100 ? 'text-green-500' :
                monitoringMetrics.availableSubscriptions > 20 ? 'text-yellow-500' : 'text-red-500'
              )} />
            </div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Свободно</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            monitoringMetrics.availableSubscriptions > 100 ? 'text-green-500' :
            monitoringMetrics.availableSubscriptions > 20 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {monitoringMetrics.availableSubscriptions}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            подписок
          </div>

          {/* Tooltip с узким местом */}
          {monitoringMetrics.bottleneckLocation && (
            <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-card border border-border rounded-xl shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
              <div className="text-xs text-muted-foreground mb-1">Узкое место:</div>
              <div className="text-sm font-medium text-foreground">
                {monitoringMetrics.bottleneckLocation.flag} {monitoringMetrics.bottleneckLocation.name}
              </div>
              <div className="text-xs text-muted-foreground">
                свободно {monitoringMetrics.bottleneckLocation.free} ключей
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Статистика - в новой модели все локации единые */}
      <div className="bg-card rounded-lg border mb-4">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Все локации</span>
            <span className="text-xs text-muted-foreground">({locations.length})</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{totalServers} серверов</span>
            <span>•</span>
            <span>{totalUsers} пользователей</span>
            <span>•</span>
            {/* WebSocket статус */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
              wsConnected ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}>
              <Radio className={`w-3 h-3 ${wsConnected ? 'animate-pulse' : ''}`} />
              {wsConnected ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Маршрут */}
      <div className="bg-card rounded-lg border mb-6 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Маршрут:</span>
          {currentPaths.length === 0 ? (
            <span className="text-muted-foreground">нет доступных серверов</span>
          ) : (
            <span className="text-foreground font-medium">
              {currentPaths.map((p) => p.server_name || p.server_ip).join(' → ')}
            </span>
          )}
        </div>
      </div>

      {/* Список локаций */}
      <div className="space-y-4">
        {filteredLocations.length === 0 && (
          <div className="bg-card rounded-lg border p-12 text-center">
            <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-1">Нет локаций</p>
            <p className="text-xs text-muted-foreground/60">Добавьте первую локацию, чтобы начать</p>
          </div>
        )}
        {filteredLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            isExpanded={expandedLocations.includes(location.id)}
            onToggle={() => toggleLocation(location.id)}
            onAddServer={() => {
              setSelectedLocationForServer(location);
              setEditingServer(null);
              setIsServerModalOpen(true);
            }}
            onDelete={() => setDeletingLocation({ id: location.id, name: location.name })}
            onEditServer={(server) => handleEditServer(server, location)}
            onDeleteServer={(server) => setDeletingServer({ id: server.id, name: server.name, locationId: location.id })}
            onRestartXray={handleRestartXray}
            restartingServerId={restartingServerId}
            onForceCheck={handleForceCheck}
            checkingServerId={checkingServerId}
            onSpeedtest={handleSpeedtest}
            speedtestServerId={speedtestServerId}
            onInstallAgent={handleInstallAgent}
            installingAgentServerId={installingAgentServerId}
            activeConnections={activeConnections}
            onProvisionKeys={handleProvisionKeys}
            provisioningStatus={provisioningLocations[location.id]}
            provisioningLoading={provisioningLoading}
            onRebalance={handleRebalance}
            rebalancingLocation={rebalancingLocation}
            onToggleMaintenance={handleToggleMaintenance}
            togglingMaintenanceServerId={togglingMaintenanceServerId}
            onNavigateToKeys={(locationName) => navigate(`/keys?location=${encodeURIComponent(locationName)}`)}
          />
        ))}
      </div>

      {/* Модальные окна */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleSaveLocation}
        existingCountryCodes={existingCountryCodes}
      />

      <ServerModal
        isOpen={isServerModalOpen}
        onClose={() => {
          setIsServerModalOpen(false);
          setSelectedLocationForServer(null);
          setEditingServer(null);
        }}
        onSave={handleSaveServer}
        locationName={selectedLocationForServer ? `${selectedLocationForServer.flag} ${selectedLocationForServer.name}` : ''}
        server={editingServer?.apiData}
      />

      {/* Delete Server Confirmation */}
      <ConfirmDialog
        open={deletingServer !== null}
        onOpenChange={(open) => !open && setDeletingServer(null)}
        onConfirm={handleDeleteServer}
        title={`Удалить сервер "${deletingServer?.name}"?`}
        description="Все ключи на этом сервере будут удалены. Это действие нельзя отменить."
        confirmText="Удалить"
        variant="danger"
      />

      {/* Delete Location Confirmation */}
      <ConfirmDialog
        open={deletingLocation !== null}
        onOpenChange={(open) => !open && setDeletingLocation(null)}
        onConfirm={handleDeleteLocation}
        title={`Удалить локацию "${deletingLocation?.name}"?`}
        description="Все серверы и ключи в этой локации будут удалены. Это действие нельзя отменить."
        confirmText="Удалить"
        variant="danger"
      />
    </div>
  );
}

function LocationCard({
  location,
  isExpanded,
  onToggle,
  onAddServer,
  onDelete,
  onEditServer,
  onDeleteServer,
  onRestartXray,
  restartingServerId,
  onForceCheck,
  checkingServerId,
  onSpeedtest,
  speedtestServerId,
  onInstallAgent,
  installingAgentServerId,
  activeConnections,
  onProvisionKeys,
  provisioningStatus,
  provisioningLoading,
  onRebalance,
  rebalancingLocation,
  onToggleMaintenance,
  togglingMaintenanceServerId,
  onNavigateToKeys
}: {
  location: Location;
  isExpanded: boolean;
  onToggle: () => void;
  onAddServer: () => void;
  onDelete: () => void;
  onEditServer: (server: ServerType) => void;
  onDeleteServer: (server: ServerType) => void;
  onRestartXray: (serverId: string) => void;
  restartingServerId: string | null;
  onForceCheck: (serverId: string) => void;
  checkingServerId: string | null;
  onSpeedtest: (serverId: string) => void;
  speedtestServerId: string | null;
  onInstallAgent: (serverId: string) => void;
  installingAgentServerId: string | null;
  activeConnections: Map<number, Map<string, ActiveConnection>>;
  onProvisionKeys: (locationId: string) => void;
  provisioningStatus?: { status: string; progress: number; created: number; failed: number; total: number };
  provisioningLoading: string | null;
  onRebalance: (locationId: string) => void;
  rebalancingLocation: string | null;
  onToggleMaintenance: (serverId: string, currentStatus: string) => void;
  togglingMaintenanceServerId: string | null;
  onNavigateToKeys: (locationName: string) => void;
}) {
  const [showAllServers, setShowAllServers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(location.name);
  const SERVERS_LIMIT = 6;

  // Обновляем editedName при изменении location.name
  useEffect(() => {
    setEditedName(location.name);
  }, [location.name]);

  const onlineServers = location.servers.filter(s => s.status === 'online').length;
  const avgLoad = location.servers.length > 0
    ? Math.round(location.servers.reduce((sum, s) => sum + s.load, 0) / location.servers.length)
    : 0;

  const displayedServers = showAllServers ? location.servers : location.servers.slice(0, SERVERS_LIMIT);
  const hasMoreServers = location.servers.length > SERVERS_LIMIT;

  const handleSaveName = async () => {
    try {
      // В новой модели is_trial не нужен
      await apiClient.updateLocation(parseInt(location.id), {
        name: editedName
      });
      setIsEditingName(false);
      toast.success('Название обновлено');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка обновления названия');
      setEditedName(location.name);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(location.name);
    setIsEditingName(false);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20">
      {/* Заголовок локации */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <span className="text-2xl sm:text-4xl">{location.flag}</span>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-foreground">{location.country}</h3>
                {location.trafficLimitGb && location.trafficLimitGb > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs rounded-full border border-blue-500/20">
                    {location.trafficLimitGb} GB
                  </span>
                )}
              </div>

              {/* Редактируемое поле кастомного названия */}
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="text-muted-foreground text-sm bg-muted px-2 py-1 rounded border border-border focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Сохранить"
                  >
                    <Check className="w-4 h-4 text-green-500" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Отменить"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 group cursor-pointer"
                  onClick={() => setIsEditingName(true)}
                >
                  <span className="text-muted-foreground text-sm">{editedName || location.name}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          </div>

          {/* Provisioning badge (visible when collapsed) */}
          {!isExpanded && provisioningStatus && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mr-2",
              provisioningStatus.status === 'running'
                ? "bg-blue-500/10 text-blue-500"
                : provisioningStatus.status === 'completed'
                ? "bg-green-500/10 text-green-500"
                : provisioningStatus.status === 'failed'
                ? "bg-red-500/10 text-red-500"
                : "bg-muted text-muted-foreground"
            )}>
              {provisioningStatus.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {provisioningStatus.status === 'completed' && <Check className="w-3 h-3" />}
              {provisioningStatus.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
              {provisioningStatus.status === 'running'
                ? `${provisioningStatus.progress}%`
                : provisioningStatus.status === 'completed'
                ? `${provisioningStatus.created} ключей`
                : 'Ошибка'
              }
            </div>
          )}

          {/* Метрики для мобильного - компактно */}
          <div className="flex sm:hidden items-center gap-3 text-xs text-muted-foreground">
            <span>{location.servers.length} серв.</span>
            <span className="text-green-500">{onlineServers} онл.</span>
          </div>

          {/* Метрики для десктопа - полностью */}
          <div className="hidden sm:flex items-center gap-6 mr-4">
            <div className="text-center">
              <div className="text-foreground text-xl">{location.servers.length}</div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">серверов</div>
            </div>
            <div className="text-center">
              <div className="text-green-500 text-xl">{onlineServers}</div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">онлайн</div>
            </div>
            <div className="text-center">
              <div className="text-foreground text-xl">{location.totalUsers}</div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">юзеров</div>
            </div>
            <div className="text-center">
              <div className={`text-xl ${
                avgLoad < 50 ? 'text-green-500' :
                avgLoad < 80 ? 'text-orange-500' :
                'text-red-500'
              }`}>
                {avgLoad}%
              </div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">заполненность</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка меню */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-muted rounded-xl transition-all duration-200"
              >
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Выпадающее меню */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-[calc(100%+0.5rem)] top-0 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить локацию
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Кнопка раскрытия */}
            <button
              onClick={onToggle}
              className="p-2 hover:bg-muted rounded-xl transition-all duration-200"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Provisioning Status */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onProvisionKeys(location.id); }}
              disabled={provisioningLoading === location.id || provisioningStatus?.status === 'running'}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300",
                provisioningStatus?.status === 'running'
                  ? "bg-blue-500/10 text-blue-500 cursor-wait"
                  : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95"
              )}
            >
              {provisioningLoading === location.id || provisioningStatus?.status === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {provisioningStatus?.status === 'running' ? 'Провижининг...' : 'Запустить провижининг'}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onRebalance(location.id); }}
              disabled={rebalancingLocation === location.id || location.servers.length < 2}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300",
                rebalancingLocation === location.id
                  ? "bg-orange-500/10 text-orange-500 cursor-wait"
                  : location.servers.length < 2
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 active:scale-95"
              )}
              title={location.servers.length < 2 ? 'Нужно минимум 2 сервера' : 'Перераспределить ключи между серверами'}
            >
              {rebalancingLocation === location.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5" />
              )}
              {rebalancingLocation === location.id ? 'Ребалансировка...' : 'Ребалансировать'}
            </button>

            {provisioningStatus && (
              <div className="flex-1 flex items-center gap-3">
                {provisioningStatus.status === 'running' && (
                  <>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${provisioningStatus.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {provisioningStatus.created}/{provisioningStatus.total}
                    </span>
                  </>
                )}
                {provisioningStatus.status === 'completed' && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Создано {provisioningStatus.created} ключей
                    {provisioningStatus.failed > 0 && <span className="text-red-400 ml-1">({provisioningStatus.failed} ошибок)</span>}
                  </span>
                )}
                {provisioningStatus.status === 'failed' && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Ошибка провижининга
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Список серверов (раскрывающийся) */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pt-4 border-t border-border">
            <h4 className="text-foreground uppercase tracking-wider text-xs sm:text-sm">Серверы в локации</h4>
            <button
              onClick={onAddServer}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all duration-200 active:scale-95 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить сервер</span>
              <span className="sm:hidden">Добавить</span>
            </button>
          </div>

          {/* Сетка серверов */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {displayedServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onEdit={() => onEditServer(server)}
                onDelete={() => onDeleteServer(server)}
                onRestartXray={() => onRestartXray(server.id)}
                isRestarting={restartingServerId === server.id}
                onForceCheck={() => onForceCheck(server.id)}
                isChecking={checkingServerId === server.id}
                onSpeedtest={() => onSpeedtest(server.id)}
                isSpeedtesting={speedtestServerId === server.id}
                onInstallAgent={() => onInstallAgent(server.id)}
                isInstallingAgent={installingAgentServerId === server.id}
                onlineUsers={activeConnections.get(parseInt(server.id))}
                onToggleMaintenance={() => onToggleMaintenance(server.id, server.status)}
                isTogglingMaintenance={togglingMaintenanceServerId === server.id}
              />
            ))}
          </div>

          {/* Кнопка "Показать все" */}
          {hasMoreServers && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllServers(!showAllServers)}
                className="px-6 py-2.5 bg-muted hover:bg-muted/70 text-foreground rounded-xl transition-all duration-200"
              >
                {showAllServers 
                  ? 'Свернуть' 
                  : `Показать все серверы (${location.servers.length - SERVERS_LIMIT} скрыто)`
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServerCard({
  server,
  onEdit,
  onDelete,
  onRestartXray,
  isRestarting,
  onForceCheck,
  isChecking,
  onSpeedtest,
  isSpeedtesting,
  onInstallAgent,
  isInstallingAgent,
  onlineUsers,
  onToggleMaintenance,
  isTogglingMaintenance
}: {
  server: ServerType;
  onEdit: () => void;
  onDelete: () => void;
  onRestartXray: () => void;
  isRestarting: boolean;
  onForceCheck: () => void;
  isChecking: boolean;
  onSpeedtest: () => void;
  isSpeedtesting: boolean;
  onInstallAgent: () => void;
  isInstallingAgent: boolean;
  onlineUsers?: Map<string, ActiveConnection>;
  onToggleMaintenance: () => void;
  isTogglingMaintenance: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const statusConfig = {
    online: {
      label: 'Онлайн',
      cardClass: 'bg-card border-border',
      badgeClass: 'bg-green-500/20 text-green-500'
    },
    offline: {
      label: 'Оффлайн',
      cardClass: 'bg-card border-border',
      badgeClass: 'bg-red-500/20 text-red-500'
    },
    degraded: {
      label: 'Частично',
      cardClass: 'bg-card border-border',
      badgeClass: 'bg-yellow-500/20 text-yellow-500'
    },
    maintenance: {
      label: 'Обслуживание',
      cardClass: 'bg-card border-border',
      badgeClass: 'bg-orange-500/20 text-orange-500'
    },
  };

  const status = statusConfig[server.status] || statusConfig.offline;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={`relative ${status.cardClass} rounded-lg border p-4 hover:shadow-lg hover:border-primary/10 transition-all duration-300 hover:translate-y-[-2px]`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-foreground font-semibold text-sm truncate">{server.name}</div>
          <div className="text-muted-foreground text-xs font-mono">{server.ip}</div>
        </div>

        {/* Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Редактировать
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceCheck();
                  }}
                  disabled={isChecking}
                  className="w-full px-4 py-2.5 text-left text-sm text-blue-500 hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Проверить сервер
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSpeedtest();
                  }}
                  disabled={isSpeedtesting}
                  className="w-full px-4 py-2.5 text-left text-sm text-purple-500 hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSpeedtesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Тест скорости...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Тест скорости
                    </>
                  )}
                </button>
                {/* Установка/Переустановка агента */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onInstallAgent();
                  }}
                  disabled={isInstallingAgent}
                  className="w-full px-4 py-2.5 text-left text-sm text-green-500 hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isInstallingAgent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {server.agent_installed ? 'Переустановка...' : 'Установка...'}
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      {server.agent_installed ? 'Переустановить агент' : 'Установить агент'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onRestartXray();
                  }}
                  disabled={isRestarting}
                  className="w-full px-4 py-2.5 text-left text-sm text-orange-500 hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isRestarting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Перезагрузка...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Перезагрузить Xray
                    </>
                  )}
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onToggleMaintenance();
                  }}
                  disabled={isTogglingMaintenance}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50",
                    server.status === 'maintenance' ? "text-green-500" : "text-yellow-500"
                  )}
                >
                  {isTogglingMaintenance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {server.status === 'maintenance' ? 'Включение...' : 'Отключение...'}
                    </>
                  ) : server.status === 'maintenance' ? (
                    <>
                      <Wifi className="w-4 h-4" />
                      Включить сервер
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4" />
                      Отключить сервер
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить сервер
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status + Agent + Panel Link */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${status.badgeClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {status.label}
          </div>

          {/* Agent Status */}
          {server.agent_installed ? (
            <>
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                server.agent_status === 'online'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {server.agent_status === 'online' ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                Agent
              </div>
              {/* Предупреждения о компонентах агента */}
              {server.agent_status === 'online' && server.components && (() => {
                const warnings: string[] = [];
                const { fail2ban, xray_logs, x3ui } = server.components;

                if (fail2ban?.status && !['ok', 'unknown'].includes(fail2ban.status)) {
                  warnings.push(`fail2ban: ${fail2ban.message}`);
                }
                if (xray_logs?.status && !['ok', 'unknown'].includes(xray_logs.status)) {
                  warnings.push(`Логи: ${xray_logs.message}`);
                }
                if (x3ui?.status && !['ok', 'unknown'].includes(x3ui.status)) {
                  warnings.push(`3x-ui: ${x3ui.message}`);
                }

                if (warnings.length > 0) {
                  return (
                    <div
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-600 cursor-help"
                      title={warnings.join('\n')}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {warnings.length}
                    </div>
                  );
                }
                return null;
              })()}
            </>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
              <WifiOff className="w-3 h-3" />
              No Agent
            </div>
          )}

        </div>

        {server.x3ui_url && (
          <a
            href={server.x3ui_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Панель
          </a>
        )}
      </div>

      {/* Credentials */}
      {server.x3ui_username && (
        <div className="rounded-lg border divide-y mb-3">
          {/* Login */}
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="text-sm">Логин</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm font-mono">{server.x3ui_username}</span>
              <button
                onClick={() => copyToClipboard(server.x3ui_username!, 'login')}
                className="p-1 hover:bg-muted rounded transition-all"
                title="Копировать"
              >
                {copied === 'login' ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <KeyRound className="w-4 h-4" />
              <span className="text-sm">Пароль</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm font-mono">
                {showPassword ? (server.x3ui_password || '••••••••') : '••••••••'}
              </span>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 hover:bg-muted rounded transition-all"
                title={showPassword ? 'Скрыть' : 'Показать'}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              {server.x3ui_password && (
                <button
                  onClick={() => copyToClipboard(server.x3ui_password!, 'password')}
                  className="p-1 hover:bg-muted rounded transition-all"
                  title="Копировать"
                >
                  {copied === 'password' ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics List (like user modal) */}
      <div className="rounded-lg border divide-y mb-3">
        {/* Юзеры */}
        <div className="flex items-center justify-between p-2.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-sm">Юзеры</span>
          </div>
          <div className="flex items-center gap-2">
            {server.load > 95 && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            )}
            {server.load > 80 && server.load <= 95 && (
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            )}
            <span className={`font-medium text-sm ${
              server.load < 50 ? 'text-green-500' : server.load < 80 ? 'text-yellow-500' : 'text-red-500'
            }`}>{server.users} / {server.maxUsers}</span>
          </div>
        </div>
        {/* Capacity load bar */}
        <div className="px-2.5 pb-2.5 -mt-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                server.load < 50 ? 'bg-green-500' :
                server.load < 80 ? 'bg-yellow-500' :
                server.load < 95 ? 'bg-orange-500' :
                'bg-red-500 animate-pulse'
              )}
              style={{ width: `${Math.min(server.load, 100)}%` }}
            />
          </div>
        </div>

        {/* Онлайн пользователей */}
        <div className="flex items-center justify-between p-2.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Radio className="w-4 h-4" />
            <span className="text-sm">Онлайн</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onlineUsers && onlineUsers.size > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            )}
            <span className={`font-medium text-sm ${
              onlineUsers && onlineUsers.size > 0 ? 'text-cyan-500' : 'text-muted-foreground'
            }`}>{onlineUsers ? onlineUsers.size : 0}</span>
          </div>
        </div>

        {/* CPU */}
        {server.cpuPercent != null && (
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="w-4 h-4" />
              <span className="text-sm">CPU</span>
            </div>
            <span className={`font-medium text-sm ${
              server.cpuPercent < 50 ? 'text-green-500' : server.cpuPercent < 80 ? 'text-yellow-500' : 'text-red-500'
            }`}>{server.cpuPercent.toFixed(1)}%</span>
          </div>
        )}

        {/* RAM */}
        {server.ramUsed != null && server.ramTotal != null && server.ramTotal > 0 && (
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MemoryStick className="w-4 h-4" />
              <span className="text-sm">RAM</span>
            </div>
            <span className={`font-medium text-sm ${
              (server.ramUsed / server.ramTotal * 100) < 50 ? 'text-green-500' :
              (server.ramUsed / server.ramTotal * 100) < 80 ? 'text-yellow-500' : 'text-red-500'
            }`}>{server.ramUsed.toFixed(1)} / {server.ramTotal.toFixed(1)} GB</span>
          </div>
        )}

        {/* Канал */}
        {server.bandwidth && server.bandwidth !== '—' && (
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="w-4 h-4" />
              <span className="text-sm">Канал</span>
            </div>
            <span className="font-medium text-sm">{server.bandwidth}</span>
          </div>
        )}

        {/* Трафик */}
        {(server.trafficUpGb != null || server.trafficDownGb != null) && (
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpDown className="w-4 h-4" />
              <span className="text-sm">Трафик</span>
            </div>
            <span className="font-medium text-sm">
              {(() => {
                const total = (server.trafficUpGb || 0) + (server.trafficDownGb || 0);
                return total >= 1024 ? `${(total / 1024).toFixed(1)} TB` : `${total.toFixed(1)} GB`;
              })()}
            </span>
          </div>
        )}

      </div>

      {/* Capacity warning */}
      {server.load > 80 && (
        <div className={cn(
          "rounded-lg p-2 flex items-center gap-2 mb-3 transition-all duration-300",
          server.load > 95
            ? "bg-red-500/10 border border-red-500/20 animate-pulse"
            : "bg-yellow-500/10 border border-yellow-500/20"
        )}>
          <TrendingUp className={cn(
            "w-3.5 h-3.5 flex-shrink-0",
            server.load > 95 ? "text-red-500" : "text-yellow-500"
          )} />
          <span className={cn(
            "text-xs font-medium",
            server.load > 95 ? "text-red-500" : "text-yellow-500"
          )}>
            {server.load > 95 ? 'Критическая заполненность сервера!' : 'Сервер заполнен более чем на 80%'}
          </span>
        </div>
      )}

      {/* Agent warning if installed but offline */}
      {server.agent_installed && server.agent_status === 'offline' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-red-500 text-xs font-medium">
            Агент не отвечает
          </span>
        </div>
      )}
    </div>
  );
}

// Mini App Location Card Component
function MiniAppLocationCard({
  location,
  isExpanded,
  onToggle,
  onAddServer,
  onDelete,
  onEditServer,
  onDeleteServer,
  wsConnected
}: {
  location: Location;
  isExpanded: boolean;
  onToggle: () => void;
  onAddServer: () => void;
  onDelete: () => void;
  onEditServer: (server: ServerType) => void;
  onDeleteServer: (server: ServerType) => void;
  wsConnected: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const onlineServers = location.servers.filter(s => s.status === 'online').length;
  const avgLoad = location.servers.length > 0
    ? Math.round(location.servers.reduce((sum, s) => sum + s.load, 0) / location.servers.length)
    : 0;

  return (
    <div className="bg-card border rounded-xl overflow-visible">
      {/* Header - always visible */}
      <div
        className="flex items-center gap-3 p-3 active:bg-accent/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <span className="text-2xl">{location.flag}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{location.country}</span>
            {location.trafficLimitGb && location.trafficLimitGb > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] rounded-full border border-blue-500/20 shrink-0">
                {location.trafficLimitGb} GB
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{location.name}</div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Servers count */}
          <div className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={cn(
              onlineServers === location.servers.length ? 'text-green-500' :
              onlineServers > 0 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {onlineServers}/{location.servers.length}
            </span>
          </div>

          {/* Users */}
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{location.totalUsers}</span>
          </div>

          {/* Load */}
          <span className={cn(
            "font-medium",
            avgLoad < 50 ? 'text-green-500' :
            avgLoad < 80 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {avgLoad}%
          </span>

          <ChevronRight className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )} />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Action buttons */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Серверы ({location.servers.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddServer();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить
              </button>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1.5 hover:bg-muted rounded-lg transition-all"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Удалить локацию
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Servers list */}
          <div className="divide-y">
            {location.servers.map((server) => (
              <MiniAppServerRow
                key={server.id}
                server={server}
                onEdit={() => onEditServer(server)}
                onDelete={() => onDeleteServer(server)}
              />
            ))}

            {location.servers.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Нет серверов
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Mini App Server Row Component
function MiniAppServerRow({
  server,
  onEdit,
  onDelete
}: {
  server: ServerType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig: Record<string, { color: string; label: string }> = {
    online: { color: 'text-green-500', label: 'Online' },
    offline: { color: 'text-red-500', label: 'Offline' },
    degraded: { color: 'text-yellow-500', label: 'Degraded' },
    maintenance: { color: 'text-orange-500', label: 'Maintenance' },
  };

  const status = statusConfig[server.status] || statusConfig.offline;

  return (
    <div className="flex items-center gap-3 p-3">
      {/* Status dot */}
      <div className={cn("w-2 h-2 rounded-full",
        server.status === 'online' ? 'bg-green-500' :
        server.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
      )} />

      {/* Server info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{server.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{server.ip}</div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {/* Users */}
        <span className={cn(
          server.load < 50 ? 'text-green-500' :
          server.load < 80 ? 'text-yellow-500' : 'text-red-500'
        )}>
          {server.users}/{server.maxUsers}
        </span>

        {/* Agent status */}
        {server.agent_installed && (
          <div className={cn(
            "flex items-center gap-1",
            server.agent_status === 'online' ? 'text-green-500' : 'text-red-500'
          )}>
            {server.agent_status === 'online' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-muted rounded transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Изменить
                </button>
                {server.x3ui_url && (
                  <a
                    href={server.x3ui_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 text-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Панель
                  </a>
                )}
                <div className="border-t border-border" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
