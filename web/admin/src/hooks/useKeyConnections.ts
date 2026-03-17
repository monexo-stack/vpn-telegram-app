import { useMemo } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export interface KeyConnection {
  serverId: number;
  clientEmail: string;
  clientIp: string;
  allIps?: string[];  // Все IP адреса клиента
  inboundTag?: string;
  connectedAt: string;
}

interface KeyConnectionsResult {
  connections: KeyConnection[];
  uniqueIps: string[];
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

/**
 * Hook для получения real-time подключений пользователя по Telegram ID
 * Используется в KeyDetailsModal для показа онлайн IP адресов
 */
export function useKeyConnections(telegramId: string | number | undefined): KeyConnectionsResult {
  const { activeConnections, isConnected, connectionStatus } = useWebSocket();

  const result = useMemo(() => {
    const connections: KeyConnection[] = [];
    const ipsSet = new Set<string>();

    if (!telegramId) {
      return { connections: [], uniqueIps: [] };
    }

    const tgidStr = String(telegramId);

    // Перебираем все серверы и их подключения
    for (const [serverId, serverConnections] of activeConnections) {
      for (const [email, conn] of serverConnections) {
        // Email имеет формат: {tgid}_vpn
        // Например: 123456789_vpn
        const match = email.match(/^(\d+)_/);
        if (match && match[1] === tgidStr) {
          connections.push({
            serverId,
            clientEmail: conn.client_email,
            clientIp: conn.client_ip,
            allIps: conn.all_ips || [],
            inboundTag: conn.inbound_tag,
            connectedAt: conn.connected_at,
          });

          // Собираем уникальные IP (исключаем служебные значения)
          // Используем all_ips если есть, иначе client_ip
          const ipsToAdd = conn.all_ips && conn.all_ips.length > 0
            ? conn.all_ips
            : (conn.client_ip && conn.client_ip !== 'online' && conn.client_ip !== 'traffic-detected'
              ? [conn.client_ip]
              : []);
          for (const ip of ipsToAdd) {
            if (ip && ip !== 'online' && ip !== 'traffic-detected') {
              ipsSet.add(ip);
            }
          }
        }
      }
    }

    return {
      connections,
      uniqueIps: Array.from(ipsSet),
    };
  }, [activeConnections, telegramId]);

  return {
    ...result,
    isConnected,
    connectionStatus,
  };
}

/**
 * Hook для получения подключений по subscription token
 * Группирует подключения по серверам
 */
export function useSubscriptionConnections(subscriptionToken: string | undefined) {
  const { activeConnections, isConnected, connectionStatus, servers } = useWebSocket();

  const result = useMemo(() => {
    const connectionsByServer = new Map<number, KeyConnection[]>();
    const allIps = new Set<string>();

    if (!subscriptionToken) {
      return { connectionsByServer, uniqueIps: [], totalConnections: 0 };
    }

    // Из subscription_token извлекаем tgid (первые цифры до первого _)
    // или ищем по всем подключениям email которые содержат token
    // В текущей архитектуре email = {tgid}_vpn

    for (const [serverId, serverConnections] of activeConnections) {
      const serverConns: KeyConnection[] = [];

      for (const [email, conn] of serverConnections) {
        // Проверяем принадлежность к этой подписке
        // Email содержит subscription_token часть
        if (email.includes(subscriptionToken.substring(0, 8))) {
          serverConns.push({
            serverId,
            clientEmail: conn.client_email,
            clientIp: conn.client_ip,
            inboundTag: conn.inbound_tag,
            connectedAt: conn.connected_at,
          });

          if (conn.client_ip &&
              conn.client_ip !== 'online' &&
              conn.client_ip !== 'traffic-detected') {
            allIps.add(conn.client_ip);
          }
        }
      }

      if (serverConns.length > 0) {
        connectionsByServer.set(serverId, serverConns);
      }
    }

    return {
      connectionsByServer,
      uniqueIps: Array.from(allIps),
      totalConnections: Array.from(connectionsByServer.values()).reduce((sum, conns) => sum + conns.length, 0),
    };
  }, [activeConnections, subscriptionToken]);

  return {
    ...result,
    servers,
    isConnected,
    connectionStatus,
  };
}
