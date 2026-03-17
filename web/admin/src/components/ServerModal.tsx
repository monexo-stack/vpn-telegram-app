import React, { useState } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { apiClient } from '../services/api';
import { useBackButton } from '../hooks/useBackButton';

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  locationName: string;
  server?: any; // Для редактирования существующего сервера
}

export function ServerModal({ isOpen, onClose, onSave, locationName, server }: ServerModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [formData, setFormData] = useState({
    ip: server?.ip || '',
    sshUsername: server?.login || 'root',
    password: '', // Пароли не возвращаются из API, оставляем пустым при редактировании
    sshKey: '', // SSH ключ (альтернатива паролю)
    authMethod: 'password' as 'password' | 'key', // Метод авторизации
    panelUrl: server?.x3ui_url || '',
    panelLogin: server?.x3ui_username || '',
    panelPassword: '', // Пароли не возвращаются из API, оставляем пустым при редактировании
    maxUsers: server?.max_space ? server.max_space.toString() : '',
    inbound: server?.inbound_id ? server.inbound_id.toString() : '',
  });

  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');
  const [isFullyChecked, setIsFullyChecked] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState<string | null>(null);
  const [recommendedUsers, setRecommendedUsers] = useState<number | null>(null);
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });
  const [ipExists, setIpExists] = useState<{ exists: boolean; location?: string } | null>(null);
  const [isCheckingIP, setIsCheckingIP] = useState(false);

  // Проверка IP на существование
  const checkIP = React.useCallback(async (ip: string) => {
    if (!ip || ip.trim().length === 0) {
      setIpExists(null);
      setIsCheckingIP(false);
      return;
    }

    setIsCheckingIP(true);
    try {
      // is_trial deprecated - проверяем только по IP
      const result = await apiClient.checkServerIP(ip.trim());
      if (result.exists && result.server) {
        setIpExists({ exists: true, location: result.server.location });
      } else {
        setIpExists({ exists: false });
      }
    } catch {
      setIpExists(null);
    } finally {
      setIsCheckingIP(false);
    }
  }, []);

  // Сброс состояний только при первом открытии модального окна
  const prevIsOpenRef = React.useRef(false);
  React.useEffect(() => {
    // Сбрасываем состояния только когда модальное окно открывается (переход false -> true)
    if (isOpen && !prevIsOpenRef.current) {
      // Заполняем данными сервера при редактировании
      if (server) {
        setFormData({
          ip: server.ip || '',
          sshUsername: server.login || 'root',
          password: '',
          sshKey: '',
          authMethod: server.has_ssh_key ? 'key' : 'password',
          panelUrl: server.x3ui_url || '',
          panelLogin: server.x3ui_username || '',
          panelPassword: '',
          maxUsers: server.max_space ? server.max_space.toString() : '',
          inbound: server.inbound_id ? server.inbound_id.toString() : '',
        });
      } else {
        setFormData({
          ip: '',
          sshUsername: 'root',
          password: '',
          sshKey: '',
          authMethod: 'password',
          panelUrl: '',
          panelLogin: '',
          panelPassword: '',
          maxUsers: '',
          inbound: '',
        });
      }
      setResultModal({ isOpen: false, title: '', message: '', type: 'success' });
      setIpExists(null);
      setIsCheckingIP(false);
      setIsFullyChecked(false);
      setCheckStatus('');
      setSpeedTestResult(null);
      setRecommendedUsers(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, server]);

  // Debounce для проверки IP
  React.useEffect(() => {
    if (!isOpen) return;

    // Не проверяем IP если редактируем сервер и IP не изменился
    if (server && formData.ip === server.ip) {
      setIpExists(null);
      return;
    }

    const timer = setTimeout(() => {
      if (formData.ip) {
        checkIP(formData.ip);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.ip, checkIP, isOpen, server]);

  const updateField = React.useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Сбрасываем статусы при изменении полей
    setIsFullyChecked(false);
    setCheckStatus('');
    if (field === 'ip') {
      setSpeedTestResult(null);
      setRecommendedUsers(null);
      setIpExists(null); // Сбрасываем проверку IP
    }
    if (field === 'password' || field === 'sshKey' || field === 'authMethod') {
      setSpeedTestResult(null);
      setRecommendedUsers(null);
    }
  }, []);

  const fullCheck = React.useCallback(async () => {
    // Валидация обязательных полей
    const hasAuth = formData.authMethod === 'key' ? !!formData.sshKey : !!formData.password;
    if (!formData.ip || !hasAuth || !formData.panelUrl || !formData.panelLogin || !formData.panelPassword) {
      setCheckStatus('❌ Заполните все обязательные поля сервера');
      return;
    }

    setIsChecking(true);
    setCheckStatus('Подключение к серверу...');
    setIsFullyChecked(false);
    setSpeedTestResult(null);

    try {
      const checkData: any = {
        server_ip: formData.ip,
        x3ui_url: formData.panelUrl,
        x3ui_username: formData.panelLogin,
        x3ui_password: formData.panelPassword,
        ssh_username: formData.sshUsername,
      };
      if (formData.authMethod === 'key') {
        checkData.ssh_key = formData.sshKey;
      } else {
        checkData.ssh_password = formData.password;
      }

      // Добавляем inbound только если он указан
      if (formData.inbound && formData.inbound.trim() !== '') {
        checkData.inbound = parseInt(formData.inbound);
      }

      const result = await apiClient.fullServerCheck(checkData);

      // Проверяем наличие steps
      if (!result.steps) {
        setIsChecking(false);
        setIsFullyChecked(false);
        setCheckStatus('❌ Ошибка: некорректный ответ сервера');
        return;
      }

      // Проверка завершена
      setIsChecking(false);

      // SSH и 3x-ui обязательны, speedtest опционален
      const sshSuccess = result.steps.ssh_connection?.status === 'success';
      const x3uiSuccess = result.steps.x3ui_connection?.status === 'success';
      const speedtestSuccess = result.steps.speedtest_run?.status === 'success';
      const corePassed = sshSuccess && x3uiSuccess;

      if (corePassed) {
        if (speedtestSuccess && result.data.speedtest) {
          const speedtest = result.data.speedtest;
          setCheckStatus('✅ Все проверки пройдены успешно');
          setSpeedTestResult(speedtest.speed_formatted);
          setRecommendedUsers(speedtest.recommended_users);

          // Автоматически подставляем рекомендуемое количество пользователей
          if (speedtest.recommended_users) {
            setFormData(prev => ({ ...prev, maxUsers: speedtest.recommended_users.toString() }));
          }
        } else {
          setCheckStatus('⚠️ SSH и 3x-ui успешны, speedtest не удался');
        }
        setIsFullyChecked(true);
      } else {
        // Провалились обязательные проверки — показываем конкретную причину
        let errorMsg = '';

        if (result.steps.ssh_connection.status === 'failed') {
          const sshMsg = result.steps.ssh_connection.message || '';
          errorMsg = `❌ SSH: ${sshMsg || 'Не удалось подключиться. Проверьте IP, логин и пароль.'}`;
        } else if (result.steps.x3ui_connection.status === 'failed') {
          const x3uiMsg = result.steps.x3ui_connection.message || '';
          errorMsg = `❌ 3x-ui: ${x3uiMsg || 'Проверьте URL панели, логин и пароль.'}`;
        } else {
          errorMsg = '❌ Проверка не пройдена. Проверьте все данные сервера.';
        }

        setCheckStatus(errorMsg);
        setIsFullyChecked(false);
      }
    } catch (error: any) {
      setIsChecking(false);
      setIsFullyChecked(false);
      const errorMsg = error.response?.data?.message || 'Ошибка при проверке сервера';
      setCheckStatus(`❌ ${errorMsg}`);
    }
  }, [formData]);

  const handleClose = React.useCallback(() => {
    if (isChecking) {
      setResultModal({
        isOpen: true,
        title: 'Проверка в процессе',
        message: 'Дождитесь завершения проверки сервера перед закрытием',
        type: 'error'
      });
      return;
    }
    onClose();
  }, [isChecking, onClose]);

  const handleSave = React.useCallback(async () => {
    // При редактировании пароли необязательны (если пустые, не обновляем)
    const isEditing = !!server;
    const hasAuth = formData.authMethod === 'key' ? !!formData.sshKey : !!formData.password;
    const requiredFields = isEditing
      ? [formData.ip, formData.panelUrl, formData.panelLogin, formData.maxUsers, formData.inbound]
      : [formData.ip, formData.panelUrl, formData.panelLogin, formData.panelPassword, formData.maxUsers, formData.inbound];
    const authRequired = isEditing ? true : hasAuth; // При редактировании авторизация не обязательна

    if (requiredFields.some(field => !field) || !authRequired) {
      setResultModal({
        isOpen: true,
        title: 'Ошибка валидации',
        message: isEditing
          ? 'Заполните все обязательные поля (пароли необязательны при редактировании)'
          : 'Заполните все обязательные поля',
        type: 'error'
      });
      return;
    }

    // Проверка на существующий IP
    if (ipExists?.exists) {
      setResultModal({
        isOpen: true,
        title: '❌ Сервер уже существует!',
        message: `Сервер с IP адресом ${formData.ip} уже существует в локации "${ipExists.location}".\n\nИспользуйте другой IP адрес.`,
        type: 'error'
      });
      return;
    }

    // ОБЯЗАТЕЛЬНАЯ проверка: сервер должен пройти полную проверку
    if (!isFullyChecked) {
      setResultModal({
        isOpen: true,
        title: '❌ Проверка сервера обязательна!',
        message: 'Нажмите кнопку "Проверить сервер" перед сохранением.',
        type: 'error'
      });
      return;
    }

    const serverData: any = {
      ...(server ? { id: server.id } : {}), // Добавляем ID если редактируем
      ip: formData.ip,
      sshUsername: formData.sshUsername,
      panelUrl: formData.panelUrl,
      panelLogin: formData.panelLogin,
      maxUsers: parseInt(formData.maxUsers),
      inbound: formData.inbound,
      bandwidth: speedTestResult || null, // Сохраняем результат speedtest
    };

    // Добавляем пароли/ключи только если они заполнены
    if (formData.authMethod === 'key' && formData.sshKey) {
      serverData.sshKey = formData.sshKey;
    } else if (formData.password) {
      serverData.password = formData.password;
    }
    if (formData.panelPassword) {
      serverData.panelPassword = formData.panelPassword;
    }

    // Вызываем onSave и ждем завершения перед закрытием
    if (onSave) {
      await Promise.resolve(onSave(serverData));
    }

    // Сброс формы
    setFormData({
      ip: '',
      sshUsername: 'root',
      password: '',
      sshKey: '',
      authMethod: 'password',
      panelUrl: '',
      panelLogin: '',
      panelPassword: '',
      maxUsers: '',
      inbound: '',
    });
    setIsFullyChecked(false);
    setCheckStatus('');
    setSpeedTestResult(null);
    setRecommendedUsers(null);
    
    // Закрываем модальное окно после успешного завершения всех операций
    onClose();
  }, [formData, ipExists, isFullyChecked, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} variant="fullscreen">
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-xl lg:max-w-2xl sm:max-h-[90vh]"
      >
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg sm:text-xl">{server ? 'Редактировать сервер' : 'Добавить сервер'}</DialogTitle>
          <DialogDescription>
            Локация: {locationName}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-foreground mb-2 text-xs sm:text-sm">
                IP адрес <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ip}
                onChange={e => updateField('ip', e.target.value)}
                placeholder="192.168.1.1"
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base ${
                  ipExists?.exists ? 'focus:ring-red-500' : 'focus:ring-primary'
                }`}
              />
              {isCheckingIP && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground mt-2 text-xs sm:text-sm">
                  <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" />
                  <span>Проверка IP...</span>
                </div>
              )}
              {ipExists?.exists && !isCheckingIP && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-red-500 mt-2 text-xs sm:text-sm">
                  <AlertCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>Сервер с этим IP уже существует в локации "{ipExists.location}"</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-foreground mb-2 text-xs sm:text-sm">
                SSH Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sshUsername}
                onChange={e => updateField('sshUsername', e.target.value)}
                placeholder="root"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-foreground text-xs sm:text-sm">
                SSH авторизация <span className="text-red-500">*</span>
              </label>
              <div className="flex bg-muted rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => updateField('authMethod', 'password')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    formData.authMethod === 'password'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Пароль
                </button>
                <button
                  type="button"
                  onClick={() => updateField('authMethod', 'key')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    formData.authMethod === 'key'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  SSH ключ
                </button>
              </div>
            </div>
            {formData.authMethod === 'password' ? (
              <input
                type="password"
                value={formData.password}
                onChange={e => updateField('password', e.target.value)}
                placeholder="Пароль от сервера"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
              />
            ) : (
              <textarea
                value={formData.sshKey}
                onChange={e => updateField('sshKey', e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                rows={4}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base font-mono text-xs resize-none"
              />
            )}
          </div>

          <div>
            <label className="block text-foreground mb-2 text-xs sm:text-sm">
              Ссылка на панель 3x-ui <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.panelUrl}
              onChange={e => updateField('panelUrl', e.target.value)}
              placeholder="https://panel.example.com"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-foreground mb-2 text-xs sm:text-sm">
                Логин 3x-ui <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.panelLogin}
                onChange={e => updateField('panelLogin', e.target.value)}
                placeholder="admin"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-foreground mb-2 text-xs sm:text-sm">
                Пароль 3x-ui <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.panelPassword}
                onChange={e => updateField('panelPassword', e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-foreground mb-2 text-xs sm:text-sm">
              Максимальное количество пользователей <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.maxUsers}
              onChange={e => {
                const value = e.target.value;
                // Разрешаем только цифры
                if (value === '' || /^\d+$/.test(value)) {
                  updateField('maxUsers', value);
                }
              }}
              placeholder="1000"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="block text-foreground mb-2 text-xs sm:text-sm">
              Инбаунд <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.inbound}
              onChange={e => {
                const value = e.target.value;
                // Разрешаем только цифры
                if (value === '' || /^\d+$/.test(value)) {
                  updateField('inbound', value);
                }
              }}
              placeholder="1"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
            />
          </div>

          {/* Проверка сервера */}
          <div className="pt-3 sm:pt-4">
            <button
              onClick={fullCheck}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                  {checkStatus || 'Проверка сервера...'}
                </>
              ) : isFullyChecked ? (
                checkStatus || 'Проверка завершена'
              ) : (
                'Проверить сервер'
              )}
            </button>

            {/* Статус проверки */}
            {checkStatus && !isChecking && (
              <div className={`mt-2 sm:mt-3 p-2.5 sm:p-3 rounded-xl border ${
                isFullyChecked
                  ? 'bg-green-500/10 border-green-500/30 text-green-600'
                  : 'bg-red-500/10 border-red-500/30 text-red-600'
              }`}>
                <div className="font-medium mb-1 text-xs sm:text-sm">{checkStatus}</div>
                {speedTestResult && (
                  <div className="text-xs sm:text-sm opacity-90 space-y-1">
                    <div>Скорость: {speedTestResult}</div>
                    {recommendedUsers && (
                      <div>Рекомендуемое количество пользователей: {recommendedUsers}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-4 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pb-safe shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isChecking}
            className="h-12 sm:h-10"
          >
            Отменить
          </Button>
          <Button
            onClick={handleSave}
            disabled={isChecking || !isFullyChecked}
            className="h-12 sm:h-10"
            title={!isFullyChecked ? 'Проверьте сервер перед сохранением' : ''}
          >
            Сохранить сервер
          </Button>
        </div>
      </DialogContent>

      {/* Модальное окно с результатами */}
      {resultModal.isOpen && resultModal.title && resultModal.message && (
        <Dialog open={resultModal.isOpen} onOpenChange={() => setResultModal({ isOpen: false, title: '', message: '', type: 'success' })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className={`p-4 border-b ${resultModal.type === 'success' ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'} -mx-6 -mt-6 rounded-t-lg`}>
              <DialogTitle className={resultModal.type === 'success' ? 'text-green-600' : 'text-red-600'}>
                {resultModal.title}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-foreground whitespace-pre-line text-sm">{resultModal.message}</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setResultModal({ isOpen: false, title: '', message: '', type: 'success' })}>
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}