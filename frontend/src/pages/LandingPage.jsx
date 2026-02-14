import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();

    const features = [
        {
            icon: '⚡',
            title: 'Simplify Document',
            desc: 'Upload PDFs, DOCX, or images — get simplified summaries tailored to your audience level.',
            endpoint: 'POST /api/simplify'
        },
        {
            icon: '💬',
            title: 'Ask Document',
            desc: 'Upload a document and ask any question. AI answers using RAG and Perplexity.',
            endpoint: 'POST /api/ask'
        },
        {
            icon: '📝',
            title: 'Summarize Text',
            desc: 'Paste text and get a concise one-paragraph summary with key topics.',
            endpoint: 'POST /api/summarize'
        },
        {
            icon: '🎯',
            title: 'Extract Key Points',
            desc: 'Upload a document — get structured bullet-point takeaways and action items.',
            endpoint: 'POST /api/extract'
        }
    ];

    return (
        <div className="landing-page">
            {/* Background Orbs */}
            <div className="landing-bg-orbs">
                <div className="orb"></div>
                <div className="orb"></div>
                <div className="orb"></div>
            </div>

            {/* Navbar */}
            <nav className="landing-nav">
                <div className="logo">
                    <span className="logo-icon">⚡</span>
                    Adaptify AI
                </div>
                <button className="btn-primary" onClick={() => navigate('/auth')}>
                    Get Started
                </button>
            </nav>

            {/* Hero */}
            <section className="hero-section">
                <div className="hero-badge">
                    <span className="badge-dot"></span>
                    Powered by Perplexity AI
                </div>
                <h1 className="hero-title">
                    Turn Complex Documents into{' '}
                    <span className="gradient-text">Clear Insights</span>
                </h1>
                <p className="hero-subtitle">
                    Upload documents, ask questions, extract key points, or get instant summaries.
                    Every feature is backed by a REST API powered by Perplexity AI.
                </p>
                <div className="hero-cta">
                    <button className="btn-primary" onClick={() => navigate('/auth')}>
                        Get Started Free
                    </button>
                    <a href="#features" className="btn-secondary">
                        View Features ↓
                    </a>
                </div>
            </section>

            {/* How It Works */}
            <section className="workflow-section" id="how-it-works">
                <div className="section-label">How It Works</div>
                <h2 className="section-title">Three Simple Steps</h2>
                <div className="workflow-steps">
                    <div className="workflow-step">
                        <div className="step-number">1</div>
                        <div className="step-icon">📄</div>
                        <h3>Upload or Paste</h3>
                        <p>Upload a PDF, DOCX, image, or paste text directly. Multi-format support built in.</p>
                    </div>
                    <div className="workflow-connector">→</div>
                    <div className="workflow-step">
                        <div className="step-number">2</div>
                        <div className="step-icon">🧠</div>
                        <h3>Choose a Feature</h3>
                        <p>Simplify, Ask, Summarize, or Extract — each feature calls its own REST API endpoint.</p>
                    </div>
                    <div className="workflow-connector">→</div>
                    <div className="workflow-step">
                        <div className="step-number">3</div>
                        <div className="step-icon">✨</div>
                        <h3>Get AI Results</h3>
                        <p>Perplexity AI processes your request and returns structured, actionable output.</p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="features-section" id="features">
                <div className="section-label" style={{ textAlign: 'center' }}>API-Backed Features</div>
                <h2 className="section-title" style={{ textAlign: 'center', fontSize: '2.2rem', fontWeight: 800, marginBottom: '3rem' }}>
                    Every Feature = Its Own API
                </h2>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <div key={i} className="feature-card">
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                            <div style={{
                                marginTop: '1rem',
                                fontFamily: "'Courier New', monospace",
                                fontSize: '0.7rem',
                                color: 'var(--accent-secondary)',
                                background: 'rgba(108, 92, 231, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                display: 'inline-block'
                            }}>
                                {f.endpoint}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <p>© 2026 Adaptify AI · Powered by Perplexity AI + RAG</p>
            </footer>
        </div>
    );
}
