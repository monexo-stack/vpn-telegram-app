import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, X, Clock, ExternalLink, Search, Loader2, ArrowUpDown, Ban } from 'lucide-react';
import { useMiniApp } from '../context/MiniAppContext';
import { Input } from './ui/input';
import { toast } from 'sonner';
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
import { apiClient, Withdrawal } from '../services/api';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { DataTablePagination } from './data-table/pagination';
import { DataTableColumnHeader } from './data-table/column-header';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  pending: { label: 'Ожидает', variant: 'outline', className: 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10' },
  processing: { label: 'Обработка', variant: 'outline', className: 'border-blue-500/50 text-blue-600 bg-blue-500/10' },
  completed: { label: 'Выполнено', variant: 'outline', className: 'border-green-500/50 text-green-600 bg-green-500/10' },
  failed: { label: 'Ошибка', variant: 'destructive', className: '' },
  rejected: { label: 'Отклонено', variant: 'outline', className: 'border-red-500/50 text-red-600 bg-red-500/10' },
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return d.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const maskAccount = (account: string): string => {
  if (account.length <= 8) return '****';
  return account.slice(0, 4) + '****' + account.slice(-4);
};

export function Withdrawals() {
  const { isMiniApp } = useMiniApp();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getWithdrawals();
      setWithdrawals(data);
    } catch (err) {
      toast.error('Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleApprove = useCallback(async (id: number) => {
    setActionLoading(id);
    try {
      await apiClient.approveWithdrawal(id);
      toast.success('Заявка одобрена, выплата отправлена');
      await fetchWithdrawals();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Ошибка при одобрении';
      toast.error(detail);
    } finally {
      setActionLoading(null);
    }
  }, [fetchWithdrawals]);

  const handleReject = useCallback(async (id: number) => {
    setActionLoading(id);
    try {
      await apiClient.rejectWithdrawal(id);
      toast.success('Заявка отклонена, средства возвращены');
      await fetchWithdrawals();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Ошибка при отклонении';
      toast.error(detail);
    } finally {
      setActionLoading(null);
    }
  }, [fetchWithdrawals]);

  const filteredWithdrawals = useMemo(() => {
    if (!withdrawals) return [];
    if (statusFilter === 'all') return withdrawals;
    return withdrawals.filter((w) => w.status === statusFilter);
  }, [withdrawals, statusFilter]);

  const stats = useMemo(() => {
    if (!withdrawals) return { total: 0, pendingCount: 0, totalPending: 0, totalPaid: 0 };
    const pending = withdrawals.filter((w) => w.status === 'pending');
    const completed = withdrawals.filter((w) => w.status === 'completed');
    const totalPending = pending.reduce((s, w) => s + w.amount, 0);
    const totalPaid = completed.reduce((s, w) => s + w.amount, 0);
    return {
      total: withdrawals.length,
      pendingCount: pending.length,
      totalPending,
      totalPaid,
    };
  }, [withdrawals]);

  const columns: ColumnDef<Withdrawal>[] = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <code className="text-foreground bg-muted px-2 py-1 rounded-md font-mono text-xs">
            #{row.getValue('id')}
          </code>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'username',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Пользователь" />,
        cell: ({ row }) => {
          const w = row.original;
          return (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{w.username || 'Без имени'}</span>
                {w.username && (
                  <a
                    href={`https://t.me/${w.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title={`@${w.username}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  </a>
                )}
              </div>
              <div className="text-muted-foreground text-xs font-mono">{w.user_tgid}</div>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const w = row.original;
          const s = value.toLowerCase();
          return (
            (w.username || '').toLowerCase().includes(s) ||
            w.user_tgid.toString().includes(value)
          );
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Сумма" />,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.amount.toLocaleString('ru-RU')} ₽
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'account',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Реквизиты" />,
        cell: ({ row }) => (
          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
            {row.original.account}
          </code>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Статус" />,
        cell: ({ row }) => {
          const status = row.original.status;
          const config = statusConfig[status] || { label: status, variant: 'outline' as const, className: '' };
          return (
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          );
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Дата" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at)}</span>
        ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="text-xs text-muted-foreground">Действия</span>,
        cell: ({ row }) => {
          const w = row.original;
          if (w.status !== 'pending') return null;
          const isLoading = actionLoading === w.id;
          return (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-green-600 border-green-500/50 hover:bg-green-500/10"
                onClick={() => handleApprove(w.id)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">Одобрить</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-red-600 border-red-500/50 hover:bg-red-500/10"
                onClick={() => handleReject(w.id)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">Отклонить</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [actionLoading, handleApprove, handleReject]
  );

  const table = useReactTable({
    data: filteredWithdrawals,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
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
    globalFilterFn: (row, columnId, filterValue) => {
      const w = row.original;
      const s = filterValue.toLowerCase();
      return (
        (w.username || '').toLowerCase().includes(s) ||
        w.user_tgid.toString().includes(filterValue) ||
        w.account.includes(filterValue) ||
        w.id.toString().includes(filterValue)
      );
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Всего заявок</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Ожидают</div>
          <div className="text-2xl font-bold">{stats.pendingCount}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Сумма ожидающих</div>
          <div className="text-2xl font-bold">₽{stats.totalPending.toLocaleString('ru-RU')}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Выплачено</div>
          <div className="text-2xl font-bold text-green-500">₽{stats.totalPaid.toLocaleString('ru-RU')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, ID, реквизитам..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'Все' },
            { key: 'pending', label: 'Ожидают' },
            { key: 'processing', label: 'Обработка' },
            { key: 'completed', label: 'Выполнено' },
            { key: 'rejected', label: 'Отклонено' },
            { key: 'failed', label: 'Ошибка' },
          ].map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
              {f.key === 'pending' && stats.pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {stats.pendingCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Нет заявок на вывод
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
