import React from 'react';
import { AlertCircle, TrendingUp, Zap } from 'lucide-react';
import '../styles/InsightsPanel.css';

const InsightsPanel = ({ insights = [], averages = {} }) => {
  const getInsightIcon = (insight) => {
    if (insight.includes('improving') || insight.includes('good')) return <TrendingUp size={20} />;
    if (insight.includes('High') || insight.includes('critical')) return <Zap size={20} />;
    return <AlertCircle size={20} />;
  };

  const getInsightColor = (insight) => {
    if (insight.includes('healthy')) return '#10b981'; // Green
    if (insight.includes('High')) return '#ef4444'; // Red
    if (insight.includes('missing')) return '#f59e0b'; // Yellow
    return '#3b82f6'; // Blue
  };

  return (
    <div className="insights-panel">
      <h3 className="insights-title">Performance Insights & Recommendations</h3>
      
      {insights.length === 0 ? (
        <div className="no-insights">
          <p>No insights available yet. More evaluations needed.</p>
        </div>
      ) : (
        <div className="insights-list">
          {insights.map((insight, idx) => (
            <div 
              key={idx} 
              className="insight-item"
              style={{ borderLeftColor: getInsightColor(insight) }}
            >
              <div className="insight-icon" style={{ color: getInsightColor(insight) }}>
                {getInsightIcon(insight)}
              </div>
              <div className="insight-content">
                <p className="insight-text">{insight}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightsPanel;
