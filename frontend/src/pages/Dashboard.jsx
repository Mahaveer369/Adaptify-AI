import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useDropzone } from 'react-dropzone';

const API_URL = 'http://localhost:5000/api';

// ─── Feature definitions: each maps to a specific API endpoint ──────────────
const FEATURES = [
    {
        id: 'simplify',
        label: 'Simplify',
        icon: '⚡',
        endpoint: '/simplify',
        description: 'Upload a document and get a simplified version tailored to your audience.',
        needsFile: true,
        needsText: true,
        needsAudience: true,
        color: '#a78bfa'
    },
    {
        id: 'ask',
        label: 'Ask Document',
        icon: '💬',
        endpoint: '/ask',
        description: 'Upload a document and ask any question — AI answers from the content.',
        needsFile: true,
        needsText: true,
        needsQuestion: true,
        color: '#60a5fa'
    },
    {
        id: 'summarize',
        label: 'Summarize',
        icon: '📝',
        endpoint: '/summarize',
        description: 'Paste or type text and get a concise one-paragraph summary.',
        needsText: true,
        color: '#34d399'
    },
    {
        id: 'extract',
        label: 'Key Points',
        icon: '🎯',
        endpoint: '/extract',
        description: 'Upload a document and extract bullet-point key takeaways.',
        needsFile: true,
        needsText: true,
        color: '#fbbf24'
    }
];

export default function Dashboard({ user }) {
    const navigate = useNavigate();

    // ─── State ──────────────────────────────────────────────────────────
    const [activeFeature, setActiveFeature] = useState('simplify');
    const [text, setText] = useState('');
    const [question, setQuestion] = useState('');
    const [files, setFiles] = useState([]);
    const [audienceLevel, setAudienceLevel] = useState('manager');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const feature = FEATURES.find(f => f.id === activeFeature);

    // ─── Auth headers ───────────────────────────────────────────────────
    const getToken = async () => {
        try { return await user.getIdToken(); } catch { return null; }
    };

    // ─── History ────────────────────────────────────────────────────────
    useEffect(() => { fetchHistory(); }, []);

    const fetchHistory = async () => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/history`, {
                headers: token
                    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    : { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) setHistory(data.history || []);
        } catch (err) {
            console.warn('Could not fetch history:', err.message);
        }
    };

    const deleteHistoryItem = async (e, id) => {
        e.stopPropagation();
        try {
            const token = await getToken();
            await fetch(`${API_URL}/history/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            setHistory(prev => prev.filter(h => h._id !== id));
            showToast('Deleted');
        } catch { showToast('Delete failed', 'error'); }
    };

    // ─── Toast ──────────────────────────────────────────────────────────
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ─── File dropzone ──────────────────────────────────────────────────
    const onDrop = useCallback((acceptedFiles) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
            'text/plain': ['.txt']
        },
        maxSize: 10 * 1024 * 1024
    });

    // ─── Feature switch ─────────────────────────────────────────────────
    const switchFeature = (id) => {
        setActiveFeature(id);
        setResult(null);
        setSidebarOpen(false);
    };

    // ─── Main action handler ────────────────────────────────────────────
    const handleAction = async () => {
        if (!text.trim() && files.length === 0) {
            showToast('Please enter text or upload a file', 'error');
            return;
        }
        if (activeFeature === 'ask' && !question.trim()) {
            showToast('Please enter a question', 'error');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const token = await getToken();
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            let response;

            if (activeFeature === 'summarize') {
                // Summarize is JSON-only, no file upload
                response = await fetch(`${API_URL}/summarize`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
            } else {
                // All other features support file upload
                const formData = new FormData();
                formData.append('text', text);
                if (activeFeature === 'ask') formData.append('question', question);
                if (activeFeature === 'simplify') formData.append('audienceLevel', audienceLevel);
                files.forEach(file => formData.append('files', file));

                response = await fetch(`${API_URL}${feature.endpoint}`, {
                    method: 'POST',
                    headers,
                    body: formData
                });
            }

            const data = await response.json();
            setResult({ type: activeFeature, data });
            showToast(`${feature.label} complete!`);
            fetchHistory();

        } catch (err) {
            console.error(`${activeFeature} error:`, err);
            showToast('Failed to connect to server', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ─── Logout ─────────────────────────────────────────────────────────
    const handleLogout = async () => {
        try { await signOut(auth); navigate('/'); } catch (err) { console.error(err); }
    };

    // ─── Download ───────────────────────────────────────────────────────
    const handleDownload = () => {
        if (!result) return;
        let content = '';
        const d = result.data;

        if (result.type === 'simplify' && d.result?.pages) {
            content = d.result.pages.map(p =>
                `PAGE ${p.page_number}: ${p.title}\n${'-'.repeat(40)}\n${p.simplified_text}\n`
            ).join('\n');
        } else if (result.type === 'ask') {
            content = `Q: ${question}\n\nA: ${d.answer}\n\nConfidence: ${d.confidence}\nExcerpt: ${d.relevant_excerpt || ''}`;
        } else if (result.type === 'summarize') {
            content = `SUMMARY\n${'='.repeat(40)}\n${d.summary}\n\nTopics: ${(d.key_topics || []).join(', ')}`;
        } else if (result.type === 'extract') {
            content = `KEY POINTS\n${'='.repeat(40)}\n${(d.key_points || []).map((kp, i) =>
                `${i + 1}. [${kp.importance?.toUpperCase()}] ${kp.point}`
            ).join('\n')}\n\nTheme: ${d.overall_theme || ''}\nActions: ${(d.action_items || []).join(', ')}`;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeFeature}-result.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded!');
    };

    const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || 'U';

    // ─── Render result based on feature type ────────────────────────────
    const renderResult = () => {
        if (!result) return null;
        const d = result.data;

        switch (result.type) {
            case 'simplify':
                const pages = d.result?.pages || d.pages || [];
                return (
                    <div className="result-container">
                        {pages.map((page, i) => (
                            <div key={i} className="page-card">
                                <div className="page-card-header">
                                    <div className="page-number">{page.page_number}</div>
                                    <h3>{page.title}</h3>
                                </div>
                                <div className="simplified-text">{page.simplified_text}</div>
                                {page.image_prompt && (
                                    <div className="image-prompt-section">
                                        <div className="image-prompt-label">Suggested Visual</div>
                                        <div className="image-prompt-text">{page.image_prompt}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );

            case 'ask':
                return (
                    <div className="result-container">
                        <div className="result-card ask-result">
                            <div className="result-badge" style={{ background: '#60a5fa22', color: '#60a5fa' }}>
                                {d.confidence === 'high' ? 'High Confidence' : d.confidence === 'medium' ? 'Medium Confidence' : 'Low Confidence'}
                            </div>
                            <h3>Answer</h3>
                            <div className="result-text">{d.answer}</div>
                            {d.relevant_excerpt && (
                                <div className="result-excerpt">
                                    <strong>Supporting excerpt:</strong>
                                    <p>{d.relevant_excerpt}</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'summarize':
                return (
                    <div className="result-container">
                        <div className="result-card summary-result">
                            <h3>Summary</h3>
                            <div className="result-text">{d.summary}</div>
                            <div className="result-meta">
                                {d.word_count && <span>{d.word_count} words</span>}
                                {d.key_topics && d.key_topics.length > 0 && (
                                    <div className="topic-tags">
                                        {d.key_topics.map((t, i) => (
                                            <span key={i} className="topic-tag">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'extract':
                const points = d.key_points || [];
                return (
                    <div className="result-container">
                        <div className="result-card extract-result">
                            {d.overall_theme && (
                                <div className="overall-theme">
                                    <strong>Theme:</strong> {d.overall_theme}
                                </div>
                            )}
                            <h3>Key Points</h3>
                            <ul className="key-points-list">
                                {points.map((kp, i) => (
                                    <li key={i} className={`key-point importance-${kp.importance}`}>
                                        <span className="importance-dot"></span>
                                        {kp.point}
                                    </li>
                                ))}
                            </ul>
                            {d.action_items && d.action_items.length > 0 && (
                                <div className="action-items">
                                    <h4>Action Items</h4>
                                    <ul>
                                        {d.action_items.map((a, i) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    // ═════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════
    return (
        <div className="dashboard">
            {/* Mobile Overlay */}
            <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

            {/* ─── Sidebar ──────────────────────────────────────────── */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-icon">⚡</span>
                        Adaptify AI
                    </div>
                </div>

                {/* Profile */}
                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {user?.photoURL ? <img src={user.photoURL} alt="Profile" /> : userInitial}
                    </div>
                    <div className="profile-info">
                        <div className="profile-name">{user?.displayName || 'User'}</div>
                        <div className="profile-email">{user?.email || ''}</div>
                    </div>
                </div>

                {/* Feature Nav */}
                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">AI Features</div>
                    {FEATURES.map(f => (
                        <button
                            key={f.id}
                            className={`sidebar-nav-item ${activeFeature === f.id ? 'active' : ''}`}
                            onClick={() => switchFeature(f.id)}
                        >
                            <span className="nav-icon">{f.icon}</span>
                            <span className="nav-label">{f.label}</span>
                            <span className="nav-api-badge">{f.endpoint}</span>
                        </button>
                    ))}

                    <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>History</div>
                    <button
                        className={`sidebar-nav-item ${showHistory ? 'active' : ''}`}
                        onClick={() => { setShowHistory(!showHistory); setSidebarOpen(false); }}
                    >
                        <span className="nav-icon">📜</span>
                        <span className="nav-label">History</span>
                        <span className="nav-api-badge">/history</span>
                    </button>

                    {showHistory && history.length > 0 && (
                        <div className="history-list">
                            {history.map(item => (
                                <div key={item._id} className="history-item" onClick={() => {
                                    setText(item.originalText || '');
                                    setResult({ type: 'simplify', data: { result: item.simplifiedOutput } });
                                    setShowHistory(false);
                                }}>
                                    <span className="history-title">
                                        {item.simplifiedOutput?.pages?.[0]?.title || item.originalText?.substring(0, 35) + '...' || 'Untitled'}
                                    </span>
                                    <button className="history-delete" onClick={(e) => deleteHistoryItem(e, item._id)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button className="sidebar-nav-item" onClick={handleLogout}>
                        <span className="nav-icon">↩</span>
                        Logout
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─────────────────────────────────────── */}
            <main className="main-content">
                <div className="main-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
                        <h1>
                            <span style={{ marginRight: '0.5rem' }}>{feature?.icon}</span>
                            {feature?.label}
                        </h1>
                    </div>
                    <div className="header-endpoint" title="REST API endpoint">
                        POST {feature?.endpoint}
                    </div>
                </div>

                {/* Feature Description */}
                <div className="feature-description">{feature?.description}</div>

                {/* ─── Input Area ─────────────────────────────────── */}
                <div className="input-area">
                    <textarea
                        className="text-input"
                        placeholder={
                            activeFeature === 'ask'
                                ? 'Paste your document text here...'
                                : activeFeature === 'summarize'
                                    ? 'Paste or type the text you want summarized...'
                                    : 'Paste your technical briefing, project update, or document text here...'
                        }
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />

                    {/* Question input for Ask feature */}
                    {feature?.needsQuestion && (
                        <input
                            type="text"
                            className="question-input"
                            placeholder="Type your question about the document..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                        />
                    )}

                    {/* File Upload — for features that support it */}
                    {feature?.needsFile && (
                        <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}>
                            <input {...getInputProps()} />
                            <div className="upload-icon">📎</div>
                            <p>{isDragActive ? 'Drop files here...' : 'Drag & drop files, or click to browse'}</p>
                            <div className="upload-formats">PDF, DOCX, TXT, PNG, JPG (max 10MB)</div>
                        </div>
                    )}

                    {/* File chips */}
                    {files.length > 0 && (
                        <div className="file-list">
                            {files.map((file, i) => (
                                <div key={i} className="file-chip">
                                    {file.name}
                                    <button className="remove-file" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Controls Row */}
                    <div className="controls-row">
                        {feature?.needsAudience && (
                            <div className="audience-selector">
                                <label>Audience:</label>
                                <select value={audienceLevel} onChange={(e) => setAudienceLevel(e.target.value)}>
                                    <option value="executive">Executive</option>
                                    <option value="manager">Manager</option>
                                    <option value="client">Client</option>
                                    <option value="intern">Intern</option>
                                </select>
                            </div>
                        )}

                        <button
                            className="simplify-btn"
                            onClick={handleAction}
                            disabled={loading || (!text.trim() && files.length === 0)}
                            style={{ '--feature-color': feature?.color || '#a78bfa' }}
                        >
                            {loading ? (
                                <><div className="btn-spinner"></div>Processing...</>
                            ) : (
                                <>{feature?.icon} {feature?.label}</>
                            )}
                        </button>
                    </div>
                </div>

                {/* ─── Loading State ──────────────────────────────── */}
                {loading && (
                    <div className="loading-overlay">
                        <div className="loading-animation"></div>
                        <p>Processing with Perplexity AI...</p>
                        <p className="loading-sub">
                            {activeFeature === 'ask' ? 'Searching document for answers...'
                                : activeFeature === 'summarize' ? 'Generating concise summary...'
                                    : activeFeature === 'extract' ? 'Extracting key points...'
                                        : 'Simplifying your briefing...'}
                        </p>
                    </div>
                )}

                {/* ─── Result Output ─────────────────────────────── */}
                {result && !loading && (
                    <div className="output-area">
                        <div className="output-header">
                            <h2>{feature?.icon} Results</h2>
                            <button className="download-btn" onClick={handleDownload}>Download</button>
                        </div>
                        {renderResult()}
                    </div>
                )}

                {/* ─── Empty State ───────────────────────────────── */}
                {!result && !loading && (
                    <div className="empty-state">
                        <div className="empty-icon">{feature?.icon}</div>
                        <h3>Ready to {feature?.label}</h3>
                        <p>{feature?.description}</p>
                    </div>
                )}
            </main>

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}
        </div>
    );
}
