import { useEffect, useRef, useState } from "react";
import { api } from "./auth";
import Navbar from "./Navbar";
import "./ScholarshipChat.css";

const STARTER_QUESTIONS = [
  "Find fully funded master's scholarships in Germany",
  "What scholarships could support Bangladeshi undergraduates?",
  "How do I prepare a strong scholarship application?",
];

function getSessionId() {
  const key = "prephub_scholarship_session";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID().replace(/-/g, "");
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function renderReply(text) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a href={part} key={`${part}-${index}`} rel="noopener noreferrer" target="_blank">
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ScholarshipChat({ onDashboard, userName, onLogout }) {
  const [sessionId, setSessionId] = useState(getSessionId);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! Tell me what you want to study, where, and at what level. I’ll look for scholarship information and share source links.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, sending]);

  async function sendMessage(message) {
    const text = message.trim();
    if (!text || sending) return;

    setInput("");
    setMessages(current => [...current, { role: "user", content: text }]);
    setSending(true);
    try {
      const response = await api("/scholarships/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      setSessionId(response.session_id);
      sessionStorage.setItem("prephub_scholarship_session", response.session_id);
      setMessages(current => [...current, { role: "assistant", content: response.reply }]);
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          role: "error",
          content: error instanceof Error ? error.message : "The scholarship assistant is unavailable. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function submit(event) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="scholarship-page">
      <Navbar
        current="scholarships"
        onDashboard={onDashboard}
        userName={userName}
        onLogout={onLogout}
      />

      <main className="scholarship-main">
        <header className="scholarship-heading">
          <div>
            <span className="scholarship-eyebrow"><span /> YOUR NEXT OPPORTUNITY</span>
            <h1>Find a scholarship that fits your future.</h1>
            <p>Share your study plans, and I’ll help you explore funding opportunities with source links.</p>
          </div>
          <div className="scholarship-heading-icon" aria-hidden="true">✦</div>
        </header>

        <section className="scholarship-chat-card" aria-label="Scholarship chat">
          <div className="scholarship-chat-top">
            <span className="scholarship-avatar" aria-hidden="true">✦</span>
            <div>
              <strong>Scholarship assistant</strong>
              <span><i /> Ready to help</span>
            </div>
            <span className="scholarship-source-note">Always verify details with the official provider</span>
          </div>

          <div className="scholarship-message-list" ref={logRef} role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`scholarship-message scholarship-message-${message.role}`} key={`${message.role}-${index}`}>
                {message.role !== "user" && <span className="scholarship-message-mark" aria-hidden="true">✦</span>}
                <p>{renderReply(message.content)}</p>
              </div>
            ))}
            {sending && (
              <div className="scholarship-message scholarship-message-assistant scholarship-typing" role="status">
                <span className="scholarship-message-mark" aria-hidden="true">✦</span>
                <p>Checking scholarship sources<span>…</span></p>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="scholarship-prompts" aria-label="Suggested questions">
              {STARTER_QUESTIONS.map(question => (
                <button key={question} disabled={sending} onClick={() => void sendMessage(question)} type="button">
                  {question}<span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          )}

          <form className="scholarship-composer" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="scholarship-message">Your scholarship question</label>
            <textarea
              id="scholarship-message"
              maxLength={2000}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder="Tell me what you want to study, and where…"
              ref={inputRef}
              rows={2}
              value={input}
            />
            <button disabled={sending || !input.trim()} type="submit" aria-label="Send message">
              {sending ? "…" : "↑"}
            </button>
          </form>
          <p className="scholarship-disclaimer">Scholarship listings and deadlines can change. Confirm eligibility and dates on the provider’s official website.</p>
        </section>
      </main>
    </div>
  );
}
