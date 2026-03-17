/**
 * Telegram WebApp utilities for Admin Panel Mini App
 */

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  disableVerticalSwipes: () => void;
  enableVerticalSwipes: () => void;
  isFullscreen: boolean;
  isVerticalSwipesEnabled: boolean;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
  BackButton: TelegramBackButton;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Check if running inside Telegram Mini App
 */
export function isTelegramWebApp(): boolean {
  const webApp = getTelegramWebApp();
  return webApp !== null && webApp.initData !== '';
}

/**
 * Get Telegram initData string for authentication
 */
export function getTelegramInitData(): string {
  const webApp = getTelegramWebApp();
  return webApp?.initData || '';
}

/**
 * Initialize Telegram WebApp - expand to fullsize mode
 */
export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    // Expand to maximum available height (fullsize mode)
    webApp.expand();

    // Disable vertical swipes to prevent accidental close
    if (typeof webApp.disableVerticalSwipes === 'function') {
      webApp.disableVerticalSwipes();
    }

    // Signal that app is ready
    webApp.ready();
  }
}

/**
 * Get current Telegram theme (light or dark)
 */
export function getTelegramTheme(): 'light' | 'dark' {
  const webApp = getTelegramWebApp();
  return webApp?.colorScheme || 'light';
}

/**
 * Get Telegram user info from initDataUnsafe
 */
export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
}

/**
 * Check if Mini App is in fullscreen mode
 */
export function isFullscreen(): boolean {
  const webApp = getTelegramWebApp();
  return webApp?.isFullscreen || false;
}

/**
 * Exit fullscreen mode
 */
export function exitFullscreen(): void {
  const webApp = getTelegramWebApp();
  if (webApp && typeof webApp.exitFullscreen === 'function') {
    webApp.exitFullscreen();
  }
}

/**
 * Close the Mini App
 */
export function closeTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  webApp?.close();
}

/**
 * Show Telegram BackButton
 */
export function showBackButton(): void {
  const webApp = getTelegramWebApp();
  webApp?.BackButton?.show();
}

/**
 * Hide Telegram BackButton
 */
export function hideBackButton(): void {
  const webApp = getTelegramWebApp();
  webApp?.BackButton?.hide();
}

/**
 * Check if BackButton is visible
 */
export function isBackButtonVisible(): boolean {
  const webApp = getTelegramWebApp();
  return webApp?.BackButton?.isVisible || false;
}

/**
 * Subscribe to BackButton click event
 */
export function onBackButtonClick(callback: () => void): void {
  const webApp = getTelegramWebApp();
  webApp?.BackButton?.onClick(callback);
}

/**
 * Unsubscribe from BackButton click event
 */
export function offBackButtonClick(callback: () => void): void {
  const webApp = getTelegramWebApp();
  webApp?.BackButton?.offClick(callback);
}

/**
 * Subscribe to theme change event
 */
export function onThemeChange(callback: () => void): void {
  const webApp = getTelegramWebApp();
  webApp?.onEvent('themeChanged', callback);
}

/**
 * Unsubscribe from theme change event
 */
export function offThemeChange(callback: () => void): void {
  const webApp = getTelegramWebApp();
  webApp?.offEvent('themeChanged', callback);
}
