import { cn } from '../ui/utils';

interface UserCardProps {
  user: {
    telegramId: string;
    name: string;
    username?: string;
    status: 'active' | 'expired' | 'banned' | 'none';
    plan?: string;
    revenue?: string;
  };
  onClick?: () => void;
}

export function UserCard({ user, onClick }: UserCardProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Активен', className: 'text-green-500' },
    expired: { label: 'Истёк', className: 'text-yellow-500' },
    banned: { label: 'Забл.', className: 'text-red-500' },
    none: { label: '', className: 'text-muted-foreground' },
  };

  const status = statusConfig[user.status] || statusConfig.none;
  const hasRevenue = user.revenue && user.revenue !== '₽0' && user.revenue !== '₽0.00';

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-card border rounded-lg active:bg-accent/50 transition-colors cursor-pointer"
    >
      {/* Left: User info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{user.name || 'Без имени'}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          {user.username && <span>@{user.username}</span>}
          {user.username && (user.plan || status.label) && <span>·</span>}
          {user.plan && <span>{user.plan}</span>}
          {user.plan && status.label && <span>·</span>}
          {status.label && <span className={status.className}>{status.label}</span>}
        </div>
      </div>

      {/* Right: Revenue */}
      {hasRevenue && (
        <div className="text-sm font-medium text-green-500 shrink-0 ml-3">
          {user.revenue}
        </div>
      )}
    </div>
  );
}
