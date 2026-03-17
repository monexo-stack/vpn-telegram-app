import { useState, useEffect, useRef, useCallback } from 'react';

// Типы сообщений от WebSocket
export interface ServerMetrics {
  cpu_percent?: number;
  ram_used_gb?: number;
  ram_total_gb?: number;
  disk_used_gb?: number;
  disk_total_gb?: number;
  net_rx_mbps?: number;
  net_tx_mbps?: number;
  load_1m?: number;
  load_5m?: number;
  load_15m?: number;
  timestamp?: string;
}

interface ConnectionEvent {
  event: 'connect' | 'disconnect';
  client_email: string;
  client_ip: string;
  inbound_tag?: string;
  timestamp: string;
}

interface TrafficData {
  clients?: Array<{
    email: string;
    up_bytes: number;
    down_bytes: number;
  }>;
  total_up_gb?: number;
  total_down_gb?: number;
}

// Трафик клиента
export interface ClientTraffic {
  email: string;
  up_bytes: number;
  down_bytes: number;
  updated_at: string;
}

// Статус компонента агента
export interface ComponentStatus {
  status: 'ok' | 'warning' | 'error' | 'not_installed' | 'not_found' | 'not_configured' | 'fallback' | 'unknown';
  message: string;
  banned_count?: number;
}

// Статусы всех компонентов агента
export interface AgentComponents {
  fail2ban?: ComponentStatus;
  xray_logs?: ComponentStatus;
  x3ui?: ComponentStatus;
  speedtest?: ComponentStatus;
  timestamp?: string;
}

interface ServerState {
  id: number;
  name: string;
  ip: string;
  agent_status: 'online' | 'offline' | 'not_installed';
  agent_installed: boolean;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  location_id?: number;
  metrics?: ServerMetrics;
  bandwidth?: string;  // Результат последнего speedtest
  components?: AgentComponents;  // Статус компонентов агента
}

interface WebSocketMessage {
  type: 'initial_state' | 'metrics' | 'connection' | 'traffic' | 'agent_status' | 'speedtest' | 'agent_components' | 'active_clients' | 'pong' | 'payment_new' | 'user_updated' | 'user_deleted' | 'key_created' | 'key_deleted' | 'user_traffic' | 'app_online';
  server_id?: number;
  timestamp?: string;
  status?: string;
  data?: any;
  components?: AgentComponents;
  agent_version?: string;
}

// Типы для real-time событий
export interface PaymentEvent {
  id: number;
  amount: number;
  user_tgid: number;
  username?: string;
  fullname?: string;
  payment_system: string;
  plan_name?: string;
  month_count?: number;
  status: string;
  created_at?: string;
  completed_at?: string;
  timestamp: string;
}

export interface UserEvent {
  tgid: number;
  action: 'banned' | 'unbanned';
  username?: string;
  fullname?: string;
  timestamp: string;
}

export interface UserDeletedEvent {
  id: number;
  tgid: number;
  username?: string;
  fullname?: string;
  timestamp: string;
}

export interface KeyEvent {
  user_tgid: number;
  subscription_token: string;
  subscription_url?: string;
  trial_period?: boolean;
  plan_id?: string;
  created_keys?: Array<{ key_id: number; location: string }>;
  locations_count?: number;
  timestamp: string;
}

export interface KeyDeletedEvent {
  key_ids: number[];
  user_tgid: number;
  subscription_token?: string;
  deleted_count: number;
  timestamp: string;
}

export interface SpeedtestEvent {
  server_id: number;
  server_name?: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  speed_formatted: string;
  server: string;
  auto_installed?: boolean;
  timestamp: string;
}

interface UseServerWebSocketOptions {
  /** URL WebSocket сервера (если не указан, вычисляется автоматически) */
  wsUrl?: string;
  /** Автоматическое переподключение при разрыве (по умолчанию true) */
  autoReconnect?: boolean;
  /** Интервал переподключения в мс (по умолчанию 3000) */
  reconnectInterval?: number;
  /** Максимальное количество попыток переподключения (по умолчанию 10) */
  maxReconnectAttempts?: number;
}

// Активное подключение клиента
export interface ActiveConnection {
  client_email: string;
  client_ip: string;
  all_ips?: string[];  // Все IP адреса клиента
  inbound_tag?: string;
  connected_at: string;
}

interface UseServerWebSocketReturn {
  /** Состояние серверов */
  servers: Map<number, ServerState>;
  /** Подключен ли WebSocket */
  isConnected: boolean;
  /** Статус соединения */
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Последняя ошибка */
  error: string | null;
  /** Количество попыток переподключения */
  reconnectAttempts: number;
  /** Последние события подключений (для отображения в UI) */
  recentConnections: Array<ConnectionEvent & { server_id: number }>;
  /** Активные подключения по серверам: server_id -> Map<client_email, connection> */
  activeConnections: Map<number, Map<string, ActiveConnection>>;
  /** Трафик клиентов: email -> ClientTraffic */
  clientTraffic: Map<string, ClientTraffic>;
  /** Агрегированный трафик по telegram ID (bytes, сумма со всех серверов) */
  aggregatedTrafficByTgid: Map<string, number>;
  /** Количество пользователей с открытым приложением */
  appOnlineCount: number;
  /** Telegram ID пользователей с открытым приложением */
  appOnlineUserIds: number[];
  /** Обновить метрики конкретного сервера */
  requestServerMetrics: (serverId: number) => void;
  /** Принудительно переподключиться */
  reconnect: () => void;
  /** Закрыть соединение */
  disconnect: () => void;
  /** Последние события (для real-time обновлений) */
  recentPayments: PaymentEvent[];
  recentUserEvents: UserEvent[];
  recentUserDeleted: UserDeletedEvent[];
  recentKeyEvents: KeyEvent[];
  recentKeyDeleted: KeyDeletedEvent[];
  /** Callbacks для подписки на события */
  onPayment: (callback: (event: PaymentEvent) => void) => () => void;
  onUserEvent: (callback: (event: UserEvent) => void) => () => void;
  onUserDeleted: (callback: (event: UserDeletedEvent) => void) => () => void;
  onKeyEvent: (callback: (event: KeyEvent) => void) => () => void;
  onKeyDeleted: (callback: (event: KeyDeletedEvent) => void) => () => void;
  onSpeedtestResult: (callback: (event: SpeedtestEvent) => void) => () => void;
}

/**
 * Hook для WebSocket подключения к серверу мониторинга
 * Получает real-time обновления метрик, подключений и статусов агентов
 */
export function useServerWebSocket(
  options: UseServerWebSocketOptions = {}
): UseServerWebSocketReturn {
  const {
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  // State
  const [servers, setServers] = useState<Map<number, ServerState>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [recentConnections, setRecentConnections] = useState<Array<ConnectionEvent & { server_id: number }>>([]);
  // Активные подключения: server_id -> Map<client_email, ActiveConnection>
  const [activeConnections, setActiveConnections] = useState<Map<number, Map<string, ActiveConnection>>>(new Map());
  // Трафик клиентов: email -> ClientTraffic
  const [clientTraffic, setClientTraffic] = useState<Map<string, ClientTraffic>>(new Map());
  // Агрегированный трафик по telegram ID (сумма со всех серверов, от бэкенда)
  const [aggregatedTrafficByTgid, setAggregatedTrafficByTgid] = useState<Map<string, number>>(new Map());
  // Пользователи с открытым приложением (web app)
  const [appOnlineCount, setAppOnlineCount] = useState(0);
  const [appOnlineUserIds, setAppOnlineUserIds] = useState<number[]>([]);

  // Real-time события для других страниц
  const [recentPayments, setRecentPayments] = useState<PaymentEvent[]>([]);
  const [recentUserEvents, setRecentUserEvents] = useState<UserEvent[]>([]);
  const [recentUserDeleted, setRecentUserDeleted] = useState<UserDeletedEvent[]>([]);
  const [recentKeyEvents, setRecentKeyEvents] = useState<KeyEvent[]>([]);
  const [recentKeyDeleted, setRecentKeyDeleted] = useState<KeyDeletedEvent[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Callbacks refs для подписки на события
  const paymentCallbacksRef = useRef<Set<(event: PaymentEvent) => void>>(new Set());
  const userEventCallbacksRef = useRef<Set<(event: UserEvent) => void>>(new Set());
  const userDeletedCallbacksRef = useRef<Set<(event: UserDeletedEvent) => void>>(new Set());
  const keyEventCallbacksRef = useRef<Set<(event: KeyEvent) => void>>(new Set());
  const keyDeletedCallbacksRef = useRef<Set<(event: KeyDeletedEvent) => void>>(new Set());
  const speedtestCallbacksRef = useRef<Set<(event: SpeedtestEvent) => void>>(new Set());

  // Вычисляем URL WebSocket
  const getWsUrl = useCallback(() => {
    if (options.wsUrl) return options.wsUrl;

    const token = localStorage.getItem('admin_token');
    if (!token) return null;

    // В dev режиме используем относительный путь (для Vite proxy)
    // В production - строим полный URL
    const isDev = import.meta.env.DEV;

    if (isDev) {
      // Vite proxy перенаправит /ws/* на backend
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${window.location.host}/ws/admin/servers?token=${token}`;
    }

    // Production: используем VITE_API_URL или текущий origin
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = new URL(apiUrl).host;

    return `${wsProtocol}//${host}/ws/admin/servers?token=${token}`;
  }, [options.wsUrl]);

  // Обработка входящих сообщений
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'initial_state':
          // Начальное состояние всех серверов
          if (message.data?.servers) {
            const newServers = new Map<number, ServerState>();
            for (const server of message.data.servers) {
              newServers.set(server.id, server);
            }
            setServers(newServers);
          }
          // Активные VPN подключения
          if (message.data?.active_connections) {
            setActiveConnections(prev => {
              const newConnections = new Map<number, Map<string, ActiveConnection>>();

              for (const [serverIdStr, connections] of Object.entries(message.data.active_connections)) {
                const serverId = parseInt(serverIdStr);
                const serverMap = new Map<string, ActiveConnection>();
                const existingServerMap = prev.get(serverId);

                for (const conn of connections as ActiveConnection[]) {
                  const existing = existingServerMap?.get(conn.client_email);
                  // Сохраняем существующие IP если новые пустые
                  const newHasIps = conn.all_ips && conn.all_ips.length > 0;
                  const existingHasIps = existing?.all_ips && existing.all_ips.length > 0;
                  const newHasRealIp = conn.client_ip && conn.client_ip !== 'online' && conn.client_ip !== 'traffic-detected';
                  const existingHasRealIp = existing?.client_ip && existing.client_ip !== 'online' && existing.client_ip !== 'traffic-detected';

                  serverMap.set(conn.client_email, {
                    ...conn,
                    client_ip: newHasRealIp ? conn.client_ip : (existingHasRealIp ? existing.client_ip : conn.client_ip),
                    all_ips: newHasIps ? conn.all_ips : (existingHasIps ? existing.all_ips : conn.all_ips || []),
                  });
                }
                newConnections.set(serverId, serverMap);
              }
              return newConnections;
            });
          }
          // Пользователи с открытым приложением
          if (message.data?.app_online) {
            setAppOnlineCount(message.data.app_online.count ?? 0);
            setAppOnlineUserIds(message.data.app_online.user_ids ?? []);
          }
          break;

        case 'metrics':
          // Обновление метрик сервера
          if (message.server_id && message.data) {
            setServers(prev => {
              const newMap = new Map(prev);
              const server = newMap.get(message.server_id!);
              if (server) {
                newMap.set(message.server_id!, {
                  ...server,
                  metrics: {
                    ...server.metrics,
                    ...message.data,
                    timestamp: message.timestamp,
                  },
                  // Если получаем метрики - сервер онлайн, но не перезаписываем maintenance
                  ...(server.status === 'maintenance' ? {} : { status: 'online' as const }),
                });
              }
              return newMap;
            });
          }
          break;

        case 'agent_status':
          // Изменение статуса агента
          if (message.server_id) {
            setServers(prev => {
              const newMap = new Map(prev);
              const server = newMap.get(message.server_id!);
              if (server) {
                newMap.set(message.server_id!, {
                  ...server,
                  agent_status: message.status as 'online' | 'offline' | 'not_installed',
                  // Не перезаписываем maintenance — используем server_status из бэкенда если есть
                  ...(message.server_status ? { status: message.server_status } :
                    server.status !== 'maintenance' ? { status: message.status === 'online' ? 'online' : 'offline' } : {}),
                });
              }
              return newMap;
            });
          }
          break;

        case 'connection':
          // Событие подключения/отключения пользователя
          if (message.server_id && message.data) {
            const connectionEvent: ConnectionEvent & { server_id: number } = {
              ...message.data,
              server_id: message.server_id,
            };

            // Добавляем в историю
            setRecentConnections(prev => {
              const updated = [connectionEvent, ...prev];
              // Храним только последние 50 событий
              return updated.slice(0, 50);
            });

            // Обновляем активные подключения
            const serverId = message.server_id;
            const { event, client_email, client_ip, all_ips, inbound_tag, timestamp } = message.data;

            setActiveConnections(prev => {
              const newMap = new Map(prev);
              let serverConnections = newMap.get(serverId);

              if (!serverConnections) {
                serverConnections = new Map();
                newMap.set(serverId, serverConnections);
              }

              if (event === 'connect' && client_email) {
                // Добавляем/обновляем подключение (timestamp обновляется при каждом запросе)
                const existing = serverConnections.get(client_email);
                const newIpIsReal = client_ip && client_ip !== 'online' && client_ip !== 'traffic-detected';
                const existingHasRealIp = existing?.client_ip && existing.client_ip !== 'online' && existing.client_ip !== 'traffic-detected';
                const existingHasIps = existing?.all_ips && existing.all_ips.length > 0;
                // Используем all_ips из события если есть
                const newHasIps = all_ips && all_ips.length > 0;

                // Приоритет: новые all_ips > существующие > собираем из client_ip
                let finalAllIps: string[];
                if (newHasIps) {
                  finalAllIps = all_ips;
                } else if (existingHasIps) {
                  finalAllIps = [...existing.all_ips];
                  // Добавляем новый IP если его ещё нет
                  if (newIpIsReal && !finalAllIps.includes(client_ip)) {
                    finalAllIps.push(client_ip);
                  }
                } else {
                  finalAllIps = newIpIsReal ? [client_ip] : [];
                }

                serverConnections.set(client_email, {
                  client_email,
                  // Сохраняем реальный IP: новый если реальный, иначе существующий
                  client_ip: newIpIsReal ? client_ip : (existingHasRealIp ? existing.client_ip : 'online'),
                  all_ips: finalAllIps,
                  inbound_tag: inbound_tag || existing?.inbound_tag,
                  connected_at: timestamp,
                });
              } else if (event === 'disconnect' && client_email) {
                // Удаляем подключение
                serverConnections.delete(client_email);
              }

              // Очищаем подключения старше 10 минут (Xray не шлёт disconnect)
              const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
              for (const [email, conn] of serverConnections.entries()) {
                const connTime = new Date(conn.connected_at).getTime();
                if (connTime < tenMinutesAgo) {
                  serverConnections.delete(email);
                }
              }

              return newMap;
            });
          }
          break;

        case 'traffic':
          // Обновление трафика сервера
          if (message.server_id && message.data) {
            const serverId = message.server_id;
            const timestamp = message.timestamp || new Date().toISOString();

            setServers(prev => {
              const newMap = new Map(prev);
              const server = newMap.get(serverId);
              if (server) {
                newMap.set(serverId, {
                  ...server,
                  metrics: {
                    ...server.metrics,
                    traffic_up_gb: message.data.total_up_gb,
                    traffic_down_gb: message.data.total_down_gb,
                  } as any,
                });
              }
              return newMap;
            });

            // Обновляем трафик клиентов
            // Ключ: email + server_id, чтобы хранить трафик с каждого сервера отдельно
            const clients: Array<{ email: string; up_bytes: number; down_bytes: number }> = message.data.clients || [];
            if (clients.length > 0) {
              setClientTraffic(prev => {
                const newMap = new Map(prev);
                for (const client of clients) {
                  // Храним по ключу email:server_id чтобы не перезаписывать данные с других серверов
                  const key = `${client.email}:${serverId}`;
                  newMap.set(key, {
                    email: client.email,
                    up_bytes: client.up_bytes,
                    down_bytes: client.down_bytes,
                    updated_at: timestamp,
                  });
                }
                return newMap;
              });
            }

            // Обновляем онлайн пользователей
            // Бэкенд уже применил grace period, так что доверяем данным
            const onlineUsers: string[] = message.data.online_users || [];
            // Используем полные данные подключений если есть (включают реальные IP)
            const onlineConnections: ActiveConnection[] = message.data.online_connections || [];

            setActiveConnections(prev => {
              const newMap = new Map(prev);
              let serverConnections = newMap.get(serverId);

              if (!serverConnections) {
                serverConnections = new Map();
              } else {
                // Создаём копию чтобы не мутировать
                serverConnections = new Map(serverConnections);
              }

              // Если есть полные данные подключений - используем их (с реальными IP)
              if (onlineConnections.length > 0) {
                for (const conn of onlineConnections) {
                  const existing = serverConnections.get(conn.client_email);
                  // Сохраняем реальный IP из connection event если он лучше чем новый
                  const existingHasRealIp = existing?.client_ip &&
                    existing.client_ip !== 'online' &&
                    existing.client_ip !== 'traffic-detected';
                  const newHasRealIp = conn.client_ip &&
                    conn.client_ip !== 'online' &&
                    conn.client_ip !== 'traffic-detected';
                  // Проверяем на длину - пустой массив [] в JS truthy!
                  const newHasIps = conn.all_ips && conn.all_ips.length > 0;
                  const existingHasIps = existing?.all_ips && existing.all_ips.length > 0;

                  serverConnections.set(conn.client_email, {
                    client_email: conn.client_email,
                    // Приоритет: новый реальный IP > существующий реальный IP > 'online'
                    client_ip: newHasRealIp ? conn.client_ip : (existingHasRealIp ? existing.client_ip : 'online'),
                    // Приоритет: новые IP если есть > существующие IP > пустой массив
                    all_ips: newHasIps ? conn.all_ips : (existingHasIps ? existing.all_ips : []),
                    inbound_tag: conn.inbound_tag || existing?.inbound_tag || '3x-ui',
                    connected_at: timestamp,
                  });
                }
              } else {
                // Fallback: только список email без IP
                for (const email of onlineUsers) {
                  const existing = serverConnections.get(email);
                  const preserveIp = existing?.client_ip &&
                    existing.client_ip !== 'online' &&
                    existing.client_ip !== 'traffic-detected';

                  serverConnections.set(email, {
                    client_email: email,
                    client_ip: preserveIp ? existing.client_ip : 'online',
                    all_ips: existing?.all_ips || [],
                    inbound_tag: preserveIp ? existing.inbound_tag : '3x-ui',
                    connected_at: timestamp,
                  });
                }
              }

              // Удаляем тех, кого нет в списке онлайн
              // Но только если список не пустой — пустой список может быть ошибкой агента/API
              // (защита от мерцания: все пропали на секунду → все вернулись)
              if (onlineUsers.length > 0 || serverConnections.size === 0) {
                for (const [email] of serverConnections.entries()) {
                  if (!onlineUsers.includes(email)) {
                    serverConnections.delete(email);
                  }
                }
              }

              newMap.set(serverId, serverConnections);
              return newMap;
            });
          }
          break;

        case 'speedtest':
          // Результат speedtest сервера
          if (message.server_id && message.data) {
            setServers(prev => {
              const newMap = new Map(prev);
              const server = newMap.get(message.server_id!);
              if (server) {
                newMap.set(message.server_id!, {
                  ...server,
                  bandwidth: message.data.speed_formatted,
                });
                // Уведомляем подписчиков
                const speedtestEvent: SpeedtestEvent = {
                  server_id: message.server_id!,
                  server_name: server.name,
                  ...message.data,
                  timestamp: message.timestamp || new Date().toISOString(),
                };
                speedtestCallbacksRef.current.forEach(cb => cb(speedtestEvent));
              }
              return newMap;
            });
          }
          break;

        case 'agent_components':
          // Статус компонентов агента
          if (message.server_id && message.components) {
            setServers(prev => {
              const newMap = new Map(prev);
              const server = newMap.get(message.server_id!);
              if (server) {
                newMap.set(message.server_id!, {
                  ...server,
                  components: {
                    ...message.components,
                    timestamp: message.timestamp,
                  },
                });
              }
              return newMap;
            });
          }
          break;

        case 'active_clients':
          // Обновление активных клиентов по трафику
          // ВАЖНО: НЕ перезаписываем существующие данные!
          // active_clients - это fallback когда нет online_connections с IP
          if (message.server_id && message.data?.active_emails) {
            const serverId = message.server_id;
            const activeEmails: string[] = message.data.active_emails;
            const timestamp = message.timestamp || new Date().toISOString();

            setActiveConnections(prev => {
              const newMap = new Map(prev);
              let serverConnections = newMap.get(serverId);

              if (!serverConnections) {
                serverConnections = new Map();
                newMap.set(serverId, serverConnections);
              } else {
                serverConnections = new Map(serverConnections);
              }

              const activeSet = new Set(activeEmails);

              // Добавляем/обновляем активных
              for (const email of activeEmails) {
                const existing = serverConnections.get(email);
                if (existing) {
                  serverConnections.set(email, {
                    ...existing,
                    connected_at: timestamp,
                  });
                } else {
                  serverConnections.set(email, {
                    client_email: email,
                    client_ip: 'traffic-detected',
                    all_ips: [],
                    inbound_tag: 'traffic',
                    connected_at: timestamp,
                  });
                }
              }

              // Удаляем тех, кого нет в activeEmails
              // Но только если список не пустой — пустой может быть ошибкой агента/API
              if (activeEmails.length > 0 || serverConnections.size === 0) {
                for (const [email] of serverConnections.entries()) {
                  if (!activeSet.has(email)) {
                    serverConnections.delete(email);
                  }
                }
              }

              newMap.set(serverId, serverConnections);
              return newMap;
            });
          }
          break;

        case 'user_traffic':
          // Агрегированный трафик по telegram ID (сумма со всех серверов)
          if (message.data?.traffic_by_tgid) {
            const trafficData: Record<string, number> = message.data.traffic_by_tgid;
            setAggregatedTrafficByTgid(new Map(Object.entries(trafficData)));
          }
          break;

        case 'app_online':
          // Пользователи с открытым приложением (web app)
          setAppOnlineCount(message.data?.count ?? (message as any).count ?? 0);
          setAppOnlineUserIds(message.data?.user_ids ?? (message as any).user_ids ?? []);
          break;

        case 'pong':
          // Ответ на ping - ничего не делаем
          break;

        case 'payment_new':
          // Новый платеж
          if (message.data) {
            const paymentEvent: PaymentEvent = {
              ...message.data,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            setRecentPayments(prev => [paymentEvent, ...prev].slice(0, 50));
            // Уведомляем подписчиков
            paymentCallbacksRef.current.forEach(cb => cb(paymentEvent));
          }
          break;

        case 'user_updated':
          // Пользователь обновлён (бан/разбан)
          if (message.data) {
            const userEvent: UserEvent = {
              ...message.data,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            setRecentUserEvents(prev => [userEvent, ...prev].slice(0, 50));
            userEventCallbacksRef.current.forEach(cb => cb(userEvent));
          }
          break;

        case 'user_deleted':
          // Пользователь удалён
          if (message.data) {
            const userDeleted: UserDeletedEvent = {
              ...message.data,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            setRecentUserDeleted(prev => [userDeleted, ...prev].slice(0, 50));
            userDeletedCallbacksRef.current.forEach(cb => cb(userDeleted));
          }
          break;

        case 'key_created':
          // Ключ создан
          if (message.data) {
            const keyEvent: KeyEvent = {
              ...message.data,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            setRecentKeyEvents(prev => [keyEvent, ...prev].slice(0, 50));
            keyEventCallbacksRef.current.forEach(cb => cb(keyEvent));
          }
          break;

        case 'key_deleted':
          // Ключ удалён
          if (message.data) {
            const keyDeleted: KeyDeletedEvent = {
              ...message.data,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            setRecentKeyDeleted(prev => [keyDeleted, ...prev].slice(0, 50));
            keyDeletedCallbacksRef.current.forEach(cb => cb(keyDeleted));
          }
          break;
      }
    } catch (e) {
      // Message parsing error - silently ignored
    }
  }, []);

  // Подключение к WebSocket
  const connect = useCallback(() => {
    const wsUrl = getWsUrl();

    if (!wsUrl) {
      setError('No authentication token');
      setConnectionStatus('error');
      return;
    }

    // Закрываем предыдущее соединение
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setError(null);

        // Запускаем ping каждые 30 секунд для поддержания соединения
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Останавливаем ping
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Автопереподключение
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setError('Max reconnect attempts reached');
          setConnectionStatus('error');
        }
      };

      ws.onerror = (event) => {
        setError('WebSocket connection error');
        setConnectionStatus('error');
      };

      wsRef.current = ws;
    } catch (e) {
      setError('Failed to create WebSocket connection');
      setConnectionStatus('error');
    }
  }, [getWsUrl, handleMessage, autoReconnect, reconnectAttempts, maxReconnectAttempts, reconnectInterval]);

  // Запрос метрик конкретного сервера
  const requestServerMetrics = useCallback((serverId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'get_server_metrics',
        server_id: serverId,
      }));
    }
  }, []);

  // Принудительное переподключение
  const reconnect = useCallback(() => {
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  // Отключение
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  // Подключаемся при монтировании
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  // Переподключаемся при изменении токена
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        reconnect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [reconnect]);

  // Периодическая очистка устаревших подключений (каждые 60 сек)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setActiveConnections(prev => {
        const newMap = new Map(prev);
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

        for (const [serverId, connections] of newMap.entries()) {
          for (const [email, conn] of connections.entries()) {
            const connTime = new Date(conn.connected_at).getTime();
            if (connTime < tenMinutesAgo) {
              connections.delete(email);
            }
          }
          // Удаляем пустые серверы
          if (connections.size === 0) {
            newMap.delete(serverId);
          }
        }

        return newMap;
      });
    }, 60000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Функции подписки на события
  const onPayment = useCallback((callback: (event: PaymentEvent) => void) => {
    paymentCallbacksRef.current.add(callback);
    return () => { paymentCallbacksRef.current.delete(callback); };
  }, []);

  const onUserEvent = useCallback((callback: (event: UserEvent) => void) => {
    userEventCallbacksRef.current.add(callback);
    return () => { userEventCallbacksRef.current.delete(callback); };
  }, []);

  const onUserDeleted = useCallback((callback: (event: UserDeletedEvent) => void) => {
    userDeletedCallbacksRef.current.add(callback);
    return () => { userDeletedCallbacksRef.current.delete(callback); };
  }, []);

  const onKeyEvent = useCallback((callback: (event: KeyEvent) => void) => {
    keyEventCallbacksRef.current.add(callback);
    return () => { keyEventCallbacksRef.current.delete(callback); };
  }, []);

  const onKeyDeleted = useCallback((callback: (event: KeyDeletedEvent) => void) => {
    keyDeletedCallbacksRef.current.add(callback);
    return () => { keyDeletedCallbacksRef.current.delete(callback); };
  }, []);

  const onSpeedtestResult = useCallback((callback: (event: SpeedtestEvent) => void) => {
    speedtestCallbacksRef.current.add(callback);
    return () => { speedtestCallbacksRef.current.delete(callback); };
  }, []);

  return {
    servers,
    isConnected,
    connectionStatus,
    error,
    reconnectAttempts,
    recentConnections,
    activeConnections,
    clientTraffic,
    aggregatedTrafficByTgid,
    appOnlineCount,
    appOnlineUserIds,
    requestServerMetrics,
    reconnect,
    disconnect,
    // Real-time события
    recentPayments,
    recentUserEvents,
    recentUserDeleted,
    recentKeyEvents,
    recentKeyDeleted,
    // Callbacks для подписки
    onPayment,
    onUserEvent,
    onUserDeleted,
    onKeyEvent,
    onKeyDeleted,
    onSpeedtestResult,
  };
}

/**
 * Hook для получения метрик конкретного сервера из WebSocket
 */
export function useServerMetrics(serverId: number) {
  const { servers, isConnected, requestServerMetrics } = useServerWebSocket();

  const server = servers.get(serverId);

  // Запрашиваем метрики при подключении
  useEffect(() => {
    if (isConnected && serverId) {
      requestServerMetrics(serverId);
    }
  }, [isConnected, serverId, requestServerMetrics]);

  return {
    metrics: server?.metrics || null,
    status: server?.status || 'offline',
    agentStatus: server?.agent_status || 'not_installed',
    isConnected,
  };
}
