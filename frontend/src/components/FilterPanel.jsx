import React from 'react';
import '../styles/FilterPanel.css';

const FilterPanel = ({ selectedRange = 'all', onRangeChange, onSearch, searchQuery = '' }) => {
  const ranges = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];

  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label className="filter-label">Time Range</label>
        <div className="filter-buttons">
          {ranges.map(range => (
            <button
              key={range.value}
              className={`filter-btn ${selectedRange === range.value ? 'active' : ''}`}
              onClick={() => onRangeChange?.(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label">Search Query</label>
        <input
          type="text"
          className="filter-input"
          placeholder="Search queries..."
          value={searchQuery}
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
    </div>
  );
};

export default FilterPanel;
