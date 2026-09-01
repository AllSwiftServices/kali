import React, { useState, useEffect, useRef } from 'react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const TIME_FILTERS = ['1M', '5M', '15M', '1H', '1D'];

function generateCandles(basePrice: number, count = 60, volatility = 0.008) {
  const candles = [];
  let price = basePrice * (0.92 + Math.random() * 0.06);
  const now = Date.now();

  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.49) * price * volatility;
    const close = Math.max(open * 0.9, open + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.random() * 1000 + 200;
    candles.push({ open, close, high, low, volume, time: new Date(now - i * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) });
    price = close;
  }
  return candles;
}

// Custom Candlestick Bar
function CandleBar(props: any) {
  const { x, y, width, height, open, close, high, low } = props;
  if (!x || !y || !width) return null;
  const isGreen = close >= open;
  const color = isGreen ? 'var(--color-primary)' : 'var(--color-destructive)';
  const barX = x + width / 2;
  const bodyTop = Math.min(props.openY ?? y, props.closeY ?? (y + height));
  const bodyH = Math.abs((props.openY ?? y) - (props.closeY ?? (y + height))) || 1;

  return (
    <g>
      <line x1={barX} y1={props.highY} x2={barX} y2={props.lowY} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={Math.max(width - 2, 1)} height={bodyH} fill={color} rx={1} />
    </g>
  );
}

const CustomTooltip = ({ active, payload }: { active?: boolean, payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isGreen = d.close >= d.open;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs space-y-1 min-w-[130px]">
      <p className="font-semibold text-muted-foreground mb-1">{d.time}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">O</span><span className="font-mono text-foreground">${d.open?.toFixed(2)}</span>
        <span className="text-muted-foreground">H</span><span className="font-mono text-primary">${d.high?.toFixed(2)}</span>
        <span className="text-muted-foreground">L</span><span className="font-mono text-destructive">${d.low?.toFixed(2)}</span>
        <span className="text-muted-foreground">C</span>
        <span className={cn("font-mono font-semibold", isGreen ? "text-primary" : "text-destructive")}>
          ${d.close?.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

import { useIsMobile } from '@/hooks/use-mobile';

export default function CandlestickChart({ basePrice, isPositive }: { basePrice: number, isPositive: boolean }) {
  const isMobile = useIsMobile();
  const [timeFilter, setTimeFilter] = useState('15M');
  const [chartType, setChartType] = useState('candle');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setData(generateCandles(basePrice, 60));
  }, [basePrice, timeFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const change = (Math.random() - 0.49) * basePrice * 0.003;
        const newClose = Math.max(last.close * 0.95, last.close + change);
        const updated = [...prev.slice(0, -1), { ...last, close: newClose, high: Math.max(last.high, newClose), low: Math.min(last.low, newClose) }];
        if (Math.random() > 0.7) {
          updated.push({
            open: newClose, close: newClose, high: newClose, low: newClose,
            volume: Math.random() * 500,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          });
          return updated.slice(-65);
        }
        return updated;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [basePrice]);

  const priceMin = Math.min(...data.map(d => d.low)) * 0.999;
  const priceMax = Math.max(...data.map(d => d.high)) * 1.001;
  const lineColor = isPositive ? 'var(--color-primary)' : 'var(--color-destructive)';

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
        <div className="flex gap-0.5 sm:gap-1">
          {TIME_FILTERS.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all',
                timeFilter === tf
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 p-0.5 sm:p-1 bg-muted rounded-xl">
          <button
            onClick={() => setChartType('candle')}
            className={cn(
              'px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all',
              chartType === 'candle' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
            )}
          >
            Candle
          </button>
          <button
            onClick={() => setChartType('line')}
            className={cn(
              'px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all',
              chartType === 'line' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
            )}
          >
            Line
          </button>
        </div>
      </div>

      {/* Chart */}
      <motion.div
        key={timeFilter + chartType}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="h-64 md:h-80"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={data} 
            margin={{ 
              top: 4, 
              right: isMobile ? 2 : 4, 
              bottom: 0, 
              left: isMobile ? -20 : 0 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: isMobile ? 8 : 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval={isMobile ? Math.floor(data.length / 4) : Math.floor(data.length / 6)}
              minTickGap={10}
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tick={{ fontSize: isMobile ? 8 : 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v.toFixed(0)}`}
              width={isMobile ? 40 : 60}
              orientation="right"
              hide={false}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
              isAnimationActive={false}
            />

            {chartType === 'line' ? (
              <Line
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <>
                <Bar
                  dataKey="close"
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    if (!payload) return null;
                    const isGreen = payload.close >= payload.open;
                    const color = isGreen ? 'var(--color-primary)' : 'var(--color-destructive)';
                    return <rect x={x + 1} y={y} width={Math.max(width - 2, 1)} height={height} fill={color} rx={1} />;
                  }}
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="high" stroke="transparent" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="low" stroke="transparent" dot={false} isAnimationActive={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}