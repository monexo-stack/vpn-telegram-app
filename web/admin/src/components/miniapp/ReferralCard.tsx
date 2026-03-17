import { cn } from '../ui/utils';

interface ReferralCardProps {
  referral: {
    telegramId: string;
    username?: string;
    fullName?: string;
    referralsCount: number;
    totalBonusDays: number;
    inviteBonusDays: number;
    purchaseBonusDays: number;
  };
  onClick?: () => void;
}

export function ReferralCard({ referral, onClick }: ReferralCardProps) {
  const displayName = referral.fullName ||
    (referral.username ? `@${referral.username}` : `ID: ${referral.telegramId}`);

  const isActive = referral.referralsCount > 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-card border rounded-lg active:bg-accent/50 transition-colors cursor-pointer"
    >
      {/* Left: Partner info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          {referral.username && <span>@{referral.username}</span>}
          {referral.username && <span>·</span>}
          <span>{referral.referralsCount} реф.</span>
          <span>·</span>
          <span className={isActive ? 'text-green-500' : ''}>
            {isActive ? 'Активен' : 'Нет реф.'}
          </span>
        </div>
      </div>

      {/* Right: Bonus days */}
      {referral.totalBonusDays > 0 && (
        <div className="text-sm font-medium text-green-500 shrink-0 ml-3">
          +{referral.totalBonusDays} дн.
        </div>
      )}
    </div>
  );
}
