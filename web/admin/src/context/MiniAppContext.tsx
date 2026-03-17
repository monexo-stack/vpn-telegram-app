import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isTelegramWebApp, getTelegramWebApp, getTelegramTheme } from '../utils/telegram';

interface MiniAppContextType {
  isMiniApp: boolean;
  theme: 'light' | 'dark';
  themeParams: {
    bgColor?: string;
    textColor?: string;
    hintColor?: string;
    linkColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    secondaryBgColor?: string;
  };
}

const MiniAppContext = createContext<MiniAppContextType>({
  isMiniApp: false,
  theme: 'light',
  themeParams: {},
});

export function MiniAppProvider({ children }: { children: ReactNode }) {
  // Check immediately on init - this is crucial for first render
  const [isMiniApp] = useState(() => isTelegramWebApp());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getTelegramTheme());
  const [themeParams, setThemeParams] = useState<MiniAppContextType['themeParams']>({});

  useEffect(() => {
    if (isMiniApp) {
      const webApp = getTelegramWebApp();
      if (webApp) {
        // Get theme params
        const params = webApp.themeParams;
        setThemeParams({
          bgColor: params.bg_color,
          textColor: params.text_color,
          hintColor: params.hint_color,
          linkColor: params.link_color,
          buttonColor: params.button_color,
          buttonTextColor: params.button_text_color,
          secondaryBgColor: params.secondary_bg_color,
        });
        setTheme(webApp.colorScheme);
      }
    }
  }, [isMiniApp]);

  return (
    <MiniAppContext.Provider value={{ isMiniApp, theme, themeParams }}>
      {children}
    </MiniAppContext.Provider>
  );
}

export function useMiniApp() {
  return useContext(MiniAppContext);
}
