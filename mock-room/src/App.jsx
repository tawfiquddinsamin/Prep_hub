import { useState } from "react";
import MockRoom from "./MockRoom";
import DrillRoom from "./DrillRoom";
import Dashboard from "./dashboard";
import ScholarshipChat from "./ScholarshipChat";
import Login from "./login";
import { getToken, getName, logout } from "./auth";

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [view, setView] = useState({ page: "dashboard" });
  const home = () => setView({ page: "dashboard" });
  const name = getName().trim() || "Student";
  const openScholarships = () => setView({ page: "scholarships" });
  const signOut = () => {
    logout();
    setAuthed(false);
    setView({ page: "dashboard" });
  };

  if (!authed) return <Login onAuth={() => setAuthed(true)} />;

  return (
    <>
      {view.page === "mock" && (
        <MockRoom
          sid={view.id}
          onDashboard={home}
          onScholarships={openScholarships}
          userName={name}
          onLogout={signOut}
        />
      )}
      {view.page === "drill" && (
        <DrillRoom
          onDone={home}
          onScholarships={openScholarships}
          userName={name}
          onLogout={signOut}
        />
      )}
      {view.page === "scholarships" && (
        <ScholarshipChat onDashboard={home} userName={name} onLogout={signOut} />
      )}
      {view.page === "dashboard" && (
        <Dashboard
          onPractice={id => setView({ page: "mock", id })}
          onDrill={() => setView({ page: "drill" })}
          onScholarships={openScholarships}
          userName={name}
          onLogout={signOut}
        />
      )}
    </>
  );
}