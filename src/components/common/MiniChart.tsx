import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniChartProps {
  data?: any[];
  isPositive?: boolean;
  height?: number | string;
  width?: number | string;
}

export default function MiniChart({ data, isPositive = true, height = 40, width = 80 }: MiniChartProps) {
  const chartData = data?.length && data.length > 0 ? data : generateSampleData(isPositive);
  
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="price"
            stroke={isPositive ? 'var(--color-primary)' : 'var(--color-destructive)'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function generateSampleData(isPositive: boolean) {
  const points = 20;
  const data = [];
  let value = 100;
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - (isPositive ? 0.4 : 0.6)) * 5;
    value = Math.max(50, Math.min(150, value + change));
    data.push({ price: value });
  }
  
  return data;
}