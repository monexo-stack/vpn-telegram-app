import { Star } from 'lucide-react';
import { cn } from '../ui/utils';

interface PaymentCardProps {
  payment: {
    id: string;
    userName: string;
    username?: string;
    amount: string;
    plan: string;
    method: string;
    status: 'completed' | 'pending' | 'failed';
    date: string;
    starsAmount?: number | null;
  };
  onClick?: () => void;
}

export function PaymentCard({ payment, onClick }: PaymentCardProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    completed: { label: 'Успешно', className: 'text-green-500' },
    pending: { label: 'Ожидает', className: 'text-orange-500' },
    failed: { label: 'Отклонено', className: 'text-red-500' },
  };

  const status = statusConfig[payment.status] || statusConfig.pending;
  const isTelegramStars = payment.method === 'Telegram Stars';

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-3 bg-card border rounded-lg transition-colors",
        onClick && "active:bg-accent/50 cursor-pointer"
      )}
    >
      {/* Left: Payment info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{payment.userName || 'Без имени'}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span>{payment.plan}</span>
          <span>·</span>
          <span className={status.className}>{status.label}</span>
        </div>
      </div>

      {/* Right: Amount and date */}
      <div className="flex flex-col items-end shrink-0 ml-3">
        {isTelegramStars && payment.starsAmount ? (
          <div className="flex items-center gap-1 text-sm font-medium">
            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
            {payment.starsAmount}
          </div>
        ) : (
          <span className="text-sm font-medium text-green-500">{payment.amount}</span>
        )}
        <span className="text-xs text-muted-foreground">{payment.date?.split(',')[0] ?? ''}</span>
      </div>
    </div>
  );
}
