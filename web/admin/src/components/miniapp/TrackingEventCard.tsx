import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  CreditCard,
  Key,
  Settings,
  Bell,
  Gift,
  Activity
} from "lucide-react";

interface TrackingEventCardProps {
  event: {
    id: number;
    action: string;
    user_id: number;
    details?: string;
    created_at: string;
  };
  onClick?: () => void;
}

const actionConfig: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  registration: { icon: UserPlus, color: "text-green-500", label: "Регистрация" },
  payment: { icon: CreditCard, color: "text-blue-500", label: "Платеж" },
  key_created: { icon: Key, color: "text-purple-500", label: "Создан ключ" },
  key_extended: { icon: Key, color: "text-cyan-500", label: "Продлен ключ" },
  settings_changed: { icon: Settings, color: "text-orange-500", label: "Настройки" },
  notification: { icon: Bell, color: "text-yellow-500", label: "Уведомление" },
  referral: { icon: Gift, color: "text-pink-500", label: "Реферал" },
};

export function TrackingEventCard({ event, onClick }: TrackingEventCardProps) {
  const config = actionConfig[event.action] || {
    icon: Activity,
    color: "text-muted-foreground",
    label: event.action
  };
  const Icon = config.icon;

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(event.created_at)}
              </span>
            </div>

            <div className="mt-1.5 text-sm">
              <span className="text-muted-foreground">User: </span>
              <span className="font-mono">{event.user_id}</span>
            </div>

            {event.details && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {event.details}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
