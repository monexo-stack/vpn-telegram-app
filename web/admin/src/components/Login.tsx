import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { apiClient } from '../services/api';
import { isTelegramWebApp, getTelegramInitData, initTelegramWebApp } from '../utils/telegram';

interface LoginProps {
  onLogin: (role?: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Telegram Mini App state - check immediately on init
  const [isMiniApp] = useState(() => isTelegramWebApp());
  const [telegramLoading, setTelegramLoading] = useState(() => isTelegramWebApp());
  const [telegramError, setTelegramError] = useState('');

  // Check for Telegram Mini App on mount
  useEffect(() => {
    const checkMiniApp = async () => {
      if (isMiniApp) {
        initTelegramWebApp();

        // Auto-authenticate with Telegram
        try {
          const initData = getTelegramInitData();
          if (initData) {
            const response = await apiClient.telegramAuth(initData);
            if (response && response.token) {
              localStorage.setItem('admin_token', response.token);
              if (response.refresh_token) {
                localStorage.setItem('admin_refresh_token', response.refresh_token);
              }
              localStorage.setItem('admin_login_time', Date.now().toString());
              onLogin(response.role);
              return;
            }
          }
          setTelegramError('Не удалось получить данные Telegram');
        } catch (err: any) {
          if (err.response?.status === 403) {
            setTelegramError('Доступ запрещён. Вы не являетесь администратором.');
          } else if (err.response?.status === 401) {
            setTelegramError('Сессия истекла. Перезапустите приложение.');
          } else {
            setTelegramError('Ошибка авторизации через Telegram');
          }
        }
      }
      setTelegramLoading(false);
    };

    checkMiniApp();
  }, [isMiniApp, onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.login(login, password);
      if (response && response.token) {
        localStorage.setItem('admin_token', response.token);
        if (response.refresh_token) {
          localStorage.setItem('admin_refresh_token', response.refresh_token);
        }
        localStorage.setItem('admin_login_time', Date.now().toString());
        onLogin(response.role);
      }
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Ошибка подключения к серверу');
      } else if (err.response?.status === 401) {
        setError('Неверный логин или пароль');
      } else {
        setError(err.response?.data?.detail || 'Ошибка авторизации');
      }
      setIsLoading(false);
    }
  };

  // Show loading while checking Mini App
  if (isMiniApp && telegramLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Авторизация через Telegram...</p>
        </div>
      </div>
    );
  }

  // Show error if Telegram auth failed (Mini App context)
  if (isMiniApp && telegramError) {
    return (
      <div className="min-h-svh flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">Ошибка авторизации</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{telegramError}</p>
            <p className="text-sm text-muted-foreground">
              Закройте приложение и попробуйте снова
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular login form (web version)
  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
        <Card className="gap-4">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Вход в панель</CardTitle>
            <CardDescription>
              Введите логин и пароль для входа в аккаунт
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login">Логин</Label>
                <Input
                  id="login"
                  type="text"
                  placeholder="admin"
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    setError('');
                  }}
                  required
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  'Войти'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
