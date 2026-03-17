import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Clock, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

type Period = 'hour' | 'day' | 'month';

interface ChartData {
  label: string;
  revenue: number;
}

interface RevenueChartProps {
  className?: string;
}

export function RevenueChart({ className = '' }: RevenueChartProps) {
  const [period, setPeriod] = useState<Period>('hour');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // WebSocket для real-time обновлений
  const { onPayment } = useWebSocket();

  useEffect(() => {
    loadData();
  }, [period, offset]);

  // Автообновление данных в реальном времени
  useEffect(() => {
    if (offset !== 0) return;

    const intervals: Record<Period, number> = {
      hour: 30 * 1000,
      day: 60 * 1000,
      month: 5 * 60 * 1000
    };

    const interval = setInterval(() => {
      loadData();
    }, intervals[period]);

    return () => clearInterval(interval);
  }, [period, offset]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dashboard = await apiClient.getDashboard(period, offset);

      if (dashboard?.revenueChart) {
        const chartData = dashboard.revenueChart.map((item: any) => ({
          label: item.label || item.month,
          revenue: item.revenue || 0,
        }));
        setData(chartData);

        // Подсчет общего дохода за период
        const total = chartData.reduce((sum: number, item: ChartData) => sum + item.revenue, 0);
        setTotalRevenue(total);
      }
    } catch (err) {
      console.error('Revenue chart error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time обновления через WebSocket
  useEffect(() => {
    // Обновляем график только если смотрим текущий период (offset === 0)
    if (offset !== 0) return;

    const unsubscribe = onPayment((event) => {
      // Добавляем сумму платежа к общему доходу
      if (event.status === 'completed') {
        setTotalRevenue(prev => prev + event.amount);

        // Перезагружаем данные графика для обновления distribution
        loadData();
      }
    });

    return () => unsubscribe();
  }, [onPayment, offset]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setOffset(0); // Сбрасываем offset при смене периода
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    setOffset(prev => direction === 'prev' ? prev + 1 : prev - 1);
  };

  // Throttle для колёсика
  const lastWheelTime = useRef(0);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const now = Date.now();
      if (now - lastWheelTime.current < 300 || loading) return;
      lastWheelTime.current = now;

      if (e.deltaY > 0) {
        setOffset(prev => prev + 1);
      } else if (e.deltaY < 0) {
        setOffset(prev => Math.max(0, prev - 1));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [loading]);

  const getPeriodLabel = () => {
    if (offset === 0) {
      if (period === 'hour') return 'Последние 24 часа';
      if (period === 'day') return 'Последние 30 дней';
      return 'Последние 12 месяцев';
    }

    const absOffset = Math.abs(offset);

    if (period === 'hour') return `${absOffset * 24}ч назад`;
    if (period === 'day') return `${absOffset * 30}д назад`;
    return `${absOffset * 12}м назад`;
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  // Название месяца по номеру
  const getMonthName = (monthNum: string) => {
    const months: Record<string, string> = {
      '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр',
      '05': 'Май', '06': 'Июн', '07': 'Июл', '08': 'Авг',
      '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек'
    };
    return months[monthNum] || monthNum;
  };

  // Кастомный tick для оси X с разделителями
  const CustomXAxisTick = ({ x, y, payload, index }: any) => {
    const label = payload.value;
    let extraLabel = '';

    if (period === 'hour' && label === '00:00') {
      extraLabel = '▼';
    } else if (period === 'day' && label.startsWith('01.')) {
      extraLabel = getMonthName(label.slice(3, 5));
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={12}
          textAnchor="middle"
          fill="currentColor"
          className="text-muted-foreground"
          fontSize={11}
          fontWeight={400}
        >
          {label}
        </text>
        {extraLabel && (
          <text
            x={0}
            y={0}
            dy={26}
            textAnchor="middle"
            fill="#6366f1"
            fontSize={10}
            fontWeight={600}
          >
            {extraLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Заголовок с контролами */}
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Доход</h3>
            <p className="text-sm text-muted-foreground">
              {getPeriodLabel()}
            </p>
          </div>

          {/* Переключатель периодов */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => handlePeriodChange('hour')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  period === 'hour'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-4 h-4" />
                Часы
              </button>
              <button
                onClick={() => handlePeriodChange('day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  period === 'day'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Дни
              </button>
              <button
                onClick={() => handlePeriodChange('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  period === 'month'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Месяцы
              </button>
            </div>

            {/* Навигация */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
                title="Предыдущий период"
              >
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => handleNavigate('next')}
                disabled={loading || offset <= 0}
                className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
                title="Следующий период"
              >
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Общий доход за период */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              ₽{totalRevenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-muted-foreground">за период</span>
          </div>
        </div>
      </div>

      {/* График */}
      <div ref={chartRef} className="p-4 sm:p-6 relative">
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  vertical={false}
                  className="text-border opacity-50"
                />

                <XAxis
                  dataKey="label"
                  stroke="currentColor"
                  tick={<CustomXAxisTick />}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                  height={45}
                />

                <YAxis
                  stroke="currentColor"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatValue(value)}
                  dx={-5}
                  width={45}
                  className="text-muted-foreground"
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                  labelStyle={{
                    color: 'hsl(var(--foreground))',
                    fontWeight: 600,
                    marginBottom: '4px'
                  }}
                  formatter={(value: number) => [
                    `₽${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
                    'Доход'
                  ]}
                  cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '4 4' }}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
