import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, METRIC_ORDER } from '../utils/chartColors';
import { formatPercentage } from '../utils/formatters';

const LatestMetricsChart = ({ data = {} }) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No data available
      </div>
    );
  }

  const chartData = METRIC_ORDER
    .filter(key => key in data)
    .map(key => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: data[key] * 100,
      fill: CHART_COLORS[key]
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '8px 12px',
          color: '#fff'
        }}>
          <p>{payload[0].name}</p>
          <p style={{ color: payload[0].fill, fontWeight: 'bold' }}>
            {payload[0].value.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="name" 
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          domain={[0, 100]}
          label={{ value: '%', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default LatestMetricsChart;
