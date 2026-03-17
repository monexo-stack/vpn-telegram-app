import { cn } from '../ui/utils';

interface BroadcastCardProps {
  broadcast: {
    id: number;
    audienceFilter: string;
    messageText: string;
    status: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
  };
  onClick?: () => void;
}

export function BroadcastCard({ broadcast, onClick }: BroadcastCardProps) {
  const audienceLabels: Record<string, string> = {
    all: 'Все',
    with_subscription: 'С подпиской',
    without_subscription: 'Без подписки',
    expiring_soon: 'Истекает',
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Черновик', className: 'text-gray-500' },
    scheduled: { label: 'Запланирована', className: 'text-blue-500' },
    sending: { label: 'Отправка...', className: 'text-yellow-500' },
    completed: { label: 'Завершена', className: 'text-green-500' },
    failed: { label: 'Ошибка', className: 'text-red-500' },
  };

  const status = statusConfig[broadcast.status] || statusConfig.draft;
  const audienceLabel = audienceLabels[broadcast.audienceFilter] || broadcast.audienceFilter;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col p-3 bg-card border rounded-lg transition-colors gap-2",
        onClick && "active:bg-accent/50 cursor-pointer"
      )}
    >
      {/* Header: Status and date */}
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", status.className)}>
          {status.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(broadcast.createdAt).toLocaleDateString('ru-RU')}
        </span>
      </div>

      {/* Message preview */}
      <div className="text-sm line-clamp-2">
        {broadcast.messageText}
      </div>

      {/* Footer: Audience and stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{audienceLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-green-500">{broadcast.sentCount}</span>
          {broadcast.failedCount > 0 && (
            <span className="text-red-500">/{broadcast.failedCount}</span>
          )}
          <span>из {broadcast.totalRecipients}</span>
        </div>
      </div>
    </div>
  );
}
