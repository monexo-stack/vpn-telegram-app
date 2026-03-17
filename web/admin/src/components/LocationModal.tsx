import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Combobox } from './ui/combobox';
import { apiClient } from '../services/api';
import { useBackButton } from '../hooks/useBackButton';

interface Country {
  code: string;
  name: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: 'AU', name: 'Австралия', flag: '🇦🇺' },
  { code: 'AT', name: 'Австрия', flag: '🇦🇹' },
  { code: 'AZ', name: 'Азербайджан', flag: '🇦🇿' },
  { code: 'AL', name: 'Албания', flag: '🇦🇱' },
  { code: 'DZ', name: 'Алжир', flag: '🇩🇿' },
  { code: 'AR', name: 'Аргентина', flag: '🇦🇷' },
  { code: 'AM', name: 'Армения', flag: '🇦🇲' },
  { code: 'BD', name: 'Бангладеш', flag: '🇧🇩' },
  { code: 'BY', name: 'Беларусь', flag: '🇧🇾' },
  { code: 'BE', name: 'Бельгия', flag: '🇧🇪' },
  { code: 'BG', name: 'Болгария', flag: '🇧🇬' },
  { code: 'BO', name: 'Боливия', flag: '🇧🇴' },
  { code: 'BA', name: 'Босния и Герцеговина', flag: '🇧🇦' },
  { code: 'BR', name: 'Бразилия', flag: '🇧🇷' },
  { code: 'GB', name: 'Великобритания', flag: '🇬🇧' },
  { code: 'HU', name: 'Венгрия', flag: '🇭🇺' },
  { code: 'VE', name: 'Венесуэла', flag: '🇻🇪' },
  { code: 'VN', name: 'Вьетнам', flag: '🇻🇳' },
  { code: 'DE', name: 'Германия', flag: '🇩🇪' },
  { code: 'HK', name: 'Гонконг', flag: '🇭🇰' },
  { code: 'GR', name: 'Греция', flag: '🇬🇷' },
  { code: 'GE', name: 'Грузия', flag: '🇬🇪' },
  { code: 'DK', name: 'Дания', flag: '🇩🇰' },
  { code: 'EG', name: 'Египет', flag: '🇪🇬' },
  { code: 'IL', name: 'Израиль', flag: '🇮🇱' },
  { code: 'IN', name: 'Индия', flag: '🇮🇳' },
  { code: 'ID', name: 'Индонезия', flag: '🇮🇩' },
  { code: 'IE', name: 'Ирландия', flag: '🇮🇪' },
  { code: 'IS', name: 'Исландия', flag: '🇮🇸' },
  { code: 'ES', name: 'Испания', flag: '🇪🇸' },
  { code: 'IT', name: 'Италия', flag: '🇮🇹' },
  { code: 'KZ', name: 'Казахстан', flag: '🇰🇿' },
  { code: 'KH', name: 'Камбоджа', flag: '🇰🇭' },
  { code: 'CA', name: 'Канада', flag: '🇨🇦' },
  { code: 'QA', name: 'Катар', flag: '🇶🇦' },
  { code: 'KE', name: 'Кения', flag: '🇰🇪' },
  { code: 'CY', name: 'Кипр', flag: '🇨🇾' },
  { code: 'KG', name: 'Киргизия', flag: '🇰🇬' },
  { code: 'CN', name: 'Китай', flag: '🇨🇳' },
  { code: 'CO', name: 'Колумбия', flag: '🇨🇴' },
  { code: 'KR', name: 'Корея Южная', flag: '🇰🇷' },
  { code: 'CR', name: 'Коста-Рика', flag: '🇨🇷' },
  { code: 'LV', name: 'Латвия', flag: '🇱🇻' },
  { code: 'LT', name: 'Литва', flag: '🇱🇹' },
  { code: 'LU', name: 'Люксембург', flag: '🇱🇺' },
  { code: 'MY', name: 'Малайзия', flag: '🇲🇾' },
  { code: 'MT', name: 'Мальта', flag: '🇲🇹' },
  { code: 'MA', name: 'Марокко', flag: '🇲🇦' },
  { code: 'MX', name: 'Мексика', flag: '🇲🇽' },
  { code: 'MD', name: 'Молдова', flag: '🇲🇩' },
  { code: 'MC', name: 'Монако', flag: '🇲🇨' },
  { code: 'MN', name: 'Монголия', flag: '🇲🇳' },
  { code: 'NL', name: 'Нидерланды', flag: '🇳🇱' },
  { code: 'NZ', name: 'Новая Зеландия', flag: '🇳🇿' },
  { code: 'NO', name: 'Норвегия', flag: '🇳🇴' },
  { code: 'AE', name: 'ОАЭ', flag: '🇦🇪' },
  { code: 'PK', name: 'Пакистан', flag: '🇵🇰' },
  { code: 'PA', name: 'Панама', flag: '🇵🇦' },
  { code: 'PY', name: 'Парагвай', flag: '🇵🇾' },
  { code: 'PE', name: 'Перу', flag: '🇵🇪' },
  { code: 'PL', name: 'Польша', flag: '🇵🇱' },
  { code: 'PT', name: 'Португалия', flag: '🇵🇹' },
  { code: 'RU', name: 'Россия', flag: '🇷🇺' },
  { code: 'RO', name: 'Румыния', flag: '🇷🇴' },
  { code: 'SA', name: 'Саудовская Аравия', flag: '🇸🇦' },
  { code: 'RS', name: 'Сербия', flag: '🇷🇸' },
  { code: 'SG', name: 'Сингапур', flag: '🇸🇬' },
  { code: 'SK', name: 'Словакия', flag: '🇸🇰' },
  { code: 'SI', name: 'Словения', flag: '🇸🇮' },
  { code: 'US', name: 'США', flag: '🇺🇸' },
  { code: 'TW', name: 'Тайвань', flag: '🇹🇼' },
  { code: 'TH', name: 'Таиланд', flag: '🇹🇭' },
  { code: 'TZ', name: 'Танзания', flag: '🇹🇿' },
  { code: 'TN', name: 'Тунис', flag: '🇹🇳' },
  { code: 'TR', name: 'Турция', flag: '🇹🇷' },
  { code: 'TM', name: 'Туркменистан', flag: '🇹🇲' },
  { code: 'UZ', name: 'Узбекистан', flag: '🇺🇿' },
  { code: 'UA', name: 'Украина', flag: '🇺🇦' },
  { code: 'UY', name: 'Уругвай', flag: '🇺🇾' },
  { code: 'PH', name: 'Филиппины', flag: '🇵🇭' },
  { code: 'FI', name: 'Финляндия', flag: '🇫🇮' },
  { code: 'FR', name: 'Франция', flag: '🇫🇷' },
  { code: 'HR', name: 'Хорватия', flag: '🇭🇷' },
  { code: 'ME', name: 'Черногория', flag: '🇲🇪' },
  { code: 'CZ', name: 'Чехия', flag: '🇨🇿' },
  { code: 'CL', name: 'Чили', flag: '🇨🇱' },
  { code: 'CH', name: 'Швейцария', flag: '🇨🇭' },
  { code: 'SE', name: 'Швеция', flag: '🇸🇪' },
  { code: 'LK', name: 'Шри-Ланка', flag: '🇱🇰' },
  { code: 'EC', name: 'Эквадор', flag: '🇪🇨' },
  { code: 'EE', name: 'Эстония', flag: '🇪🇪' },
  { code: 'ZA', name: 'ЮАР', flag: '🇿🇦' },
  { code: 'JP', name: 'Япония', flag: '🇯🇵' },
];

interface ServerForm {
  id: string;
  ip: string;
  sshUsername: string;
  password: string;
  sshKey: string;
  authMethod: 'password' | 'key';
  panelUrl: string;
  panelLogin: string;
  panelPassword: string;
  maxUsers: string;
  inbound: string;
  isChecking: boolean;
  checkStatus: string;
  isFullyChecked: boolean;
  speedTestResult: string | null;
  recommendedUsers: number | null;
  ipExists: { exists: boolean; location?: string } | null;
  isCheckingIP: boolean;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  existingCountryCodes?: string[];
}

export function LocationModal({ isOpen, onClose, onSave, existingCountryCodes = [] }: LocationModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [servers, setServers] = useState<ServerForm[]>([
    {
      id: '1',
      ip: '',
      sshUsername: 'root',
      password: '',
      sshKey: '',
      authMethod: 'password' as const,
      panelUrl: '',
      panelLogin: '',
      panelPassword: '',
      maxUsers: '',
      inbound: '',
      isChecking: false,
      checkStatus: '',
      isFullyChecked: false,
      speedTestResult: null,
      recommendedUsers: null,
      ipExists: null,
      isCheckingIP: false,
    },
  ]);
  const [trafficLimitGb, setTrafficLimitGb] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Сброс состояния при закрытии модального окна
  const prevIsOpenRef = React.useRef(false);
  React.useEffect(() => {
    // Сбрасываем состояния только когда модальное окно закрывается (переход true -> false)
    if (!isOpen && prevIsOpenRef.current) {
      setServers([
        {
          id: '1',
          ip: '',
          sshUsername: 'root',
          password: '',
          panelUrl: '',
          panelLogin: '',
          panelPassword: '',
          maxUsers: '',
          inbound: '',
          isChecking: false,
          checkStatus: '',
          isFullyChecked: false,
          speedTestResult: null,
          recommendedUsers: null,
          ipExists: null,
          isCheckingIP: false,
        },
      ]);
      setSelectedCountry(null);
      setTrafficLimitGb('');
      setSaveError(null);
      setResultModal({ isOpen: false, title: '', message: '', type: 'success' });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Все страны доступны для выбора (дубликаты разрешены)
  const availableNewCountries = COUNTRIES;
  const allCountriesForSelect = COUNTRIES;

  const addServer = React.useCallback(() => {
    setServers(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        ip: '',
        sshUsername: 'root',
        password: '',
        sshKey: '',
        authMethod: 'password' as const,
        panelUrl: '',
        panelLogin: '',
        panelPassword: '',
        maxUsers: '',
        inbound: '',
        isChecking: false,
        checkStatus: '',
        isFullyChecked: false,
        speedTestResult: null,
        recommendedUsers: null,
        ipExists: null,
        isCheckingIP: false,
      },
    ]);
  }, []);

  const removeServer = React.useCallback((id: string) => {
    setServers(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }, []);

  const updateServer = React.useCallback((id: string, field: keyof ServerForm, value: string | boolean | null | { exists: boolean; location?: string }) => {
    setServers(prev => prev.map(s => {
      if (s.id !== id) return s;

      const updated = { ...s, [field]: value };

      // Сбрасываем статусы проверки при изменении критических полей
      if (field === 'ip') {
        updated.ipExists = null;
        updated.isFullyChecked = false;
        updated.checkStatus = '';
        updated.speedTestResult = null;
        updated.recommendedUsers = null;
      } else if (field === 'password' || field === 'panelUrl' || field === 'panelLogin' || field === 'panelPassword') {
        updated.isFullyChecked = false;
        updated.checkStatus = '';
        updated.speedTestResult = null;
        updated.recommendedUsers = null;
      }

      return updated;
    }));
  }, []);

  // Проверка IP на существование
  const checkIP = React.useCallback(async (serverId: string, ip: string) => {
    if (!ip || ip.trim().length === 0) {
      updateServer(serverId, 'ipExists', null);
      updateServer(serverId, 'isCheckingIP', false);
      return;
    }

    updateServer(serverId, 'isCheckingIP', true);
    try {
      const result = await apiClient.checkServerIP(ip.trim());
      if (result.exists && result.server) {
        updateServer(serverId, 'ipExists', { exists: true, location: result.server.location });
      } else {
        updateServer(serverId, 'ipExists', { exists: false });
      }
    } catch {
      updateServer(serverId, 'ipExists', null);
    } finally {
      updateServer(serverId, 'isCheckingIP', false);
    }
  }, [updateServer]);

  const fullCheck = React.useCallback(async (serverId: string) => {
    // Получаем данные сервера синхронно
    const currentServers = servers;
    const server = currentServers.find(s => s.id === serverId);

    if (!server) {
      return;
    }

    // Валидация обязательных полей
    const hasAuth = server.authMethod === 'key' ? !!server.sshKey : !!server.password;
    if (!server.ip || !server.sshUsername || !hasAuth || !server.panelUrl || !server.panelLogin || !server.panelPassword) {
      updateServer(serverId, 'checkStatus', '❌ Заполните все обязательные поля');
      return;
    }

    // Устанавливаем статус проверки
    updateServer(serverId, 'isChecking', true);
    updateServer(serverId, 'checkStatus', 'Подключение к серверу...');
    updateServer(serverId, 'isFullyChecked', false);
    updateServer(serverId, 'speedTestResult', null);

    try {
      const checkData: any = {
        server_ip: server.ip,
        x3ui_url: server.panelUrl,
        x3ui_username: server.panelLogin,
        x3ui_password: server.panelPassword,
        ssh_username: server.sshUsername,
      };
      if (server.authMethod === 'key') {
        checkData.ssh_key = server.sshKey;
      } else {
        checkData.ssh_password = server.password;
      }

      // Добавляем inbound только если он указан
      if (server.inbound && server.inbound.trim() !== '') {
        checkData.inbound = parseInt(server.inbound);
      }

      const result = await apiClient.fullServerCheck(checkData);

      // Проверяем наличие steps
      if (!result.steps) {
        updateServer(serverId, 'isChecking', false);
        updateServer(serverId, 'isFullyChecked', false);
        updateServer(serverId, 'checkStatus', '❌ Ошибка: некорректный ответ сервера');
        return;
      }

      // Обновляем статусы по мере выполнения
      if (result.steps.ssh_connection?.status === 'in_progress') {
        updateServer(serverId, 'checkStatus', '🔌 Подключение к серверу...');
      }
      if (result.steps.ssh_connection?.status === 'success') {
        updateServer(serverId, 'checkStatus', '✓ SSH подключение | Проверка 3x-ui...');
      }
      if (result.steps.x3ui_connection?.status === 'in_progress') {
        updateServer(serverId, 'checkStatus', '🔧 Проверка 3x-ui панели...');
      }
      if (result.steps.x3ui_connection?.status === 'success') {
        updateServer(serverId, 'checkStatus', '✓ 3x-ui подключена | Проверка скорости...');
      }
      if (result.steps.speedtest_install?.status === 'in_progress') {
        updateServer(serverId, 'checkStatus', '📦 Установка speedtest...');
      }
      if (result.steps.speedtest_run?.status === 'in_progress') {
        updateServer(serverId, 'checkStatus', '⚡ Тестирование скорости...');
      }

      updateServer(serverId, 'isChecking', false);

      // SSH и 3x-ui обязательны, speedtest опционален
      const sshSuccess = result.steps.ssh_connection?.status === 'success';
      const x3uiSuccess = result.steps.x3ui_connection?.status === 'success';
      const speedtestSuccess = result.steps.speedtest_run?.status === 'success';
      const corePassed = sshSuccess && x3uiSuccess;

      if (corePassed) {
        if (speedtestSuccess && result.data.speedtest) {
          const speedtest = result.data.speedtest;
          updateServer(serverId, 'checkStatus', '✅ Все проверки пройдены успешно');
          updateServer(serverId, 'speedTestResult', speedtest.speed_formatted);
          updateServer(serverId, 'recommendedUsers', speedtest.recommended_users);

          // Автоматически подставляем рекомендуемое количество пользователей
          if (speedtest.recommended_users) {
            updateServer(serverId, 'maxUsers', speedtest.recommended_users.toString());
          }
        } else {
          updateServer(serverId, 'checkStatus', '⚠️ SSH и 3x-ui успешны, speedtest не удался');
        }
        updateServer(serverId, 'isFullyChecked', true);
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

        updateServer(serverId, 'checkStatus', errorMsg);
        updateServer(serverId, 'isFullyChecked', false);
      }
    } catch (error: any) {
      updateServer(serverId, 'isChecking', false);
      updateServer(serverId, 'isFullyChecked', false);
      const errorMsg = error.response?.data?.message || 'Ошибка при проверке сервера';
      updateServer(serverId, 'checkStatus', `❌ ${errorMsg}`);
    }
  }, [servers, updateServer]);

  // Debounce для проверки IP серверов
  React.useEffect(() => {
    if (!isOpen) return;

    const timers: NodeJS.Timeout[] = [];

    servers.forEach(server => {
      if (server.ip) {
        const timer = setTimeout(() => {
          checkIP(server.id, server.ip);
        }, 500);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [servers.map(s => s.ip).join(','), checkIP, isOpen]);

  const handleSave = React.useCallback(async () => {
    if (!selectedCountry || servers.length === 0) {
      setResultModal({
        isOpen: true,
        title: 'Ошибка валидации',
        message: 'Выберите страну и добавьте минимум один сервер',
        type: 'error'
      });
      return;
    }

    // Проверка что все серверы заполнены
    const hasEmptyServer = servers.some(
      s => !s.ip || !(s.authMethod === 'key' ? s.sshKey : s.password) || !s.panelUrl || !s.panelLogin || !s.panelPassword || !s.maxUsers || !s.inbound
    );

    if (hasEmptyServer) {
      setResultModal({
        isOpen: true,
        title: 'Ошибка валидации',
        message: 'Заполните все поля для каждого сервера',
        type: 'error'
      });
      return;
    }

    // Проверка на существующие IP адреса
    const existingIPServers = servers.filter(s => s.ipExists?.exists);
    if (existingIPServers.length > 0) {
      const ipList = existingIPServers.map(s => `${s.ip} (в локации "${s.ipExists?.location}")`).join('\n');
      setResultModal({
        isOpen: true,
        title: '❌ Серверы с этими IP уже существуют!',
        message: `Следующие IP адреса уже используются:\n\n${ipList}\n\nИспользуйте другие IP адреса.`,
        type: 'error'
      });
      return;
    }

    // ОБЯЗАТЕЛЬНАЯ проверка: все серверы должны пройти полную проверку
    const uncheckedServers = servers.filter(s => !s.isFullyChecked);
    if (uncheckedServers.length > 0) {
      setResultModal({
        isOpen: true,
        title: '❌ Проверка сервера обязательна!',
        message: `Не проверено серверов: ${uncheckedServers.length}\n\nНажмите кнопку "Проверить сервер" для каждого сервера перед сохранением.`,
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // 1. Создаем локацию только со страной
      const locationName = selectedCountry.name;
      const location = await apiClient.createLocation(
        locationName,
        false, // is_trial deprecated - все серверы единые
        {
          country: selectedCountry.name,
          country_code: selectedCountry.code,
          flag: selectedCountry.flag,
          traffic_limit_gb: trafficLimitGb ? parseInt(trafficLimitGb) : null
        }
      );
      
      // 2. Создаем серверы для этой локации последовательно
      const createdServers = [];
      const errors: string[] = [];
      
      for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        try {
          const serverData: any = {
            ip: server.ip,
            login: server.sshUsername,
            x3ui_url: server.panelUrl,
            x3ui_username: server.panelLogin,
            x3ui_password: server.panelPassword,
            max_space: parseInt(server.maxUsers) || 1000,
            inbound_id: parseInt(server.inbound) || 0,
            type_vpn: 1,
            connection_method: 0,
            is_trial: false,
            x3ui_connected: server.isFullyChecked === true,
            panel: 'sanaei',
            bandwidth: server.speedTestResult || null,
          };
          if (server.authMethod === 'key') {
            serverData.ssh_key = server.sshKey;
          } else {
            serverData.password = server.password;
          }
          
          const createdServer = await apiClient.createServer(location.id, serverData);
          createdServers.push(createdServer);
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;
          errors.push(`Сервер ${server.ip}: ${errorMessage}`);
        }
      }
      
      if (createdServers.length === 0) {
        throw new Error('Не удалось создать ни одного сервера. ' + (errors.length > 0 ? errors.join('; ') : ''));
      }
      
      if (createdServers.length < servers.length) {
        const errorMsg = `Создано ${createdServers.length} из ${servers.length} серверов.\n${errors.join('\n')}`;
        setSaveError(errorMsg);
        // Не закрываем модальное окно, чтобы пользователь видел ошибку
        return;
      }
      
      // 3. Вызываем callback с данными локации и ждем его завершения
      if (onSave) {
        await Promise.resolve(onSave({
          id: location.id,
          name: locationName,
          country: selectedCountry,
        }));
      }
      
      // Закрываем модальное окно только после успешного завершения всех операций
      onClose();
    } catch (error: any) {
      setSaveError(error.message || 'Ошибка при сохранении локации');
    } finally {
      setIsSaving(false);
    }
  }, [selectedCountry, servers, onSave, onClose]);

  // Проверяем, идет ли сейчас проверка хотя бы одного сервера
  const isAnyServerChecking = servers.some(s => s.isChecking);

  // Функция закрытия с проверкой
  const handleClose = React.useCallback(() => {
    const checking = servers.some(s => s.isChecking);
    if (checking) {
      setResultModal({
        isOpen: true,
        title: 'Проверка в процессе',
        message: 'Дождитесь завершения проверки сервера перед закрытием',
        type: 'error'
      });
      return;
    }
    onClose();
  }, [servers, onClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} variant="fullscreen">
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-2xl lg:max-w-4xl sm:max-h-[90vh]"
      >
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Добавить локацию</DialogTitle>
          <DialogDescription>
            Выберите страну и добавьте серверы
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 overscroll-contain">
          {/* Выбор страны */}
          <div>
            <label className="block text-foreground mb-2 text-sm sm:text-base">
              Страна <span className="text-red-500">*</span>
            </label>
            <div className="w-64">
              <Combobox
                value={selectedCountry?.code || ''}
                onChange={(code) => {
                  const country = allCountriesForSelect.find(c => c.code === code);
                  if (country) {
                    setSelectedCountry(country);
                  }
                }}
                options={allCountriesForSelect.map(country => {
                  const isExisting = existingCountryCodes.includes(country.code);
                  return {
                    value: country.code,
                    label: isExisting ? `${country.flag} ${country.name} (уже есть)` : `${country.flag} ${country.name}`,
                    disabled: false,
                  };
                })}
                placeholder={availableNewCountries.length ? "Выберите страну" : "Нет доступных стран"}
                searchPlaceholder="Поиск страны..."
              />
            </div>
          </div>

          {/* Лимит трафика */}
          <div>
            <label className="block text-foreground mb-2 text-sm sm:text-base">
              Лимит трафика на клиента (GB)
            </label>
            <div className="w-64">
              <input
                type="text"
                value={trafficLimitGb}
                onChange={e => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setTrafficLimitGb(value);
                  }
                }}
                placeholder="0 (безлимит)"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
              />
            </div>
            <p className="text-muted-foreground text-xs mt-1.5">
              Каждый пользователь получит свой личный лимит. 0 или пусто = безлимит.
            </p>
          </div>

          {/* Серверы */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4">
              <div>
                <h3 className="text-foreground mb-1 text-base sm:text-lg">Серверы</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Добавьте минимум один сервер для локации
                </p>
              </div>
              <button
                onClick={addServer}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-muted text-foreground rounded-xl hover:bg-muted/70 transition-all duration-200 text-sm sm:text-base"
              >
                <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                Добавить сервер
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {servers.map((server, index) => (
                <div
                  key={server.id}
                  className="bg-muted/50 rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-foreground text-sm sm:text-base">Сервер #{index + 1}</h4>
                    {servers.length > 1 && (
                      <button
                        onClick={() => removeServer(server.id)}
                        className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors duration-150"
                      >
                        <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        IP адрес <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={server.ip}
                        onChange={e => updateServer(server.id, 'ip', e.target.value)}
                        placeholder="192.168.1.1"
                        className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border rounded-xl focus:outline-none focus:ring-2 text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base ${
                          server.ipExists?.exists ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
                        }`}
                      />
                      {server.isCheckingIP && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground mt-2 text-xs sm:text-sm">
                          <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" />
                          <span>Проверка IP...</span>
                        </div>
                      )}
                      {server.ipExists?.exists && !server.isCheckingIP && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-red-500 mt-2 text-xs sm:text-sm">
                          <AlertCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          <span>Сервер с этим IP уже существует в локации "{server.ipExists.location}"</span>
                        </div>
                      )}
                      {server.ipExists?.exists === false && !server.isCheckingIP && server.ip && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-green-500 mt-2 text-xs sm:text-sm">
                          <CheckCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          <span>IP адрес доступен</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        SSH Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={server.sshUsername}
                        onChange={e => updateServer(server.id, 'sshUsername', e.target.value)}
                        placeholder="root"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-foreground text-xs sm:text-sm">
                        SSH авторизация <span className="text-red-500">*</span>
                      </label>
                      <div className="flex bg-card border border-border rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateServer(server.id, 'authMethod', 'password')}
                          className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                            server.authMethod === 'password'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Пароль
                        </button>
                        <button
                          type="button"
                          onClick={() => updateServer(server.id, 'authMethod', 'key')}
                          className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                            server.authMethod === 'key'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          SSH ключ
                        </button>
                      </div>
                    </div>
                    {server.authMethod === 'password' ? (
                      <input
                        type="password"
                        value={server.password}
                        onChange={e => updateServer(server.id, 'password', e.target.value)}
                        placeholder="Пароль от сервера"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    ) : (
                      <textarea
                        value={server.sshKey}
                        onChange={e => updateServer(server.id, 'sshKey', e.target.value)}
                        placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                        rows={4}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base font-mono text-xs resize-none"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        Ссылка на панель 3x-ui <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={server.panelUrl}
                        onChange={e => updateServer(server.id, 'panelUrl', e.target.value)}
                        placeholder="https://panel.example.com"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        Макс. пользователей <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={server.maxUsers}
                        onChange={e => {
                          const value = e.target.value;
                          // Разрешаем только цифры
                          if (value === '' || /^\d+$/.test(value)) {
                            updateServer(server.id, 'maxUsers', value);
                          }
                        }}
                        placeholder="1000"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        Инбаунд <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={server.inbound}
                        onChange={e => {
                          const value = e.target.value;
                          // Разрешаем только цифры
                          if (value === '' || /^\d+$/.test(value)) {
                            updateServer(server.id, 'inbound', value);
                          }
                        }}
                        placeholder="1"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        Логин 3x-ui <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={server.panelLogin}
                        onChange={e => updateServer(server.id, 'panelLogin', e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground mb-2 text-xs sm:text-sm">
                        Пароль 3x-ui <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={server.panelPassword}
                        onChange={e => updateServer(server.id, 'panelPassword', e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Кнопка полной проверки сервера */}
                  <div className="space-y-2 sm:space-y-3">
                    <button
                      onClick={() => fullCheck(server.id)}
                      disabled={server.isChecking}
                      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      {server.isChecking ? (
                        <>
                          <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                          {server.checkStatus || 'Проверка сервера...'}
                        </>
                      ) : server.isFullyChecked ? (
                        server.checkStatus || 'Проверка завершена'
                      ) : (
                        'Проверить сервер'
                      )}
                    </button>

                    {/* Статус проверки */}
                    {server.checkStatus && !server.isChecking && (
                      <div className={`p-2.5 sm:p-3 rounded-xl border ${
                        server.isFullyChecked
                          ? 'bg-green-500/10 border-green-500/30 text-green-600'
                          : 'bg-red-500/10 border-red-500/30 text-red-600'
                      }`}>
                        <div className="font-medium text-xs sm:text-sm">{server.checkStatus}</div>
                        {server.isFullyChecked && server.speedTestResult && (
                          <div className="text-xs sm:text-sm mt-1">
                            Скорость: <span className="font-mono font-bold">{server.speedTestResult}</span>
                            {server.recommendedUsers && (
                              <> • Рекомендовано: <span className="font-bold">{server.recommendedUsers}</span> польз.</>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-4 border-t space-y-3 pb-safe shrink-0">
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-red-500 text-xs sm:text-sm">
                <div className="font-medium mb-1">Ошибка сохранения</div>
                <div>{saveError}</div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving || isAnyServerChecking}
              className="h-12 sm:h-10"
            >
              Отменить
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isAnyServerChecking || servers.some(s => !s.isFullyChecked)}
              className="h-12 sm:h-10"
              title={servers.some(s => !s.isFullyChecked) ? 'Проверьте все серверы перед сохранением' : ''}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                'Сохранить локацию'
              )}
            </Button>
          </div>
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