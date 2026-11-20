import "./Navbar.css";

const pageLabels = {
  dashboard: "Dashboard",
  mock: "Mock exam",
  drill: "Coach drill",
  scholarships: "Scholarship finder",
};

export default function Navbar({ current, onDashboard, onScholarships, userName, onLogout }) {
  const name = userName?.trim() || "Student";

  return (
    <header className="site-navbar">
      <div className="site-navbar-inner">
        <a
          className="site-brand"
          href="/"
          onClick={onDashboard ? (event) => {
            event.preventDefault();
            onDashboard();
          } : undefined}
          aria-label="Prephub home"
        >
          <span className="site-brand-mark" aria-hidden="true"><span /></span>
          <span>prephub<span className="site-brand-period">.</span></span>
        </a>

        <nav className="site-navbar-nav" aria-label="Main navigation">
          {current !== "dashboard" && (
            <button className="site-nav-link" onClick={onDashboard} type="button">
              <span aria-hidden="true">←</span> Dashboard
            </button>
          )}
          {current !== "scholarships" && onScholarships && (
            <button className="site-nav-link site-nav-scholarship" onClick={onScholarships} type="button">
              <span aria-hidden="true">✦</span> Scholarship finder
            </button>
          )}
          <span className="site-nav-current" aria-current="page">
            {pageLabels[current]}
          </span>
        </nav>

        <div className="site-navbar-account">
          <div className="site-navbar-user">
            <span className="site-navbar-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span className="site-navbar-user-copy">
              <span>Welcome back</span>
              <strong>{name}</strong>
            </span>
          </div>
          <button className="site-navbar-logout" onClick={onLogout} type="button">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
