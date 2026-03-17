import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  isTelegramWebApp,
  getTelegramTheme,
  onThemeChange,
  offThemeChange,
} from '../utils/telegram';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isTelegramControlled: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Синхронное получение темы для избежания мерцания
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  // В Telegram Mini App используем тему Telegram
  if (isTelegramWebApp()) {
    return getTelegramTheme();
  }

  // В обычном браузере используем localStorage
  const saved = localStorage.getItem('theme') as Theme;
  if (saved === 'light' || saved === 'dark') return saved;
  // По умолчанию тёмная тема
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Инициализация из localStorage или Telegram сразу (без useEffect)
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [isTelegramControlled] = useState(() => isTelegramWebApp());

  // Слушаем изменения темы в Telegram
  const handleTelegramThemeChange = useCallback(() => {
    const newTheme = getTelegramTheme();
    setTheme(newTheme);
  }, []);

  useEffect(() => {
    if (isTelegramControlled) {
      // Подписываемся на изменения темы в Telegram
      onThemeChange(handleTelegramThemeChange);
      return () => {
        offThemeChange(handleTelegramThemeChange);
      };
    }
  }, [isTelegramControlled, handleTelegramThemeChange]);

  // Применяем тему к DOM и сохраняем (только в браузере)
  useEffect(() => {
    // В браузере сохраняем в localStorage
    if (!isTelegramControlled) {
      localStorage.setItem('theme', theme);
    }

    // Всегда применяем класс к DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isTelegramControlled]);

  const toggleTheme = () => {
    // В Telegram нельзя переключать тему - она управляется клиентом
    if (isTelegramControlled) return;
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTelegramControlled }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

