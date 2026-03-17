import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  /** Интервал обновления в миллисекундах (по умолчанию 30 секунд) */
  interval?: number;
  /** Включено ли автообновление (по умолчанию true) */
  enabled?: boolean;
  /** Приостанавливать при неактивной вкладке (по умолчанию true) */
  pauseWhenHidden?: boolean;
}

/**
 * Хук для автоматического обновления данных
 * @param fetchFn - Функция для получения данных
 * @param options - Опции автообновления
 */
export function useAutoRefresh(
  fetchFn: () => void | Promise<void>,
  options: UseAutoRefreshOptions = {}
) {
  const {
    interval = 30000, // 30 секунд по умолчанию
    enabled = true,
    pauseWhenHidden = true,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHiddenRef = useRef(false);

  const refresh = useCallback(() => {
    if (pauseWhenHidden && isHiddenRef.current) {
      return;
    }
    fetchFn();
  }, [fetchFn, pauseWhenHidden]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Запускаем интервал
    intervalRef.current = setInterval(refresh, interval);

    // Обработчик видимости вкладки
    const handleVisibilityChange = () => {
      isHiddenRef.current = document.hidden;

      // Если вкладка стала активной - сразу обновляем данные
      if (!document.hidden && pauseWhenHidden) {
        refresh();
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enabled, interval, refresh, pauseWhenHidden]);

  // Возвращаем функцию для ручного обновления
  return { refresh };
}
