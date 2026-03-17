import { cn } from '../ui/utils';

interface TrackingLinkCardProps {
  link: {
    id: string;
    name: string;
    slug: string;
    registrations: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
    source?: string | null;
    linkType?: string;
    botCount: number;
  };
  onClick?: () => void;
}

export function TrackingLinkCard({ link, onClick }: TrackingLinkCardProps) {
  const hasRevenue = link.revenue > 0;
  const hasBots = link.botCount > 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-card border rounded-lg active:bg-accent/50 transition-colors cursor-pointer"
    >
      {/* Left: Link info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{link.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span className="font-mono">{link.slug}</span>
          <span>·</span>
          <span>{link.registrations} рег.</span>
          <span>·</span>
          <span>{link.conversions} конв.</span>
          {link.source && (
            <>
              <span>·</span>
              <span className="text-primary">{link.source}</span>
            </>
          )}
          {hasBots && (
            <>
              <span>·</span>
              <span className="text-red-500">{link.botCount} бот.</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Revenue */}
      {hasRevenue && (
        <div className="flex flex-col items-end shrink-0 ml-3">
          <span className="text-sm font-medium text-green-500">
            ₽{link.revenue.toLocaleString('ru-RU')}
          </span>
          <span className="text-xs text-muted-foreground">{link.conversionRate}% CR</span>
        </div>
      )}
    </div>
  );
}
