import { cn } from '../ui/utils';

interface KeyCardProps {
  keyData: {
    id: string;
    userName: string;
    username?: string;
    telegramId: string;
    plan: string;
    status: 'active' | 'expired';
    trafficFormatted: string;
    expires: string;
    daysRemaining?: number | null;
    isOnline?: boolean;
  };
  onClick?: () => void;
}

export function KeyCard({ keyData, onClick }: KeyCardProps) {
  const isActive = keyData.status === 'active';
  const daysRemaining = keyData.daysRemaining;

  const getTimeColor = () => {
    if (!isActive || daysRemaining === null || daysRemaining === undefined) return 'text-muted-foreground';
    if (daysRemaining <= 0) return 'text-red-500';
    if (daysRemaining <= 3) return 'text-orange-500';
    if (daysRemaining <= 7) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatDaysRemaining = () => {
    if (!isActive || daysRemaining === null || daysRemaining === undefined) return null;
    if (daysRemaining <= 0) return 'Истёк';
    if (daysRemaining === 1) return '1 день';
    if (daysRemaining < 5) return `${daysRemaining} дня`;
    return `${daysRemaining} дней`;
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-card border rounded-lg active:bg-accent/50 transition-colors cursor-pointer"
    >
      {/* Left: Key info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{keyData.userName || 'Без имени'}</span>
          {keyData.isOnline && (
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          {keyData.username && <span>@{keyData.username}</span>}
          {keyData.username && keyData.plan && <span>·</span>}
          <span>{keyData.plan}</span>
          {keyData.trafficFormatted !== '0 B' && (
            <>
              <span>·</span>
              <span>{keyData.trafficFormatted}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Status / Days */}
      <div className="flex flex-col items-end shrink-0 ml-3">
        <span className={cn('text-sm font-medium', getTimeColor())}>
          {formatDaysRemaining() || (isActive ? 'Активен' : 'Истёк')}
        </span>
        <span className="text-xs text-muted-foreground">{keyData.expires}</span>
      </div>
    </div>
  );
}
