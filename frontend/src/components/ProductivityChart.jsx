import React from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

export default function ProductivityChart({ data }) {
  // data expected: Array of { day: 'Mon', count: 5, active: boolean }

  return (
    <div className="h-32 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-black text-white px-2 py-1 rounded-lg text-[10px] font-bold">
                    {payload[0].value} tasks
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 4, 4]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.active ? '#000000' : '#E5E7EB'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
