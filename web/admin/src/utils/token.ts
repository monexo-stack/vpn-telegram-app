/**
 * Утилиты для работы с JWT токенами
 */

/**
 * Декодирует JWT токен без проверки подписи (только для получения payload)
 * @param token JWT токен
 * @returns Payload токена или null, если токен невалиден
 */
export function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // Декодируем payload (вторая часть токена)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Проверяет, истек ли JWT токен
 * @param token JWT токен
 * @returns true, если токен истек или невалиден, false если токен валиден
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true; // Если нет exp, считаем токен невалидным
  }
  
  // exp в JWT - это Unix timestamp в секундах
  const expirationTime = payload.exp * 1000; // Конвертируем в миллисекунды
  const currentTime = Date.now();
  
  // Добавляем небольшой запас (5 секунд) для учета задержек сети
  return currentTime >= (expirationTime - 5000);
}

/**
 * Получает время истечения токена в миллисекундах
 * @param token JWT токен
 * @returns Время истечения в миллисекундах или null, если токен невалиден
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }
  
  return payload.exp * 1000; // Конвертируем в миллисекунды
}

/**
 * Получает оставшееся время жизни токена в миллисекундах
 * @param token JWT токен
 * @returns Оставшееся время в миллисекундах или 0, если токен истек/невалиден
 */
export function getTokenTimeRemaining(token: string): number {
  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) {
    return 0;
  }
  
  const remaining = expirationTime - Date.now();
  return Math.max(0, remaining);
}


