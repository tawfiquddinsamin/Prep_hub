import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./Navbar";
import { api } from "./auth";
import "./App.css";

export default function MockRoom({ sid = 0, onDashboard, onScholarships, userName, onLogout }) {
  const [practiceSet, setPracticeSet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [left, setLeft] = useState(20 * 60);
  const [loadingError, setLoadingError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSet() {
      try {
        const data = await api(`/passages/${sid}`);
        if (!cancelled) setPracticeSet(data);
      } catch (error) {
        if (!cancelled) {
          setLoadingError(error instanceof Error ? error.message : "Could not load this practice set.");
        }
      }
    }

    loadSet();
    return () => { cancelled = true; };
  }, [sid]);

  useEffect(() => {
    if (result || !practiceSet) return undefined;
    const timer = window.setInterval(() => {
      setLeft((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [practiceSet, result]);

  const submit = useCallback(async () => {
    if (submitting || result || !practiceSet) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      setResult(await api(`/passages/${sid}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your answers could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, practiceSet, result, sid, submitting]);

  useEffect(() => {
    if (left !== 0 || !practiceSet || result || autoSubmitStarted.current) return undefined;
    autoSubmitStarted.current = true;
    const timeout = window.setTimeout(() => { void submit(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [left, practiceSet, result, submit]);

  if (loadingError) {
    return (
      <div className="app-shell">
        <Navbar current="mock" onDashboard={onDashboard} onScholarships={onScholarships} userName={userName} onLogout={onLogout} />
        <main className="message-screen">
          <div className="message-card">
            <span className="message-icon" aria-hidden="true">!</span>
            <h1>We couldn’t open your practice set</h1>
            <p>{loadingError} Make sure the practice API is running, then refresh this page.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!practiceSet) {
    return (
      <div className="app-shell">
        <Navbar current="mock" onDashboard={onDashboard} onScholarships={onScholarships} userName={userName} onLogout={onLogout} />
        <main className="message-screen">
          <div className="loading-card" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Preparing your practice room…</span>
          </div>
        </main>
      </div>
    );
  }

  const minutes = String(Math.floor(left / 60)).padStart(2, "0");
  const seconds = String(left % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;
  const completion = Math.round((answeredCount / practiceSet.questions.length) * 100);
  const isUrgent = left <= 60;

  function jumpToQuestion(id) {
    document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="app-shell">
      <Navbar
        current="mock"
        onDashboard={onDashboard}
        onScholarships={onScholarships}
        userName={userName}
        onLogout={onLogout}
      />

      <main className="workspace">
        <section className="intro">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> READING PRACTICE <span className="eyebrow-dot">·</span> SET {String(sid + 1).padStart(2, "0")}</div>
            <h1>{practiceSet.title}</h1>
            <p className="intro-copy">Read the passage and choose the best answer for each question.</p>
          </div>
          <div className={`timer-card${isUrgent ? " timer-urgent" : ""}`} aria-label={`Time remaining ${minutes} minutes ${seconds} seconds`}>
            <span className="timer-icon" aria-hidden="true">◷</span>
            <span className="timer-copy"><span className="timer-caption">TIME REMAINING</span><strong>{minutes}:{seconds}</strong></span>
          </div>
        </section>

        <section className="progress-panel" aria-label="Practice progress">
          <div className="progress-topline">
            <div className="progress-label"><span className="progress-check" aria-hidden="true">✓</span> Your progress</div>
            <span className="progress-count"><strong>{answeredCount}</strong> of {practiceSet.questions.length} answered</span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={answeredCount} aria-valuemin="0" aria-valuemax={practiceSet.questions.length} aria-label="Questions answered">
            <span style={{ width: `${completion}%` }} />
          </div>
          <nav className="question-nav" aria-label="Jump to question">
            {practiceSet.questions.map((question, index) => (
              <button
                className={`question-nav-item${answers[question.id] !== undefined ? " is-answered" : ""}`}
                key={question.id}
                onClick={() => jumpToQuestion(question.id)}
                aria-label={`Go to question ${index + 1}${answers[question.id] !== undefined ? ", answered" : ", unanswered"}`}
              >
                {answers[question.id] !== undefined && <span aria-hidden="true">✓</span>}
                {String(index + 1).padStart(2, "0")}
              </button>
            ))}
            <span className="nav-hint"><span className="nav-hint-dot" /> Answered <span className="nav-hint-dot nav-hint-empty" /> To do</span>
          </nav>
        </section>

        <div className="exam-layout">
          <aside className="passage-card">
            <div className="card-heading">
              <div className="heading-icon passage-icon" aria-hidden="true">Aa</div>
              <div>
                <span className="card-kicker">READING PASSAGE</span>
                <h2>Read carefully</h2>
              </div>
              <span className="read-time">~5 min read</span>
            </div>
            <div className="passage-rule" />
            <div className="passage-text">{practiceSet.passage}</div>
            <div className="passage-footer"><span className="footer-sparkle" aria-hidden="true">✳</span> Take your time. You can revisit the passage at any point.</div>
          </aside>

          <section className="questions-column" aria-label="Questions">
            <div className="questions-heading">
              <div>
                <span className="card-kicker">YOUR QUESTIONS</span>
                <h2>Choose your answers</h2>
              </div>
              <span className="question-total">{practiceSet.questions.length} QUESTIONS</span>
            </div>
            {practiceSet.questions.map((question, index) => {
              const questionResult = result?.results.find((item) => item.id === question.id);
              return (
                <article className={`question-card${questionResult ? (questionResult.correct ? " question-correct" : " question-incorrect") : ""}`} id={`question-${question.id}`} key={question.id}>
                  <div className="question-card-top">
                    <span className="question-number">Q{String(index + 1).padStart(2, "0")}</span>
                    {question.topic && <span className="topic-tag">{question.topic}</span>}
                    {questionResult && <span className={`answer-status${questionResult.correct ? " status-correct" : " status-incorrect"}`}>{questionResult.correct ? "Correct" : "Review"}</span>}
                  </div>
                  <h3>{question.stem}</h3>
                  <div className="answer-options">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === optionIndex;
                      const isCorrectAnswer = questionResult?.answer_index === optionIndex;
                      return (
                        <label className={`answer-option${selected ? " option-selected" : ""}${questionResult && isCorrectAnswer ? " option-correct" : ""}${questionResult && selected && !questionResult.correct ? " option-incorrect" : ""}`} key={optionIndex}>
                          <input
                            type="radio"
                            name={`q${question.id}`}
                            value={optionIndex}
                            disabled={Boolean(result) || submitting}
                            checked={selected}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                          />
                          <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                          <span className="option-text">{option}</span>
                          {questionResult && isCorrectAnswer && <span className="option-check" aria-label="Correct answer">✓</span>}
                        </label>
                      );
                    })}
                  </div>
                  {questionResult && (
                    <div className="evidence-box">
                      <span className="evidence-icon" aria-hidden="true">“</span>
                      <div><strong>From the passage</strong><p>{questionResult.evidence}</p></div>
                    </div>
                  )}
                </article>
              );
            })}

            {submitError && <p className="submit-error" role="alert">{submitError}</p>}

            <div className="submit-panel">
              {result ? (
                <div className="result-summary" role="status">
                  <span className="result-icon" aria-hidden="true">{result.score === result.total ? "✦" : "✓"}</span>
                  <div><span className="card-kicker">PRACTICE COMPLETE</span><strong>You scored {result.score} out of {result.total}</strong><p>Review the explanations above to sharpen your understanding.</p></div>
                </div>
              ) : (
                <>
                  <div className="submit-copy"><strong>Ready to see how you did?</strong><span>You can still change your answers before submitting.</span></div>
                  <button className="submit-button" onClick={submit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit answers"} <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
        <footer className="page-footer"><span>prephub<span className="brand-period">.</span></span><span>One question at a time. You’ve got this.</span></footer>
      </main>
    </div>
  );
}
