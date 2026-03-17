import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode } from 'react';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
} from '../utils/telegram';
import { useMiniApp } from './MiniAppContext';

interface BackButtonContextType {
  pushHandler: (handler: () => void) => void;
  popHandler: () => void;
}

const BackButtonContext = createContext<BackButtonContextType | null>(null);

/**
 * Provider that manages Telegram BackButton handlers in a stack.
 * Allows modals to push their handler and restore the previous one when closed.
 */
export function BackButtonProvider({ children }: { children: ReactNode }) {
  const { isMiniApp } = useMiniApp();

  // Stack of handlers (most recent is active)
  const handlersRef = useRef<(() => void)[]>([]);

  // Current active handler ref (for stable callback)
  const activeHandlerRef = useRef<(() => void) | null>(null);

  // Stable callback that calls the current active handler
  const stableCallbackRef = useRef(() => {
    if (activeHandlerRef.current) {
      activeHandlerRef.current();
    }
  });

  // Update the active handler and show/hide button
  const updateBackButton = useCallback(() => {
    if (!isMiniApp) return;

    const handlers = handlersRef.current;
    if (handlers.length > 0) {
      activeHandlerRef.current = handlers[handlers.length - 1];
      showBackButton();
    } else {
      activeHandlerRef.current = null;
      hideBackButton();
    }
  }, [isMiniApp]);

  // Push a new handler onto the stack
  const pushHandler = useCallback((handler: () => void) => {
    handlersRef.current.push(handler);
    updateBackButton();
  }, [updateBackButton]);

  // Pop the current handler from the stack
  const popHandler = useCallback(() => {
    handlersRef.current.pop();
    updateBackButton();
  }, [updateBackButton]);

  // Set up the global back button listener
  useEffect(() => {
    if (!isMiniApp) return;

    const callback = stableCallbackRef.current;
    onBackButtonClick(callback);

    return () => {
      offBackButtonClick(callback);
    };
  }, [isMiniApp]);

  return (
    <BackButtonContext.Provider value={{ pushHandler, popHandler }}>
      {children}
    </BackButtonContext.Provider>
  );
}

/**
 * Hook to get the back button context
 */
export function useBackButtonContext() {
  return useContext(BackButtonContext);
}

/**
 * Hook to register a back button handler for a modal/component.
 * Automatically pushes handler when isActive is true and pops when false.
 */
export function useBackButton(isActive: boolean, onBack: () => void) {
  const context = useContext(BackButtonContext);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Stable handler reference
  const handlerRef = useRef(() => {
    onBackRef.current();
  });

  useEffect(() => {
    if (!context) return;

    if (isActive) {
      context.pushHandler(handlerRef.current);
      return () => {
        context.popHandler();
      };
    }
  }, [context, isActive]);
}
