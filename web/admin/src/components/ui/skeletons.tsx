import { Skeleton } from './skeleton';

// Skeleton для карточки статистики
export function StatCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-20 sm:h-9 sm:w-24" />
    </div>
  );
}

// Skeleton для строки таблицы
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-5 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Skeleton для таблицы
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="text-left p-4">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Skeleton для заголовка страницы
export function PageHeaderSkeleton({ hasButton = false }: { hasButton?: boolean }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <Skeleton className="h-7 sm:h-8 w-36 sm:w-48 mb-2" />
        <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
      </div>
      {hasButton && <Skeleton className="h-10 sm:h-12 w-full sm:w-40 rounded-xl" />}
    </div>
  );
}

// Skeleton для Dashboard
export function DashboardSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <Skeleton className="h-5 sm:h-6 w-24 sm:w-32 mb-4" />
            <Skeleton className="h-48 sm:h-64 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-10 sm:h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton для Users
export function UsersSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Search/Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Skeleton className="h-10 sm:h-12 flex-1 rounded-xl" />
        <Skeleton className="h-10 sm:h-12 w-full sm:w-28 rounded-xl" />
        <Skeleton className="h-10 sm:h-12 w-full sm:w-28 rounded-xl" />
      </div>

      {/* Table */}
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
}

// Skeleton для Keys
export function KeysSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton hasButton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Skeleton className="h-12 w-full max-w-md rounded-xl" />
      </div>

      {/* Table */}
      <TableSkeleton rows={10} columns={8} />
    </div>
  );
}

// Skeleton для Payments
export function PaymentsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <Skeleton className="h-12 flex-1 max-w-md rounded-xl" />
        <Skeleton className="h-12 w-32 rounded-xl" />
      </div>

      {/* Table */}
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}

// Skeleton для Locations
export function LocationsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton hasButton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton для Broadcasts
export function BroadcastsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton hasButton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={5} columns={8} />
    </div>
  );
}

// Skeleton для Analytics
export function AnalyticsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Date Range */}
      <div className="mb-6 flex gap-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-12 w-48 rounded-xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Skeleton для Promocodes
export function PromocodesSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton hasButton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}

// Skeleton для Referrals
export function ReferralsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

// Skeleton для Tracking
export function TrackingSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton hasButton />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

// Skeleton для Settings
export function SettingsSkeleton() {
  return (
    <div className="">
      <PageHeaderSkeleton />

      {/* Settings Sections */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
