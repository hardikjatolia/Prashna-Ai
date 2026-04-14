import os
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from huggingface_hub import InferenceClient
from duckduckgo_search import DDGS

# ─── Configuration ────────────────────────────────────────────────
load_dotenv()
HF_TOKEN  = os.getenv("HF_TOKEN")
MODEL_ID  = "baidu/ERNIE-4.5-VL-28B-A3B-PT"

client = InferenceClient(api_key=HF_TOKEN)

# ─── App ──────────────────────────────────────────────────────────
app = FastAPI(title="Prashna AI API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic models ──────────────────────────────────────────────
class MessageContent(BaseModel):
    type: str          # "text" or "image_url"
    text: Optional[str] = None
    image_url: Optional[dict] = None  # {"url": "data:image/...;base64,..."}

class Message(BaseModel):
    role: str
    content: str | List[MessageContent]  # str for plain text, list for multipart

class ChatRequest(BaseModel):
    messages: List[Message]
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.3
    system_prompt: Optional[str] = (
        "You are Prashna AI - a strict, expert teacher exclusively for competitive exam students (JEE, NEET, UPSC, GATE, etc.).\n"
        "TOPIC RESTRICTION (CRITICAL): You MUST ONLY answer questions that are related to academics, education, studying, "
        "science, mathematics, history, geography, polity, economics, competitive exam preparation, and school/college subjects.\n"
        "If the user asks ANYTHING unrelated to studies or academics (e.g., movies, cricket, cooking, relationships, jokes, "
        "coding projects, general chat, weather, news, etc.), you MUST refuse politely with EXACTLY this message:\n"
        "\"\ud83c\udf93 I'm Prashna AI - your dedicated study assistant! I can only help with academic doubts, exam prep, and "
        "study-related questions. Please ask me something related to your studies!\"\n"
        "Do NOT answer off-topic queries under any circumstances, even if the user insists.\n\n"
        "CHEMICAL ACCURACY (CRITICAL): For chemistry questions, ensure ALL chemical formulas, equations, and structures are 100% accurate. "
        "Benzyne is C6H4 (not C6H2), verify all molecular formulas, reaction mechanisms, and stoichiometry. "
        "Double-check organic chemistry structures and inorganic compounds.\n\n"
        "CHEMICAL EQUATION FORMATTING: Always write chemical equations in proper LaTeX format with clear compound labels. "
        "Example: \\[ \\text{C}_6\\text{H}_5\\text{Cl} + \\text{NaNH}_2 \\rightarrow \\text{C}_6\\text{H}_4\\text{(benzyne)} + \\text{NaCl} + \\text{NH}_3 \\]\n\n"
        "For valid study questions, always structure your response exactly like this:\n"
        "### \ud83d\udccc Step-by-Step Solution\n"
        "### \ud83e\udde0 Simple Explanation\n"
        "### \ud83d\udcdd Quick Revision Notes\n"
        "### \u26a1 Exam Tips\n"
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
    """Build messages for Gemma 4 (supports multipart image+text content)."""
    msgs = [{"role": "system", "content": system_content}]
    for msg in req_messages:
        if isinstance(msg.content, list):
            # Multipart content (text + image)
            parts = []
            for part in msg.content:
                if part.type == "text" and part.text:
                    parts.append({"type": "text", "text": part.text})
                elif part.type == "image_url" and part.image_url:
                    parts.append({"type": "image_url", "image_url": part.image_url})
            msgs.append({"role": msg.role, "content": parts})
        else:
            msgs.append({"role": msg.role, "content": msg.content})
    return msgs

# ─── Routes ───────────────────────────────────────────────────────

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream chat completions using DeepSeek-R1."""

    user_messages   = [m for m in req.messages if m.role == "user"]
    last_msg = user_messages[-1].content if user_messages else ""
    # Extract plain text for search/logging (ignore image parts)
    if isinstance(last_msg, list):
        latest_user_msg = " ".join(p.text for p in last_msg if p.type == "text" and p.text)
    else:
        latest_user_msg = last_msg

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
                if not hasattr(chunk, "choices") or not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
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
