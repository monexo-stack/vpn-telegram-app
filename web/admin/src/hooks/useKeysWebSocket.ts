import { useOnlineUsers } from '../context/WebSocketContext';

/**
 * Hook для real-time обновлений ключей через WebSocket
 * Использует общий WebSocket контекст
 */
export function useKeysWebSocket() {
  const data = useOnlineUsers();

  return {
    ...data,
    // Получить трафик для telegram ID
    getTrafficForTelegramId: (telegramId: string) => {
      return data.trafficByTelegramId.get(telegramId) || null;
    },
  };
}
