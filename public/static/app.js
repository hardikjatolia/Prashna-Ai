/* ══════════════════════════════════════════════════════════
   ThinkAI — App Logic
   ══════════════════════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────
const STREAM_URL  = '/api/chat/stream';
const CHATS_KEY   = 'prashna_chats';
const SETT_KEY    = 'prashna_settings_v2';
const THEME_KEY   = 'prashna_theme';

const DEFAULTS = {
  systemPrompt : `You are Prashna AI — a strict expert teacher exclusively for JEE, NEET, UPSC, GATE & other competitive exam students.
TOPIC RESTRICTION (CRITICAL): You MUST ONLY answer questions related to academics, education, studying, science, maths, history, geography, polity, economics, competitive exam prep, and school/college subjects.
If someone asks ANYTHING unrelated to studies (movies, cricket, cooking, relationships, jokes, weather, news, etc.) refuse with:
"🎓 I'm Prashna AI — your dedicated study assistant! I can only help with academic doubts, exam prep, and study-related questions. Please ask me something related to your studies!"
Do NOT deviate under any circumstances.

OUTPUT FORMAT (for valid study questions):
### 📌 Step-by-Step Solution
[Detailed step-by-step, do not skip steps]
### 🧠 Simple Explanation
[Very easy explanation, assume beginner]
### 📝 Quick Revision Notes
[Bullet points]
### ⚡ Exam Tips
[Shortcuts / mistakes / tips]

If an image is shared, analyze it carefully (question paper, diagram, equation, textbook page) and answer accordingly.
Rules: Never skip steps. Focus on intuition. Add memory tricks. Support 'Explain Like I'm 10', 'Only Revision Mode', and 'Test Me' if asked.`,
  maxTokens    : 4096,
  temperature  : 0.5,
  userName     : 'Student',
};

// ── State ─────────────────────────────────────────────────
let chats    = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');
let cfg      = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETT_KEY) || '{}') };
let activeChatId  = null;
let abortCtrl     = null;
let webSearchOn   = false;   // manual web search toggle
let pendingImageB64 = null;  // base64 data-url of image to send


// ── Suggestion pools ───────────────────────────────────────
const POOLS = [
  [
    { icon:'⚛️', text:'Explain Physics concept',    prompt:'Explain the concept of moment of inertia like I\'m 10.' },
    { icon:'➗', text:'Solve Math problem',         prompt:'Solve this step-by-step: ∫ x^2 e^x dx.' },
    { icon:'🧬', text:'Biology revision notes',     prompt:'Only Revision Mode: Important points for Human Physiology.' },
    { icon:'📅', text:'Create study timetable',     prompt:'Create a 30-day study plan for JEE Main physics.' },
  ],
  [
    { icon:'🔥', text:'Tricks & Shortcuts',         prompt:'Give me a memory trick to remember the Periodic Table.' },
    { icon:'📝', text:'Test Me on a concept',       prompt:'Test Me on Newton\'s Laws of Motion.' },
    { icon:'🤔', text:'Simplify a topic',           prompt:'I am confused about hybridization in Chemistry, can you simplify it?' },
    { icon:'📖', text:'UPSC Prep advice',           prompt:'What are the most important topics in Indian Polity for UPSC?' },
  ]
];
let poolIdx = 0;

// ── DOM refs ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const body        = document.body;
const htmlEl      = document.documentElement;
const messagesEl  = $('messages');
const welcomeEl   = $('welcome');
const inputEl     = $('userInput');
const sendBtn     = $('sendBtn');
const sendIcon    = $('sendIcon');
const stopIcon    = $('stopIcon');
const chatListEl  = $('chatList');
const topbarTitle = $('topbarTitle');
const userAvatar  = $('userAvatar');
const welcomeTitle= $('welcomeTitle');

// ── Utils ──────────────────────────────────────────────────
const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const now    = () => new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
const esc    = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const saveChats = () => {
  // Strip image_url parts before writing to localStorage (quota protection)
  const clean = chats.map(chat => ({
    ...chat,
    messages: chat.messages.map(m => ({
      ...m,
      image: null,
      content: Array.isArray(m.content)
        ? m.content.filter(p => p.type !== 'image_url')
        : m.content,
    })),
  }));
  localStorage.setItem(CHATS_KEY, JSON.stringify(clean));
};
const saveCfg   = () => localStorage.setItem(SETT_KEY,  JSON.stringify(cfg));
const getChat   = id => chats.find(c => c.id === id);

// ── Markdown ───────────────────────────────────────────────
function md(text) {
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const safe = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div style="position:relative"><button class="copy-code" onclick="copyCode(this)">Copy</button><pre><code>${safe}</code></pre></div>`;
  });
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  text = text.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  text = text.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (!p || /^<[hup]/.test(p)) return p;
    return `<p>${p}</p>`;
  }).join('');
  text = text.replace(/([^>])\n([^<])/g, '$1<br>$2');
  return text;
}
window.copyCode = btn => {
  const code = btn.nextElementSibling?.querySelector('code') || btn.nextElementSibling;
  navigator.clipboard.writeText(code?.innerText || '').then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1800);
  });
};

// ── Think tag parser ───────────────────────────────────────
function parseThink(raw) {
  const m = raw.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/i);
  if (m) return { thinking: m[1].trim(), answer: m[2].trim() };
  if (raw.startsWith('<think>')) return { thinking: raw.slice(7).trim(), answer: '' };
  return { thinking: null, answer: raw };
}
const wc = s => s.trim().split(/\s+/).length;

// ── Greeting ───────────────────────────────────────────────
function updateGreeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  welcomeTitle.textContent = `Good ${part}, ${cfg.userName}`;
  userAvatar.textContent = (cfg.userName || 'U')[0].toUpperCase();
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme(t) {
  htmlEl.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  const sunIcon  = document.querySelector('.icon-sun');
  const moonIcon = document.querySelector('.icon-moon');
  if (t === 'dark') { sunIcon.style.display = 'none'; moonIcon.style.display = 'block'; }
  else               { sunIcon.style.display = 'block'; moonIcon.style.display = 'none'; }
}
$('themeToggle').addEventListener('click', () => {
  applyTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ── Suggestions ────────────────────────────────────────────
function renderSuggestions() {
  const el = $('suggestions');
  el.innerHTML = '';
  POOLS[poolIdx % POOLS.length].forEach(item => {
    const btn = document.createElement('button');
    btn.className = 's-card';
    btn.innerHTML = `<span class="s-icon">${item.icon}</span><span class="s-text">${esc(item.text)}</span>`;
    btn.addEventListener('click', () => {
      inputEl.value = item.prompt;
      autoResize();
      sendBtn.disabled = false;
      inputEl.focus();
    });
    el.appendChild(btn);
  });
}
$('refreshBtn').addEventListener('click', () => {
  poolIdx++;
  renderSuggestions();
});

// ── Chat list ──────────────────────────────────────────────
function renderChatList(filter = '') {
  chatListEl.innerHTML = '';
  const list = filter ? chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase())) : chats;
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'chat-empty';
    p.textContent = filter ? 'No results' : 'No conversations yet';
    chatListEl.appendChild(p);
    return;
  }
  list.forEach(chat => {
    const btn = document.createElement('button');
    btn.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    btn.title = chat.title;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>${esc(chat.title)}</span>`;
    btn.addEventListener('click', () => { switchChat(chat.id); closeSidebar(); });
    chatListEl.appendChild(btn);
  });
}

// ── Chat ops ───────────────────────────────────────────────
function newChat() {
  const chat = { id: uid(), title: 'New Chat', messages: [], createdAt: Date.now() };
  chats.unshift(chat);
  saveChats();
  return chat;
}
function switchChat(id) {
  activeChatId = id;
  const chat = getChat(id);
  topbarTitle.textContent = chat.title;
  renderMessages(chat.messages);
  renderChatList();
}
function startNew() {
  activeChatId = null;
  topbarTitle.textContent = 'New Conversation';
  messagesEl.innerHTML = '';
  messagesEl.appendChild(welcomeEl);
  welcomeEl.style.display = 'flex';
  renderChatList();
}

// ── Render messages ────────────────────────────────────────
function renderMessages(msgs) {
  messagesEl.innerHTML = '';
  welcomeEl.style.display = 'none';
  msgs.forEach(m => addMsg(m.role, m.content, m.time, false, m.image));
  scrollDown();
}

function addMsg(role, content, time, streaming = false, imageDataUrl = null) {
  // imageDataUrl: base64 data-url string if an image was attached by the user
  welcomeEl.style.display = 'none';

  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user' : 'ai'}`;

  // Avatar
  const av = document.createElement('div');
  av.className = role === 'user' ? 'msg-av u' : 'msg-av a';
  if (role === 'user') {
    av.textContent = (cfg.userName || 'U')[0].toUpperCase();
  } else {
    av.innerHTML = `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="rgba(255,255,255,.2)"/><path d="M6.5 10a3.5 3.5 0 0 1 7 0" stroke="white" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="10" cy="10" r="2" fill="white"/></svg>`;
  }

  const col = document.createElement('div');
  col.className = 'msg-col';

  // Think block (AI only, always collapsed initially)
  let thinkBlock = null, thinkBody = null;
  if (role === 'assistant') {
    thinkBlock = document.createElement('div');
    thinkBlock.className = 'think-block';

    const thinkBtn = document.createElement('button');
    thinkBtn.className = 'think-btn collapsed';
    thinkBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> Thinking…`;

    thinkBody = document.createElement('div');
    thinkBody.className = 'think-body hidden';

    thinkBtn.addEventListener('click', () => {
      const hidden = thinkBody.classList.toggle('hidden');
      thinkBtn.classList.toggle('collapsed', hidden);
      thinkBtn._open = !hidden;
    });

    thinkBlock.appendChild(thinkBtn);
    thinkBlock.appendChild(thinkBody);
    col.appendChild(thinkBlock);
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Render attached image inside user bubble
  if (imageDataUrl && role === 'user') {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'msg-img-wrap';
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.className = 'msg-img';
    img.alt = 'Attached image';
    imgWrap.appendChild(img);
    bubble.appendChild(imgWrap);
  }


  if (!streaming) {
    if (role === 'assistant') {
      const p = parseThink(content);
      if (p.thinking) {
        thinkBlock.style.display = 'block';
        thinkBody.textContent = p.thinking;
        const btn = thinkBlock.querySelector('.think-btn');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> Reasoning (${wc(p.thinking)} words)`;
        btn.classList.add('collapsed');
        thinkBody.classList.add('hidden');
      }
      bubble.innerHTML = md(p.answer || content);
    } else {
      if (content) {
        const textNode = document.createElement('p');
        textNode.style.margin = '0';
        textNode.textContent = content;
        bubble.appendChild(textNode);
      }
    }
  } else {
    // For streaming messages, initialize empty content
    if (role === 'assistant') {
      bubble.innerHTML = '';
    }
  }

  // Meta
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const tEl = document.createElement('span');
  tEl.className = 'msg-time';
  tEl.textContent = time || now();
  const cBtn = document.createElement('button');
  cBtn.className = 'copy-msg';
  cBtn.textContent = 'Copy';
  cBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(role === 'user' ? content : bubble.innerText).then(() => {
      cBtn.textContent = 'Copied!';
      setTimeout(() => cBtn.textContent = 'Copy', 1800);
    });
  });
  meta.appendChild(tEl);
  meta.appendChild(cBtn);

  col.appendChild(bubble);
  col.appendChild(meta);
  row.appendChild(av);
  row.appendChild(col);
  messagesEl.appendChild(row);
  scrollDown();

  return { bubble, thinkBlock, thinkBody, col };
}

// Typing indicator
function showTyping() {
  removeTyping();
  const row = document.createElement('div');
  row.className = 'typing-row'; row.id = 'typing';
  const av = document.createElement('div');
  av.className = 'msg-av a';
  av.innerHTML = `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2" fill="white"/></svg>`;
  const bub = document.createElement('div');
  bub.className = 'typing-bubble';
  bub.innerHTML = '<div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div>';
  row.appendChild(av); row.appendChild(bub);
  messagesEl.appendChild(row);
  scrollDown();
}
function removeTyping() { const el = $('typing'); if (el) el.remove(); }

// Web searching indicator
function showSearching(query) {
  removeSearching();
  const row = document.createElement('div');
  row.className = 'searching-row'; row.id = 'searching';
  row.innerHTML = `
    <div class="searching-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
        <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
      </svg>
      Searching the web for: <strong>${esc(query.slice(0, 55))}${query.length > 55 ? '…' : ''}</strong>
    </div>`;
  messagesEl.appendChild(row);
  scrollDown();
}
function removeSearching() { const el = $('searching'); if (el) el.remove(); }

// Render source citations below AI bubble
function renderSources(col, sources) {
  if (!sources || !sources.length) return;
  const block = document.createElement('div');
  block.className = 'sources-block';
  block.innerHTML = `
    <div class="sources-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      Web sources
    </div>`;
  sources.slice(0, 5).forEach((s, i) => {
    try {
      const host = new URL(s.url).hostname.replace('www.', '');
      const a = document.createElement('a');
      a.className = 'source-link';
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = `<span class="source-num">${i + 1}</span><span>${esc(s.title || host)}</span>`;
      block.appendChild(a);
    } catch {}
  });
  col.appendChild(block);
  scrollDown();
}

function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── Send ───────────────────────────────────────────────────
async function send() {
  const text = inputEl.value.trim();
  if (!text && !pendingImageB64) return;

  if (abortCtrl) { abortCtrl.abort(); return; }

  // Ensure chat
  if (!activeChatId) {
    const chat = newChat();
    activeChatId = chat.id;
    topbarTitle.textContent = chat.title;
  }
  const chat = getChat(activeChatId);

  // Build user message — multipart if image is attached
  let uMsgContent;
  const imageToSend = pendingImageB64;
  if (imageToSend) {
    uMsgContent = [
      { type: 'text',      text: text || 'Analyze this image and answer accordingly.' },
      { type: 'image_url', image_url: { url: imageToSend } },
    ];
  } else {
    uMsgContent = text;
  }

  const uMsg = { role:'user', content: uMsgContent, time:now(), image: imageToSend };
  chat.messages.push(uMsg);
  saveChats();  // saveChats() auto-strips image_url before writing to localStorage

  // After saving, restore the full in-memory entry (with image) for this session
  chat.messages[chat.messages.length - 1] = uMsg;

  // Auto-title (use text portion)
  const titleText = text || 'Image question';
  if (chat.messages.filter(m => m.role === 'user').length === 1) {
    chat.title = titleText.slice(0, 46) + (titleText.length > 46 ? '…' : '');
    topbarTitle.textContent = chat.title;
    saveChats(); renderChatList();
  }

  // Render user message (with image if any)
  addMsg('user', text || '', uMsg.time, false, imageToSend);
  inputEl.value = '';
  autoResize();

  // Clear pending image
  clearImagePreview();


  setBusy(true);
  showTyping();

  abortCtrl = new AbortController();
  let raw = '', thinkAcc = '', ansAcc = '';
  let inThink = false, thinkDone = false;
  let aiEls = null;
  let searchSources = [];

  try {
    const res = await fetch(STREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Serialize messages: send multipart for messages that have image content,
        // plain string for text-only messages. Strip large base64 from older history.
        messages: chat.messages.map((m, idx) => {
          const isLast = idx === chat.messages.length - 1;
          // Only send image in the actual current message (already set on uMsg)
          if (Array.isArray(m.content)) {
            return { role: m.role, content: m.content };
          }
          return { role: m.role, content: m.content };
        }),
        max_tokens:   cfg.maxTokens,
        temperature:  cfg.temperature,
        system_prompt: cfg.systemPrompt,
        web_search:   webSearchOn,
      }),
      signal: abortCtrl.signal,
    });

    if (!res.ok) throw new Error(`Server ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream:true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let p; try { p = JSON.parse(payload); } catch { continue; }
        if (p.error) throw new Error(p.error);

        // ── Searching started event ──────────────────────────────
        if (p.searching) {
          removeTyping();
          showSearching(p.query);
          continue;
        }

        // ── Sources received event ───────────────────────────────
        if (p.sources) {
          searchSources = p.sources;
          removeSearching();
          // Create AI bubble now (before tokens arrive)
          if (!aiEls) {
            aiEls = addMsg('assistant', '', now(), true);
          }
          continue;
        }

        if (p.d) break;

        // ── Regular token ────────────────────────────────────────
        const tok = p.t || '';
        raw += tok;

        // Ensure AI bubble exists (non-search path)
        if (!aiEls) {
          removeTyping();
          aiEls = addMsg('assistant', '', now(), true);
        }

        // Parse think/answer split
        if (!thinkDone) {
          if (!inThink && raw.startsWith('<think>')) inThink = true;
          if (inThink) {
            const ci = raw.indexOf('</think>');
            if (ci !== -1) {
              thinkAcc = raw.slice(7, ci);
              ansAcc   = raw.slice(ci + 8);
              thinkDone = true; inThink = false;
            } else {
              thinkAcc = raw.slice(7);
            }
          } else {
            ansAcc = raw;
          }
        } else {
          ansAcc += tok;
        }

        // Update think block label (keep collapsed)
        if (thinkAcc && aiEls.thinkBlock) {
          aiEls.thinkBlock.style.display = 'block';
          aiEls.thinkBody.textContent = thinkAcc;
          const btn = aiEls.thinkBlock.querySelector('.think-btn');
          const label = thinkDone ? `Reasoning (${wc(thinkAcc)} words)` : 'Thinking…';
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> ${label}`;
          if (!btn._open) {
            btn.classList.add('collapsed');
            aiEls.thinkBody.classList.add('hidden');
          }
        }

        // Update answer bubble
        aiEls.bubble.innerHTML = md(ansAcc || (inThink ? '' : raw));
        scrollDown();
      }
    }

    // Show sources if we got any
    if (searchSources.length && aiEls) {
      renderSources(aiEls.col, searchSources);
    }

    chat.messages.push({ role:'assistant', content:raw, time:now() });
    saveChats();

  } catch (err) {
    removeTyping();
    removeSearching();
    if (err.name === 'AbortError') {
      if (raw) { chat.messages.push({ role:'assistant', content:raw + '\n\n*(stopped)*', time:now() }); saveChats(); }
    } else {
      if (!aiEls) aiEls = addMsg('assistant', '', now(), true);
      aiEls.bubble.innerHTML = `<span style="color:#ef4444">⚠ ${esc(err.message)}</span>`;
    }
  } finally {
    abortCtrl = null;
    setBusy(false);
  }
}

// ── UI helpers ─────────────────────────────────────────────
function setBusy(on) {
  if (on) {
    sendBtn.disabled = false;
    sendBtn.classList.add('stopping');
    sendIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  } else {
    sendBtn.classList.remove('stopping');
    sendIcon.style.display = 'block';
    stopIcon.style.display = 'none';
    sendBtn.disabled = !inputEl.value.trim();
  }
}
function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
}

// ── Image upload ───────────────────────────────────────────────────
const imgUploadBtn  = $('imgUploadBtn');
const imgFileInput  = $('imgFileInput');
const imgPreviewEl  = $('imgPreview');
const imgStripEl    = $('imgPreviewStrip');
const imgRemoveBtn  = $('imgRemoveBtn');

function clearImagePreview() {
  pendingImageB64 = null;
  imgStripEl.style.display = 'none';
  imgPreviewEl.src = '';
  imgFileInput.value = '';
  imgUploadBtn.classList.remove('active');
  // Re-evaluate send button
  if (!abortCtrl) sendBtn.disabled = !inputEl.value.trim();
}

imgUploadBtn.addEventListener('click', () => imgFileInput.click());

imgFileInput.addEventListener('change', () => {
  const file = imgFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingImageB64 = e.target.result;  // data:image/...;base64,...
    imgPreviewEl.src = pendingImageB64;
    imgStripEl.style.display = 'flex';
    imgUploadBtn.classList.add('active');
    sendBtn.disabled = false;  // can send with just an image
    inputEl.focus();
  };
  reader.readAsDataURL(file);
});

imgRemoveBtn.addEventListener('click', clearImagePreview);

// ── Web search toggle ─────────────────────────────────────────────
const webSearchBtn = $('webSearchBtn');
webSearchBtn.addEventListener('click', () => {
  webSearchOn = !webSearchOn;
  webSearchBtn.classList.toggle('active', webSearchOn);
  webSearchBtn.title = webSearchOn ? 'Web search ON — click to disable' : 'Toggle web search';
});

// ── Events ─────────────────────────────────────────────────
sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled || abortCtrl) send(); }
});
inputEl.addEventListener('input', () => {
  autoResize();
  // can send if there's text OR a pending image
  if (!abortCtrl) sendBtn.disabled = !(inputEl.value.trim() || pendingImageB64);
});

// Paste image from clipboard
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = ev => {
        pendingImageB64 = ev.target.result;
        imgPreviewEl.src = pendingImageB64;
        imgStripEl.style.display = 'flex';
        imgUploadBtn.classList.add('active');
        sendBtn.disabled = false;
      };
      reader.readAsDataURL(file);
      break;
    }
  }
});

$('newChatBtn').addEventListener('click', () => { startNew(); closeSidebar(); });

$('clearBtn').addEventListener('click', () => {
  if (!activeChatId) return;
  const chat = getChat(activeChatId);
  if (!chat || !confirm(`Delete "${chat.title}"?`)) return;
  chats = chats.filter(c => c.id !== activeChatId);
  saveChats();
  startNew();
});

$('searchInput').addEventListener('input', e => renderChatList(e.target.value));

$('sidebarToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('click', e => {
  const sb = $('sidebar');
  if (window.innerWidth <= 768 && !sb.contains(e.target) && !$('sidebarToggle').contains(e.target)) {
    sb.classList.remove('open');
  }
});

// User Name Prompt
userAvatar.addEventListener('click', () => {
  const newName = prompt('Enter your name:', cfg.userName);
  if (newName !== null && newName.trim() !== '') {
    cfg.userName = newName.trim();
    saveCfg();
    updateGreeting();
    userAvatar.textContent = cfg.userName[0].toUpperCase();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSidebar(); }
});

// ── Init ───────────────────────────────────────────────────
(function init() {
  // Theme
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  // Greeting & avatar
  updateGreeting();
  // Suggestions
  renderSuggestions();
  // Chat list
  renderChatList();
  // Focus input
  inputEl.focus();
})();
