import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const FILTERS = ['1D', '7D', '1M', '3M', '1Y', 'ALL'];

// Small trend line for the balance header, next to the number — same
// decorative-shape convention as the full chart below (see note above
// generateData): the balance/delta figures next to it are real, this
// squiggle is not tied to actual historical data.
export function InlineTrend({ isPositive }: { isPositive: boolean }) {
  const data = useMemo(() => {
    let v = 100;
    return Array.from({ length: 14 }, () => {
      v += (Math.random() - (isPositive ? 0.4 : 0.6)) * 5;
      return { v: parseFloat(v.toFixed(2)) };
    });
  }, [isPositive]);
  const color = isPositive ? 'var(--color-primary)' : 'var(--color-destructive)';

  return (
    <div className="w-24 h-12">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function generateData(days: number, baseValue: number, isPositive: boolean) {
  const points = [];
  let val = baseValue * (isPositive ? 0.94 : 1.06);
  for (let i = 0; i < days; i++) {
    const drift = isPositive ? 0.52 : 0.48;
    val = Math.max(val * 0.9, val + (Math.random() - drift) * val * 0.02);
    points.push({ label: i, value: parseFloat(val.toFixed(2)) });
  }
  if (points.length > 0) {
    points[points.length - 1].value = baseValue;
  }
  return points;
}

const PERIOD_POINTS: Record<string, number> = { '1D': 24, '7D': 7, '1M': 30, '3M': 90, '1Y': 52, 'ALL': 60 };

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  isPositive: boolean;
}

const CustomTooltip = ({ active, payload, isPositive }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className={cn('font-bold', isPositive ? 'text-primary' : 'text-destructive')}>
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

interface BalanceChartProps {
  totalBalance: number;
  isPositive: boolean;
}

export default function BalanceChart({ totalBalance, isPositive }: BalanceChartProps) {
  const [active, setActive] = useState('7D');
  const data = useMemo(() => generateData(PERIOD_POINTS[active], totalBalance, isPositive), [active, totalBalance]);
  // Use HSL variables directly for SVGs if needed, but hex is fine for Recharts props
  const color = isPositive ? 'var(--color-primary)' : 'var(--color-destructive)'; 
  const gradientId = isPositive ? 'gainGrad' : 'lossGrad';

  return (
    <div>
      <motion.div
        key={active}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="h-44"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip isPositive={isPositive} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              style={{ filter: `drop-shadow(0 0 6px ${isPositive ? 'var(--color-primary)' : 'var(--color-destructive)'}80)` }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Time filters */}
      <div className="flex gap-1 mt-3 rounded-2xl p-1 bg-secondary">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={cn(
              'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all',
              active === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}