import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cn } from './ui/utils';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'token' | 'credentials' | 'verify';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('token');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [maskedTgId, setMaskedTgId] = useState('');

  const handleVerifyToken = async () => {
    if (!setupToken.trim()) {
      setError('Введите setup token');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_token: setupToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Неверный setup token');
      }

      setCurrentStep('credentials');
    } catch (err: any) {
      setError(err.message || 'Ошибка проверки токена');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Введите логин');
      return;
    }
    if (username.length < 3) {
      setError('Логин должен быть не менее 3 символов');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_token: setupToken,
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка регистрации');
      }

      setMaskedTgId(data.masked_tgid || '***');
      setCurrentStep('verify');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_token: setupToken,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Неверный код');
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Ошибка подтверждения');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_token: setupToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Не удалось отправить код');
      }

      setError('');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        {/* Step 1: Token */}
        {currentStep === 'token' && (
          <>
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Настройка панели
              </h1>
              <p className="text-sm text-muted-foreground">
                Введите Setup Token из консоли сервера
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="setup-token">Setup Token</Label>
                <Input
                  id="setup-token"
                  type="text"
                  placeholder="XXXXXXXXXXXXXXXX"
                  value={setupToken}
                  onChange={(e) => {
                    setSetupToken(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className="font-mono text-center tracking-wider"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleVerifyToken}
                disabled={isLoading || !setupToken.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  'Продолжить'
                )}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Credentials */}
        {currentStep === 'credentials' && (
          <>
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Создание аккаунта
              </h1>
              <p className="text-sm text-muted-foreground">
                Придумайте логин и пароль для входа
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Запишите логин и пароль. Восстановление возможно только через Telegram.
              </p>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('token')}
                  disabled={isLoading}
                >
                  Назад
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={isLoading || !username.trim() || !password || !confirmPassword}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    'Получить код'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Verify */}
        {currentStep === 'verify' && (
          <>
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Подтверждение
              </h1>
              <p className="text-sm text-muted-foreground">
                Введите код из Telegram ({maskedTgId})
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="verification-code">Код подтверждения</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                    setError('');
                  }}
                  className="font-mono text-center text-2xl tracking-[0.5em]"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Код действителен 5 минут
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  'Завершить настройку'
                )}
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep('credentials')}
                  disabled={isLoading}
                >
                  Назад
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendCode}
                  disabled={isLoading}
                >
                  Отправить повторно
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {['token', 'credentials', 'verify'].map((step, index) => {
            const stepIndex = ['token', 'credentials', 'verify'].indexOf(currentStep);
            const isActive = step === currentStep;
            const isPast = index < stepIndex;

            return (
              <div
                key={step}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  isActive && 'bg-primary w-4',
                  isPast && 'bg-primary',
                  !isActive && !isPast && 'bg-muted-foreground/30'
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
