import { useEffect, useState } from "react";
import { api } from "./auth";
import Navbar from "./Navbar";
import "./DrillRoom.css";

export default function DrillRoom({ onDone, onScholarships, userName, onLogout }) {
  const [drill, setDrill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadDrill() {
      try {
        setDrill(await api("/me/practice"));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Your coach could not build a drill.");
      } finally {
        setLoading(false);
      }
    }

    loadDrill();
  }, []);

  async function submit() {
    if (!drill || submitting || result) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const questionIds = drill.groups.flatMap((group) => group.questions.map((question) => question.id));
      const data = await api("/practice/submit", {
        method: "POST",
        body: JSON.stringify({
          topic: drill.topic,
          question_ids: questionIds,
          answers,
        }),
      });
      setResult(data);
    } catch (submitIssue) {
      setSubmitError(submitIssue instanceof Error ? submitIssue.message : "Your drill could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="drill-room">
        <Navbar current="drill" onDashboard={onDone} onScholarships={onScholarships} userName={userName} onLogout={onLogout} />
        <main className="drill-message-screen">
          <div className="drill-message-card" role="status">
            <div className="drill-loading-card">
              <span className="drill-spinner" aria-hidden="true" />
              Your coach is preparing a focused drill…
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !drill) {
    return (
      <div className="drill-room">
        <Navbar current="drill" onDashboard={onDone} onScholarships={onScholarships} userName={userName} onLogout={onLogout} />
        <main className="drill-message-screen">
          <section className="drill-message-card">
            <span className="drill-message-icon" aria-hidden="true">!</span>
            <h1>We couldn’t prepare your drill</h1>
            <p>{error || "Your coach returned an empty drill. Please try again."}</p>
            <button className="drill-back-button" onClick={onDone} type="button">
              <span aria-hidden="true">←</span> Back to dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  const questions = drill.groups.flatMap((group) => group.questions);
  const questionNumbers = new Map(questions.map((question, index) => [question.id, index + 1]));
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const completion = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="drill-room">
      <Navbar
        current="drill"
        onDashboard={onDone}
        onScholarships={onScholarships}
        userName={userName}
        onLogout={onLogout}
      />

      <main className="drill-main">
        <section className="drill-hero">
          <div>
            <span className="drill-eyebrow">YOUR PERSONALIZED PRACTICE</span>
            <h1>Build confidence in {drill.topic}</h1>
            <p className="drill-hero-copy">
              Your coach picked this focus based on your recent work. Read each passage,
              then choose the strongest answer.
            </p>
          </div>
          <div className="drill-scorecard" aria-label={`${answeredCount} of ${questions.length} questions answered`}>
            <span className="drill-scorecard-icon" aria-hidden="true">✓</span>
            <div><strong>{answeredCount}/{questions.length}</strong><span>answered</span></div>
          </div>
        </section>

        <div
          className="drill-progress"
          role="progressbar"
          aria-label="Questions answered"
          aria-valuenow={answeredCount}
          aria-valuemin="0"
          aria-valuemax={questions.length}
        >
          <span style={{ width: `${completion}%` }} />
        </div>

        {(drill.rationale || drill.study_tip) && (
          <section className="drill-coach-note" aria-label="Your coach's guidance">
            <span className="drill-coach-icon" aria-hidden="true">✦</span>
            <div className="drill-coach-copy">
              <span>YOUR COACH’S PLAN</span>
              {drill.rationale && <p>{drill.rationale}</p>}
              {drill.study_tip && (
                <div className="drill-coach-tip"><strong>Study tip:</strong> {drill.study_tip}</div>
              )}
            </div>
          </section>
        )}

        {drill.trace?.length > 0 && (
          <details style={{ margin: "8px 0" }}>
            <summary>Agent trace ({drill.trace.length} tool calls)</summary>
            <ol>
              {drill.trace.map((t, i) => (
                <li key={i}><code>{t.tool}</code> {JSON.stringify(t.args)}</li>
              ))}
            </ol>
          </details>
        )}

        <div className="drill-groups">
          {drill.groups.map((group, groupIndex) => (
            <section className="drill-group" key={`${group.passage_id}-${groupIndex}`}>
              <article className="drill-passage-card">
                <header className="drill-passage-heading">
                  <span>READING PASSAGE {String(groupIndex + 1).padStart(2, "0")}</span>
                  <h2>{group.title}</h2>
                </header>
                <div className="drill-passage-body">{group.passage}</div>
                <div className="drill-passage-footer">
                  <span aria-hidden="true">✳</span> You can revisit the passage while answering.
                </div>
              </article>

              <div className="drill-question-list" aria-label={`Questions for ${group.title}`}>
                {group.questions.map((question) => {
                  const questionResult = result?.results.find((item) => item.id === question.id);
                  return (
                    <article className="drill-question-card" key={question.id}>
                      <div className="drill-question-heading">
                        <span className="drill-question-number">
                          Q{String(questionNumbers.get(question.id)).padStart(2, "0")}
                        </span>
                        {question.topic && <span className="drill-topic-tag">{question.topic}</span>}
                      </div>
                      <h3>{question.stem}</h3>
                      <div className="drill-answer-options">
                        {question.options.map((option, optionIndex) => {
                          const selected = answers[question.id] === optionIndex;
                          const isCorrect = questionResult?.answer_index === optionIndex;
                          const optionClass = [
                            "drill-answer-option",
                            selected && "is-selected",
                            questionResult && isCorrect && "is-correct",
                            questionResult && selected && !questionResult.correct && "is-incorrect",
                          ].filter(Boolean).join(" ");
                          return (
                            <label className={optionClass} key={optionIndex}>
                              <input
                                type="radio"
                                name={`q${question.id}`}
                                value={optionIndex}
                                disabled={Boolean(result) || submitting}
                                checked={selected}
                                onChange={() => setAnswers((current) => ({
                                  ...current,
                                  [question.id]: optionIndex,
                                }))}
                              />
                              <span className="drill-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                              <span className="drill-option-copy">{option}</span>
                            </label>
                          );
                        })}
                      </div>
                      {questionResult && (
                        <div className="drill-evidence">
                          <span className="drill-evidence-icon" aria-hidden="true">“</span>
                          <div>
                            <strong>{questionResult.correct ? "Correct answer" : "Review this answer"}</strong>
                            <p>{questionResult.evidence}</p>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {submitError && <p className="drill-submit-error" role="alert">{submitError}</p>}
        <section className="drill-submit-panel">
          {result ? (
            <div className="drill-result" role="status">
              <span className="drill-result-icon" aria-hidden="true">{result.score === result.total ? "✦" : "✓"}</span>
              <div>
                <span className="drill-card-kicker">DRILL COMPLETE</span>
                <strong>You scored {result.score} out of {result.total}</strong>
                <span>Review the explanations above to strengthen your skills.</span>
              </div>
            </div>
          ) : (
            <>
              <div className="drill-submit-copy">
                <strong>Ready to see how you did?</strong>
                <span>You can still change your answers before submitting.</span>
              </div>
              <button
                className="drill-submit-button"
                onClick={submit}
                disabled={submitting}
                type="button"
              >
                {submitting ? "Submitting…" : "Submit drill"} <span aria-hidden="true">→</span>
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
