import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Флаг для предотвращения множественных refresh запросов
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

// Обрабатываем ответы и автоматически обновляем токен при 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Если получили 401 (Unauthorized)
    if (error.response?.status === 401) {
      // Проверяем, что это не запрос на логин или refresh
      const isAuthRequest = originalRequest?.url?.includes('/login') || originalRequest?.url?.includes('/refresh')

      if (isAuthRequest) {
        return Promise.reject(error)
      }

      // Если уже пробовали обновить токен для этого запроса - выходим
      if (originalRequest._retry) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_refresh_token')
        localStorage.removeItem('admin_login_time')
        window.location.href = '/admin'
        return Promise.reject(error)
      }

      // Пробуем обновить токен
      const refreshToken = localStorage.getItem('admin_refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('admin_token')
        window.location.href = '/admin'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Если уже идёт обновление - ждём его завершения
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${API_BASE_URL}/refresh`, { refresh_token: refreshToken })
        const newToken = response.data.access_token

        localStorage.setItem('admin_token', newToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        processQueue(null, newToken)

        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_refresh_token')
        localStorage.removeItem('admin_login_time')
        window.location.href = '/admin'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ============ СИСТЕМА КЭШИРОВАНИЯ ============
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private pendingRequests: Map<string, Promise<any>> = new Map()

  // TTL по умолчанию - 30 секунд
  private defaultTTL = 30 * 1000

  // TTL для разных типов данных (в мс)
  private ttlConfig: Record<string, number> = {
    '/dashboard': 30 * 1000,      // 30 сек
    '/users': 30 * 1000,          // 30 сек
    '/keys': 30 * 1000,           // 30 сек
    '/payments': 30 * 1000,       // 30 сек
    '/locations': 60 * 1000,      // 1 мин
    '/analytics': 60 * 1000,      // 1 мин
    '/stats': 30 * 1000,          // 30 сек
    '/promocodes': 30 * 1000,     // 30 сек
    '/referrals': 30 * 1000,      // 30 сек
    '/broadcasts': 30 * 1000,     // 30 сек
    '/tracking': 30 * 1000,       // 30 сек
    '/settings': 120 * 1000,      // 2 мин
  }

  private getTTL(key: string): number {
    for (const [pattern, ttl] of Object.entries(this.ttlConfig)) {
      if (key.startsWith(pattern)) {
        return ttl
      }
    }
    return this.defaultTTL
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Проверяем не истёк ли TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.getTTL(key)
    })
  }

  // Для предотвращения дублирования запросов
  getPending(key: string): Promise<any> | null {
    return this.pendingRequests.get(key) || null
  }

  setPending(key: string, promise: Promise<any>): void {
    this.pendingRequests.set(key, promise)
  }

  clearPending(key: string): void {
    this.pendingRequests.delete(key)
  }

  // Инвалидация кэша
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  // Принудительное обновление
  forceRefresh(key: string): void {
    this.cache.delete(key)
  }
}

export const apiCache = new ApiCache()

// Обёртка для кэшированных GET запросов
async function cachedGet<T>(url: string, params?: any): Promise<T> {
  const cacheKey = params ? `${url}?${JSON.stringify(params)}` : url

  // Проверяем кэш
  const cached = apiCache.get<T>(cacheKey)
  if (cached) {
    return cached
  }

  // Проверяем, нет ли уже активного запроса
  const pending = apiCache.getPending(cacheKey)
  if (pending) {
    return pending
  }

  // Создаём новый запрос
  const requestPromise = api.get<T>(url, { params })
    .then(response => {
      apiCache.set(cacheKey, response.data)
      apiCache.clearPending(cacheKey)
      return response.data
    })
    .catch(error => {
      apiCache.clearPending(cacheKey)
      throw error
    })

  apiCache.setPending(cacheKey, requestPromise)
  return requestPromise
}

// Типы данных
export interface LoginResponse {
  token: string
  refresh_token?: string
  username: string
  role?: string
}

export interface Stats {
  totalUsers: number
  activeSubscriptions: number
  monthlyRevenue: number
  totalServers: number
}

export interface Dashboard {
  totalUsers: number
  totalUsersChange: string
  activeServers: number
  activeServersChange: string
  monthlyRevenue: number
  monthlyRevenueChange: string
  activeConnections: number
  activeConnectionsChange: string
  userGrowth: Array<{ month: string; users: number; paid_subs: number; trial_subs: number }>
  revenueChart: Array<{ month: string; revenue: number; label?: string }>
  serverTime?: string
  serverDate?: string
  locations: Array<{
    name: string;
    flag: string;
    servers: number;
    traffic: string;
    traffic_bytes: number;
    percentage: number;
    color: string
  }>
  recentActivity: Array<{ user: string; action: string; time: string; status: string }>
  serverUtilization: number
  totalBandwidth: string
  countriesCount: number
}

export interface User {
  id: number
  tgid: number
  username: string | null
  fullname: string | null
  subscription_active: boolean
  keys_count: number
  banned: boolean
  created_at?: string | null
  last_active?: string | null
  subscription_type?: string | null
  traffic_total?: number | null
  expires_at?: string | null
  blocked?: boolean
  lang?: string
  revenue?: number
  source?: string | null  // Источник пользователя: 'organic', 'referral', 'ad'
  referral_user_tgid?: number | null  // ID реферера
  referral_count?: number | null  // Количество рефералов
  ad_campaign?: string | null  // Рекламная кампания
  bot_score?: number  // Скоринг бота 0-100
  bot_confirmed?: boolean  // Админ подтвердил что бот
  app_opens_count?: number  // Сколько раз открывал приложение
  trial_period?: boolean  // Пробный период был использован
}

export interface Location {
  id: number
  name: string
  status: string  // 'online', 'offline', 'maintenance'
  is_trial?: boolean
  country?: string | null
  country_code?: string | null
  servers_count?: number
  users_count?: number
  user_tgids?: number[]
  traffic?: string
  growth?: string
  city?: string
  flag?: string
  traffic_limit_gb?: number | null
}

export interface SubscriptionPath {
  location_id: number
  location_name: string
  server_id: number
  server_name?: string | null
  server_ip?: string | null
  active_users: number
  max_space: number
  load_percent: number
}

export interface Server {
  id: number
  name?: string | null
  ip: string | null
  type_vpn: number
  location: string | null
  status: string  // 'online', 'offline', 'maintenance'
  connection_method: number
  panel: string
  inbound_id: number
  login: string
  x3ui_url: string | null
  x3ui_username: string | null
  x3ui_password?: string | null
  x3ui_connected: boolean
  x3ui_last_check: string | null
  location_id: number
  is_trial?: boolean
  max_space?: number
  users_count?: number
  load_percentage?: number
  bandwidth?: string
  cpu_percent?: number
  ram_used?: number
  ram_total?: number
  disk_used?: number
  disk_total?: number
  traffic_up_gb?: number
  traffic_down_gb?: number
  // Метрики мониторинга V2
  health_score?: number
  uptime_percentage?: number
  avg_response_time_ms?: number
  ping_latency_ms?: number
  ssh_latency_ms?: number
  x3ui_latency_ms?: number
  consecutive_failures?: number
  next_check_at?: string
  priority?: number
  last_online_at?: string
  last_offline_at?: string
  total_checks?: number
  failed_checks?: number
  last_check_duration?: number
}

export interface Key {
  id: number
  user_tgid: number
  server_id: number | null
  subscription: number | null
  type?: string | null
  active: boolean
  config?: string | null
  subscription_url?: string | null
  server_name?: string | null
  server_ip?: string | null
  user_username?: string | null
  user_fullname?: string | null
  created_at?: string | null
  expires_at?: string | null
  trial_period?: boolean
  free_key?: boolean
  days_remaining?: number | null
  plan_name?: string | null
  locations_count?: number
  traffic?: number  // Трафик в байтах
  subscription_token?: string | null
  user_bot_score?: number
  user_bot_confirmed?: boolean
  location_name?: string | null
  location_id?: number | null
}

export interface KeyDetailsServer {
  server_id: number
  server_name: string | null
  server_ip: string | null
  type_vpn: number
  vpn_type_name: string
  status: string  // 'online', 'offline', 'maintenance'
  x3ui_connected: boolean
  key_id: number
  key_active: boolean
  config: string | null
}

export interface KeyDetailsLocation {
  location_id: number
  location_name: string
  country: string | null
  country_code: string | null
  flag: string | null
  is_trial: boolean
  servers: KeyDetailsServer[]
}

export interface DeviceHistoryItem {
  ip_address: string
  location_id: number | null
  server_id: number | null
  first_seen_at: string | null
  last_seen_at: string | null
  is_banned: boolean
  banned_at: string | null
  ban_reason: string | null
}

export interface KeyDetails {
  id: number
  user: {
    tgid: number
    username: string | null
    fullname: string | null
    banned: boolean
    subscription_active: boolean
  }
  subscription_token: string | null
  subscription_url: string | null
  created_at: string | null
  expires_at: string | null
  days_remaining: number | null
  active: boolean
  trial_period: boolean
  free_key: boolean
  plan: {
    plan_id: string
    name: string
    duration_days: number | null
    price: number | null
  } | null
  locations: KeyDetailsLocation[]
  device_history?: DeviceHistoryItem[]
}

export interface Payment {
  id: number
  user_id: number
  amount: number
  payment_system: string
  month_count: number | null
  date: string
  user_username?: string | null
  user_tgid?: number | null
  user_fullname?: string | null
  status?: string
  plan?: string | null
  stars_amount?: number | null
}

export interface Promocode {
  id: number
  text: string
  percent: number
  used_count: number
  count_use: number
  created_at?: string | null
  valid_until?: string | null
  status?: string
  discount_type?: 'percentage' | 'fixed'
  amount?: number | null
  total_discount_given?: number | null
}

export interface Referral {
  user_id: number
  referral_count: number
  username?: string | null
  total_bonus_days: number
  invite_bonus_days: number
  purchase_bonus_days: number
}

export interface Withdrawal {
  id: number
  user_tgid: number
  username?: string | null
  amount: number
  account: string
  payment_system_id?: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rejected'
  freekassa_withdrawal_id?: string | null
  error_message?: string | null
  created_at?: string | null
  processed_at?: string | null
}

export interface NotificationSettings {
  server_down: boolean
  server_recovered: boolean
  suspicious_activity: boolean
  tracking_bots: boolean
  new_payment: boolean
  daily_report: boolean
  tracking_bots_threshold: number
  cooldown_minutes: number
}

export interface Settings {
  // Основные настройки бота
  bot_name: string
  bot_token: string
  bot_username?: string
  mini_app_short_name?: string
  admin_tgid: string
  support_bot_token?: string
  support_bot_username?: string
  support_type?: 'bot' | 'personal'
  support_username?: string
  device_surcharge_price?: number

  // Платежи
  telegram_stars_enabled: boolean
  yoomoney_enabled: boolean
  yoomoney_token: string
  yoomoney_wallet: string
  yookassa_enabled: boolean
  yookassa_shop_id: string
  yookassa_secret_key: string
  yookassa_receipt_email: string
  cryptobot_enabled: boolean
  cryptobot_token: string

  // Реферальная программа
  referral_invite_bonus_days: string
  referral_purchase_bonus_days?: {
    '1month': number
    '3months': number
    '6months': number
    '1year': number
  }

  // Уведомления
  notifications: NotificationSettings

  // Тема мини-приложения
  template_id?: string
  theme_primary?: string
  theme_primary_dark?: string
  theme_primary_rgb?: string
  theme_success?: string
  theme_danger?: string
  hero_type?: string
  hero_sticker_url?: string
  bg_gradient_dark?: string
  bg_gradient_light?: string
  bg_header_dark?: string
  bg_header_light?: string

  [key: string]: any
}

export interface SubscriptionPlan {
  id: number
  plan_id: string
  name: string
  price: number
  duration_days: number
  active: boolean
}

export interface WebhookStatus {
  success: boolean
  configured: boolean | string
  message: string
}

export interface Broadcast {
  id: number
  audience_filter: string
  message_text: string
  image_url: string | null
  buttons: string | null
  status: string
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  blocked_count: number
  created_by: string | null
  created_at: string
}

export interface BroadcastStats {
  total: number
  completed: number
  scheduled: number
  total_sent: number
}

export const apiClient = {
  // Авторизация
  async login(username: string, password: string): Promise<LoginResponse | null> {
    const response = await api.post<LoginResponse>('/login', { username, password })
    return response.data
  },

  // Авторизация через Telegram Mini App
  async telegramAuth(initData: string): Promise<LoginResponse | null> {
    const response = await api.post<LoginResponse>('/admin/auth/telegram', { init_data: initData })
    return response.data
  },

  // Статистика (с кэшированием)
  async getStats(): Promise<Stats> {
    return cachedGet<Stats>('/stats')
  },

  // Полные данные для дашборда (с кэшированием)
  async getDashboard(period: string = 'month', offset: number = 0): Promise<Dashboard> {
    return cachedGet<Dashboard>('/dashboard', { period, offset })
  },

  async getUsersStats(): Promise<{ total: number; active: number; inactive: number; pending: number }> {
    return cachedGet('/stats/users')
  },

  async getKeysStats(): Promise<{ total: number; active: number; expired: number; created_today: number }> {
    return cachedGet('/stats/keys')
  },

  async getPaymentsStats(): Promise<{ total: number; successful: number; pending: number; failed: number; monthly_revenue: number }> {
    return cachedGet('/stats/payments')
  },

  async getPromocodesStats(): Promise<{ total: number; active: number; total_uses: number; avg_percent: number; total_discount_given: number }> {
    return cachedGet('/stats/promocodes')
  },

  async getWithdrawalsStats(): Promise<{ total: number; pending: number; paid_total: number; paid_monthly: number }> {
    return cachedGet('/stats/withdrawals')
  },

  // Пользователи (с кэшированием)
  async getUsers(): Promise<User[]> {
    return cachedGet<User[]>('/users')
  },

  async getUser(userId: number): Promise<User> {
    const response = await api.get<User>(`/users/${userId}`)
    return response.data
  },

  async getUserByTgid(tgid: number): Promise<User> {
    const response = await api.get<User>(`/users/by-tgid/${tgid}`)
    return response.data
  },

  async getUsersWithSubscription(): Promise<User[]> {
    const response = await api.get<User[]>('/users/with-subscription')
    return response.data
  },

  async getUsersWithoutSubscription(): Promise<User[]> {
    const response = await api.get<User[]>('/users/without-subscription')
    return response.data
  },

  async deleteUser(userId: number): Promise<void> {
    await api.delete(`/users/${userId}`)
  },

  async banUser(tgid: number): Promise<void> {
    await api.post(`/users/${tgid}/ban`)
  },

  async unbanUser(tgid: number): Promise<void> {
    await api.post(`/users/${tgid}/unban`)
  },

  async getUserKeysHistory(tgid: number): Promise<Key[]> {
    const response = await api.get<Key[]>(`/users/${tgid}/keys`)
    return response.data
  },

  async addSubscription(tgid: number, days: number): Promise<{ message: string }> {
    const response = await api.post(`/users/${tgid}/add-subscription`, { days })
    return response.data
  },

  async createSubscriptionForUser(tgid: number, planId: string): Promise<{ message: string; created_keys: any[]; total_locations: number; successful_locations: number; failed_locations: string[] }> {
    // Получаем план из БД для точного количества дней
    const plans = await this.getPlans()
    const plan = plans.find(p => p.plan_id === planId)

    const days = plan?.duration_days || 30
    const isTrial = planId === 'trial'

    // Вычисляем timestamp окончания подписки
    const subscriptionTimestamp = Math.floor(Date.now() / 1000) + (days * 24 * 3600)

    const response = await api.post(`/users/${tgid}/create-subscription`, {
      subscription_timestamp: subscriptionTimestamp,
      trial_period: isTrial,
      plan_id: planId
    })
    return response.data
  },

  async extendUserSubscription(tgid: number, days: number): Promise<{ message: string; extended_keys: number }> {
    const response = await api.post(`/users/${tgid}/extend-subscription`, { days })
    return response.data
  },

  async extendKeySubscription(keyId: number, days: number): Promise<{ message: string }> {
    const response = await api.put(`/keys/${keyId}/subscription`, { days })
    return response.data
  },

  async reissueKey(keyId: number): Promise<{ message: string; new_config: string }> {
    const response = await api.post(`/keys/${keyId}/reissue`)
    return response.data
  },

  async exportUsers(type: 'all' | 'with-subscription' | 'without-subscription'): Promise<Blob> {
    const response = await api.get(`/users/export/${type}`, { responseType: 'blob' })
    return response.data
  },

  // Трекинг (с кэшированием)
  async getTrackingLinks(): Promise<any[]> {
    return cachedGet<any[]>('/tracking')
  },

  async getTrackingLinkUsers(slug: string): Promise<any[]> {
    const response = await api.get(`/tracking/${slug}/users`)
    return response.data
  },

  async createTrackingLink(data: { name: string; slug: string; source?: string; link_type?: string }): Promise<any> {
    const response = await api.post('/tracking', data)
    return response.data
  },

  async updateTrackingLink(slug: string, data: { name?: string; source?: string }): Promise<any> {
    const response = await api.put(`/tracking/${slug}`, data)
    return response.data
  },

  async deleteTrackingLink(slug: string): Promise<void> {
    await api.delete(`/tracking/${slug}`)
  },

  async banCampaignBots(slug: string, scoreThreshold: number = 50): Promise<{ banned_count: number; message: string }> {
    const { data } = await api.post(`/tracking/${slug}/ban-bots`, { score_threshold: scoreThreshold })
    return data
  },

  async confirmBot(tgid: number): Promise<{ status: string; message: string }> {
    const { data } = await api.post(`/users/${tgid}/confirm-bot`)
    return data
  },

  // Локации (с кэшированием)
  // В новой модели все локации единые - is_trial игнорируется
  async getLocations(isTrial?: boolean): Promise<Location[]> {
    // isTrial параметр сохранён для обратной совместимости, но игнорируется
    return cachedGet<Location[]>('/locations')
  },

  async getCountries(): Promise<{ countries: string[] }> {
    return cachedGet<{ countries: string[] }>('/countries')
  },

  // В новой модели is_trial игнорируется - все локации единые
  async createLocation(name: string, isTrial?: boolean, additionalData?: { city?: string; country?: string; country_code?: string; flag?: string; traffic_limit_gb?: number | null }): Promise<Location> {
    const response = await api.post<Location>('/locations', {
      name,
      status: 'online',
      // is_trial убран - в новой модели все локации единые
      ...(additionalData || {})
    })
    return response.data
  },

  // В новой модели is_trial игнорируется
  async updateLocation(id: number, data: { name?: string; status?: string; country?: string; traffic_limit_gb?: number | null }, isTrial?: boolean): Promise<void> {
    const response = await api.put(`/locations/${id}`, data)
    return response.data
  },

  // В новой модели is_trial игнорируется
  async deleteLocation(id: number, isTrial?: boolean): Promise<void> {
    await api.delete(`/locations/${id}`)
  },

  // Серверы
  async getServers(isTrial?: boolean): Promise<Server[]> {
    const params = isTrial !== undefined ? { is_trial: isTrial } : {}
    const response = await api.get<Server[]>('/servers', { params })
    return response.data
  },

  async getServer(serverId: number): Promise<Server> {
    const response = await api.get<Server>(`/servers/${serverId}`)
    return response.data
  },

  // В новой модели is_trial игнорируется
  async getServersByLocation(locationId: number, isTrial?: boolean): Promise<Server[]> {
    const response = await api.get<Server[]>(`/locations/${locationId}/servers`)
    return response.data
  },

  async createServer(locationId: number, serverData: Partial<Server>): Promise<Server> {
    const response = await api.post<Server>(`/servers`, {
      ...serverData,
      location_id: locationId,
    })
    return response.data
  },

  async updateServer(serverId: number, data: Partial<Server>): Promise<Server> {
    const response = await api.put<Server>(`/servers/${serverId}`, data)
    return response.data
  },

  async deleteServer(serverId: number): Promise<void> {
    await api.delete(`/servers/${serverId}`)
  },

  async provisionKeys(locationId: number): Promise<{ message: string; location: string; servers_count: number }> {
    const response = await api.post(`/locations/${locationId}/provision-keys`)
    return response.data
  },

  async getLocationBalance(locationId: number): Promise<{
    servers: Array<{
      id: number;
      name: string;
      ip: string;
      active_keys: number;
      max_space: number;
      load_percent: number;
    }>;
    avg_load: number;
    total_keys: number;
    total_capacity: number;
    is_balanced: boolean;
  }> {
    const response = await api.get(`/locations/${locationId}/balance`)
    return response.data
  },

  async rebalanceLocation(locationId: number): Promise<{ status: string; message: string }> {
    const response = await api.post(`/locations/${locationId}/rebalance`)
    return response.data
  },

  async syncCapacity(): Promise<{ status: string; message: string }> {
    const response = await api.post('/servers/sync-capacity')
    return response.data
  },

  async getProvisioningStatus(locationId: number): Promise<{
    tasks: Array<{
      id: number;
      status: string;
      total_users: number;
      created_keys: number;
      failed_keys: number;
      skipped_keys: number;
      capacity_full: number;
      error_message: string | null;
      started_at: string | null;
      completed_at: string | null;
      created_at: string | null;
      progress: number;
    }>;
    has_running: boolean;
  }> {
    const response = await api.get(`/locations/${locationId}/provisioning-status`)
    return response.data
  },

  async restartXray(serverId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/servers/${serverId}/restart-xray`)
    return response.data
  },

  async runServerSpeedtest(serverId: number): Promise<{
    success: boolean;
    bandwidth?: string;
    download_mbps?: number;
    upload_mbps?: number;
    recommended_users?: number;
    error?: string;
  }> {
    const response = await api.post(`/servers/${serverId}/speedtest`)
    return response.data
  },

  async forceServerCheck(serverId: number, checkType: 'QUICK' | 'FULL' = 'FULL'): Promise<{
    success: boolean;
    server_id: number;
    server_name: string;
    check_type: string;
    status: string;
    check_duration?: number;
    ssh_latency_ms?: number;
    x3ui_latency_ms?: number;
    error_message?: string;
    message: string;
  }> {
    const response = await api.post(`/servers/${serverId}/force-check`, { check_type: checkType })
    return response.data
  },

  async testServerConnection(serverId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/servers/${serverId}/test-connection`)
    return response.data
  },

  async testX3UIConnection(data: { x3ui_url: string; x3ui_username: string; x3ui_password: string }): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/servers/test-x3ui-connection', data)
    return response.data
  },

  async testServerSpeed(data: { server_ip: string; ssh_password: string; ssh_username?: string }): Promise<{
    success: boolean;
    message: string;
    data?: {
      download_mbps: number;
      upload_mbps: number;
      download_gbps: number;
      upload_gbps: number;
      speed_formatted: string;
      ping_ms?: number;
      recommended_users: number;
    };
  }> {
    const response = await api.post('/servers/test-speed', {
      server_ip: data.server_ip,
      ssh_password: data.ssh_password,
      ssh_username: data.ssh_username || 'root'
    })
    return response.data
  },

  async fullServerCheck(data: {
    server_ip: string;
    ssh_password: string;
    x3ui_url: string;
    x3ui_username: string;
    x3ui_password: string;
    ssh_username?: string;
    inbound?: number;
  }): Promise<{
    success: boolean;
    steps: {
      ssh_connection: { status: string; message: string };
      x3ui_connection: { status: string; message: string };
      speedtest_check: { status: string; message: string };
      speedtest_install: { status: string; message: string };
      speedtest_run: { status: string; message: string };
    };
    data: {
      x3ui_info?: any;
      speedtest?: {
        download_mbps: number;
        upload_mbps: number;
        download_gbps: number;
        upload_gbps: number;
        speed_formatted: string;
        ping_ms?: number;
        recommended_users: number;
      };
    };
  }> {
    const requestData: any = {
      server_ip: data.server_ip,
      ssh_password: data.ssh_password,
      x3ui_url: data.x3ui_url,
      x3ui_username: data.x3ui_username,
      x3ui_password: data.x3ui_password,
      ssh_username: data.ssh_username || 'root'
    };

    // Добавляем inbound если он передан
    if (data.inbound !== undefined) {
      requestData.inbound = data.inbound;
    }

    const response = await api.post('/servers/full-check', requestData);
    return response.data
  },

  async installAgent(serverId: number): Promise<{ success: boolean; message: string; steps?: any }> {
    const response = await api.post(`/servers/${serverId}/install-agent`);
    return response.data
  },

  async toggleServerStatus(serverId: number, status: string): Promise<void> {
    await api.put(`/servers/${serverId}/status`, { status })
  },

  async getServerUsers(serverId: number): Promise<User[]> {
    const response = await api.get<User[]>(`/servers/${serverId}/users`)
    return response.data
  },

  async deleteServerUsers(serverId: number): Promise<void> {
    await api.post(`/servers/${serverId}/delete-users`)
  },

  async getSubscriptionPaths(): Promise<{ premium: SubscriptionPath[]; trial: SubscriptionPath[] }> {
    const response = await api.get<{ premium: SubscriptionPath[]; trial: SubscriptionPath[] }>(`/subscription-paths`)
    return response.data
  },

  async checkServerIP(ip: string, isTrial?: boolean): Promise<{ exists: boolean; server?: { id: number; ip: string; location: string; location_id: number } }> {
    // is_trial deprecated - проверяем только по IP
    const response = await api.get(`/servers/check-ip?ip=${encodeURIComponent(ip)}`)
    return response.data
  },

  // Ключи (с кэшированием)
  async getKeys(): Promise<Key[]> {
    return cachedGet<Key[]>('/keys')
  },

  async getKey(keyId: number): Promise<Key> {
    const response = await api.get<Key>(`/keys/${keyId}`)
    return response.data
  },

  async getKeyDetails(keyId: number): Promise<KeyDetails> {
    const response = await api.get<KeyDetails>(`/keys/${keyId}/details`)
    return response.data
  },

  async deleteKey(keyId: number): Promise<void> {
    await api.delete(`/keys/${keyId}`)
  },

  async getUserKeys(tgid: number): Promise<Key[]> {
    const response = await api.get<Key[]>(`/users/${tgid}/keys`)
    return response.data
  },

  async getUserPayments(tgid: number): Promise<Payment[]> {
    const response = await api.get<Payment[]>(`/users/${tgid}/payments`)
    return response.data
  },

  async getUserReferrals(tgid: number): Promise<Array<{
    id: number
    tgid: number
    name: string
    username: string
    date: string
    invite_days: number
    purchase_days: number
    total_days: number
  }>> {
    const response = await api.get(`/users/${tgid}/referrals`)
    return response.data
  },

  async updateKeySubscription(keyId: number, subscription: number): Promise<void> {
    await api.put(`/keys/${keyId}/subscription`, { subscription })
  },

  async switchKeyLocation(keyId: number, locationId: number): Promise<void> {
    await api.put(`/keys/${keyId}/switch-location`, { location_id: locationId })
  },

  // Платежи (с кэшированием)
  async getPayments(): Promise<Payment[]> {
    return cachedGet<Payment[]>('/payments')
  },

  async exportPayments(): Promise<Blob> {
    const response = await api.get('/payments/export', { responseType: 'blob' })
    return response.data
  },

  // Промокоды (с кэшированием)
  async getPromocodes(): Promise<Promocode[]> {
    return cachedGet<Promocode[]>('/promocodes')
  },

  async getPromocode(promoId: number): Promise<Promocode> {
    const response = await api.get<Promocode>(`/promocodes/${promoId}`)
    return response.data
  },

  async createPromocode(data: {
    text: string;
    percent?: number;
    amount?: number;
    count_use: number;
    expires_at?: string | null;
    active?: boolean;
    discount_type?: 'percentage' | 'fixed';
  }): Promise<Promocode> {
    const response = await api.post<Promocode>('/promocodes', data)
    return response.data
  },

  async deletePromocode(promoId: number): Promise<void> {
    await api.delete(`/promocodes/${promoId}`)
  },

  async togglePromocode(promoId: number): Promise<{ id: number; active: boolean; message: string }> {
    const response = await api.patch(`/promocodes/${promoId}/toggle`)
    return response.data
  },

  // Реферальная программа (с кэшированием)
  async getReferrals(): Promise<Referral[]> {
    return cachedGet<Referral[]>('/referrals')
  },

  // Вывод средств
  async getWithdrawals(): Promise<Withdrawal[]> {
    const response = await api.get<Withdrawal[]>('/withdrawals')
    return response.data
  },

  async getWithdrawal(withdrawalId: number): Promise<Withdrawal> {
    const response = await api.get<Withdrawal>(`/withdrawals/${withdrawalId}`)
    return response.data
  },

  async approveWithdrawal(withdrawalId: number): Promise<void> {
    await api.post(`/withdrawals/${withdrawalId}/approve`)
  },

  async rejectWithdrawal(withdrawalId: number): Promise<void> {
    await api.post(`/withdrawals/${withdrawalId}/reject`)
  },

  // Настройки (с кэшированием)
  async getSettings(): Promise<Settings> {
    return cachedGet<Settings>('/settings')
  },

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await api.post<Settings>('/settings', settings)
    // Инвалидируем кэш настроек после обновления
    apiCache.invalidate('/settings')
    return response.data
  },

  // Subscription Domain
  async getSubscriptionDomainStatus(): Promise<{
    configured: boolean;
    domain: string | null;
    dns_valid: boolean;
    ssl_valid: boolean;
    ssl_expires_at: string | null;
    ssl_days_remaining: number | null;
    ready: boolean;
    errors: string[];
  }> {
    const response = await api.get('/admin/settings/subscription-domain/status')
    return response.data
  },

  async checkSubscriptionDomainDNS(domain: string): Promise<{
    valid: boolean;
    server_ip: string | null;
    domain_ip: string | null;
    error: string | null;
  }> {
    const response = await api.post('/admin/settings/subscription-domain/check', { domain })
    return response.data
  },

  async applySubscriptionDomain(domain: string, backend_port: number = 8000): Promise<{
    success: boolean;
    message: string;
    domain: string | null;
    dns_check: any;
    ssl_check: any;
    error: string | null;
  }> {
    const response = await api.post('/admin/settings/subscription-domain/apply', { domain, backend_port })
    return response.data
  },

  async removeSubscriptionDomain(): Promise<{
    success: boolean;
    message: string;
    removed_domain: string;
  }> {
    const response = await api.delete('/admin/settings/subscription-domain')
    return response.data
  },

  // Тарифные планы
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await api.get<SubscriptionPlan[]>('/plans')
    return response.data
  },

  async updatePlans(plans: Partial<SubscriptionPlan>[]): Promise<{ message: string; updated: string[] }> {
    const response = await api.post('/plans', plans)
    return response.data
  },

  // Тестовые функции
  async sendTestNotification(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/notifications/test')
    return response.data
  },

  async triggerHealthCheck(): Promise<{ status: string; message: string }> {
    const response = await api.post('/health-check/trigger')
    return response.data
  },

  async testWebhookEndpoint(webhookUrl: string): Promise<{ success: boolean; accessible: boolean; message: string }> {
    const response = await api.post('/webhooks/test', null, { params: { webhook_url: webhookUrl } })
    return response.data
  },

  // Управление вебхуками
  async configureWebhooks(baseUrl: string): Promise<any> {
    const response = await api.post('/webhooks/configure', { base_url: baseUrl })
    return response.data
  },

  async checkWebhooksStatus(): Promise<{
    success: boolean
    results: {
      cryptobot: WebhookStatus
      yookassa: WebhookStatus
      yoomoney: WebhookStatus
      stars: WebhookStatus
    }
  }> {
    const response = await api.get('/webhooks/status')
    return response.data
  },

  async getPaymentSystemsInfo(): Promise<any> {
    const response = await api.get('/payment-systems/info')
    return response.data
  },

  async triggerKeysCleanup(): Promise<{ status: string; message: string }> {
    const response = await api.post('/keys/cleanup/trigger')
    return response.data
  },

  // Broadcasts (с кэшированием)
  async getBroadcasts(): Promise<Broadcast[]> {
    return cachedGet<Broadcast[]>('/broadcasts')
  },

  async getBroadcastsStats(): Promise<BroadcastStats> {
    return cachedGet<BroadcastStats>('/broadcasts/stats')
  },

  async createBroadcast(data: {
    audience_filter: string
    message_text: string
    image_url?: string | null
    scheduled_at?: string | null
    target_tgid?: number | null
  }): Promise<{ id: number; status: string; message: string }> {
    const response = await api.post('/broadcasts', data)
    return response.data
  },

  async uploadSticker(file: File): Promise<{ filename: string; url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/stickers/upload', formData, {
      headers: { 'Content-Type': undefined }
    })
    return response.data
  },

  async uploadBroadcastImage(file: File): Promise<{ filename: string; url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/broadcasts/upload-image', formData, {
      headers: { 'Content-Type': undefined }
    })
    return response.data
  },

  async previewBroadcastAudience(audience_filter: string): Promise<{
    audience_filter: string
    total_users: number
  }> {
    const response = await api.get(`/broadcasts/preview-audience?audience_filter=${audience_filter}`)
    return response.data
  },

  async deleteBroadcast(broadcastId: number): Promise<void> {
    await api.delete(`/broadcasts/${broadcastId}`)
  },

  async getProblematicServers(): Promise<{
    failing_servers: Array<{
      id: number
      name: string
      ip: string
      status: string
      location_name: string
      location_flag: string | null
      health_score: number
      uptime_percentage: number
      avg_response_time_ms: number | null
      consecutive_failures: number
      ssh_latency_ms: number | null
      x3ui_latency_ms: number | null
      last_offline_at: string | null
    }>
    slow_servers: Array<{
      id: number
      name: string
      ip: string
      status: string
      location_name: string
      location_flag: string | null
      health_score: number
      uptime_percentage: number
      avg_response_time_ms: number | null
      consecutive_failures: number
      ssh_latency_ms: number | null
      x3ui_latency_ms: number | null
      last_offline_at: string | null
    }>
    degraded_servers: Array<{
      id: number
      name: string
      ip: string
      status: string
      location_name: string
      location_flag: string | null
      health_score: number
      uptime_percentage: number
      avg_response_time_ms: number | null
      consecutive_failures: number
      ssh_latency_ms: number | null
      x3ui_latency_ms: number | null
      last_offline_at: string | null
    }>
    total_problematic: number
  }> {
    return cachedGet('/servers/problematic')
  },

  async getServersRanking(limit: number = 10): Promise<{
    ranking: Array<{
      rank: number
      medal: string | null
      id: number
      name: string
      ip: string
      status: string
      location_name: string
      location_flag: string | null
      health_score: number
      uptime_percentage: number
      avg_response_time_ms: number | null
      total_checks: number
      failed_checks: number
      reliability_badge: string
    }>
    total_servers: number
  }> {
    return cachedGet(`/servers/ranking`, { limit })
  },

  async getCurrentAdmin(): Promise<{
    id: number
    username: string
    role: string
    active: boolean
  }> {
    const response = await api.get('/admins/me')
    return response.data
  },

  // Аналитика (расширенная v2)
  async getAnalytics(): Promise<{
    metrics: {
      mrr: number
      mrr_change: number
      arr: number
      churn_rate: number
      renewal_rate: number
      ltv: number
      predicted_ltv: number
      arpu: number
      arppu: number
      avg_check: number
      payments_per_user: number
      active_subscriptions: number
      active_trial_subs: number
      total_users: number
      paying_users: number
      total_revenue: number
      revenue_7d: number
      revenue_30d: number
      revenue_30d_change: number
      new_users_this_month: number
      new_users_change: number
    }
    mrr_breakdown: {
      current_mrr: number
      new_mrr: number
      new_mrr_users: number
      reactivation_mrr: number
      reactivated_users: number
      churned_mrr: number
      churned_users: number
      net_mrr: number
      monthly_price: number
    }
    activity: {
      dau: number
      wau: number
      mau: number
      stickiness: number
    }
    funnel: {
      total_users: number
      trial_users: number
      paid_users: number
      trial_converted: number
      paid_without_trial: number
      trial_rate: number
      purchase_rate: number
      trial_to_paid_rate: number
      new_users_30d: number
      new_trials_30d: number
      new_paid_30d: number
      trial_rate_30d: number
      purchase_rate_30d: number
    }
    cohorts: Array<{
      month: string
      month_short: string
      cohort_size: number
      retained: number
      retention_rate: number
      tried_trial: number
      trial_adoption: number
      converted_to_paid: number
      conversion_rate: number
    }>
    revenue_by_day: Array<{
      date: string
      day_name: string
      revenue: number
      payments: number
      prev_revenue: number
      change: number
    }>
    registrations_by_day: Array<{
      date: string
      day_name: string
      count: number
      prev_count: number
      change: number
    }>
    sources: Array<{
      source: string
      count: number
      percentage: number
      revenue: number
      paying_users: number
      conversion_rate: number
      revenue_per_user: number
    }>
    insights: Array<{
      type: 'success' | 'warning' | 'danger'
      category: string
      title: string
      description: string
      metric: number
      threshold: number
    }>
    projections: {
      projected_mrr: number
      projected_arr: number
      projected_users: number
      growth_rate: number
    }
  }> {
    return cachedGet('/analytics')
  },

  async extendSubscription(tgid: number, days: number): Promise<{ message: string; extended_keys: number }> {
    const response = await api.post(`/users/${tgid}/extend-subscription`, { days })
    return response.data
  },

  // ============ ЛОГИ АДМИНОВ ============
  async getAdminLogs(params?: {
    admin_id?: number;
    action?: string;
    entity_type?: string;
    date_from?: string;
    date_to?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: number;
      admin_id: number | null;
      admin_username: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      entity_name: string | null;
      details: Record<string, any> | null;
      ip_address: string | null;
      created_at: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const response = await api.get('/admin-logs', { params })
    return response.data
  },

  async getAdminLogsFilters(): Promise<{
    actions: Array<{ value: string; label: string }>;
    entity_types: Array<{ value: string; label: string }>;
  }> {
    const response = await api.get('/admin-logs/filters')
    return response.data
  },

  async getAdminLogsStats(days?: number): Promise<{
    period_days: number;
    total_actions: number;
    by_action: Array<{ action: string; count: number }>;
    by_admin: Array<{ admin: string; count: number }>;
    by_day: Array<{ date: string; count: number }>;
  }> {
    const response = await api.get('/admin-logs/stats', { params: { days } })
    return response.data
  },

  // ============ МОНИТОРИНГ УСТРОЙСТВ ============
  async getServerOnlineDevices(serverId: number): Promise<{
    server_id: number;
    server_name: string;
    server_ip: string;
    total_online_clients: number;
    total_online_ips: number;
    clients_over_limit: number;
    devices: Array<{
      email: string;
      ips: string[];
      ip_count: number;
      limit_ip: number;
      is_over_limit: boolean;
    }>;
  }> {
    const response = await api.get(`/servers/${serverId}/online-devices`)
    return response.data
  },

  async getServerBannedIPs(serverId: number): Promise<{
    server_id: number;
    server_name: string;
    server_ip: string;
    total_banned: number;
    banned_ips: Array<{
      ip: string;
      jail: string;
      ban_time: string | null;
      reason: string | null;
    }>;
  }> {
    const response = await api.get(`/servers/${serverId}/banned-ips`)
    return response.data
  },

  async getSubscriptionOnlineDevices(subscriptionToken: string): Promise<{
    subscription_token: string;
    user_tgid: number;
    total_locations: number;
    total_online_ips: number;
    device_limit: number;
    is_over_limit: boolean;
    locations: Array<{
      location_id: number;
      location_name: string;
      location_flag: string;
      server_id: number;
      status: string;
      client_email?: string;
      is_online?: boolean;
      online_ips: string[];
      online_ip_count?: number;
      banned_ips?: string[];  // Забаненные IP на сервере через fail2ban
      error?: string;
    }>;
  }> {
    const response = await api.get(`/keys/${subscriptionToken}/online-devices`)
    return response.data
  },

  async unbanIP(serverId: number, ip: string, jail: string = '3x-ipl'): Promise<{
    success: boolean;
    message: string;
    server_id: number;
  }> {
    const response = await api.post(`/servers/${serverId}/unban-ip`, null, {
      params: { ip, jail }
    })
    return response.data
  },

  async banIP(serverId: number, ip: string, jail: string = '3x-ipl'): Promise<{
    success: boolean;
    message: string;
    server_id: number;
  }> {
    const response = await api.post(`/servers/${serverId}/ban-ip`, null, {
      params: { ip, jail }
    })
    return response.data
  },

  // ===== SUPPORT CHAT =====

  async getSupportConversations(params?: { status?: string; search?: string; offset?: number; limit?: number }) {
    const response = await api.get('/support/conversations', { params })
    return response.data
  },

  async getSupportMessages(conversationId: number, params?: { offset?: number; limit?: number }) {
    const response = await api.get(`/support/conversations/${conversationId}/messages`, { params })
    return response.data
  },

  async sendSupportMessage(conversationId: number, text: string) {
    const response = await api.post(`/support/conversations/${conversationId}/messages`, { text })
    return response.data
  },

  async markConversationRead(conversationId: number) {
    const response = await api.patch(`/support/conversations/${conversationId}/read`)
    return response.data
  },

  async updateConversationStatus(conversationId: number, status: string) {
    const response = await api.patch(`/support/conversations/${conversationId}`, { status })
    return response.data
  },

  async getSupportUnreadCount() {
    const response = await api.get('/support/unread-count')
    return response.data
  },

  async getSupportFileUrl(fileId: string, filename?: string | null): Promise<string> {
    const params = filename ? { filename } : undefined
    const response = await api.get(`/support/file/${fileId}`, { responseType: 'blob', params })
    return URL.createObjectURL(response.data)
  },

  async toggleSupportAI(conversationId: number, enabled: boolean) {
    const response = await api.patch(`/support/conversations/${conversationId}/ai`, { enabled })
    return response.data
  },

  // Database management
  async getDatabaseStatus() {
    const response = await api.get('/database/status')
    return response.data
  },

  async testDatabaseConnection(creds: { host: string; port: number; username: string; password: string; database: string; ssl: boolean }) {
    const response = await api.post('/database/test-connection', creds)
    return response.data
  },

  async migrateDatabase(creds: { host: string; port: number; username: string; password: string; database: string; ssl: boolean }) {
    const response = await api.post('/database/migrate', creds, { timeout: 300000 })
    return response.data
  },

  async switchDatabase(creds: { host: string; port: number; username: string; password: string; database: string; ssl: boolean }) {
    const response = await api.post('/database/switch', creds)
    return response.data
  },

  async exportDatabaseData(type: string): Promise<Blob> {
    const response = await api.get(`/database/export/${type}`, { responseType: 'blob' })
    return response.data
  },
}
