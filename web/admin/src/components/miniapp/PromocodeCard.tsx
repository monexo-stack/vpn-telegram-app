import { Copy, Check } from 'lucide-react';
import { cn } from '../ui/utils';

interface PromocodeCardProps {
  promocode: {
    id: string;
    code: string;
    discount: string;
    type: 'percentage' | 'fixed';
    uses: number;
    maxUses: number;
    status: 'active' | 'expired' | 'disabled';
    totalDiscountGiven: number;
  };
  isCopied: boolean;
  onCopy: (id: string, code: string) => void;
  onClick?: () => void;
}

export function PromocodeCard({ promocode, isCopied, onCopy, onClick }: PromocodeCardProps) {
  const usagePercent = promocode.maxUses ? Math.min((promocode.uses / promocode.maxUses) * 100, 100) : 0;

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Активен', className: 'text-green-500' },
    expired: { label: 'Истёк', className: 'text-red-500' },
    disabled: { label: 'Выключен', className: 'text-muted-foreground' },
  };

  const status = statusConfig[promocode.status] || statusConfig.disabled;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-3 bg-card border rounded-lg transition-colors",
        onClick && "active:bg-accent/50 cursor-pointer"
      )}
    >
      {/* Left: Promocode info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="font-mono font-bold truncate">{promocode.code}</code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(promocode.id, promocode.code);
            }}
            className="p-1 shrink-0"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span>{promocode.uses}/{promocode.maxUses || '∞'} исп.</span>
          <span>·</span>
          <span className={status.className}>{status.label}</span>
        </div>
      </div>

      {/* Right: Discount and loss */}
      <div className="flex flex-col items-end shrink-0 ml-3">
        <span className="text-sm font-bold">{promocode.discount}</span>
        {promocode.totalDiscountGiven > 0 && (
          <span className="text-xs text-red-500">
            -₽{promocode.totalDiscountGiven.toLocaleString('ru-RU')}
          </span>
        )}
      </div>
    </div>
  );
}
