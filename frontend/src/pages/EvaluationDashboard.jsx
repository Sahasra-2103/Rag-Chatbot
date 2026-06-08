import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { AlertTriangle, CheckCircle2, Download, BarChart3, Lightbulb, TrendingDown } from 'lucide-react';
import MetricsCards from '../components/MetricsCards';
import LatestMetricsChart from '../components/LatestMetricsChart';
import TrendChart from '../components/TrendChart';
import QueryHistoryTable from '../components/QueryHistoryTable';
import InsightsPanel from '../components/InsightsPanel';
import FilterPanel from '../components/FilterPanel';
import '../styles/EvaluationDashboard.css';
import { formatPercentage, truncateText } from '../utils/formatters';

const EvaluationDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analytics
      const analyticsRes = await axios.get('/api/evaluation/analytics', {
        params: { range }
      });
      setAnalytics(analyticsRes.data);

      // Fetch history
      const historyRes = await axios.get('/api/evaluation/history', {
        params: {
          range,
          search: searchQuery,
          sort: sortField,
          order: sortOrder,
          page,
          limit: 10
        }
      });
      setHistory(historyRes.data);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching evaluation data:', err);
      setError(err.message || 'Failed to load evaluation data');
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await fetchData();
    };

    const timer = setInterval(run, 2000);
    run();

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [range, searchQuery, page, sortField, sortOrder]);

  const handleExportCSV = async () => {
    try {
      const response = await axios.get('/api/evaluation/export/csv', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'evaluation-results.csv');
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get('/api/evaluation/export/pdf', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'evaluation-report.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    }
  };

  if (error) {
    return (
      <div className="dashboard-error">
        <p>Error loading evaluation dashboard: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading evaluation data...</p>
      </div>
    );
  }

  return (
    <div className="evaluation-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <BarChart3 size={32} />
            <h1>RAG Evaluation Dashboard</h1>
          </div>
          <p className="header-subtitle">Per-question scoring, error analysis, strengths, weaknesses, and recommendations</p>
        </div>
        <div className="header-actions">
          <button className="export-btn csv-btn" onClick={handleExportCSV} title="Export CSV">
            <Download size={18} /> CSV
          </button>
          <button className="export-btn pdf-btn" onClick={handleExportPDF} title="Export PDF">
            <Download size={18} /> PDF
          </button>
        </div>
      </div>

      <FilterPanel 
        selectedRange={range}
        onRangeChange={setRange}
        searchQuery={searchQuery}
        onSearch={(q) => {
          setSearchQuery(q);
          setPage(1);
        }}
      />

      {analytics && (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">Overall Metrics</h2>
            <div className="summary-strip">
              <div>
                <span>Average RAG Score</span>
                <strong>{formatPercentage(analytics.overall_score || 0)}</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong>{analytics.rating}</strong>
              </div>
              <div>
                <span>Grade</span>
                <strong>{analytics.grade}</strong>
              </div>
              <div>
                <span>Evaluated Questions</span>
                <strong>{analytics.count}</strong>
              </div>
            </div>
            <MetricsCards metrics={analytics.averages} />
          </section>

          <section className="dashboard-section">
            <div className="section-row">
              <div className="section-col">
                <h2 className="section-title">Latest Evaluation Metrics</h2>
                <LatestMetricsChart data={analytics.latest_metrics?.reduce((acc, m) => {
                  const key = m.key || m.name.toLowerCase().replace(/\s+/g, '_');
                  acc[key] = m.value;
                  return acc;
                }, {})} />
              </div>

              <div className="section-col">
                <h2 className="section-title">Performance Trends</h2>
                <TrendChart data={analytics.trends || []} />
              </div>
            </div>
          </section>

          {analytics.insights && (
            <section className="dashboard-section">
              <InsightsPanel insights={analytics.insights} averages={analytics.averages} />
            </section>
          )}

          <section className="dashboard-section">
            <h2 className="section-title">Detailed Evaluation Viewer</h2>
            <div className="detail-grid">
              {(analytics.detailed_examples || []).map((example) => (
                <article className="detail-card" key={example.question_id}>
                  <div className="detail-card-header">
                    <span>{example.question_id}</span>
                    <strong>{example.final_remark}</strong>
                  </div>
                  <h3>{example.question}</h3>
                  <div className="detail-block">
                    <span>Retrieved Context</span>
                    {(example.retrieved_context || []).slice(0, 2).map((ctx, idx) => (
                      <p key={ctx.id || idx}>{truncateText(ctx.text, 220)}</p>
                    ))}
                    {!example.retrieved_context?.length && <p>No context retrieved.</p>}
                  </div>
                  <div className="detail-block">
                    <span>Generated Answer</span>
                    <p>{example.generated_answer}</p>
                  </div>
                  <div className="detail-block">
                    <span>Expected Answer</span>
                    <p>{example.expected_answer || 'Not provided'}</p>
                  </div>
                  <div className="mini-table-wrap">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Score</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(example.metrics || []).map((metric) => (
                          <tr key={metric.key || metric.metric}>
                            <td>{metric.metric}</td>
                            <td>{formatPercentage(metric.score || 0)}</td>
                            <td>{metric.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
              {!analytics.detailed_examples?.length && (
                <div className="empty-panel">Ask two questions to populate detailed examples.</div>
              )}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="analysis-grid">
              <section className="analysis-panel">
                <h2 className="section-title"><AlertTriangle size={18} /> Error Analysis</h2>
                {(analytics.error_analysis || []).length ? analytics.error_analysis.map((issue) => (
                  <div className="analysis-item" key={issue.category}>
                    <strong>{issue.category}</strong>
                    <span>{issue.count} occurrence(s)</span>
                    <p>{issue.explanation}</p>
                  </div>
                )) : <p className="muted-text">No recurring errors detected.</p>}
              </section>

              <section className="analysis-panel">
                <h2 className="section-title"><CheckCircle2 size={18} /> Strengths</h2>
                {(analytics.strengths || []).map((item) => <p className="analysis-copy" key={item}>{item}</p>)}
              </section>

              <section className="analysis-panel">
                <h2 className="section-title"><TrendingDown size={18} /> Weaknesses</h2>
                {(analytics.weaknesses || []).map((item) => <p className="analysis-copy" key={item}>{item}</p>)}
              </section>

              <section className="analysis-panel">
                <h2 className="section-title"><Lightbulb size={18} /> Recommendations</h2>
                {(analytics.recommendations || []).map((item) => <p className="analysis-copy" key={item}>{item}</p>)}
              </section>
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">Query Evaluation History</h2>
            <QueryHistoryTable
              items={history.items || []}
              total={history.total || 0}
              page={history.page || page}
              limit={history.limit || 10}
              sortField={sortField}
              sortOrder={sortOrder}
              onPageChange={setPage}
              onSort={(field, order) => {
                setSortField(field);
                setSortOrder(order);
                setPage(1);
              }}
            />
          </section>

          <section className="dashboard-section stats-section">
            <div className="stats-grid">
              {analytics.best_query && (
                <div className="stat-card best">
                  <h3>Best Query</h3>
                  <p className="stat-query">{analytics.best_query.query.substring(0, 50)}...</p>
                  <div className="stat-value" style={{ color: '#10b981' }}>
                    {(analytics.best_query.overall_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              {analytics.worst_query && (
                <div className="stat-card worst">
                  <h3>Worst Query</h3>
                  <p className="stat-query">{analytics.worst_query.query.substring(0, 50)}...</p>
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {(analytics.worst_query.overall_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              {analytics.most_accurate_query && (
                <div className="stat-card accurate">
                  <h3>Most Correct</h3>
                  <p className="stat-query">{analytics.most_accurate_query.query.substring(0, 50)}...</p>
                  <div className="stat-value" style={{ color: '#3b82f6' }}>
                    {((analytics.most_accurate_query.answer_correctness ?? analytics.most_accurate_query.accuracy ?? 0) * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              {analytics.most_hallucinated_query && (
                <div className="stat-card hallucination">
                  <h3>Highest Hallucination</h3>
                  <p className="stat-query">{analytics.most_hallucinated_query.query.substring(0, 50)}...</p>
                  <div className="stat-value" style={{ color: '#f59e0b' }}>
                    {(analytics.most_hallucinated_query.hallucination_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default EvaluationDashboard;
