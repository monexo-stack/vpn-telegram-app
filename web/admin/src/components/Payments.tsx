import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, ExternalLink, Star, Zap, Search, FileCheck, FileX, FileText } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { useMiniApp } from '../context/MiniAppContext';
import { PaymentCard } from './miniapp/PaymentCard';
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
import { apiClient, Payment as ApiPayment } from '../services/api';
import { PaymentsSkeleton } from './ui/skeletons';
import { RevenueChart } from './RevenueChart';
import { cn } from './ui/utils';
import { useIsMobile } from './ui/use-mobile';
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

interface Payment {
  id: string;
  userName: string;
  telegramId: string;
  username: string;
  amount: string;
  method: string;
  plan: string;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  transactionId: string;
  starsAmount?: number | null;
  displayAmount?: string;
  receiptStatus?: string | null;
  receiptUrl?: string | null;
}

const mapApiPaymentToComponent = (apiPayment: ApiPayment): Payment => {
  const formatDate = (date: string | Date): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  const normalizePaymentSystem = (system: string): string => {
    const systemLower = system.toLowerCase();
    if (systemLower.includes('yookassa')) return 'YooKassa';
    if (systemLower.includes('yoomoney')) return 'YooMoney';
    if (systemLower.includes('cryptobot')) return 'CryptoBot';
    if (systemLower.includes('cryptomus')) return 'Cryptomus';
    if (systemLower.includes('stars') || systemLower.includes('telegram')) return 'Telegram Stars';
    return system;
  };

  const paymentSystem = normalizePaymentSystem(apiPayment.payment_system);
  const isTelegramStars = paymentSystem === 'Telegram Stars';

  let displayAmount = `₽${apiPayment.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (isTelegramStars && apiPayment.stars_amount) {
    displayAmount = `${apiPayment.stars_amount} ⭐`;
  }

  return {
    id: apiPayment.id.toString(),
    userName: apiPayment.user_fullname || '',
    telegramId: apiPayment.user_tgid?.toString() || '',
    username: apiPayment.user_username || '',
    amount: `₽${apiPayment.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
    method: paymentSystem,
    plan: apiPayment.plan || `${apiPayment.month_count || 0} мес.`,
    status: (apiPayment.status as any) || 'completed',
    date: formatDate(apiPayment.date),
    transactionId: apiPayment.id.toString(),
    starsAmount: apiPayment.stars_amount,
    displayAmount: displayAmount,
    receiptStatus: (apiPayment as any).receipt_status || null,
    receiptUrl: (apiPayment as any).receipt_url || null,
  };
};

export function Payments() {
  const { isMiniApp } = useMiniApp();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starsRate, setStarsRate] = useState<number>(2.5);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [newPaymentsCount, setNewPaymentsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket для real-time обновлений
  const { onPayment, isConnected } = useWebSocket();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  const formatStarsRub = (payment: Payment) => {
    if (!payment.starsAmount) return null;
    const rubValue = payment.starsAmount * starsRate;
    return `≈ ₽${rubValue.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const columns: ColumnDef<Payment>[] = useMemo(() => [
    {
      accessorKey: 'transactionId',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <code className="text-foreground bg-muted px-2 py-1 rounded-md font-mono text-xs">
          #{row.getValue('transactionId')}
        </code>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'userName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Пользователь" />
      ),
      cell: ({ row }) => {
        const payment = row.original;
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{payment.userName || 'Без имени'}</span>
              {payment.username && (
                <a
                  href={`https://t.me/${payment.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={`@${payment.username}`}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </a>
              )}
            </div>
            <div className="text-muted-foreground text-xs font-mono">{payment.telegramId || '—'}</div>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const payment = row.original;
        const searchLower = value.toLowerCase();
        return (
          payment.userName.toLowerCase().includes(searchLower) ||
          payment.username.toLowerCase().includes(searchLower) ||
          payment.telegramId.includes(value)
        );
      },
    },
    {
      accessorKey: 'plan',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Тариф" className="justify-center" />
      ),
      cell: ({ row }) => {
        const plan = row.getValue('plan') as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              plan === '1 месяц' || plan === '1 мес.' ? 'border-blue-500/50 text-blue-500' :
              plan === '3 месяца' || plan === '3 мес.' ? 'border-green-500/50 text-green-500' :
              plan === '6 месяцев' || plan === '6 мес.' ? 'border-purple-500/50 text-purple-500' :
              plan === '1 год' || plan === '12 мес.' ? 'border-orange-500/50 text-orange-500' :
              'border-muted-foreground/50 text-muted-foreground'
            )}
          >
            {plan}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Сумма" />
      ),
      cell: ({ row }) => {
        const payment = row.original;
        if (payment.method === 'Telegram Stars' && payment.starsAmount) {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="font-medium flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                {payment.starsAmount}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatStarsRub(payment) || `≈ ${payment.amount}`}
              </div>
            </div>
          );
        }
        return <div className="font-medium">{payment.amount}</div>;
      },
    },
    {
      accessorKey: 'method',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Метод" className="justify-center" />
      ),
      cell: ({ row }) => {
        const method = row.getValue('method') as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              method === 'Telegram Stars' ? 'border-yellow-500/50 text-yellow-600' : ''
            )}
          >
            {method === 'Telegram Stars' && <Star className="h-3 w-3 mr-1" />}
            {method}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Статус" className="justify-center" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <Badge
            variant="secondary"
            className={cn(
              status === 'completed' ? 'bg-teal-500/10 text-teal-500' :
              status === 'pending' ? 'bg-orange-500/10 text-orange-500' :
              'bg-red-500/10 text-red-500'
            )}
          >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {status === 'completed' ? 'Успешно' :
             status === 'pending' ? 'Ожидает' : 'Отклонено'}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'receiptStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Чек" className="justify-center" />
      ),
      cell: ({ row }) => {
        const payment = row.original;
        if (!payment.receiptStatus) return <span className="text-muted-foreground text-xs">—</span>;
        if (payment.receiptStatus === 'sent') {
          return payment.receiptUrl ? (
            <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" title="Открыть чек">
              <Badge variant="outline" className="border-green-500/50 text-green-500 cursor-pointer hover:bg-green-500/10">
                <FileCheck className="h-3 w-3 mr-1" />
                Чек
              </Badge>
            </a>
          ) : (
            <Badge variant="outline" className="border-green-500/50 text-green-500">
              <FileCheck className="h-3 w-3 mr-1" />
              Отправлен
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="border-red-500/50 text-red-500">
            <FileX className="h-3 w-3 mr-1" />
            Ошибка
          </Badge>
        );
      },
      enableSorting: false,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата" className="justify-center" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('date')}</span>
      ),
      meta: { className: 'text-center' },
    },
  ], [starsRate]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const [apiPayments, paymentSystemsInfo, analytics] = await Promise.all([
          apiClient.getPayments(),
          apiClient.getPaymentSystemsInfo().catch(() => null),
          apiClient.getAnalytics().catch(() => null)
        ]);

        if (analytics?.metrics?.total_revenue) {
          setTotalRevenue(analytics.metrics.total_revenue);
        }

        const starsRateFromSettings = paymentSystemsInfo?.systems?.stars?.settings?.stars_rub_rate;
        if (starsRateFromSettings) {
          const parsed = parseFloat(starsRateFromSettings);
          if (!Number.isNaN(parsed)) setStarsRate(parsed);
        }

        const mappedPayments = apiPayments.map(mapApiPaymentToComponent);
        setPayments(mappedPayments);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Ошибка загрузки платежей');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Real-time обновления через WebSocket
  useEffect(() => {
    const unsubscribe = onPayment((event) => {
      // Конвертируем событие в формат Payment
      const newPayment: Payment = {
        id: event.id.toString(),
        userName: event.fullname || '',
        telegramId: event.user_tgid?.toString() || '',
        username: event.username || '',
        amount: `₽${event.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        method: event.payment_system,
        plan: event.plan_name || `${event.month_count || 0} мес.`,
        status: event.status as 'completed' | 'pending' | 'failed',
        date: new Date(event.timestamp).toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        transactionId: event.id.toString(),
        starsAmount: null,
        displayAmount: `₽${event.amount.toLocaleString('ru-RU')}`
      };

      // Добавляем в начало списка
      setPayments(prev => {
        // Проверяем, нет ли уже такого платежа
        if (prev.some(p => p.id === newPayment.id)) {
          return prev;
        }
        return [newPayment, ...prev];
      });

      // Обновляем общий доход
      if (event.status === 'completed') {
        setTotalRevenue(prev => prev + event.amount);
      }

      // Показываем уведомление
      toast.success('Новый платеж!', {
        description: `${event.fullname || event.username || 'Пользователь'} - ₽${event.amount}`,
        duration: 5000,
      });

      setNewPaymentsCount(prev => prev + 1);
    });

    return () => unsubscribe();
  }, [onPayment]);

  const table = useReactTable({
    data: payments,
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

  const handleExport = () => {
    const csvHeaders = ['ID транзакции', 'Пользователь', 'Telegram ID', 'Тариф', 'Сумма', 'Звезды', 'Метод оплаты', 'Статус', 'Дата'].join(';');
    const csvRows = payments.map(p => [
      p.transactionId,
      p.userName || p.username,
      p.telegramId,
      p.plan,
      p.amount,
      p.starsAmount || '',
      p.method,
      p.status === 'completed' ? 'Успешно' : p.status === 'pending' ? 'Ожидает' : 'Отклонено',
      p.date
    ].join(';')).join('\n');

    const csvContent = '\uFEFF' + csvHeaders + '\n' + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter payments for Mini App search
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const query = searchQuery.toLowerCase();
    return payments.filter(payment =>
      payment.userName.toLowerCase().includes(query) ||
      payment.username?.toLowerCase().includes(query) ||
      payment.telegramId.includes(query) ||
      payment.transactionId.includes(query)
    );
  }, [payments, searchQuery]);

  // Stats computed once
  const completedPayments = useMemo(() => payments.filter(p => p.status === 'completed'), [payments]);

  const todayRevenue = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPayments = completedPayments.filter(p => {
      try {
        const datePart = p.date?.split(',')[0];
        if (!datePart) return false;
        const paymentDate = new Date(datePart.split('.').reverse().join('-'));
        if (isNaN(paymentDate.getTime())) return false;
        paymentDate.setHours(0, 0, 0, 0);
        return paymentDate.getTime() === today.getTime();
      } catch { return false; }
    });
    return todayPayments.reduce((sum, p) => {
      const amount = parseFloat((p.amount || '0').replace('₽', '').replace(/\s/g, '').replace(',', '.'));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [completedPayments]);

  const averageCheck = useMemo(() => {
    if (completedPayments.length === 0) return 0;
    const paymentsSum = completedPayments.reduce((sum, p) => {
      const amount = parseFloat((p.amount || '0').replace('₽', '').replace(/\s/g, '').replace(',', '.'));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    return paymentsSum / completedPayments.length;
  }, [completedPayments]);

  if (loading) {
    return <PaymentsSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
        {error}
      </div>
    );
  }

  // Mini App View - Cards instead of table
  if (isMiniApp) {
    return (
      <div className="flex flex-col h-full">
        {/* Stats row - compact */}
        <div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/30">
          <div className="text-center">
            <div className="text-sm font-bold text-green-500">₽{totalRevenue.toLocaleString('ru-RU')}</div>
            <div className="text-[10px] text-muted-foreground">Всего</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">₽{Math.round(todayRevenue).toLocaleString('ru-RU')}</div>
            <div className="text-[10px] text-muted-foreground">Сегодня</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">₽{Math.round(averageCheck).toLocaleString('ru-RU')}</div>
            <div className="text-[10px] text-muted-foreground">Ср. чек</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">{completedPayments.length}</div>
            <div className="text-[10px] text-muted-foreground">Платежей</div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Payments list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredPayments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет платежей'}
            </div>
          ) : (
            filteredPayments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={{
                  id: payment.id,
                  userName: payment.userName,
                  username: payment.username,
                  amount: payment.amount,
                  plan: payment.plan,
                  method: payment.method,
                  status: payment.status,
                  date: payment.date,
                  starsAmount: payment.starsAmount,
                }}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Desktop View - Table
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            Общий доход
            {isConnected && (
              <Zap className="h-3 w-3 text-green-500 animate-pulse" title="WebSocket подключен" />
            )}
          </div>
          <div className="text-2xl font-bold text-green-500">₽{totalRevenue.toLocaleString('ru-RU')}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Сегодня</div>
          <div className="text-2xl font-bold">₽{todayRevenue.toLocaleString('ru-RU')}</div>
          {newPaymentsCount > 0 && (
            <div className="text-xs text-green-500 mt-1">+{newPaymentsCount} новых</div>
          )}
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Ср. чек</div>
          <div className="text-2xl font-bold">₽{Math.round(averageCheck).toLocaleString('ru-RU')}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Платежей</div>
          <div className="text-2xl font-bold">{completedPayments.length}</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <RevenueChart />

      {/* Table */}
      <div className="flex flex-1 flex-col gap-4">
        <DataTableToolbar
          table={table}
          searchPlaceholder="Поиск по пользователю, ID транзакции..."
          filters={[
            {
              columnId: 'status',
              title: 'Статус',
              options: [
                { value: 'completed', label: 'Успешно' },
                { value: 'pending', label: 'Ожидает' },
                { value: 'failed', label: 'Отклонено' },
              ],
            },
            {
              columnId: 'plan',
              title: 'Тариф',
              options: [
                { value: '1 месяц', label: '1 месяц' },
                { value: '3 месяца', label: '3 месяца' },
                { value: '6 месяцев', label: '6 месяцев' },
                { value: '1 год', label: '1 год' },
              ],
            },
            {
              columnId: 'method',
              title: 'Метод',
              options: [
                { value: 'YooMoney', label: 'YooMoney' },
                { value: 'YooKassa', label: 'YooKassa' },
                { value: 'CryptoBot', label: 'CryptoBot' },
                { value: 'Telegram Stars', label: 'Telegram Stars' },
              ],
            },
          ]}
        >
          <Button onClick={handleExport} size="sm" className="h-8 gap-2">
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
        </DataTableToolbar>

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
    </div>
  );
}
