import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Users, ShoppingCart, Search, Gift } from 'lucide-react';
import { useMiniApp } from '../context/MiniAppContext';
import { useBackButton } from '../hooks/useBackButton';
import { ReferralCard } from './miniapp/ReferralCard';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table';
import { apiClient, Referral as ApiReferral } from '../services/api';
import { ReferralsSkeleton } from './ui/skeletons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { DataTableToolbar } from './data-table/toolbar';
import { DataTablePagination } from './data-table/pagination';
import { DataTableColumnHeader } from './data-table/column-header';

interface Referral {
  id: string;
  username: string;
  telegramId: string;
  fullName: string;
  referralsCount: number;
  totalBonusDays: number;
  inviteBonusDays: number;
  purchaseBonusDays: number;
  referralBalance: number;
  totalMoneyEarned: number;
  joined: string;
}

export function Referrals() {
  const { referralId } = useParams<{ referralId: string }>();
  const navigate = useNavigate();
  const { isMiniApp } = useMiniApp();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state derived from URL
  const selectedReferral = useMemo(() => {
    if (!referralId) return null;
    return referrals.find(r => r.telegramId === referralId) || null;
  }, [referralId, referrals]);

  const handleOpenModal = (referral: Referral) => {
    navigate(`/referrals/${referral.telegramId}`);
  };

  const handleCloseModal = () => {
    navigate('/referrals');
  };

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  const formatDate = (dateString: string): string => {
    try {
      if (!dateString) return '—';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  const columns: ColumnDef<Referral>[] = useMemo(() => [
    {
      accessorKey: 'fullName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Партнер" />
      ),
      cell: ({ row }) => {
        const referral = row.original;
        return (
          <div>
            <div className="font-medium">{referral.fullName || 'Без имени'}</div>
            <div className="text-muted-foreground text-xs font-mono">{referral.telegramId}</div>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const referral = row.original;
        const searchLower = value.toLowerCase();
        return (
          (referral.fullName || '').toLowerCase().includes(searchLower) ||
          (referral.username || '').toLowerCase().includes(searchLower) ||
          referral.telegramId.includes(value)
        );
      },
    },
    {
      accessorKey: 'username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Username" />
      ),
      cell: ({ row }) => {
        const referral = row.original;
        if (!referral.username) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-2">
            <span>{referral.username}</span>
            <a
              href={`https://t.me/${(referral.username || '').replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: 'referralsCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Рефералов" className="justify-center" />
      ),
      cell: ({ row }) => {
        const count = row.getValue('referralsCount') as number;
        return (
          <Badge
            variant="outline"
            className={cn(
              count >= 10 ? 'border-green-500/50 text-green-500' :
              count >= 5 ? 'border-blue-500/50 text-blue-500' :
              count >= 1 ? 'border-gray-500/50 text-gray-500' :
              'border-muted-foreground/50 text-muted-foreground'
            )}
          >
            {count}
          </Badge>
        );
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'totalBonusDays',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Бонус дней" className="justify-center" />
      ),
      cell: ({ row }) => {
        const days = row.getValue('totalBonusDays') as number;
        return (
          <span className={cn(
            'font-medium',
            days > 0 ? 'text-green-500' : 'text-muted-foreground'
          )}>
            +{days}
          </span>
        );
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'inviteBonusDays',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="За приглашения" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">+{row.getValue('inviteBonusDays')}</span>
      ),
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'purchaseBonusDays',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="За покупки" className="justify-center" />
      ),
      cell: ({ row }) => {
        const days = row.getValue('purchaseBonusDays') as number;
        return (
          <span className={cn(days > 0 ? 'text-purple-500' : 'text-muted-foreground')}>
            +{days}
          </span>
        );
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'referralBalance',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Баланс" className="justify-center" />
      ),
      cell: ({ row }) => {
        const balance = row.getValue('referralBalance') as number;
        return balance > 0
          ? <span className="text-green-500 font-medium">{balance.toFixed(0)} ₽</span>
          : <span className="text-muted-foreground">—</span>;
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'joined',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата регистрации" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('joined')}</span>
      ),
      meta: { className: 'text-center' },
    },
  ], []);

  useEffect(() => {
    fetchReferrals();
  }, []);

  useAutoRefresh(() => fetchReferrals(true), { interval: 30000 });

  const fetchReferrals = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);

      const [apiReferrals, users] = await Promise.all([
        apiClient.getReferrals(),
        apiClient.getUsers()
      ]);

      const usersMap = new Map(users.map(u => [u.tgid, u]));

      const mappedReferrals: Referral[] = apiReferrals.map(apiRef => {
        const user = usersMap.get(apiRef.user_id);
        return {
          id: apiRef.user_id.toString(),
          username: user?.username ? `@${user.username}` : '',
          telegramId: apiRef.user_id.toString(),
          fullName: user?.fullname || user?.username || `User ${apiRef.user_id}`,
          referralsCount: apiRef.referral_count,
          totalBonusDays: apiRef.total_bonus_days || 0,
          inviteBonusDays: apiRef.invite_bonus_days || 0,
          purchaseBonusDays: apiRef.purchase_bonus_days || 0,
          referralBalance: apiRef.referral_balance || 0,
          totalMoneyEarned: apiRef.total_money_earned || 0,
          joined: user?.created_at ? formatDate(user.created_at) : '—',
        };
      });

      setReferrals(mappedReferrals);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки рефералов');
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalPartners = referrals.length;
    const totalReferrals = referrals.reduce((sum, ref) => sum + ref.referralsCount, 0);
    const totalBonusDays = referrals.reduce((sum, ref) => sum + ref.totalBonusDays, 0);
    const inviteBonusDays = referrals.reduce((sum, ref) => sum + ref.inviteBonusDays, 0);
    const purchaseBonusDays = referrals.reduce((sum, ref) => sum + ref.purchaseBonusDays, 0);
    const activePartners = referrals.filter(r => r.referralsCount > 0).length;
    const partnersWithPurchases = referrals.filter(r => r.purchaseBonusDays > 0).length;
    const effectivePartners = referrals.filter(r => r.referralsCount >= 3).length;
    const avgReferralsPerPartner = activePartners > 0 ? totalReferrals / activePartners : 0;
    const totalBalance = referrals.reduce((sum, ref) => sum + ref.referralBalance, 0);

    const topPartners = [...referrals]
      .sort((a, b) => b.referralsCount - a.referralsCount)
      .slice(0, 5);

    const topByDays = [...referrals]
      .sort((a, b) => b.totalBonusDays - a.totalBonusDays)
      .slice(0, 5);

    return {
      totalPartners,
      totalReferrals,
      totalBonusDays,
      inviteBonusDays,
      purchaseBonusDays,
      activePartners,
      partnersWithPurchases,
      avgReferralsPerPartner,
      topPartners,
      topByDays,
      effectivePartners,
      totalBalance
    };
  }, [referrals]);

  const table = useReactTable({
    data: referrals,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Filter referrals for mobile search - must be before conditional returns
  const filteredReferrals = useMemo(() => {
    if (!globalFilter) return referrals;
    const searchLower = globalFilter.toLowerCase();
    return referrals.filter(ref =>
      (ref.fullName || '').toLowerCase().includes(searchLower) ||
      (ref.username || '').toLowerCase().includes(searchLower) ||
      ref.telegramId.includes(globalFilter)
    );
  }, [referrals, globalFilter]);

  if (loading) {
    return <ReferralsSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
        {error}
      </div>
    );
  }

  // Mini App mobile view
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact stats row */}
        <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
          <div className="text-center">
            <div className="text-lg font-bold">{stats.totalPartners}</div>
            <div className="text-[10px] text-muted-foreground">Партнеров</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.totalReferrals}</div>
            <div className="text-[10px] text-muted-foreground">Рефералов</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">+{stats.totalBonusDays}</div>
            <div className="text-[10px] text-muted-foreground">Дней</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">
              {stats.activePartners > 0 ? `${((stats.partnersWithPurchases / stats.activePartners) * 100).toFixed(0)}%` : '0%'}
            </div>
            <div className="text-[10px] text-muted-foreground">Конверсия</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск партнера..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Referral cards list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredReferrals.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {globalFilter ? 'Ничего не найдено' : 'Нет партнеров'}
            </div>
          ) : (
            filteredReferrals.map((referral) => (
              <ReferralCard
                key={referral.id}
                referral={{
                  telegramId: referral.telegramId,
                  username: (referral.username || '').replace('@', ''),
                  fullName: referral.fullName,
                  referralsCount: referral.referralsCount,
                  totalBonusDays: referral.totalBonusDays,
                  inviteBonusDays: referral.inviteBonusDays,
                  purchaseBonusDays: referral.purchaseBonusDays
                }}
                onClick={() => handleOpenModal(referral)}
              />
            ))
          )}
        </div>

        {/* Modal */}
        {selectedReferral && (
          <ReferralDetailsModal
            referral={selectedReferral}
            onClose={handleCloseModal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Партнеров</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats.totalPartners}</span>
            <span className="text-green-500 text-sm">({stats.activePartners} акт.)</span>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Рефералов</div>
          <div className="text-2xl font-bold">{stats.totalReferrals}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Бонус дней</div>
          <div className="text-2xl font-bold text-green-500">{stats.totalBonusDays.toLocaleString('ru-RU')}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Конверсия</div>
          <div className="text-2xl font-bold">
            {stats.activePartners > 0 ? `${((stats.partnersWithPurchases / stats.activePartners) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-4">
            Топ-5 по рефералам
          </h3>
          {stats.topPartners.length > 0 && stats.topPartners[0].referralsCount > 0 ? (
            <div className="space-y-3">
              {stats.topPartners.filter(p => p.referralsCount > 0).map((partner, index) => (
                <div key={partner.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm">{partner.fullName}</div>
                      <div className="text-muted-foreground text-xs">{partner.username}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{partner.referralsCount} реф.</div>
                    <div className="text-muted-foreground text-xs">+{partner.totalBonusDays} дн.</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-4">Нет данных</div>
          )}
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-4">
            Топ-5 по заработанным дням
          </h3>
          {stats.topByDays.length > 0 && stats.topByDays[0].totalBonusDays > 0 ? (
            <div className="space-y-3">
              {stats.topByDays.filter(p => p.totalBonusDays > 0).map((partner, index) => (
                <div key={partner.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm">{partner.fullName}</div>
                      <div className="text-muted-foreground text-xs">{partner.username}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">+{partner.totalBonusDays} дн.</div>
                    <div className="text-muted-foreground text-xs">
                      {partner.inviteBonusDays} приг. • {partner.purchaseBonusDays} пок.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-4">Нет данных</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 flex-col gap-4">
        <DataTableToolbar
          table={table}
          searchPlaceholder="Поиск по имени, username или Telegram ID..."
        />

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        (header.column.columnDef.meta as any)?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="cursor-pointer"
                    onClick={() => handleOpenModal(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={(cell.column.columnDef.meta as any)?.className}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination table={table} />
      </div>

      {/* Modal */}
      {selectedReferral && (
        <ReferralDetailsModal
          referral={selectedReferral}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

interface ReferralDetailsModalProps {
  referral: Referral;
  onClose: () => void;
}

function ReferralDetailsModal({ referral, onClose }: ReferralDetailsModalProps) {
  const { isMiniApp } = useMiniApp();
  useBackButton(true, onClose);
  const [loading, setLoading] = useState(true);
  const [referredUsers, setReferredUsers] = useState<Array<{
    id: number;
    tgid: number;
    name: string;
    username: string;
    date: string;
    invite_days: number;
    purchase_days: number;
    total_days: number;
  }>>([]);

  useEffect(() => {
    loadReferredUsers();
  }, [referral.telegramId]);

  const loadReferredUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserReferrals(parseInt(referral.telegramId));
      // Маппим данные с бэкенда (fullname -> name, registered_at -> date, bonus_days -> total_days)
      const mappedUsers = response.map((user: any) => ({
        id: user.id || user.tgid,
        tgid: user.tgid,
        name: user.fullname || user.name || '',
        username: user.username || '',
        date: user.registered_at || user.date || '',
        invite_days: user.invite_days || 0,
        purchase_days: user.purchase_days || 0,
        total_days: user.bonus_days || user.total_days || 0,
      }));
      setReferredUsers(mappedUsers);
    } catch (err) {
      console.error('Error loading referred users:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      if (!dateString) return '—';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose} variant={isMiniApp ? "fullscreen" : "default"}>
      <DialogContent hideCloseButton className="sm:max-w-[700px] sm:max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b shrink-0">
          <div className={isMiniApp ? "text-center" : "pr-8"}>
            <DialogTitle className="text-xl truncate">{referral.fullName}</DialogTitle>
            <DialogDescription className={cn("mt-1.5 flex items-center gap-2 text-sm", isMiniApp && "justify-center")}>
              <span>{referral.username}</span>
              <span>•</span>
              <span className="font-mono">{referral.telegramId}</span>
            </DialogDescription>
          </div>

          {/* Stats Row - симметричный вид */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{referral.referralsCount}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <Gift className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-green-500">+{referral.totalBonusDays}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-purple-500">+{referral.purchaseBonusDays}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe overscroll-contain">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <Users className="w-4 h-4" />
            Приглашённые ({referredUsers.length})
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : referredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">Нет приглашённых</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referredUsers.map((user) => (
                <div key={user.id} className="rounded-lg bg-muted/50 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      <span>{user.name || 'Без имени'}</span>
                      {isMiniApp && <span className="font-mono text-xs text-muted-foreground">{user.tgid}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.username ? `@${user.username}` : '—'}
                      {!isMiniApp && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="font-mono">{user.tgid}</span>
                        </>
                      )}
                      <span className="mx-1">•</span>
                      <span>{formatDate(user.date)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-green-500">+{user.total_days || 0} дн</div>
                    <div className="text-xs text-muted-foreground">
                      {user.invite_days || 0} приг • {user.purchase_days || 0} пок
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
