import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from nlp_engine import process_document, ask_document, summarize_text, extract_key_points

load_dotenv()

app = FastAPI(title="Technical Briefing Simplifier - NLP Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    text: str
    audience_level: Optional[str] = "manager"
    user_id: Optional[str] = "default"

class AskRequest(BaseModel):
    text: str
    question: str
    user_id: Optional[str] = "default"

class SummarizeRequest(BaseModel):
    text: str

class ExtractRequest(BaseModel):
    text: str
    user_id: Optional[str] = "default"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "nlp-engine",
        "version": "3.0.0",
        "model": "perplexity-sonar-pro",
        "endpoints": ["/process", "/ask", "/summarize", "/extract"]
    }


@app.post("/process")
async def process_text_endpoint(request: ProcessRequest):
    """Simplify a document into page-by-page summaries."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    try:
        result = await process_document(
            text=request.text,
            audience=request.audience_level,
            user_id=request.user_id or "default"
        )
        return result
    except Exception as e:
        print(f"[/process] Error: {e}")
        return {
            "pages": [{
                "page_number": 1,
                "title": "Summary",
                "simplified_text": f"Processing error. Document excerpt:\n\n{request.text[:500]}",
                "image_prompt": "An error notification icon"
            }]
        }


@app.post("/ask")
async def ask_endpoint(request: AskRequest):
    """Ask a question about an uploaded document (RAG Q&A)."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No document text provided")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="No question provided")
    try:
        result = await ask_document(
            text=request.text,
            question=request.question,
            user_id=request.user_id or "default"
        )
        return result
    except Exception as e:
        print(f"[/ask] Error: {e}")
        return {"success": False, "answer": f"Error: {str(e)}", "confidence": "low", "relevant_excerpt": ""}


@app.post("/summarize")
async def summarize_endpoint(request: SummarizeRequest):
    """Summarize text into a concise paragraph."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    try:
        result = await summarize_text(text=request.text)
        return result
    except Exception as e:
        print(f"[/summarize] Error: {e}")
        return {"success": False, "summary": f"Error: {str(e)}", "word_count": 0, "key_topics": []}


@app.post("/extract")
async def extract_endpoint(request: ExtractRequest):
    """Extract key points from a document."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    try:
        result = await extract_key_points(
            text=request.text,
            user_id=request.user_id or "default"
        )
        return result
    except Exception as e:
        print(f"[/extract] Error: {e}")
        return {"success": False, "key_points": [], "overall_theme": f"Error: {str(e)}", "action_items": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
