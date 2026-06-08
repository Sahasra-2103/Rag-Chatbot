import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '../utils/chartColors';
import { formatTime } from '../utils/formatters';

const TrendChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No trend data available
      </div>
    );
  }

  const chartData = data.map((item, idx) => ({
    ...item,
    name: idx + 1,
    overall_score: (item.overall_score || 0) * 100,
    faithfulness: (item.faithfulness || 0) * 100,
    context_recall: (item.context_recall || 0) * 100,
    context_precision: (item.context_precision || 0) * 100
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '8px 12px',
          color: '#fff'
        }}>
          <p style={{ margin: '0 0 6px 0' }}>Query #{label}</p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ margin: '2px 0', color: item.color }}>
              {item.name}: {item.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="name"
          label={{ value: 'Query #', position: 'insideBottomRight', offset: -5 }}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          domain={[0, 100]}
          label={{ value: '%', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="line"
        />
        <Line 
          type="monotone" 
          dataKey="overall_score" 
          stroke={CHART_COLORS.overall_score}
          name="Overall Score"
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line 
          type="monotone" 
          dataKey="faithfulness" 
          stroke={CHART_COLORS.faithfulness}
          name="Faithfulness"
          dot={{ r: 3 }}
          strokeDasharray="5 5"
        />
        <Line 
          type="monotone" 
          dataKey="context_recall" 
          stroke={CHART_COLORS.context_recall}
          name="Context Recall"
          dot={{ r: 3 }}
          strokeDasharray="5 5"
        />
        <Line
          type="monotone"
          dataKey="context_precision"
          stroke={CHART_COLORS.context_precision}
          name="Context Precision"
          dot={{ r: 3 }}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TrendChart;
