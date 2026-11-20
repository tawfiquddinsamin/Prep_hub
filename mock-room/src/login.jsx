import { useState } from "react";
import { api, setSession } from "./auth";
import "./login.css";

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const body = mode === "signup" ? { name, email, password } : { email, password };
      const res = await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
      setSession(res.token, res.name);
      onAuth();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About PrepHub">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true"><span /></span>
          <span>prep hub<span className="brand-period">.</span></span>
        </div>

        <div className="auth-story-copy">
          <span className="auth-kicker"><span /> A LITTLE BETTER, EVERY DAY</span>
          <h1>Turn focused practice into real progress.</h1>
          <p>
            Personalized reading drills, clear insights, and steady momentum—
            all in one calm place to build your confidence.
          </p>

          <div className="auth-benefits">
            <div>
              <span className="auth-benefit-icon" aria-hidden="true">↗</span>
              <div><strong>Track your growth</strong><small>See progress by skill</small></div>
            </div>
            <div>
              <span className="auth-benefit-icon" aria-hidden="true">✦</span>
              <div><strong>Practice with purpose</strong><small>Get a drill made for you</small></div>
            </div>
          </div>
        </div>

        <div className="auth-quote">
          <span aria-hidden="true">“</span>
          <p>Small steps compound. Keep showing up.</p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-mobile-brand">
            <span className="auth-brand-mark" aria-hidden="true"><span /></span>
            <span>prep hub<span className="brand-period">.</span></span>
          </div>

          <div className="auth-heading">
            <span className="auth-heading-kicker">{mode === "login" ? "WELCOME BACK" : "START YOUR JOURNEY"}</span>
            <h2>{mode === "login" ? "Ready for a little progress?" : "Create your account"}</h2>
            <p>{mode === "login" ? "Log in to continue your practice." : "It takes less than a minute to get started."}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Sign up
            </button>
          </div>

          <div className="auth-fields">
            {mode === "signup" && (
              <label className="auth-field">
                <span>Name</span>
                <input
                  type="text"
                  placeholder="How should we call you?"
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email address</span>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(current => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          </div>

          {error && <p className="auth-error" role="alert"><span aria-hidden="true">!</span>{error}</p>}

          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? "Please wait…" : mode === "login" ? "Continue learning" : "Create my account"}</span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>

          <p className="auth-switch">
            {mode === "login" ? "New to PrepHub?" : "Already have an account?"}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}