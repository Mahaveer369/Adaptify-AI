# ⚡ Adaptify AI — AI Document Intelligence Platform

> Turn complex documents into clear, audience-adapted insights using Perplexity AI + RAG

Adaptify AI is a full-stack AI SaaS application that simplifies technical documents, answers questions from uploaded files, generates summaries, and extracts key points — all powered by Perplexity AI with a RAG (Retrieval-Augmented Generation) pipeline. The AI **adapts its output** for Executives, Managers, Clients, and Interns.

---

## 🎯 Features

Every feature has its own REST API endpoint. Only API-backed features appear in the UI.

| Feature | API Endpoint | Description |
|---------|-------------|-------------|
| ⚡ **Simplify** | `POST /api/simplify` | Upload a document → get audience-tailored simplified output |
| 💬 **Ask Document** | `POST /api/ask` | Upload a document + ask a question → AI answers from context |
| 📝 **Summarize** | `POST /api/summarize` | Paste text → get a concise one-paragraph summary |
| 🎯 **Key Points** | `POST /api/extract` | Upload a document → get bullet-point takeaways + action items |
| 📜 **History** | `GET /api/history` | View, recall, or delete past interactions |

### 🎯 Audience-Aware AI

The **Simplify** feature adapts its output based on the selected audience level. The AI adjusts vocabulary, detail depth, and tone for each:

| Audience | What They Get |
|----------|---------------|
| 🏢 **Executive** | High-level strategic summary, business impact, ROI focus. Minimal jargon. |
| 📋 **Manager** | Balanced overview with project status, risks, deadlines, and team implications. |
| 🤝 **Client** | Non-technical explanation focused on deliverables, timelines, and outcomes. |
| 🎓 **Intern** | Detailed, plain-language walkthrough with definitions and context for every concept. |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Node.js Backend│────▶│  FastAPI NLP    │
│  (Vite)         │     │  (Express)      │     │  Service        │
│  Port 5173      │     │  Port 5000      │     │  Port 8000      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
   Firebase Auth           MongoDB Atlas          Perplexity AI
   (Google OAuth)          (Users, History)        (sonar-pro)
                                                         │
                                                  LangChain + FAISS
                                                  (RAG Pipeline)
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, React Dropzone |
| Auth | Firebase Authentication (Google OAuth) |
| Styling | Vanilla CSS (dark theme, glassmorphism, animations) |
| Backend | Node.js, Express, Multer, Mongoose |
| Database | MongoDB Atlas |
| NLP Service | Python, FastAPI, Uvicorn |
| AI Model | Perplexity AI (`sonar-pro`) |
| RAG | LangChain, FAISS, HuggingFace Embeddings (`all-MiniLM-L6-v2`) |
| File Parsing | pdfplumber, python-docx, pytesseract |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **Python** 3.9+
- **MongoDB** (local or Atlas cloud)
- **Firebase** project with Google Auth enabled
- **Perplexity AI** API key

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd project
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/briefai
FASTAPI_URL=http://localhost:8000
PERPLEXITY_API_KEY=pplx-your-key-here
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

**FastAPI** (`fastapi_service/.env`):
```env
PERPLEXITY_API_KEY=pplx-your-key-here
```

**Frontend** (`frontend/src/firebase.js`):
Update with your Firebase project config from Firebase Console → Project Settings.

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# FastAPI
cd ../fastapi_service
pip install -r requirements.txt
```

### 4. Start All Services

Open 3 terminals:

```bash
# Terminal 1 — FastAPI NLP Service
cd fastapi_service
python main.py

# Terminal 2 — Node.js Backend
cd backend
node server.js

# Terminal 3 — React Frontend
cd frontend
npx vite --host
```

### 5. Open in Browser

Navigate to `http://localhost:5173` → Sign in with Google → Use any feature!

---

## 📁 Project Structure

```
project/
├── frontend/                      # React + Vite
│   ├── src/
│   │   ├── main.jsx               # Routes, auth listener
│   │   ├── index.css              # Design system
│   │   ├── firebase.js            # Firebase config
│   │   └── pages/
│   │       ├── LandingPage.jsx    # Public landing page
│   │       ├── Authentication.jsx # Google OAuth page
│   │       └── Dashboard.jsx      # Feature-tabbed main app
│   └── package.json
│
├── backend/                       # Node.js + Express
│   ├── server.js                  # Express app + route mounting
│   ├── middleware/auth.js         # Firebase JWT verification
│   ├── models/                    # Mongoose schemas
│   │   ├── User.js
│   │   └── History.js
│   ├── routes/                    # One file per feature
│   │   ├── simplify.js            # POST /api/simplify
│   │   ├── ask.js                 # POST /api/ask
│   │   ├── summarize.js           # POST /api/summarize
│   │   ├── extract.js             # POST /api/extract
│   │   ├── history.js             # GET/DELETE /api/history
│   │   ├── auth.js                # POST /api/auth/verify
│   │   └── user.js                # GET /api/user/profile
│   └── package.json
│
├── fastapi_service/               # Python + FastAPI
│   ├── main.py                    # Endpoints: /process, /ask, /summarize, /extract
│   ├── nlp_engine.py              # RAG pipeline + Perplexity AI integration
│   ├── requirements.txt
│   ├── vector_stores/             # Per-user FAISS indexes (auto-created)
│   └── utils/
│       └── file_parser.py         # PDF, DOCX, image extraction
│
├── system_design.txt              # Full system design document
└── README.md                      # This file
```

---

## 🧠 RAG Pipeline

```
Document Text
     │
     ▼
[1] Chunk text (LangChain, 500 chars, 50 overlap)
     │
     ▼
[2] Generate embeddings (HuggingFace all-MiniLM-L6-v2, local CPU)
     │
     ▼
[3] Store in FAISS (per-user vector index, persisted to disk)
     │
     ▼
[4] Retrieve top-k relevant chunks (cosine similarity)
     │
     ▼
[5] Build prompt (context + instructions + audience level)
     │
     ▼
[6] Call Perplexity AI (sonar-pro model)
     │
     ▼
[7] Parse structured JSON response
     │
     ▼
Result (pages / answer / summary / key_points)
```

---

## 🔒 Security

- Firebase JWT verification on all API routes
- API keys stored in `.env` (never committed)
- File upload limits (10MB) with type filtering
- CORS restricted to frontend origins
- Per-user vector store isolation

---

## 🛡️ Error Handling

The app uses **defense-in-depth** error handling — it never crashes:

- **Frontend**: try/catch + toast notifications
- **Backend**: try/catch per route + mock fallbacks
- **FastAPI**: try/except at every level (imports, embeddings, FAISS, API calls, JSON parsing)
- Every failure path returns a graceful fallback response

---

## 📄 API Reference

### Health Check
```
GET /api/health
Response: { status, timestamp, endpoints }
```

### Simplify Document
```
POST /api/simplify
Body (FormData): text, audienceLevel (executive|manager|client|intern), files[]
Response: { success, result: { pages: [{ page_number, title, simplified_text }] } }
```

### Ask Document
```
POST /api/ask
Body (FormData): text, question, files[]
Response: { success, answer, confidence, relevant_excerpt }
```

### Summarize Text
```
POST /api/summarize
Body (JSON): { text }
Response: { success, summary, word_count, key_topics[] }
```

### Extract Key Points
```
POST /api/extract
Body (FormData): text, files[]
Response: { success, key_points: [{ point, importance }], overall_theme, action_items[] }
```

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

**Built with ⚡ by thall** | Powered by Perplexity AI + LangChain + FAISS | [Adaptify AI](https://github.com/Mahaveer369/Adaptify-AI)
