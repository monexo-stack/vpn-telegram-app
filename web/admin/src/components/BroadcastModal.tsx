import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, Image, Trash2, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { apiClient, User as ApiUser } from '../services/api';
import { useBackButton } from '../hooks/useBackButton';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    audienceFilter: string;
    messageText: string;
    imageUrl?: string;
    scheduledAt?: string;
    targetTgid?: number;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function BroadcastModal({ isOpen, onClose, onCreate, isSubmitting }: BroadcastModalProps) {
  // Telegram BackButton
  useBackButton(isOpen, onClose);

  const [audienceFilter, setAudienceFilter] = useState('all');
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User search state
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load users when specific_user is selected
  useEffect(() => {
    if (audienceFilter === 'specific_user' && allUsers.length === 0 && !loadingUsers) {
      const loadUsers = async () => {
        try {
          setLoadingUsers(true);
          const users = await apiClient.getUsers();
          setAllUsers(users);
        } catch (err) {
          console.error('Error loading users:', err);
        } finally {
          setLoadingUsers(false);
        }
      };
      loadUsers();
    }
  }, [audienceFilter, allUsers.length, loadingUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return allUsers;
    const q = userSearchQuery.toLowerCase();
    return allUsers.filter(u =>
      (u.fullname && u.fullname.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      String(u.tgid).includes(q)
    );
  }, [allUsers, userSearchQuery]);

  // Загрузка предпросмотра аудитории
  useEffect(() => {
    if (!isOpen) return;

    if (audienceFilter === 'specific_user') {
      setAudienceCount(selectedUser ? 1 : 0);
      return;
    }

    const loadAudienceCount = async () => {
      try {
        setLoadingAudience(true);
        const result = await apiClient.previewBroadcastAudience(audienceFilter);
        setAudienceCount(result.total_users);
      } catch (err) {
        console.error('Error loading audience count:', err);
        setAudienceCount(null);
      } finally {
        setLoadingAudience(false);
      }
    };

    loadAudienceCount();
  }, [audienceFilter, isOpen, selectedUser]);

  const handleClose = () => {
    setAudienceFilter('all');
    setMessageText('');
    setImageUrl('');
    setImagePreview(null);
    setScheduledAt('');
    setAudienceCount(null);
    setSelectedUser(null);
    setUserSearchQuery('');
    setIsUserDropdownOpen(false);
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Недопустимый формат файла. Разрешены: JPG, PNG, GIF, WEBP');
      return;
    }

    // Проверка размера (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимум: 10MB');
      return;
    }

    try {
      setUploadingImage(true);

      // Показываем превью
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Загружаем на сервер
      const result = await apiClient.uploadBroadcastImage(file);
      setImageUrl(result.url);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка загрузки изображения');
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectUser = (user: ApiUser) => {
    setSelectedUser(user);
    setUserSearchQuery('');
    setIsUserDropdownOpen(false);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setUserSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация
    if (!messageText.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    if (audienceFilter === 'specific_user' && !selectedUser) {
      toast.error('Выберите пользователя');
      return;
    }

    try {
      await onCreate({
        audienceFilter,
        messageText,
        imageUrl: imageUrl || undefined,
        scheduledAt: scheduledAt || undefined,
        targetTgid: audienceFilter === 'specific_user' && selectedUser ? selectedUser.tgid : undefined,
      });
      toast.success('Рассылка создана');
    } catch (err: any) {
      toast.error(err.message || 'Не удалось создать рассылку');
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} variant="fullscreen">
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-xl sm:max-h-[90vh]"
      >
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">Создать рассылку</DialogTitle>
          <DialogDescription>
            Отправьте сообщение пользователям
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
            {/* Audience Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Аудитория
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="all"
                    checked={audienceFilter === 'all'}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-foreground text-sm">Все пользователи</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="with_subscription"
                    checked={audienceFilter === 'with_subscription'}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-foreground text-sm">Только с активной подпиской</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="without_subscription"
                    checked={audienceFilter === 'without_subscription'}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-foreground text-sm">Только без подписки</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="expiring_soon"
                    checked={audienceFilter === 'expiring_soon'}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-foreground text-sm">Подписка истекает скоро (&lt; 7 дней)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="specific_user"
                    checked={audienceFilter === 'specific_user'}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-foreground text-sm">Конкретный пользователь</span>
                </label>

                {/* User Search Dropdown */}
                {audienceFilter === 'specific_user' && (
                  <div ref={dropdownRef} className="relative mt-2">
                    {selectedUser ? (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {(selectedUser.fullname || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {selectedUser.fullname || 'Без имени'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedUser.username ? `@${selectedUser.username}` : `ID: ${selectedUser.tgid}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearUser}
                          className="p-1 hover:bg-muted rounded-md transition-colors"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => {
                              setUserSearchQuery(e.target.value);
                              setIsUserDropdownOpen(true);
                            }}
                            onFocus={() => setIsUserDropdownOpen(true)}
                            placeholder="Поиск по имени, @username или ID..."
                            className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          />
                          {loadingUsers && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        {isUserDropdownOpen && !loadingUsers && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                {userSearchQuery ? 'Пользователь не найден' : 'Нет пользователей'}
                              </div>
                            ) : (
                              filteredUsers.map(user => (
                                <button
                                  key={user.tgid}
                                  type="button"
                                  onClick={() => handleSelectUser(user)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-medium text-primary">
                                      {(user.fullname || '?')[0].toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">
                                      {user.fullname || 'Без имени'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {user.username ? `@${user.username}` : `ID: ${user.tgid}`}
                                      {user.subscription_active && (
                                        <span className="ml-1.5 text-emerald-500">• активна</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              {audienceCount !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>
                    Получателей: <strong className="text-foreground">{audienceCount}</strong>
                  </span>
                </div>
              )}
              {loadingAudience && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка...
                </div>
              )}
            </div>

            {/* Message Text */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Текст сообщения <span className="text-destructive">*</span>
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Введите текст сообщения (поддерживается HTML)"
                className="w-full min-h-[120px] px-3 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-y text-sm"
                required
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Поддерживаются HTML теги: &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;code&gt;
              </p>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Изображение (опционально)
              </label>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full max-h-40 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:opacity-80 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Загрузка...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2 bg-muted rounded-full">
                        <Image className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-foreground">Нажмите для загрузки</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          JPG, PNG, GIF, WEBP до 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Scheduled At */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Запланировать отправку (опционально)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Если не указано, рассылка будет отправлена немедленно
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 pt-4 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0 pb-safe">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-12 sm:h-10"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || uploadingImage}
              className="h-12 sm:h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Создание...
                </>
              ) : scheduledAt ? (
                'Запланировать'
              ) : (
                'Отправить'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
