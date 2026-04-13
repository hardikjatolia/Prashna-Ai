import os
import json
import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from huggingface_hub import InferenceClient
from duckduckgo_search import DDGS

# ─── Configuration ────────────────────────────────────────────────
HF_TOKEN  = os.getenv("HF_TOKEN")
MODEL_ID  = "deepseek-ai/DeepSeek-R1"

client = InferenceClient(api_key=HF_TOKEN)

# ─── App ──────────────────────────────────────────────────────────
app = FastAPI(title="Prashna AI API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# ─── Pydantic models ──────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    max_tokens: Optional[int] = 2048
    temperature: Optional[float] = 0.6
    system_prompt: Optional[str] = (
        "You are Prashna AI — a strict, expert teacher exclusively for competitive exam students (JEE, NEET, UPSC, GATE, etc.).\n"
        "TOPIC RESTRICTION (CRITICAL): You MUST ONLY answer questions that are related to academics, education, studying, "
        "science, mathematics, history, geography, polity, economics, competitive exam preparation, and school/college subjects.\n"
        "If the user asks ANYTHING unrelated to studies or academics (e.g., movies, cricket, cooking, relationships, jokes, "
        "coding projects, general chat, weather, news, etc.), you MUST refuse politely with EXACTLY this message:\n"
        "\"🎓 I'm Prashna AI — your dedicated study assistant! I can only help with academic doubts, exam prep, and "
        "study-related questions. Please ask me something related to your studies!\"\n"
        "Do NOT answer off-topic queries under any circumstances, even if the user insists.\n\n"
        "For valid study questions, always structure your response exactly like this:\n"
        "### 📌 Step-by-Step Solution\n"
        "### 🧠 Simple Explanation\n"
        "### 📝 Quick Revision Notes\n"
        "### ⚡ Exam Tips\n"
        "If an image is shared, analyze it carefully (it may be a question paper, diagram, equation, or textbook page) "
        "and answer accordingly."
    )
    web_search: Optional[bool] = False

# ─── Web search ───────────────────────────────────────────────────
SEARCH_TRIGGERS = [
    "latest", "recent", "today", "current", "now", "live",
    "news", "weather", "price", "stock", "score", "result",
    "2024", "2025", "2026", "breaking", "update", "just",
    "who won", "what happened", "when did", "released", "launched",
    "announced", "died", "elected", "discovered", "invented",
    "how much is", "how much does", "what is the price",
    "what is the latest", "what are the latest",
]

def needs_web_search(query: str, force: bool = False) -> bool:
    if force:
        return True
    q = query.lower()
    return any(t in q for t in SEARCH_TRIGGERS)

def do_web_search(query: str, max_results: int = 5) -> List[dict]:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return [
            {"title": r.get("title", ""), "url": r.get("href", ""), "body": r.get("body", "")}
            for r in results
        ]
    except Exception as e:
        print(f"[search error] {e}")
        return []

def build_search_context(results: List[dict]) -> str:
    if not results:
        return ""
    lines = ["[WEB SEARCH RESULTS — use these to answer accurately]\n"]
    for i, r in enumerate(results, 1):
        lines.append(f"[{i}] {r['title']}")
        lines.append(f"URL: {r['url']}")
        lines.append(r["body"])
        lines.append("")
    lines.append("[END OF SEARCH RESULTS]")
    return "\n".join(lines)

def build_llm_messages(req_messages: List[Message], system_content: str) -> List[dict]:
    """Build plain-text messages for DeepSeek-R1."""
    msgs = [{"role": "system", "content": system_content}]
    for msg in req_messages:
        msgs.append({"role": msg.role, "content": msg.content})
    return msgs

# ─── Routes ───────────────────────────────────────────────────────
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream chat completions using DeepSeek-R1."""

    user_messages   = [m for m in req.messages if m.role == "user"]
    latest_user_msg = user_messages[-1].content if user_messages else ""

    should_search = needs_web_search(latest_user_msg, force=req.web_search)

    async def generate():
        search_results = []

        # ── Optional web search ────────────────────────────────────
        if should_search:
            yield f"data: {json.dumps({'searching': True, 'query': latest_user_msg[:80]})}\n\n"
            loop = asyncio.get_event_loop()
            search_results = await loop.run_in_executor(
                None, do_web_search, latest_user_msg, 5
            )
            sources_payload = [{"title": r["title"], "url": r["url"]} for r in search_results]
            yield f"data: {json.dumps({'sources': sources_payload})}\n\n"

        # ── Build system prompt ────────────────────────────────────
        system_content = req.system_prompt or ""
        
        # Unconditionally enforce topic restrictions in the backend (overrides frontend cached settings)
        system_content = (
            "You are Prashna AI — a strict, expert teacher exclusively for competitive exam students (JEE, NEET, UPSC, GATE, etc.).\n"
            "TOPIC RESTRICTION (CRITICAL ENFORCEMENT): You MUST ONLY answer questions related to academics, studying, science, math, history, geography, polity, economics, or exams.\n"
            "If the user asks ANY off-topic question (e.g., movies, jokes, cooking, general chat, weather, programming projects), YOU MUST REPLY EXACTLY WITH:\n"
            "\"🎓 I'm Prashna AI — your dedicated study assistant! I can only help with academic doubts, exam prep, and study-related questions. Please ask me something related to your studies!\"\n"
            "Do NOT provide any other response for off-topic queries.\n\n"
            + system_content
        )

        if search_results:
            system_content = (
                system_content + "\n\n" + build_search_context(search_results) +
                "\n\nIMPORTANT: Use the web search results above to provide an accurate, "
                "up-to-date answer. Cite sources where relevant using [1], [2], etc."
            )
        # ── Build message list ──────
        messages = build_llm_messages(req.messages, system_content)

        # ── Stream LLM response ────────────────────────────────────
        try:
            stream = client.chat.completions.create(
                model=MODEL_ID,
                messages=messages,
                stream=True,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f"data: {json.dumps({'token': delta.content, 'done': False})}\n\n"

            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

        except Exception as e:
            error_msg = str(e)
            print(f"[LLM error] {error_msg}")
            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": MODEL_ID}
