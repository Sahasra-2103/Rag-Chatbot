import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { MessageSquare, Database, Upload, Send, Bot, User, CheckCircle2, AlertTriangle, FileText, File as FileIcon } from 'lucide-react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
    if (totalSize > 4.2 * 1024 * 1024) { // 4.2MB safe limit for Vercel
      setMsg("Error: Total file size exceeds the 4.5MB Vercel serverless limit. Please upload smaller documents.");
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
        context: res.data.context
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
    { path: '/documents', label: 'Knowledge Base', icon: <Database size={20} /> }
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
        </Routes>
      </main>
    </div>
  );
}
