import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Database, Globe2, Layers3, Menu, MessageSquare, Plus, Search, Settings2, ShieldCheck, Sparkles, Square, Waypoints, X, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Orb from './Orb';

const capabilities = [
  { id: 'knowledge', icon: BookOpen, title: 'Your knowledge, connected', short: 'Knowledge base', description: 'Find answers in your internal documents.', prompt: 'How many days of annual leave do employees receive in the sample HR policy?', color: 'mint', tools: ['search_knowledge_base'] },
  { id: 'database', icon: Database, title: 'Let your data do the talking', short: 'Database', description: 'Turn everyday questions into insights.', prompt: 'How many active employees are in Engineering? Use the demo database.', color: 'purple', tools: ['get_database_schema', 'query_database'] },
  { id: 'web', icon: Globe2, title: 'A wider world of answers', short: 'Web search', description: 'Explore the web for current information.', prompt: 'Search the web for the official Python documentation and give me the link.', color: 'blue', tools: ['web_search'] },
];
const labelFor = tool => capabilities.find(c => c.tools.includes(tool))?.short || tool;
const makeChat = () => ({ id: crypto.randomUUID(), title: 'New conversation', messages: [] });
const initial = makeChat();

function Brand({ small = false }) { return <div className={`brand ${small ? 'small' : ''}`}><span className="brand-symbol"><Waypoints size={small ? 17 : 23} strokeWidth={2} /></span>{!small && <span>nexus<span className="brand-period">.</span></span>}</div>; }

export default function App() {
  const [chats, setChats] = useState([initial]);
  const [activeId, setActiveId] = useState(initial.id);
  const [draft, setDraft] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [topK, setTopK] = useState(4);
  const [health, setHealth] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState('settings');
  const [copied, setCopied] = useState(null);
  const [copyError, setCopyError] = useState(false);
  const dialog = useRef(null);
  const input = useRef(null);
  const end = useRef(null);
  const request = useRef(null);
  const chat = chats.find(c => c.id === activeId);
  const messages = chat.messages;
  const empty = messages.length === 0;

  useEffect(() => {
    const controller = new AbortController();
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) });
        const data = await response.json();
        if (!controller.signal.aborted) setHealth(response.ok && data.status === 'ok' ? 'online' : 'offline');
      } catch { if (!controller.signal.aborted) setHealth('offline'); }
    };
    checkHealth(); const timer = setInterval(checkHealth, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (!busy) return; setElapsed(0); const timer = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(timer); }, [busy]);
  useEffect(() => () => request.current?.abort(), []);

  function showPanel(name) { setPanel(name); setKeyDraft(apiKey); dialog.current.showModal(); setMobile(false); }
  function newChat() {
    if (busy) return;
    const next = makeChat(); setChats(old => [next, ...old.filter(c => c.messages.length)]); setActiveId(next.id); setDraft(''); setMobile(false); input.current?.focus();
  }
  function append(id, message) { setChats(old => old.map(c => c.id === id ? { ...c, messages: [...c.messages, message] } : c)); }
  async function send(event) {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || busy || question.length > 4000) return;
    if (!apiKey) { showPanel('settings'); return; }
    const id = activeId;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setDraft('');
    setChats(old => old.map(c => c.id === id ? { ...c, title: c.messages.length ? c.title : question, messages: [...c.messages, { id: crypto.randomUUID(), role: 'user', content: question }] } : c));
    const started = performance.now();
    try {
      const response = await fetch('/api/agent/query', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }, body: JSON.stringify({ question, top_k: topK }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error('Your API key was not accepted. Update it in Connection settings and try again.');
        throw new Error(typeof data.detail === 'string' ? data.detail : `The service returned an error (${response.status}). Please try again.`);
      }
      if (typeof data.answer !== 'string' || !Array.isArray(data.tools_used)) throw new Error('The service returned an unexpected response.');
      append(id, { id: crypto.randomUUID(), role: 'assistant', content: data.answer, tools: data.tools_used, calls: data.tool_calls, rounds: data.rounds, seconds: ((performance.now() - started) / 1000).toFixed(1) });
    } catch (error) {
      append(id, { id: crypto.randomUUID(), role: 'error', content: error.name === 'AbortError' ? 'Stopped waiting for this response. The server may still finish processing the request.' : error instanceof TypeError ? 'Could not reach the agent service. Check that your backend is running on port 8000, then try again.' : error.message, retry: question });
    } finally { setBusy(false); request.current = null; input.current?.focus(); }
  }
  async function copy(message) {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); setCopyError(false); setTimeout(() => setCopied(null), 1800); }
    catch { setCopyError(true); }
  }

  return <div className="workspace">
    {mobile && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
      <div className="sidebar-brand"><Brand /><span className="workspace-tag">WORKSPACE</span></div>
      <button className="new-chat" onClick={newChat} disabled={busy}><Plus size={17} /> New conversation <span>↗</span></button>
      <label className="history-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
      <div className="nav-label">WORKSPACE</div>
      <button className="nav-item active" onClick={() => setMobile(false)}><MessageSquare size={17} /> AI assistant <span className="tiny-dot" /></button>
      <button className="nav-item" onClick={() => showPanel('tools')}><Layers3 size={17} /> Connected tools <span className="count">{capabilities.length}</span></button>
      <div className="nav-label recent-label">RECENT CONVERSATIONS</div>
      <div className="history">
        {chats.filter(c => c.messages.length && c.title.toLowerCase().includes(search.toLowerCase())).map(c => <button key={c.id} disabled={busy} className={`history-item ${activeId === c.id ? 'selected' : ''}`} onClick={() => { setActiveId(c.id); setDraft(''); setMobile(false); }}><MessageSquare size={14} /><span>{c.title}</span></button>)}
        {!chats.some(c => c.messages.length && c.title.toLowerCase().includes(search.toLowerCase())) && <p className="history-empty">{search ? 'No matching conversations.' : 'A little curiosity goes a long way. Your conversations will appear here.'}</p>}
      </div>
      <div className="sidebar-bottom">
        <div className="local-card"><span className="local-icon"><ShieldCheck size={18} /></span><div><strong>Your space to explore</strong><p>Local intelligence. Connected tools.</p></div></div>
        <button className="nav-item" onClick={() => showPanel('help')}><CircleHelp size={17} /> A quick guide <ArrowUpRight size={14} /></button>
        <button className="profile" onClick={() => showPanel('settings')}><span className="avatar">Y</span><span><strong>Your workspace</strong><small>Personal account</small></span><Settings2 size={17} /></button>
      </div>
    </aside>

    <main className="main-panel">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><strong>AI assistant</strong></div><div className="top-actions"><span className={`service-status ${health}`}><i />{health === 'online' ? 'Service online' : health === 'checking' ? 'Checking service' : 'Service offline'}</span><button className="icon-button" aria-label="Connection settings" onClick={() => showPanel('settings')}><Settings2 size={18} /></button></div></header>
      <div className="conversation-scroll">
        {empty ? <section className="welcome">
          <div className="eyebrow"><span /> A LITTLE CURIOSITY. ENDLESS POSSIBILITIES.</div>
          <div className="hero-art"><Orb /><span className="orbit-label orbit-label-left"><BookOpen size={13} /> Knowledge</span><span className="orbit-label orbit-label-right"><Database size={13} /> Data & beyond</span><span className="orb-cross cross-one">+</span><span className="orb-cross cross-two">+</span></div>
          <h1>Big questions.<br /><span>Connected answers.</span></h1>
          <p className="hero-description">Your documents, data, and the web. One thoughtful assistant.<br className="desktop-break" /> What would you like to explore today?</p>
          <div className="suggestions">{capabilities.map(({ id, icon: Icon, title, description, prompt, color }) => <button key={id} className={`suggestion ${color}`} onClick={() => { setDraft(prompt); input.current?.focus(); }}><span className="suggestion-top"><span className="tool-icon"><Icon size={19} /></span><ArrowUpRight size={16} /></span><strong>{title}</strong><p>{description}</p></button>)}</div>
          <div className="welcome-note"><Waypoints size={13} /> A connected mind, with the right tools for every question.</div>
        </section> : <section className="messages" aria-label="Conversation">
          <div className="conversation-heading"><span className="eyebrow">YOUR EXPLORATION</span><h1>{chat.title}</h1><p>Each question is answered independently using the available tools.</p></div>
          {messages.map(message => <article className={`message ${message.role}`} key={message.id}>
            {message.role === 'user' ? <div className="user-avatar">Y</div> : <Brand small />}
            <div className="message-body"><div className="message-label">{message.role === 'user' ? 'You' : 'Nexus'}{message.role === 'assistant' && <span>AI ASSISTANT</span>}</div>
              {message.role === 'user' ? <p className="user-content">{message.content}</p> : <div className="markdown"><Markdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{message.content}</Markdown></div>}
              {message.tools && <div className="response-meta">{[...new Set(message.tools)].map(tool => <span className="tool-chip" title={tool} key={tool}><Zap size={11} />{labelFor(tool)}{tool === 'get_database_schema' ? ' · schema' : ''}</span>)}<span className="response-time">{message.seconds}s · {message.calls} tool calls · {message.rounds} rounds</span><button className="icon-button copy-button" aria-label="Copy answer" onClick={() => copy(message)}>{copied === message.id ? <Check size={14} /> : <Copy size={14} />}</button></div>}
              {message.retry && <button className="retry" disabled={busy} onClick={() => { setDraft(message.retry); input.current?.focus(); }}>Edit and retry <ArrowUpRight size={12} /></button>}
            </div>
          </article>)}
          {busy && <div className="message assistant" role="status"><Brand small /><div className="message-body"><div className="message-label">Nexus <span className="thinking-dots">•••</span></div><p className="thinking">Working on your question <span>{elapsed}s</span></p><p className="thinking-detail">The agent is choosing tools and gathering an answer. This can take a few minutes.</p></div></div>}
          {copyError && <p role="status" className="copy-error">Could not access the clipboard. You can select and copy the answer manually.</p>}
          <div ref={end} />
        </section>}
      </div>
      <div className="composer-area"><form className={`composer ${busy ? 'is-busy' : ''}`} onSubmit={send}>
        <label className="sr-only" htmlFor="question">Ask Nexus a question</label><textarea id="question" ref={input} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} maxLength={4000} rows={2} placeholder="Ask a question. Connect the dots." disabled={busy} />
        <div className="composer-bottom"><div className="composer-options"><button type="button" className="mode-button" onClick={() => showPanel('tools')}><Sparkles size={14} /> Auto <ChevronDown size={12} /></button><span className="composer-divider" /><span className="tools-caption"><span className="tiny-dot" /> {capabilities.length} tools available</span></div><div className="send-actions">{draft.length > 3500 && <span className="character-count">{draft.length}/4000</span>}<span className="enter-hint">{busy ? 'Working on it' : 'Enter to send'}</span>{busy ? <button className="send-button stop-button" type="button" aria-label="Stop waiting for response" onClick={() => request.current?.abort()}><Square size={16} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={20} /></button>}</div></div>
      </form><div className="composer-footnote"><span>Nexus can make mistakes. Check important information.</span><button onClick={() => showPanel('settings')}><span className={`key-dot ${apiKey ? 'ready' : ''}`} />{apiKey ? 'Key connected' : 'Connect API key'}<ArrowUpRight size={11} /></button></div></div>
    </main>

    <dialog ref={dialog} className="settings-dialog" onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="dialog-header"><span className="dialog-icon">{panel === 'tools' ? <Layers3 size={20} /> : panel === 'help' ? <CircleHelp size={20} /> : <Settings2 size={20} />}</span><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current.close()}><X size={20} /></button></div>
      {panel === 'settings' ? <><h2>Make the connection.</h2><p>Connect Nexus to your local agent service.</p><form onSubmit={e => { e.preventDefault(); setApiKey(keyDraft.trim()); dialog.current.close(); input.current?.focus(); }}><label htmlFor="api-key">Agent API key</label><input autoComplete="off" id="api-key" type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="Enter your AGENT_API_KEY" /><small>Use the AGENT_API_KEY from your backend .env file. The key stays in memory and is cleared when you reload.</small><label htmlFor="top-k">Knowledge passages <span>{topK}</span></label><input id="top-k" type="range" min="1" max="8" value={topK} onChange={e => setTopK(Number(e.target.value))} /><small>How many document passages the agent retrieves for each knowledge search.</small><div className="connection-detail"><span className={`service-status ${health}`}><i />{health === 'online' ? 'Backend reachable' : 'Backend not connected'}</span><code>127.0.0.1:8000</code></div><button className="primary-button" type="submit">Save connection <ArrowUpRight size={16} /></button></form></> : panel === 'tools' ? <><h2>A few very useful connections.</h2><p>The assistant chooses the tools needed for each question. Availability depends on your backend configuration.</p><div className="tool-list">{capabilities.map(({ id, icon: Icon, short, tools, color, description }) => <div key={id} className={color}><span className="tool-icon"><Icon size={18} /></span><div><strong>{short}</strong><p>{description}</p>{tools.map(t => <code key={t}>{t}</code>)}</div></div>)}</div></> : <><h2>Start with a little curiosity.</h2><p>Ask about an HR policy, explore the demo company database, or search the web.</p><ol className="guide"><li>Start your FastAPI backend and Ollama model.</li><li>Add your API key in Connection settings.</li><li>Choose a prompt card or write your own question.</li></ol><div className="help-note"><ShieldCheck size={20} /><p>Conversations stay in this tab and clear on reload. The backend treats each question independently; include the context it needs in your question.</p></div><button className="primary-button" onClick={() => { setPanel('settings'); setKeyDraft(apiKey); }}>Connection settings <ArrowUpRight size={16} /></button></>}
    </dialog>
  </div>;
}
