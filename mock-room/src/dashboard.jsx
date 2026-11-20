import { useEffect, useState } from "react";
import { api } from "./auth";
import Navbar from "./Navbar";
import "./Dashboard.css";

export default function Dashboard({ onPractice, onDrill, onScholarships, userName, onLogout }) {
  const [mastery, setMastery] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [passages, setPassages] = useState([]);
  const [passagesLoading, setPassagesLoading] = useState(true);
  const [passagesError, setPassagesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPassages() {
      try {
        setPassages(await api("/passages"));
      } catch (loadError) {
        setPassagesError(loadError instanceof Error ? loadError.message : "Available passages could not be loaded.");
      } finally {
        setPassagesLoading(false);
      }
    }

    loadPassages();
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [masteryData, attemptsData] = await Promise.all([
          api("/me/mastery"),
          api("/me/attempts"),
        ]);
        setMastery(masteryData);
        setAttempts(attemptsData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Your progress couldn’t be loaded.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const weakest = mastery[0];
  const totalQuestions = mastery.reduce((total, topic) => total + topic.attempted, 0);
  const overallAccuracy = totalQuestions
    ? Math.round(mastery.reduce((total, topic) => total + topic.accuracy * topic.attempted, 0) / totalQuestions * 100)
    : 0;

  return (
    <div className="dashboard-page">
      <Navbar current="dashboard" onScholarships={onScholarships} userName={userName} onLogout={onLogout} />

      <main className="dashboard-main">
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="dashboard-eyebrow"><span /> YOUR DASHBOARD</span>
            <h1>A little progress<br />goes a long way.</h1>
            <button className="dashboard-primary-button scholarship-launch" onClick={onScholarships} type="button">
              <span aria-hidden="true">✦</span> Find scholarships
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-orbit hero-orbit-one" />
            <span className="hero-orbit hero-orbit-two" />
            <span className="hero-leaf hero-leaf-one" />
            <span className="hero-leaf hero-leaf-two" />
            <span className="hero-sun">✳</span>
            <span className="hero-book"><span /><span /><span /></span>
          </div>
          <div className="hero-note"><span>✦</span> Your next breakthrough starts here</div>
        </section>

        {error && <p className="dashboard-error" role="alert">{error}</p>}

        <section className="dashboard-stats" aria-label="Your study statistics">
          <article className="stat-card">
            <span className="stat-icon stat-icon-green" aria-hidden="true">↗</span>
            <div><span className="stat-label">QUESTIONS PRACTICED</span><strong>{loading ? "—" : totalQuestions}</strong><span className="stat-caption">Across all reading topics</span></div>
          </article>
          <article className="stat-card">
            <span className="stat-icon stat-icon-gold" aria-hidden="true">◎</span>
            <div><span className="stat-label">OVERALL ACCURACY</span><strong>{loading || !totalQuestions ? "—" : `${overallAccuracy}%`}</strong><span className="stat-caption">Keep strengthening your skills</span></div>
          </article>
          <article className="stat-card">
            <span className="stat-icon stat-icon-lilac" aria-hidden="true">✦</span>
            <div><span className="stat-label">PRACTICE SESSIONS</span><strong>{loading ? "—" : attempts.length}</strong><span className="stat-caption">Every session moves you forward</span></div>
          </article>
        </section>

        <div className="dashboard-columns">
          <section className="dashboard-card mastery-card">
            <div className="dashboard-card-heading">
              <div><span className="dashboard-card-kicker">SKILL BREAKDOWN</span><h2>Your reading strengths</h2></div>
              <span className="heading-sparkle" aria-hidden="true">✳</span>
            </div>
            {loading ? (
              <div className="dashboard-empty"><span className="dashboard-spinner" />Loading your skills…</div>
            ) : mastery.length ? (
              <div className="mastery-list">
                {mastery.map((topic) => (
                  <div className="mastery-row" key={topic.topic}>
                    <div className="mastery-row-top">
                      <div><strong>{topic.topic}</strong><span>{topic.attempted} {topic.attempted === 1 ? "question" : "questions"}</span></div>
                      <strong className="mastery-score">{Math.round(topic.accuracy * 100)}%</strong>
                    </div>
                    <div className="mastery-track" role="progressbar" aria-label={`${topic.topic} accuracy`} aria-valuenow={Math.round(topic.accuracy * 100)} aria-valuemin="0" aria-valuemax="100">
                      <span style={{ width: `${Math.max(0, Math.min(100, topic.accuracy * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <span className="empty-icon" aria-hidden="true">◌</span>
                <strong>Your skills will show up here</strong>
                <span>Complete a practice session to see your topic-by-topic progress.</span>
              </div>
            )}
            {!loading && weakest && (
              <div className="focus-tip">
                <span aria-hidden="true">✦</span>
                <p>
                  <strong>A good place to focus</strong><br />
                  Spend a little extra time on {weakest.topic.toLowerCase()} questions.
                  <button className="dashboard-primary-button" onClick={onDrill} type="button">
                    Get my coach&apos;s drill
                  </button>
                </p>
              </div>
            )}
          </section>

          <section className="dashboard-card attempts-card">
            <div className="dashboard-card-heading">
              <div><span className="dashboard-card-kicker">KEEP YOUR MOMENTUM</span><h2>Recent sessions</h2></div>
              <span className="session-count">{attempts.length} {attempts.length === 1 ? "SESSION" : "SESSIONS"}</span>
            </div>
            {loading ? (
              <div className="dashboard-empty"><span className="dashboard-spinner" />Loading sessions…</div>
            ) : attempts.length ? (
              <div className="attempt-list">
                {attempts.map((attempt, index) => {
                  const scorePercent = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
                  return (
                    <div className="attempt-row" key={`${attempt.set_id}-${attempt.taken_at}-${index}`}>
                      <span className={`attempt-medal${scorePercent >= 80 ? " medal-strong" : ""}`} aria-hidden="true">{scorePercent >= 80 ? "✦" : "✓"}</span>
                      <div className="attempt-details">
                        <strong>{attempt.kind === "drill" ? `Drill: ${attempt.topic}` : `Passage ${attempt.set_id}`}</strong>
                        <time dateTime={attempt.taken_at}>{new Date(attempt.taken_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>
                      </div>
                      <span className="attempt-score">{attempt.score}<span>/{attempt.total}</span></span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <span className="empty-icon" aria-hidden="true">◷</span>
                <strong>No sessions yet</strong>
                <span>Your completed practices will appear here.</span>
              </div>
            )}
            {passagesError && <p className="dashboard-error" role="alert">{passagesError}</p>}
            {!passagesLoading && !passagesError && passages.length === 0 && (
              <p className="dashboard-error" role="status">No practice passages are available yet.</p>
            )}
            <div className="passage-choices" aria-label="Available practice passages">
              {passagesLoading ? (
                <div className="dashboard-empty"><span className="dashboard-spinner" />Loading passages…</div>
              ) : passages.map((passage) => (
                <button
                  className="dashboard-primary-button"
                  key={passage.id}
                  onClick={() => onPractice(passage.id)}
                >
                  <span aria-hidden="true">＋</span>
                  <span className="passage-choice-copy">
                    <strong>{passage.title}</strong>
                    <small>{passage.questions} {passage.questions === 1 ? "question" : "questions"}</small>
                  </span>
                  <span className="button-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="dashboard-footer"><span>prephub<span className="brand-period">.</span></span><span>Little by little, a little becomes a lot.</span></footer>
      </main>
    </div>
  );
}
