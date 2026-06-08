import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPercentage, formatDate, truncateText } from '../utils/formatters';
import { getScoreColor } from '../utils/formatters';
import '../styles/EvaluationPanel.css';

const EvaluationPanel = ({ evaluation = null, loading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!evaluation) return null;

  const metrics = [
    { key: 'faithfulness', label: 'Faithfulness' },
    { key: 'answer_relevancy', label: 'Answer Relevancy' },
    { key: 'context_precision', label: 'Context Precision' },
    { key: 'context_recall', label: 'Context Recall' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'hallucination_score', label: 'Hallucination Score' }
  ];

  const overallScore = evaluation.overall_score || 0;
  const overallColor = getScoreColor(overallScore);

  return (
    <div className="evaluation-panel">
      <div className="evaluation-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="evaluation-title">
          <h4>Evaluation Results</h4>
          <div className="overall-score-badge" style={{ backgroundColor: overallColor + '20', color: overallColor }}>
            Overall: {formatPercentage(overallScore, 0)} • {evaluation.rating || 'N/A'}
          </div>
        </div>
        <button className="expand-btn">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="evaluation-content">
          <div className="metrics-summary">
            {metrics.map(({ key, label }) => {
              const value = evaluation[key] || 0;
              const color = getScoreColor(value);
              return (
                <div key={key} className="metric-summary-row">
                  <span className="metric-name">{label}</span>
                  <div className="metric-bar-small">
                    <div 
                      className="metric-fill-small"
                      style={{ 
                        width: `${value * 100}%`, 
                        backgroundColor: color 
                      }}
                    />
                  </div>
                  <span className="metric-value-small" style={{ color }}>
                    {formatPercentage(value, 0)}
                  </span>
                </div>
              );
            })}
          </div>

          {evaluation.details && (
            <div className="evaluation-details">
              <div className="details-section">
                <h5>Retrieved Chunks</h5>
                <div className="chunks-list">
                  {evaluation.details.retrieved_chunks_used?.length ? (
                    evaluation.details.retrieved_chunks_used.map((chunk, idx) => (
                      <div key={idx} className="chunk-item">
                        <div className="chunk-header">
                          <span className="chunk-source">{chunk.source}</span>
                          <span className="chunk-score" style={{ color: getScoreColor(parseFloat(chunk.score)) }}>
                            Score: {chunk.score}
                          </span>
                        </div>
                        <p className="chunk-text">{truncateText(chunk.text, 100)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="no-chunks">No chunks retrieved</p>
                  )}
                </div>
              </div>

              {evaluation.details.hallucination_warnings?.length > 0 && (
                <div className="details-section warnings">
                  <h5>⚠️ Hallucination Warnings</h5>
                  <ul className="warnings-list">
                    {evaluation.details.hallucination_warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="details-section">
                <h5>Sources Referenced</h5>
                <div className="sources-list">
                  {evaluation.details.sources_referenced?.length ? (
                    evaluation.details.sources_referenced.map((source, idx) => (
                      <span key={idx} className="source-badge">{source}</span>
                    ))
                  ) : (
                    <p className="no-sources">No sources</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationPanel;
