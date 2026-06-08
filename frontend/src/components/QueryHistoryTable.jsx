import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPercentage, truncateText, formatDate, getScoreColor } from '../utils/formatters';
import '../styles/QueryHistoryTable.css';

const QueryHistoryTable = ({ items = [], total = 0, page = 1, limit = 10, onPageChange, onSort, sortField, sortOrder }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSort = (field) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    onSort?.(field, newOrder);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ color: '#9ca3af', marginLeft: '4px' }}>Sort</span>;
    return sortOrder === 'desc'
      ? <ChevronDown size={16} style={{ marginLeft: '4px' }} />
      : <ChevronUp size={16} style={{ marginLeft: '4px' }} />;
  };

  return (
    <div className="query-history-container">
      <div className="table-wrapper">
        <table className="query-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} className="sortable">
                <span>Date</span>
                <SortIcon field="timestamp" />
              </th>
              <th>ID</th>
              <th className="query-col">Question</th>
              <th onClick={() => handleSort('overall_score')} className="sortable">
                <span>Overall</span>
                <SortIcon field="overall_score" />
              </th>
              <th>Precision</th>
              <th>Recall</th>
              <th>Faith</th>
              <th>Relevance</th>
              <th>Correctness</th>
              <th>Concise</th>
              <th className="rating-col">Final Remark</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="11" className="no-data">No evaluation data available</td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id || idx} className="query-row">
                  <td className="date-cell">{formatDate(item.timestamp)}</td>
                  <td className="metric-cell">{item.question_id || `Q${idx + 1}`}</td>
                  <td className="query-cell">
                    <div className="query-text" title={item.query}>{truncateText(item.query, 42)}</div>
                  </td>
                  <td className="metric-cell">
                    <span
                      className="metric-badge"
                      style={{ backgroundColor: `${getScoreColor(item.overall_score)}20`, color: getScoreColor(item.overall_score) }}
                    >
                      {formatPercentage(item.overall_score, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.context_precision) }}>
                      {formatPercentage(item.context_precision, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.context_recall) }}>
                      {formatPercentage(item.context_recall, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.faithfulness) }}>
                      {formatPercentage(item.faithfulness, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.answer_relevance ?? item.answer_relevancy) }}>
                      {formatPercentage(item.answer_relevance ?? item.answer_relevancy, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.answer_correctness ?? item.accuracy) }}>
                      {formatPercentage(item.answer_correctness ?? item.accuracy, 0)}
                    </span>
                  </td>
                  <td className="metric-cell">
                    <span style={{ color: getScoreColor(item.conciseness) }}>
                      {formatPercentage(item.conciseness, 0)}
                    </span>
                  </td>
                  <td className="rating-cell">{item.final_remark || item.rating || 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          title="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="pagination-info">
          Page {page} of {totalPages} ({total} total)
        </span>
        <button
          className="pagination-btn"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
          title="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default QueryHistoryTable;
