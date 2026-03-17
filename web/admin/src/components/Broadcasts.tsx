import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';
import { useMiniApp } from '../context/MiniAppContext';
import { BroadcastCard } from './miniapp/BroadcastCard';
import { Input } from './ui/input';
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
import { BroadcastModal } from './BroadcastModal';
import { apiClient, Broadcast as ApiBroadcast, BroadcastStats } from '../services/api';
import { BroadcastsSkeleton } from './ui/skeletons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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

interface BroadcastsProps {
  isModalOpen?: boolean;
  setIsModalOpen?: (open: boolean) => void;
}

export function Broadcasts({ isModalOpen: externalModalOpen, setIsModalOpen: externalSetIsModalOpen }: BroadcastsProps) {
  const { isMiniApp } = useMiniApp();
  const [broadcasts, setBroadcasts] = useState<ApiBroadcast[]>([]);
  const [stats, setStats] = useState<BroadcastStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use external modal state if provided, otherwise use internal
  const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setIsModalOpen = externalSetIsModalOpen || setInternalModalOpen;
  const [createLoading, setCreateLoading] = useState(false);
  const [deletingBroadcastId, setDeletingBroadcastId] = useState<number | null>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  const getAudienceLabel = (filter: string) => {
    const labels: Record<string, string> = {
      all: 'Все пользователи',
      with_subscription: 'С подпиской',
      without_subscription: 'Без подписки',
      expiring_soon: 'Истекает скоро',
    };
    return labels[filter] || filter;
  };

  const columns: ColumnDef<ApiBroadcast>[] = useMemo(() => [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <code className="text-foreground bg-muted px-2 py-1 rounded-md font-mono text-xs">
          #{row.getValue('id')}
        </code>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'audience_filter',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Аудитория" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{getAudienceLabel(row.getValue('audience_filter'))}</span>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'message_text',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Сообщение" />
      ),
      cell: ({ row }) => {
        const text = row.getValue('message_text') as string;
        return (
          <div className="max-w-xs truncate" title={text}>
            {text.substring(0, 50)}...
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Статус" className="justify-center" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusConfig: Record<string, { className: string; label: string }> = {
          draft: { className: 'bg-gray-500/10 text-gray-500', label: 'Черновик' },
          scheduled: { className: 'bg-blue-500/10 text-blue-500', label: 'Запланирована' },
          sending: { className: 'bg-yellow-500/10 text-yellow-500', label: 'Отправка...' },
          completed: { className: 'bg-teal-500/10 text-teal-500', label: 'Завершена' },
          failed: { className: 'bg-red-500/10 text-red-500', label: 'Ошибка' },
        };
        const config = statusConfig[status] || statusConfig.draft;
        return (
          <Badge variant="secondary" className={config.className}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {config.label}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'total_recipients',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Получатели" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue('total_recipients')}</span>
      ),
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'sent_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Отправлено" className="justify-center" />
      ),
      cell: ({ row }) => {
        const broadcast = row.original;
        return (
          <div className="flex items-center justify-center gap-1 text-sm">
            <span className="text-green-500">{broadcast.sent_count}</span>
            {broadcast.failed_count > 0 && (
              <span className="text-red-500">/{broadcast.failed_count}</span>
            )}
          </div>
        );
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.getValue('created_at')).toLocaleDateString('ru-RU')}
        </span>
      ),
      meta: { className: 'text-center' },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const broadcast = row.original;
        if (broadcast.status === 'draft' || broadcast.status === 'scheduled') {
          return (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingBroadcastId(broadcast.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          );
        }
        return null;
      },
    },
  ], []);

  const loadBroadcasts = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const [broadcastsData, statsData] = await Promise.all([
        apiClient.getBroadcasts(),
        apiClient.getBroadcastsStats(),
      ]);

      setBroadcasts(broadcastsData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error loading broadcasts:', err);
      if (!isAutoRefresh) toast.error(err?.response?.data?.detail || 'Ошибка загрузки рассылок');
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
  }, []);

  useAutoRefresh(() => loadBroadcasts(true), { interval: 30000 });

  const handleCreateBroadcast = async (data: {
    audienceFilter: string;
    messageText: string;
    imageUrl?: string;
    scheduledAt?: string;
    targetTgid?: number;
  }) => {
    try {
      setCreateLoading(true);
      await apiClient.createBroadcast({
        audience_filter: data.audienceFilter,
        message_text: data.messageText,
        image_url: data.imageUrl || null,
        scheduled_at: data.scheduledAt || null,
        target_tgid: data.targetTgid || null,
      });

      await loadBroadcasts();
      setIsModalOpen(false);
    } catch (err: any) {
      throw new Error(err?.response?.data?.detail || 'Failed to create broadcast');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (broadcastId: number) => {
    try {
      await apiClient.deleteBroadcast(broadcastId);
      await loadBroadcasts();
      toast.success('Рассылка удалена');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось удалить рассылку');
    }
  };

  const table = useReactTable({
    data: broadcasts,
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

  // Filter broadcasts for Mini App search
  const filteredBroadcasts = useMemo(() => {
    if (!searchQuery.trim()) return broadcasts;
    const query = searchQuery.toLowerCase();
    return broadcasts.filter(broadcast =>
      broadcast.message_text.toLowerCase().includes(query)
    );
  }, [broadcasts, searchQuery]);

  if (loading) {
    return <BroadcastsSkeleton />;
  }

  // Mini App View - Card list
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Stats row - compact */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
            <div className="text-center">
              <div className="text-lg font-bold">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Всего</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">{stats.completed}</div>
              <div className="text-[10px] text-muted-foreground">Заверш.</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{stats.scheduled}</div>
              <div className="text-[10px] text-muted-foreground">Заплан.</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{stats.total_sent}</div>
              <div className="text-[10px] text-muted-foreground">Отправл.</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по сообщению..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Broadcasts list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredBroadcasts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет рассылок'}
            </div>
          ) : (
            filteredBroadcasts.map((broadcast) => (
              <BroadcastCard
                key={broadcast.id}
                broadcast={{
                  id: broadcast.id,
                  audienceFilter: broadcast.audience_filter,
                  messageText: broadcast.message_text,
                  status: broadcast.status,
                  totalRecipients: broadcast.total_recipients,
                  sentCount: broadcast.sent_count,
                  failedCount: broadcast.failed_count,
                  createdAt: broadcast.created_at,
                }}
              />
            ))
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <BroadcastModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onCreate={handleCreateBroadcast}
            isSubmitting={createLoading}
          />
        )}
      </div>
    );
  }

  // Desktop View - Table
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Всего</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Завершено</div>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Запланировано</div>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Отправлено</div>
            <div className="text-2xl font-bold">{stats.total_sent}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex flex-1 flex-col gap-4">
        <DataTableToolbar
          table={table}
          searchPlaceholder="Поиск по сообщению..."
          filters={[
            {
              columnId: 'status',
              title: 'Статус',
              options: [
                { value: 'draft', label: 'Черновик' },
                { value: 'scheduled', label: 'Запланирована' },
                { value: 'sending', label: 'Отправка' },
                { value: 'completed', label: 'Завершена' },
                { value: 'failed', label: 'Ошибка' },
              ],
            },
            {
              columnId: 'audience_filter',
              title: 'Аудитория',
              options: [
                { value: 'all', label: 'Все пользователи' },
                { value: 'with_subscription', label: 'С подпиской' },
                { value: 'without_subscription', label: 'Без подписки' },
                { value: 'expiring_soon', label: 'Истекает скоро' },
              ],
            },
          ]}
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
      {isModalOpen && (
        <BroadcastModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleCreateBroadcast}
          isSubmitting={createLoading}
        />
      )}

      <ConfirmDialog
        open={deletingBroadcastId !== null}
        onOpenChange={(open) => !open && setDeletingBroadcastId(null)}
        onConfirm={() => {
          if (deletingBroadcastId !== null) {
            handleDelete(deletingBroadcastId);
            setDeletingBroadcastId(null);
          }
        }}
        title="Удалить рассылку?"
        description="Вы уверены, что хотите удалить эту рассылку?"
        confirmText="Удалить"
        variant="danger"
      />
    </div>
  );
}
