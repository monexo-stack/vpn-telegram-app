import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Send, ArrowLeft, MessageSquare, Check, CheckCheck, User as UserIcon, Key as KeyIcon, FileDown, Bot, AlertTriangle, Sparkles } from 'lucide-react'
import { useMiniApp } from '../context/MiniAppContext'
import { useBackButton } from '../hooks/useBackButton'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from './ui/utils'
import { apiClient, type User as ApiUser } from '../services/api'
import { UserDetailsModal } from './UserDetailsModal'
import { KeyDetailsModal } from './KeyDetailsModal'

interface Conversation {
  id: number
  user_tgid: number
  username: string | null
  fullname: string | null
  status: string
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string | null
  needs_admin: boolean
  ai_enabled: boolean
  user_level: number
}

interface Message {
  id: number
  sender: 'user' | 'admin' | 'ai'
  admin_username: string | null
  text: string | null
  media_type: string | null
  media_file_id: string | null
  media_filename: string | null
  is_read: boolean
  created_at: string | null
}

// Компонент для отображения медиа-контента
function MediaContent({ fileId, mediaType, filename }: { fileId: string; mediaType: string; filename?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let revoke: string | null = null
    apiClient.getSupportFileUrl(fileId, filename)
      .then(blobUrl => {
        revoke = blobUrl
        setUrl(blobUrl)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [fileId, filename])

  if (loading) return <div className="w-48 h-32 bg-muted/50 animate-pulse rounded-lg" />
  if (error || !url) return <div className="text-xs opacity-70 italic">[Не удалось загрузить]</div>

  // Скачать blob с правильным именем файла
  const downloadFile = (name: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (mediaType === 'photo') {
    return <img src={url} alt="photo" className="max-w-[280px] max-h-[300px] rounded-lg object-cover cursor-pointer" onClick={() => {
      // Открываем фото в новой вкладке через blob
      const w = window.open('')
      if (w) {
        w.document.write(`<img src="${url}" style="max-width:100%;max-height:100vh;" />`)
        w.document.title = filename || 'photo'
      }
    }} />
  }
  if (mediaType === 'sticker') {
    return <img src={url} alt="sticker" className="w-28 h-28 object-contain" />
  }
  if (mediaType === 'video') {
    return <video src={url} controls className="max-w-[280px] max-h-[300px] rounded-lg" />
  }
  if (mediaType === 'voice') {
    return <audio src={url} controls className="max-w-[250px]" />
  }
  if (mediaType === 'document') {
    return (
      <button onClick={() => downloadFile(filename || 'file')} className="flex items-center gap-2 text-xs underline opacity-80 hover:opacity-100">
        <FileDown className="h-3.5 w-3.5" />
        {filename || 'Скачать файл'}
      </button>
    )
  }
  return <div className="text-xs opacity-70 italic">[{mediaType}]</div>
}

export function SupportChat() {
  const { isMiniApp } = useMiniApp()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [search, setSearch] = useState('')
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showNeedsAdmin, setShowNeedsAdmin] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMessagesLengthRef = useRef<number>(0)
  const shouldAutoScrollRef = useRef<boolean>(true)

  // User profile modal
  const [profileUser, setProfileUser] = useState<any>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  // Key details modal
  const [keyId, setKeyId] = useState<number | null>(null)
  const [keyModalOpen, setKeyModalOpen] = useState(false)

  const openProfile = useCallback(async (tgid: number) => {
    try {
      const apiUser: ApiUser = await apiClient.getUserByTgid(tgid)
      const formatDate = (d: string | null | undefined) => {
        if (!d) return '—'
        try { return new Date(d).toLocaleDateString('ru-RU') } catch { return '—' }
      }
      const status: 'active' | 'expired' | 'banned' | 'none' = apiUser.banned
        ? 'banned'
        : apiUser.subscription_active
          ? 'active'
          : (apiUser.keys_count > 0 || apiUser.expires_at)
            ? 'expired'
            : 'none'
      setProfileUser({
        id: apiUser.id.toString(),
        name: apiUser.fullname || '',
        telegramId: apiUser.tgid.toString(),
        username: apiUser.username || '',
        plan: apiUser.subscription_type || 'Нет подписки',
        status,
        registered: formatDate(apiUser.created_at),
        lastActive: formatDate(apiUser.last_active),
        revenue: apiUser.revenue ? `₽${apiUser.revenue.toFixed(2)}` : '₽0',
        expiresAt: apiUser.expires_at || undefined,
        source: (apiUser.source as 'organic' | 'referral' | 'ad') || 'organic',
      })
      setProfileOpen(true)
    } catch (e) {
      console.error('Failed to load user profile:', e)
    }
  }, [])

  const openKey = useCallback(async (tgid: number) => {
    try {
      const keys = await apiClient.getUserKeys(tgid)
      if (!keys || keys.length === 0) return
      const activeKey = keys.find(k => k.active) || keys[0]
      if (activeKey) {
        setKeyId(activeKey.id)
        setKeyModalOpen(true)
      }
    } catch (e) {
      console.error('Failed to load user keys:', e)
    }
  }, [])

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiClient.getSupportConversations({
        search: search || undefined,
      })
      setConversations(data.conversations)
    } catch (e) {
      console.error('Failed to load conversations:', e)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load messages when conversation selected
  const loadMessages = useCallback(async (convId: number, forceScroll = false) => {
    try {
      const data = await apiClient.getSupportMessages(convId, { limit: 200 })
      setMessages(data.messages)
      // Auto-scroll only on initial load or when forced (new message sent)
      if (forceScroll) {
        shouldAutoScrollRef.current = true
      }
      // Mark as read
      await apiClient.markConversationRead(convId)
      // Update local unread count
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread_count: 0 } : c
      ))
    } catch (e) {
      console.error('Failed to load messages:', e)
    }
  }, [])

  useEffect(() => {
    if (selectedConv) {
      shouldAutoScrollRef.current = true // Auto-scroll on initial conversation load
      loadMessages(selectedConv.id, true)
    }
  }, [selectedConv, loadMessages])

  // Scroll to bottom only when needed (new messages added or initial load)
  useEffect(() => {
    const newLength = messages.length
    const prevLength = prevMessagesLengthRef.current

    // Auto-scroll if:
    // 1. shouldAutoScroll flag is set (initial load or message sent)
    // 2. New messages were added (length increased)
    if (shouldAutoScrollRef.current || newLength > prevLength) {
      const el = messagesEndRef.current
      if (el?.parentElement) {
        el.parentElement.scrollTop = el.parentElement.scrollHeight
      }
      shouldAutoScrollRef.current = false
    }

    prevMessagesLengthRef.current = newLength
  }, [messages])

  // Listen for WebSocket support_message events
  useEffect(() => {
    // Poll for new messages since we don't have a direct WS callback for support
    // The WS broadcasts support_message type which we can handle in the existing hook
    const interval = setInterval(() => {
      loadConversations()
      if (selectedConv) {
        loadMessages(selectedConv.id)
      }
    }, 5000) // Poll every 5s as fallback

    return () => clearInterval(interval)
  }, [selectedConv, loadConversations, loadMessages])

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConv || sendingMessage) return

    setSendingMessage(true)
    try {
      const msg = await apiClient.sendSupportMessage(selectedConv.id, messageText.trim())
      setMessages(prev => [...prev, msg])
      shouldAutoScrollRef.current = true // Auto-scroll when admin sends a message
      setMessageText('')
      inputRef.current?.focus()
      // Refresh conversations to update preview
      loadConversations()
    } catch (e) {
      console.error('Failed to send message:', e)
    } finally {
      setSendingMessage(false)
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  const getDisplayName = (conv: Conversation) => {
    return conv.fullname || conv.username || `User ${conv.user_tgid}`
  }

  const getInitials = (conv: Conversation) => {
    const name = getDisplayName(conv)
    return name.slice(0, 2).toUpperCase()
  }

  const handleToggleAI = async () => {
    if (!selectedConv) return
    const newVal = !selectedConv.ai_enabled
    try {
      await apiClient.toggleSupportAI(selectedConv.id, newVal)
      setSelectedConv({ ...selectedConv, ai_enabled: newVal })
      setConversations(prev => prev.map(c =>
        c.id === selectedConv.id ? { ...c, ai_enabled: newVal } : c
      ))
    } catch (e) {
      console.error('Failed to toggle AI:', e)
    }
  }

  const filteredConversations = showNeedsAdmin
    ? conversations.filter(c => c.needs_admin)
    : conversations

  // Mobile: show either list or conversation
  const showConversation = !!selectedConv

  // Telegram back button for mini app
  useBackButton(isMiniApp && showConversation, () => setSelectedConv(null))

  return (
  <>
    <div className={cn(
      "flex overflow-hidden bg-card",
      isMiniApp ? "h-full" : "h-[calc(100vh-7rem)] rounded-lg border"
    )}>
      {/* Conversation List */}
      <div className={cn(
        "border-r flex flex-col",
        isMiniApp ? "w-full" : "w-full sm:w-80 sm:min-w-80",
        showConversation && (isMiniApp ? "hidden" : "hidden sm:flex")
      )}>
        {/* Search */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Button
            variant={showNeedsAdmin ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowNeedsAdmin(!showNeedsAdmin)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Требуют внимания
          </Button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Загрузка...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Нет диалогов</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b transition-colors",
                  selectedConv?.id === conv.id && "bg-muted"
                )}
                onClick={() => setSelectedConv(conv)}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                  {getInitials(conv)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-sm truncate">{getDisplayName(conv)}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">
                      {conv.last_message_preview || 'Нет сообщений'}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {conv.needs_admin && (
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      )}
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        !showConversation && (isMiniApp ? "hidden" : "hidden sm:flex")
      )}>
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b flex-shrink-0 overflow-x-auto">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", isMiniApp ? "" : "sm:hidden")}
                onClick={() => setSelectedConv(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {getInitials(selectedConv)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{getDisplayName(selectedConv)}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedConv.username ? `@${selectedConv.username}` : `ID: ${selectedConv.user_tgid}`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openProfile(selectedConv.user_tgid)}
                title="Профиль пользователя"
              >
                <UserIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openKey(selectedConv.user_tgid)}
                title="Ключ пользователя"
              >
                <KeyIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedConv.ai_enabled ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleToggleAI}
                title={selectedConv.ai_enabled ? 'ИИ включен' : 'ИИ выключен'}
              >
                <Sparkles className="h-3.5 w-3.5" />
                ИИ
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Нет сообщений
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender === 'admin' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.sender === 'ai' && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center mr-2 mt-1">
                        <Bot className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm overflow-hidden",
                      msg.sender === 'admin'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : msg.sender === 'ai'
                          ? 'bg-violet-500/10 border border-violet-500/20 rounded-bl-md'
                          : 'bg-muted rounded-bl-md'
                    )}>
                      {msg.media_type && msg.media_file_id && (
                        <MediaContent fileId={msg.media_file_id} mediaType={msg.media_type} filename={msg.media_filename} />
                      )}
                      {msg.text && <div className="whitespace-pre-wrap break-words break-all">{msg.text}</div>}
                      <div className={cn(
                        "text-[10px] mt-1 flex items-center gap-1",
                        msg.sender === 'admin' ? 'justify-end opacity-70' : 'text-muted-foreground'
                      )}>
                        {msg.sender === 'ai' && <Bot className="h-2.5 w-2.5" />}
                        {formatTime(msg.created_at)}
                        {msg.sender === 'admin' && (
                          msg.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend() }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  placeholder="Написать сообщение..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                  disabled={sendingMessage}
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageText.trim() || sendingMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Выберите диалог</p>
            </div>
          </div>
        )}
      </div>
    </div>

    <UserDetailsModal
      isOpen={profileOpen}
      onClose={() => { setProfileOpen(false); setProfileUser(null) }}
      user={profileUser}
    />

    {keyId && (
      <KeyDetailsModal
        isOpen={keyModalOpen}
        onClose={() => { setKeyModalOpen(false); setKeyId(null) }}
        keyId={keyId}
      />
    )}
  </>
  )
}
