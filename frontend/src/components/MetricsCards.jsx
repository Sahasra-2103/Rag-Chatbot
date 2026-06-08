import React from 'react';
import { formatPercentage, getScoreColor } from '../utils/formatters';
import '../styles/MetricsCards.css';

const MetricsCards = ({ metrics = {} }) => {
  const metricsList = [
    { key: 'overall_score', label: 'Overall Score' },
    { key: 'context_precision', label: 'Context Precision' },
    { key: 'context_recall', label: 'Context Recall' },
    { key: 'retrieval_relevance', label: 'Retrieval Relevance' },
    { key: 'faithfulness', label: 'Faithfulness' },
    { key: 'answer_relevance', label: 'Answer Relevance' },
    { key: 'answer_correctness', label: 'Answer Correctness' },
    { key: 'conciseness', label: 'Conciseness' }
  ];

  return (
    <div className="metrics-grid">
      {metricsList.map(({ key, label }) => {
        const value = metrics[key] || 0;
        const color = getScoreColor(value);
        return (
          <div key={key} className="metric-card">
            <div className="metric-header">
              <h3 className="metric-label">{label}</h3>
              <div className="metric-value" style={{ color }}>{formatPercentage(value)}</div>
            </div>
            <div className="metric-bar-container">
              <div className="metric-bar-bg">
                <div 
                  className="metric-bar-fill" 
                  style={{ width: `${value * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsCards;
