import React, { createContext, useContext, ReactNode } from 'react';
import {
  useServerWebSocket,
  ActiveConnection,
  ServerMetrics,
  AgentComponents,
  ClientTraffic,
  PaymentEvent,
  UserEvent,
  UserDeletedEvent,
  KeyEvent,
  KeyDeletedEvent,
  SpeedtestEvent
} from '../hooks/useServerWebSocket';

interface ServerState {
  id: number;
  name: string;
  ip: string;
  agent_status: 'online' | 'offline' | 'not_installed';
  agent_installed: boolean;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  location_id?: number;
  metrics?: ServerMetrics;
  bandwidth?: string;
  components?: AgentComponents;
}

interface ConnectionEvent {
  event: 'connect' | 'disconnect';
  client_email: string;
  client_ip: string;
  inbound_tag?: string;
  timestamp: string;
  server_id: number;
}

interface WebSocketContextValue {
  servers: Map<number, ServerState>;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  reconnectAttempts: number;
  recentConnections: ConnectionEvent[];
  activeConnections: Map<number, Map<string, ActiveConnection>>;
  clientTraffic: Map<string, ClientTraffic>;
  aggregatedTrafficByTgid: Map<string, number>;
  appOnlineCount: number;
  appOnlineUserIds: number[];
  requestServerMetrics: (serverId: number) => void;
  reconnect: () => void;
  disconnect: () => void;
  // Real-time события
  recentPayments: PaymentEvent[];
  recentUserEvents: UserEvent[];
  recentUserDeleted: UserDeletedEvent[];
  recentKeyEvents: KeyEvent[];
  recentKeyDeleted: KeyDeletedEvent[];
  // Callbacks для подписки на события
  onPayment: (callback: (event: PaymentEvent) => void) => () => void;
  onUserEvent: (callback: (event: UserEvent) => void) => () => void;
  onUserDeleted: (callback: (event: UserDeletedEvent) => void) => () => void;
  onKeyEvent: (callback: (event: KeyEvent) => void) => () => void;
  onKeyDeleted: (callback: (event: KeyDeletedEvent) => void) => () => void;
  onSpeedtestResult: (callback: (event: SpeedtestEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsState = useServerWebSocket();

  return (
    <WebSocketContext.Provider value={wsState}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Hook для получения онлайн статуса пользователей по telegramId
 * (для использования на странице Keys)
 */
export function useOnlineUsers() {
  const { isConnected, connectionStatus, activeConnections, clientTraffic, aggregatedTrafficByTgid, appOnlineCount, appOnlineUserIds } = useWebSocket();

  const onlineTelegramIds = React.useMemo(() => {
    const ids = new Set<string>();

    for (const [, serverConnections] of activeConnections) {
      for (const [email] of serverConnections) {
        // Извлекаем tgid из email (формат: {tgid}_vpn)
        const match = email.match(/^(\d+)_/);
        if (match) {
          ids.add(match[1]);
        }
      }
    }

    return ids;
  }, [activeConnections]);

  const onlineCount = React.useMemo(() => {
    return onlineTelegramIds.size;
  }, [onlineTelegramIds]);

  const totalConnections = React.useMemo(() => {
    let count = 0;
    for (const [, serverConnections] of activeConnections) {
      count += serverConnections.size;
    }
    return count;
  }, [activeConnections]);

  // Агрегированный трафик по telegram ID от бэкенда (сумма со всех серверов)
  // Бэкенд отправляет корректные totals, без partial sums
  const trafficByTelegramId = React.useMemo(() => {
    const traffic = new Map<string, { up_bytes: number; down_bytes: number }>();

    for (const [tgid, totalBytes] of aggregatedTrafficByTgid) {
      traffic.set(tgid, {
        up_bytes: 0,
        down_bytes: totalBytes,
      });
    }

    return traffic;
  }, [aggregatedTrafficByTgid]);

  return {
    isConnected,
    connectionStatus,
    onlineTelegramIds,
    onlineCount,
    totalConnections,
    clientTraffic,
    trafficByTelegramId,
    appOnlineCount,
    appOnlineUserIds,
  };
}
