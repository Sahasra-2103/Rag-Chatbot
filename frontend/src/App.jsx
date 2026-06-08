import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart3, ChevronDown, ChevronUp, Database, Download, FileText, File as FileIcon, Gauge, MessageSquare, Search, Send, Bot, User, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import './index.css';
import EvaluationDashboardPage from './pages/EvaluationDashboard';
import EvaluationPanelComponent from './components/EvaluationPanel';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const metricLabels = {
  faithfulness: 'Faithfulness',
  answer_relevancy: 'Answer Relevancy',
  answer_relevance: 'Answer Relevance',
  context_precision: 'Context Precision',
  context_recall: 'Context Recall',
  retrieval_relevance: 'Retrieval Relevance',
  accuracy: 'Accuracy',
  answer_correctness: 'Answer Correctness',
  conciseness: 'Conciseness',
  hallucination_score: 'Hallucination Score',
  retrieval_quality: 'Retrieval Quality',
  response_completeness: 'Response Completeness',
  overall_score: 'Overall RAG Score'
};

const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

function scoreClass(value) {
  if (value >= 0.8) return 'score-green';
  if (value >= 0.6) return 'score-yellow';
  return 'score-red';
}

function downloadFile(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function EvaluationPanel({ evaluation }) {
  const [open, setOpen] = useState(false);
  if (!evaluation) return null;

  const coreMetrics = [
    'context_precision',
    'context_recall',
    'retrieval_relevance',
    'faithfulness',
    'answer_relevance',
    'answer_correctness',
    'conciseness'
  ];

  return (
    <div className="evaluation-panel">
      <div className="evaluation-summary">
        <div>
          <span className="panel-eyebrow">Evaluation</span>
          <strong className={scoreClass(evaluation.overall_score)}>{metricLabels.overall_score}: {percent(evaluation.overall_score)}</strong>
        </div>
        <span className={`rating-badge ${scoreClass(evaluation.overall_score)}`}>{evaluation.rating}</span>
      </div>

      <div className="metric-grid compact">
        {coreMetrics.map((key) => (
          <div key={key} className="metric-row">
            <span>{metricLabels[key]}</span>
            <strong className={scoreClass(evaluation[key])}>{percent(evaluation[key])}</strong>
          </div>
        ))}
      </div>

      <button className="details-toggle" type="button" onClick={() => setOpen(!open)}>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        View Details
      </button>

      {open && (
        <div className="evaluation-details">
          <section>
            <h3>Retrieved Chunks Used</h3>
            {(evaluation.details?.retrieved_chunks_used || []).map((chunk, idx) => (
              <div key={`${chunk.id || idx}`} className="chunk-preview">
                <strong>{chunk.source || 'Unknown source'} • {percent(chunk.score)}</strong>
                <p>{chunk.text}</p>
              </div>
            ))}
            {!evaluation.details?.retrieved_chunks_used?.length && <p>No retrieved chunks were available for this answer.</p>}
          </section>
          <section>
            <h3>Missing Information</h3>
            <p>{evaluation.details?.missing_information}</p>
          </section>
          <section>
            <h3>Hallucination Warnings</h3>
            {(evaluation.details?.hallucination_warnings || []).length ? (
              evaluation.details.hallucination_warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)
            ) : (
              <p>No hallucination warnings detected.</p>
            )}
          </section>
          <section>
            <h3>Evaluation Reasoning</h3>
            {(evaluation.details?.evaluation_reasoning || []).map((reason) => <p key={reason}>{reason}</p>)}
          </section>
          <section>
            <h3>Sources Referenced</h3>
            <div>
              {(evaluation.details?.sources_referenced || []).map((source) => (
                <span key={source} className="source-badge"><FileIcon size={12} style={{ display: 'inline', marginRight: '4px' }} />{source}</span>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function EvaluationDashboard() {
  const [range, setRange] = useState('7d');
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState({ items: [], total: 0, page: 1, limit: 8 });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('timestamp');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/evaluation/analytics`, { params: { range } }),
        axios.get(`${API_URL}/evaluation/history`, { params: { range, search, sort, order, page, limit: history.limit } })
      ]);
      setAnalytics(analyticsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(1);
    const timer = setInterval(() => loadDashboard(1), 10000);
    return () => clearInterval(timer);
  }, [range, sort, order]);

  const submitSearch = (e) => {
    e.preventDefault();
    loadDashboard(1);
  };

  const avg = analytics?.averages || {};
  const cards = [
    ['faithfulness', 'Average Faithfulness'],
    ['answer_relevancy', 'Average Relevancy'],
    ['context_precision', 'Average Precision'],
    ['context_recall', 'Average Recall'],
    ['accuracy', 'Average Accuracy'],
    ['hallucination_score', 'Average Hallucination'],
    ['overall_score', 'Average Overall']
  ];

  return (
    <div className="evaluation-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>RAGAS Evaluation Analytics</h1>
          <p>Automatic quality monitoring for every generated chatbot response.</p>
        </div>
        <div className="dashboard-actions">
          <select className="select-control" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button className="btn btn-secondary" onClick={() => downloadFile(`${API_URL}/evaluation/export/csv`)}>
            <Download size={16} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => downloadFile(`${API_URL}/evaluation/export/pdf`)}>
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      {error && <div className="status-banner error">{error}</div>}
      {loading && <div className="status-banner">Loading evaluation analytics...</div>}

      <div className="analytics-grid">
        {cards.map(([key, label]) => (
          <div key={key} className="analytics-card">
            <span>{label}</span>
            <strong className={scoreClass(avg[key])}>{percent(avg[key])}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel latest-panel">
          <div className="section-title">
            <Gauge size={18} />
            <h2>Latest Evaluation</h2>
          </div>
          {analytics?.latest ? (
            <>
              <p className="latest-query">{analytics.latest.query}</p>
              <div className="metric-grid">
                {['overall_score', 'faithfulness', 'answer_relevancy', 'accuracy'].map((key) => (
                  <div key={key} className="metric-row">
                    <span>{metricLabels[key]}</span>
                    <strong className={scoreClass(analytics.latest[key])}>{percent(analytics.latest[key])}</strong>
                  </div>
                ))}
              </div>
              <span className={`rating-badge ${scoreClass(analytics.latest.overall_score)}`}>{analytics.latest.rating}</span>
            </>
          ) : (
            <p>No evaluations yet. Ask a chatbot question to create the first record.</p>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="section-title">
            <BarChart3 size={18} />
            <h2>Latest Query Metrics</h2>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={(analytics?.latest_metrics || []).map((item) => ({ ...item, value: Math.round(item.value * 100) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="dashboard-panel">
        <div className="section-title">
          <BarChart3 size={18} />
          <h2>Historical Trends</h2>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={(analytics?.trends || []).map((item) => ({
              ...item,
              overall_score: Math.round(item.overall_score * 100),
              faithfulness: Math.round(item.faithfulness * 100),
              accuracy: Math.round(item.accuracy * 100),
              context_recall: Math.round(item.context_recall * 100)
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)' }} />
              <Line type="monotone" dataKey="overall_score" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="faithfulness" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="accuracy" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="context_recall" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="table-toolbar">
          <div className="section-title">
            <Search size={18} />
            <h2>Query History</h2>
          </div>
          <form className="history-search" onSubmit={submitSearch}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search queries..." />
            <button className="btn btn-secondary" type="submit">Search</button>
          </form>
        </div>
        <div className="table-controls">
          <select className="select-control" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="timestamp">Date</option>
            <option value="overall_score">Overall Score</option>
            <option value="faithfulness">Faithfulness</option>
            <option value="answer_relevancy">Relevancy</option>
            <option value="accuracy">Accuracy</option>
          </select>
          <select className="select-control" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Overall</th>
                <th>Faithfulness</th>
                <th>Relevancy</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>Accuracy</th>
                <th>Hallucination</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => (
                <tr key={item.id}>
                  <td className="query-cell">{item.query}</td>
                  <td className={scoreClass(item.overall_score)}>{percent(item.overall_score)}</td>
                  <td>{percent(item.faithfulness)}</td>
                  <td>{percent(item.answer_relevancy)}</td>
                  <td>{percent(item.context_precision)}</td>
                  <td>{percent(item.context_recall)}</td>
                  <td>{percent(item.accuracy)}</td>
                  <td>{percent(item.hallucination_score)}</td>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="btn btn-secondary" disabled={history.page <= 1} onClick={() => loadDashboard(history.page - 1)}>Previous</button>
          <span>Page {history.page} of {Math.max(1, Math.ceil(history.total / history.limit))}</span>
          <button className="btn btn-secondary" disabled={history.page >= Math.ceil(history.total / history.limit)} onClick={() => loadDashboard(history.page + 1)}>Next</button>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="section-title">
          <CheckCircle2 size={18} />
          <h2>Performance Insights</h2>
        </div>
        <div className="insight-list">
          {(analytics?.insights || []).map((insight) => <p key={insight}>{insight}</p>)}
        </div>
      </section>
    </div>
  );
}

function DocumentManager() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 2 * 1024 * 1024) { // 2MB safe limit for Vercel
      setMsg("Error: File too large. Vercel's Hobby tier kills tasks that take longer than 60s or use too much RAM. Please upload files under 2MB.");
      return;
    }

    setUploading(true);
    setMsg("");
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    
    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      setMsg(res.data.message);
      setFiles([]);
    } catch (error) {
      setMsg("Error: " + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '32px', minHeight: '100%' }}>
      <div className="view-header">
        <h1>Knowledge Base Management</h1>
        <p>Upload documents from any domain to build your knowledge base dynamically.</p>
      </div>
      
      <div className="upload-zone" onClick={() => document.getElementById('file-upload').click()}>
        <input id="file-upload" type="file" multiple style={{ display: 'none' }} accept=".pdf,.docx,.txt,.csv,.json" onChange={handleFileChange} />
        <Upload className="upload-icon" />
        <h2>{files.length > 0 ? `${files.length} files selected` : "Click or drag to upload files"}</h2>
        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Supported formats: PDF, DOCX, TXT, CSV, JSON</p>
      </div>
      
      {files.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <strong>Selected Files:</strong>
          <ul style={{ listStyleType: 'none', padding: '8px 0' }}>
            {files.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <FileText size={16} /> {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-primary" disabled={!files.length || uploading} onClick={handleUpload}>
          {uploading ? "Extracting, Chunking & Tagging..." : "Upload & Process Documents"}
        </button>
        {msg && <span style={{ color: msg.includes('Error') ? 'var(--danger)' : 'var(--success)' }}>{msg}</span>}
      </div>
    </div>
  );
}

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    
    try {
      const res = await axios.post(`${API_URL}/chat`, { query: userMsg });
      setMessages(prev => [...prev, {
        role: 'bot', 
        text: res.data.answer,
        confidence: res.data.confidence,
        sources: res.data.sources,
        context: res.data.context,
        evaluation: res.data.evaluation
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "Error connecting to backend." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-wrapper glass">
      <div className="view-header" style={{ padding: '24px 24px 0', marginBottom: 0 }}>
        <h1>RAG Chat Assistant</h1>
        <p>Strictly grounded generation with dynamic domain-agnostic retrieval.</p>
      </div>
      
      <div className="chat-history">
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Bot size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h2>Ask me anything.</h2>
            <p>I will only answer using information from uploaded documents.</p>
          </div>
        ) : null}
        
        {messages.map((msg, i) => {
          const notFound = msg.text === "Not Found in Knowledge Base";
          
          return (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="chat-avatar">
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className="chat-bubble" style={{ border: notFound ? '1px solid var(--danger)' : '' }}>
                <p style={{ color: notFound ? 'var(--danger)' : 'inherit', fontWeight: notFound ? 600 : 400 }}>
                  {msg.text}
                </p>
                
                {msg.role === 'bot' && !notFound && msg.sources && msg.sources.length > 0 && (
                  <div className="chat-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--success)' }}>
                      <CheckCircle2 size={14} /> Grounded Response (Confidence: {msg.confidence})
                    </div>
                    <strong>Sources Used:</strong>
                    <div>
                      {msg.sources.map((src, idx) => (
                        <span key={idx} className="source-badge"><FileIcon size={12} style={{ display:'inline', marginRight:'4px' }}/>{src}</span>
                      ))}
                    </div>
                    
                    {msg.context && msg.context.length > 0 && (
                       <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
                          <strong>Retrieved Tags:</strong> {msg.context[0].tags}
                       </div>
                    )}
                  </div>
                )}

                {msg.role === 'bot' && notFound && (
                   <div className="chat-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                        <AlertTriangle size={14} /> {msg.context?.length ? 'The retrieved context did not contain the exact requested detail.' : 'Retrieval confidence too low or context missing. Generation aborted to prevent hallucination.'}
                      </div>
                   </div>
                )}

                {msg.role === 'bot' && <EvaluationPanel evaluation={msg.evaluation} />}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="chat-message bot">
            <div className="chat-avatar"><Bot size={20} /></div>
            <div className="chat-bubble">Thinking...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      
      <form className="chat-input-container" onSubmit={handleSend}>
        <input 
          type="text" 
          className="chat-input" 
          placeholder="Ask a question..." 
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() || isTyping}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { path: '/chat', label: 'Chat Interface', icon: <MessageSquare size={20} /> },
    { path: '/documents', label: 'Knowledge Base', icon: <Database size={20} /> },
    { path: '/evaluation', label: 'Evaluation', icon: <Gauge size={20} /> }
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <Bot size={28} /> CRAG System
      </div>
      
      <div className="nav-links">
        {navItems.map(item => (
          <div 
            key={item.path} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <div className="app-layout">
      {/* Ambient Animated Background */}
      <div className="ambient-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <Sidebar />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/documents" element={<DocumentManager />} />
          <Route path="/evaluation" element={<EvaluationDashboardPage />} />
        </Routes>
      </main>
    </div>
  );
}
