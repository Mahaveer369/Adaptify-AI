"""
NLP Engine — Perplexity AI + LangChain + FAISS RAG Pipeline

Flow:
1. User uploads text / PDF / DOCX / image → text is extracted
2. Text is chunked via LangChain RecursiveCharacterTextSplitter
3. Chunks are embedded (all-MiniLM-L6-v2) and stored in a FAISS vector store
4. For each page, relevant chunks are retrieved from FAISS
5. Perplexity AI (sonar-pro) generates simplified output using those chunks as context
"""

import os
import re
import json
import asyncio
import sys
import traceback
from pathlib import Path
from typing import Optional

# Fix Windows console encoding for emoji/unicode in log messages
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from dotenv import load_dotenv

load_dotenv()

# ─── Imports with try/except guards ─────────────────────────────────────────

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    HAS_LANGCHAIN = True
    print("✅ LangChain text splitters loaded")
except ImportError as e:
    HAS_LANGCHAIN = False
    print(f"⚠️  LangChain text splitters unavailable: {e}")

try:
    from langchain_community.vectorstores import FAISS
    HAS_FAISS = True
    print("✅ FAISS vector store loaded")
except ImportError as e:
    HAS_FAISS = False
    print(f"⚠️  FAISS unavailable: {e}")

try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    HAS_EMBEDDINGS = True
    print("✅ HuggingFace embeddings loaded")
except ImportError as e:
    HAS_EMBEDDINGS = False
    print(f"⚠️  HuggingFace embeddings unavailable: {e}")

try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
    print("✅ OpenAI client loaded (for Perplexity)")
except ImportError as e:
    HAS_OPENAI = False
    print(f"⚠️  OpenAI client unavailable: {e}")

# ─── Config ──────────────────────────────────────────────────────────────────

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
VECTOR_STORE_DIR = Path(__file__).parent / "vector_stores"

try:
    VECTOR_STORE_DIR.mkdir(exist_ok=True)
    print(f"✅ Vector store directory: {VECTOR_STORE_DIR}")
except Exception as e:
    print(f"⚠️  Could not create vector store directory: {e}")

# ─── Embedding Model (lazy-loaded singleton) ────────────────────────────────

_embeddings = None
_embeddings_init_attempted = False


def get_embeddings():
    """Lazy-load the embedding model. Returns None if unavailable."""
    global _embeddings, _embeddings_init_attempted

    if _embeddings is not None:
        return _embeddings

    if _embeddings_init_attempted:
        return None  # Already tried and failed, don't retry

    _embeddings_init_attempted = True

    if not HAS_EMBEDDINGS:
        print("⚠️  Skipping embeddings — HuggingFaceEmbeddings not installed")
        return None

    try:
        print("🔄 Loading embedding model (all-MiniLM-L6-v2)... this may take a moment on first run")
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        print("✅ Embedding model loaded successfully")
        return _embeddings
    except Exception as e:
        print(f"❌ Failed to load embedding model: {e}")
        traceback.print_exc()
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# TEXT CHUNKING
# ═══════════════════════════════════════════════════════════════════════════════

def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    """
    Split text into overlapping chunks using LangChain splitter.
    Falls back to simple splitting if LangChain is unavailable.
    """
    if not text or not text.strip():
        print("⚠️  chunk_text: Empty text received, returning empty list")
        return []

    try:
        if HAS_LANGCHAIN:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            chunks = splitter.split_text(text)
            print(f"✅ Text chunked into {len(chunks)} chunks (LangChain)")
            return chunks
        else:
            # Fallback: simple paragraph-based splitting
            print("⚠️  Using fallback chunking (no LangChain)")
            paragraphs = text.split("\n\n")
            chunks = []
            current = ""
            for para in paragraphs:
                if len(current) + len(para) > chunk_size and current:
                    chunks.append(current.strip())
                    current = para
                else:
                    current += "\n\n" + para if current else para
            if current.strip():
                chunks.append(current.strip())
            print(f"✅ Text chunked into {len(chunks)} chunks (fallback)")
            return chunks if chunks else [text]

    except Exception as e:
        print(f"❌ Error during text chunking: {e}")
        traceback.print_exc()
        # Last resort: return entire text as one chunk
        return [text]


def segment_pages(text: str, max_chars_per_page: int = 3000) -> list[str]:
    """Split text into page-sized segments for display output."""
    if not text or not text.strip():
        return [text or ""]

    try:
        pages = re.split(r'\n\s*---\s*\n|\f|\n\s*Page\s+\d+\s*\n', text, flags=re.IGNORECASE)
        pages = [p.strip() for p in pages if p.strip()]
        if len(pages) > 1:
            return pages

        paragraphs = text.split('\n\n')
        pages = []
        current = ""
        for para in paragraphs:
            if len(current) + len(para) > max_chars_per_page and current:
                pages.append(current.strip())
                current = para
            else:
                current += "\n\n" + para if current else para
        if current.strip():
            pages.append(current.strip())
        return pages if pages else [text]

    except Exception as e:
        print(f"❌ Error during page segmentation: {e}")
        return [text]


# ═══════════════════════════════════════════════════════════════════════════════
# FAISS VECTOR STORE
# ═══════════════════════════════════════════════════════════════════════════════

def build_vector_store(text: str, user_id: str = "default") -> Optional[object]:
    """
    Chunk the text, embed it, and store in FAISS.
    Returns the vector store object, or None if anything fails.
    """
    if not HAS_FAISS:
        print("⚠️  build_vector_store: FAISS not available, skipping")
        return None

    embeddings = get_embeddings()
    if embeddings is None:
        print("⚠️  build_vector_store: No embedding model, skipping vector store")
        return None

    try:
        # Step 1: Chunk the text
        chunks = chunk_text(text)
        if not chunks:
            print("⚠️  build_vector_store: No chunks produced from text")
            return None

        print(f"📦 Building FAISS index with {len(chunks)} chunks for user '{user_id}'...")

        # Step 2: Create FAISS index from chunks
        try:
            vector_store = FAISS.from_texts(chunks, embeddings)
            print(f"✅ FAISS index built successfully ({len(chunks)} vectors)")
        except Exception as e:
            print(f"❌ Failed to create FAISS index from texts: {e}")
            traceback.print_exc()
            return None

        # Step 3: Persist to disk (per-user)
        try:
            # Sanitize user_id for filesystem safety
            safe_user_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', user_id)
            store_path = VECTOR_STORE_DIR / safe_user_id
            vector_store.save_local(str(store_path))
            print(f"💾 FAISS index saved to {store_path}")
        except Exception as e:
            print(f"⚠️  Could not persist FAISS index to disk (still usable in memory): {e}")
            # Non-fatal — we can still use the in-memory store

        return vector_store

    except Exception as e:
        print(f"❌ Unexpected error building vector store: {e}")
        traceback.print_exc()
        return None


def load_vector_store(user_id: str = "default") -> Optional[object]:
    """Load an existing FAISS store for a user from disk."""
    if not HAS_FAISS:
        return None

    embeddings = get_embeddings()
    if embeddings is None:
        return None

    try:
        safe_user_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', user_id)
        store_path = VECTOR_STORE_DIR / safe_user_id
        if not store_path.exists():
            print(f"ℹ️  No stored FAISS index for user '{user_id}'")
            return None

        vector_store = FAISS.load_local(
            str(store_path), embeddings,
            allow_dangerous_deserialization=True
        )
        print(f"✅ Loaded FAISS index from {store_path}")
        return vector_store
    except Exception as e:
        print(f"❌ Failed to load FAISS store for user '{user_id}': {e}")
        traceback.print_exc()
        return None


def retrieve_context(vector_store, query: str, k: int = 4) -> str:
    """Retrieve the top-k most relevant chunks from FAISS for a given query."""
    if vector_store is None:
        return ""

    try:
        docs = vector_store.similarity_search(query, k=k)
        context = "\n\n---\n\n".join([doc.page_content for doc in docs])
        print(f"🔍 Retrieved {len(docs)} relevant chunks from FAISS")
        return context
    except Exception as e:
        print(f"❌ FAISS retrieval error: {e}")
        traceback.print_exc()
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
# PERPLEXITY AI
# ═══════════════════════════════════════════════════════════════════════════════

def get_audience_instructions(audience: str) -> str:
    audiences = {
        "executive": "Use very concise, high-level business language. Focus on ROI, strategic impact, and bottom-line results.",
        "manager": "Use clear, simple English (Grade 6 level). Focus on project progress, team impact, and actionable items.",
        "client": "Use professional but very simple language. Focus on deliverables, timelines, and value provided.",
        "intern": "Use the simplest possible language. Explain every concept as if the reader has no technical background."
    }
    return audiences.get(audience.lower(), audiences["manager"])


def build_simplification_prompt(page_text: str, context: str, page_number: int, audience: str) -> str:
    """Build the Perplexity prompt with RAG context."""
    audience_instructions = get_audience_instructions(audience)

    context_block = ""
    if context:
        context_block = f"""

Here is additional relevant context retrieved from the document:
---
{context[:2000]}
---
"""

    return f"""You are an expert business communication assistant.

Task:
Convert the following technical project update into a simplified executive summary.

Audience: {audience.capitalize()}
{audience_instructions}
{context_block}
Rules:
- Use very simple English (Grade 6 level).
- Avoid technical jargon.
- Explain in a way that the target audience can understand.
- Keep structure aligned with original content.
- Provide a short heading for this section.
- Add a brief explanation of key impact.
- Suggest a relevant image idea for this section.
- Output format must be valid JSON:

{{
  "page_number": {page_number},
  "title": "...",
  "simplified_text": "...",
  "image_prompt": "..."
}}

Content to simplify:
---
{page_text}
---

Respond ONLY with the JSON object, no other text."""


async def call_perplexity(prompt: str, system_msg: str = "") -> str:
    """Call Perplexity AI using its OpenAI-compatible API. Returns raw response text."""
    if not HAS_OPENAI:
        print("❌ call_perplexity: openai library not available")
        return ""

    if not PERPLEXITY_API_KEY or PERPLEXITY_API_KEY == "your_perplexity_api_key_here":
        print("⚠️  call_perplexity: No valid Perplexity API key set")
        return ""

    try:
        client = AsyncOpenAI(
            api_key=PERPLEXITY_API_KEY,
            base_url="https://api.perplexity.ai"
        )

        messages = []
        if system_msg:
            messages.append({"role": "system", "content": system_msg})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            model="sonar-pro",
            messages=messages,
            temperature=0.5,
            max_tokens=2000,
        )
        result = response.choices[0].message.content.strip()
        print(f"✅ Perplexity API returned {len(result)} chars")
        return result

    except Exception as e:
        print(f"❌ Perplexity API error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return ""


def parse_llm_json(raw: str, page_number: int) -> dict:
    """Parse JSON from LLM response, handling markdown fences and edge cases."""
    if not raw:
        return {}

    try:
        # Remove markdown code fences if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)

        result = json.loads(cleaned)
        result["page_number"] = page_number
        return result

    except json.JSONDecodeError as e:
        print(f"⚠️  JSON parse failed for page {page_number}: {e}")
        # Try to extract JSON from mixed text
        try:
            json_match = re.search(r'\{[\s\S]*?\}', raw)
            if json_match:
                result = json.loads(json_match.group())
                result["page_number"] = page_number
                return result
        except Exception:
            pass

        # Return raw text as simplified_text
        return {
            "page_number": page_number,
            "title": f"Section {page_number}",
            "simplified_text": raw[:1500],
            "image_prompt": "A simple infographic summarizing the key points"
        }

    except Exception as e:
        print(f"❌ Unexpected error parsing LLM JSON: {e}")
        return {
            "page_number": page_number,
            "title": f"Section {page_number}",
            "simplified_text": raw[:1500] if raw else "Processing error occurred.",
            "image_prompt": "A simple infographic summarizing the key points"
        }


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK FALLBACK
# ═══════════════════════════════════════════════════════════════════════════════

def generate_mock_response(page_text: str, page_number: int, audience: str) -> dict:
    """Generate a mock simplified response when API is unavailable."""
    try:
        lines = page_text.strip().split('\n')
        title_line = lines[0] if lines else "Section Summary"
        title = re.sub(r'^[#\-*>\d.]+\s*', '', title_line)[:80]
        if not title:
            title = f"Section {page_number} Summary"

        sentences = re.split(r'[.!?]+', page_text)
        key_sentences = [s.strip() for s in sentences[:5] if len(s.strip()) > 20]
        simplified = "Here's what this section is about in simple terms:\n\n"
        for sent in key_sentences:
            simplified += f"• {sent}.\n"
        if not key_sentences:
            simplified += f"• {page_text[:300]}...\n"
        simplified += f"\n📌 This section is written for a {audience} audience."

        return {
            "page_number": page_number,
            "title": title,
            "simplified_text": simplified,
            "image_prompt": "A team collaboration infographic showing project milestones"
        }
    except Exception as e:
        print(f"❌ Even mock response failed: {e}")
        return {
            "page_number": page_number,
            "title": f"Section {page_number}",
            "simplified_text": "Could not process this section.",
            "image_prompt": "A generic business infographic"
        }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

async def simplify_page(page_text: str, page_number: int, audience: str,
                        vector_store=None) -> dict:
    """Simplify a single page using RAG context + Perplexity AI."""
    try:
        # 1. Retrieve relevant context from the FAISS vector store
        context = ""
        if vector_store is not None:
            try:
                context = retrieve_context(vector_store, page_text, k=4)
            except Exception as e:
                print(f"⚠️  Context retrieval failed for page {page_number}: {e}")
                context = ""

        # 2. Build prompt with context
        prompt = build_simplification_prompt(page_text, context, page_number, audience)
        system_msg = "You are a helpful assistant that simplifies technical documents. Always respond with valid JSON only."

        # 3. Call Perplexity AI
        raw_response = await call_perplexity(prompt, system_msg)

        if raw_response:
            result = parse_llm_json(raw_response, page_number)
            if result and "simplified_text" in result:
                return result

        # 4. Fallback to mock
        print(f"⚠️  Using mock response for page {page_number}")
        return generate_mock_response(page_text, page_number, audience)

    except Exception as e:
        print(f"❌ Unexpected error simplifying page {page_number}: {e}")
        traceback.print_exc()
        return generate_mock_response(page_text, page_number, audience)


async def process_document(text: str, audience: str = "manager",
                           user_id: str = "default") -> dict:
    """
    Full RAG pipeline:
    1. Chunk text → FAISS vector store
    2. Segment text into pages
    3. For each page, retrieve context + call Perplexity AI
    4. Return structured JSON
    """
    print(f"\n{'='*60}")
    print(f"📝 Processing document for user '{user_id}' (audience: {audience})")
    print(f"   Input length: {len(text)} chars")
    print(f"{'='*60}")

    # Step 1: Build vector store from the full document
    vector_store = None
    try:
        vector_store = build_vector_store(text, user_id)
        if vector_store:
            print("✅ Vector store ready for RAG retrieval")
        else:
            print("⚠️  Vector store unavailable — proceeding without RAG context")
    except Exception as e:
        print(f"❌ Vector store build failed: {e}")
        traceback.print_exc()

    # Step 2: Segment into display pages
    try:
        pages = segment_pages(text)
        print(f"📄 Document segmented into {len(pages)} pages")
    except Exception as e:
        print(f"❌ Page segmentation failed: {e}")
        pages = [text]

    # Step 3: Simplify each page concurrently
    try:
        tasks = [
            simplify_page(page, i + 1, audience, vector_store)
            for i, page in enumerate(pages)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions in results
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"❌ Page {i+1} processing raised exception: {result}")
                final_results.append(generate_mock_response(pages[i], i + 1, audience))
            else:
                final_results.append(result)

        print(f"\n✅ Processing complete: {len(final_results)} pages simplified")
        return {"pages": final_results}

    except Exception as e:
        print(f"❌ Critical error during document processing: {e}")
        traceback.print_exc()
        # Emergency fallback
        return {
            "pages": [
                generate_mock_response(pages[i] if i < len(pages) else text, i + 1, audience)
                for i in range(len(pages))
            ]
        }


# ═══════════════════════════════════════════════════════════════════════════════
# ASK DOCUMENT (Q&A from uploaded document)
# ═══════════════════════════════════════════════════════════════════════════════

async def ask_document(text: str, question: str, user_id: str = "default") -> dict:
    """
    RAG Q&A: chunk document → FAISS → retrieve relevant context → Perplexity answers.
    """
    print(f"\n{'='*60}")
    print(f"[ASK] Question: {question[:80]}...")
    print(f"      Document length: {len(text)} chars, user: {user_id}")
    print(f"{'='*60}")

    try:
        # Build vector store from document
        vector_store = None
        try:
            vector_store = build_vector_store(text, user_id)
        except Exception as e:
            print(f"[ASK] Vector store build failed: {e}")

        # Retrieve relevant context
        context = ""
        if vector_store:
            try:
                context = retrieve_context(vector_store, question, k=5)
            except Exception as e:
                print(f"[ASK] Context retrieval failed: {e}")

        # Build prompt
        context_block = ""
        if context:
            context_block = f"""
Here is the relevant context from the uploaded document:
---
{context[:3000]}
---
"""
        elif text:
            context_block = f"""
Here is the document content:
---
{text[:3000]}
---
"""

        prompt = f"""You are an intelligent document assistant.

The user has uploaded a document and is asking a question about it.
{context_block}
User's Question: {question}

Instructions:
- Answer the question based ONLY on the document content provided above.
- If the answer is not in the document, say so clearly.
- Be concise but thorough.
- Use simple, clear language.

Respond with a JSON object:
{{
  "answer": "your detailed answer here",
  "confidence": "high/medium/low",
  "relevant_excerpt": "brief quote from the document that supports your answer"
}}

Respond ONLY with the JSON object."""

        system_msg = "You are a helpful document Q&A assistant. Always respond with valid JSON only."
        raw = await call_perplexity(prompt, system_msg)

        if raw:
            result = parse_llm_json(raw, 1)
            if result and "answer" in result:
                return {"success": True, **result}

            # If JSON parse gave us simplified_text instead of answer
            if result and "simplified_text" in result:
                return {
                    "success": True,
                    "answer": result["simplified_text"],
                    "confidence": "medium",
                    "relevant_excerpt": ""
                }

        # Fallback
        return {
            "success": True,
            "answer": f"Based on the document, here is what I found related to your question:\n\n{text[:500]}...\n\n(Note: AI service returned no structured answer, showing document excerpt instead.)",
            "confidence": "low",
            "relevant_excerpt": text[:200]
        }

    except Exception as e:
        print(f"[ASK] Critical error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "answer": f"An error occurred while processing your question: {str(e)}",
            "confidence": "low",
            "relevant_excerpt": ""
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARIZE TEXT (quick single-paragraph summary)
# ═══════════════════════════════════════════════════════════════════════════════

async def summarize_text(text: str) -> dict:
    """Generate a concise one-paragraph summary via Perplexity."""
    print(f"\n{'='*60}")
    print(f"[SUMMARIZE] Input length: {len(text)} chars")
    print(f"{'='*60}")

    try:
        prompt = f"""You are a summarization expert.

Summarize the following text into a clear, concise paragraph (3-5 sentences).
Focus on the most important points.

Text:
---
{text[:4000]}
---

Respond with a JSON object:
{{
  "summary": "your concise summary paragraph here",
  "word_count": <number of words in the summary>,
  "key_topics": ["topic1", "topic2", "topic3"]
}}

Respond ONLY with the JSON object."""

        system_msg = "You are a summarization assistant. Always respond with valid JSON only."
        raw = await call_perplexity(prompt, system_msg)

        if raw:
            result = parse_llm_json(raw, 1)
            if result and "summary" in result:
                return {"success": True, **result}
            if result and "simplified_text" in result:
                return {
                    "success": True,
                    "summary": result["simplified_text"],
                    "word_count": len(result["simplified_text"].split()),
                    "key_topics": []
                }

        # Fallback
        sentences = re.split(r'[.!?]+', text)
        key = [s.strip() for s in sentences[:3] if len(s.strip()) > 15]
        fallback = ". ".join(key) + "." if key else text[:300]
        return {
            "success": True,
            "summary": fallback,
            "word_count": len(fallback.split()),
            "key_topics": []
        }

    except Exception as e:
        print(f"[SUMMARIZE] Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "summary": f"Summarization failed: {str(e)}",
            "word_count": 0,
            "key_topics": []
        }


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACT KEY POINTS (bullet-point extraction)
# ═══════════════════════════════════════════════════════════════════════════════

async def extract_key_points(text: str, user_id: str = "default") -> dict:
    """Extract structured key points/takeaways from a document via Perplexity."""
    print(f"\n{'='*60}")
    print(f"[EXTRACT] Input length: {len(text)} chars, user: {user_id}")
    print(f"{'='*60}")

    try:
        # Build vector store for context
        vector_store = None
        try:
            vector_store = build_vector_store(text, user_id)
        except Exception as e:
            print(f"[EXTRACT] Vector store failed: {e}")

        # Use full text (up to limit) for extraction
        doc_text = text[:5000]

        prompt = f"""You are an expert analyst.

Extract the key points and takeaways from the following document.

Document:
---
{doc_text}
---

Respond with a JSON object:
{{
  "key_points": [
    {{"point": "First key point", "importance": "high/medium/low"}},
    {{"point": "Second key point", "importance": "high/medium/low"}}
  ],
  "overall_theme": "One sentence describing the main theme",
  "action_items": ["action 1", "action 2"]
}}

Extract 5-10 key points. Respond ONLY with the JSON object."""

        system_msg = "You are a document analysis assistant. Always respond with valid JSON only."
        raw = await call_perplexity(prompt, system_msg)

        if raw:
            result = parse_llm_json(raw, 1)
            if result and "key_points" in result:
                return {"success": True, **result}

        # Fallback: simple sentence extraction
        sentences = re.split(r'[.!?]+', text)
        points = [{"point": s.strip(), "importance": "medium"}
                  for s in sentences[:7] if len(s.strip()) > 20]
        return {
            "success": True,
            "key_points": points if points else [{"point": text[:200], "importance": "medium"}],
            "overall_theme": "Document analysis",
            "action_items": []
        }

    except Exception as e:
        print(f"[EXTRACT] Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "key_points": [],
            "overall_theme": f"Error: {str(e)}",
            "action_items": []
        }
