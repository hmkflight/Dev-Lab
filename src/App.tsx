import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { Routes, Route, NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  FolderOpen,
  CheckCheck,
  Bot,
  Layers3,
  ArrowUpRight,
  ArrowRight,
  Search,
  CircleHelp,
  X,
  Menu,
  Bell,
} from "lucide-react";
import type { StudioSnapshot } from "../lib/studio-adapter/types";
import { api } from "./api";
import {
  ProjectCard,
  PageTitle,
  NewProjectButton,
  SectionTitle,
  Activity,
  AgentCard,
  Spinner,
  Empty,
  Status,
  PreviewThumb,
  date,
} from "./components/shared";
import { AnimatedNumber, LoadingSignal } from "./components/Motion";
import { Dialog } from "./components/Dialog";
import { Intake } from "./components/Intake";
import { ProjectPage } from "./components/ProjectPage";
const StudioContext = createContext<{
  data: StudioSnapshot;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}>(null!);
export const useStudio = () => useContext(StudioContext);
export default function App() {
  const [data, setData] = useState<StudioSnapshot>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const location = useLocation();
  const refresh = useCallback(async (background = false) => {
    const data = await api.snapshot(background);
    setData(data);
    setError("");
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      void refresh(true).catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const pending =
    data?.approvals.filter(
      (a) =>
        a.status === "pending" &&
        data.projects.some(
          (p) =>
            p.id === a.projectId &&
            !p.archived &&
            !["cancelled", "complete"].includes(p.status),
        ),
    ) || [];
  const nav = [
    { to: "/", label: "Overview", icon: LayoutGrid },
    { to: "/projects", label: "Projects", icon: FolderOpen },
    {
      to: "/approvals",
      label: "Approvals",
      icon: CheckCheck,
      count: pending.length,
    },
    { to: "/agents", label: "Agent station", icon: Bot },
    { to: "/library", label: "Design library", icon: Layers3 },
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            s<span>↗</span>
          </span>
          <span>
            studio<span className="brand-period">.</span>
            <small>BY DEV LAB</small>
          </span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">H</span>
          <div>
            Hudson’s workspace<small>Website production</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map((n) => (
            <NavLink end={n.to === "/"} key={n.to} to={n.to}>
              <n.icon size={18} />
              {n.label}
              {!!n.count && <span className="nav-count">{n.count}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="eyebrow">
              <i />
              DEV LAB CONNECTION
            </span>
            <strong>
              {data?.mode === "devlab"
                ? "Connected to Dev Lab"
                : "Running in demo mode"}
            </strong>
            <p>
              {data?.mode === "devlab" ? (
                <>
                  Your lab is connected.
                  <br />
                  Production state comes from Dev Lab.
                </>
              ) : (
                <>
                  Your studio is ready.
                  <br />
                  Connect your lab when you are.
                </>
              )}
            </p>
            <button onClick={() => setHelp(true)}>
              Integration guide
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            About this studio
          </button>
          <div className="profile">
            <span className="profile-avatar">HM</span>
            <div>
              Hudson Myung<small>Studio owner</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <LoadingSignal />
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {location.pathname.startsWith("/new")
                ? "New project"
                : location.pathname.startsWith("/projects/")
                  ? "Project workspace"
                  : nav.find((n) => n.to === location.pathname)?.label ||
                    "Studio"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`demo-label ${data?.mode === "devlab" ? "live-label" : ""}`}
            >
              {data?.mode === "devlab" ? "DEV LAB CONNECTED" : "DEMO MODE"}
            </span>
            <Link
              to="/approvals"
              className="icon-button notifications"
              aria-label={`${pending.length} pending approvals`}
            >
              <Bell size={19} />
              {pending.length > 0 && <i />}
            </Link>
            <span className="top-avatar">HM</span>
          </div>
        </header>
        <main id="main">
          {error && (
            <div className="error-banner" role="alert">
              {error}{" "}
              <button
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                Retry
              </button>
            </div>
          )}
          {data ? (
            <StudioContext.Provider value={{ data, refresh, notify: setToast }}>
              <div className="route-scene" key={location.pathname}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/new" element={<Intake />} />
                <Route path="/projects/:id" element={<ProjectPage />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/library" element={<Library />} />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="This page isn’t here"
                      copy="Use the sidebar to return to your studio."
                    />
                  }
                />
              </Routes>
              </div>
            </StudioContext.Provider>
          ) : (
            <Spinner />
          )}
        </main>
        <footer className="workspace-footer">
          <span>A little less managing. A little more making.</span>
          <span>Studio / Dev Lab</span>
        </footer>
      </div>
      {toast && (
        <div role="status" className="toast" key={toast}>
          <CheckCheck size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Dialog labelledBy="help-title" onClose={() => setHelp(false)}>
          <div className="row">
            <span className="eyebrow">YOUR STUDIO, YOUR LAB</span>
            <button
              autoFocus
              className="icon-button"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
          </div>
          <h2 id="help-title">Ready for your Dev Lab.</h2>
          <p>
            {data?.mode === "devlab"
              ? "The studio is connected to your Dev Lab. Production state and available actions come from the server adapter."
              : "This is a working demo. Projects and files are saved by the studio server. No agents, production jobs, or external services are running."}
          </p>
          <div className="architecture">
            Browser UI <ArrowRight size={16} /> Server adapter{" "}
            <ArrowRight size={16} /> Your Dev Lab
          </div>
          <p>
            To connect your lab, implement the StudioAdapter interface and
            select it at the server adapter resolver. Stages, agents,
            artifacts, approvals, and quality checks are supplied by the
            adapter.
          </p>
          <p>
            The repository’s <strong>docs/DEVLAB_STUDIO_ADAPTER.md</strong> includes the
            contract, command mapping, and connection checklist.
          </p>
          <button className="button primary" onClick={() => setHelp(false)}>
            Back to the studio
          </button>
        </Dialog>
      )}
    </>
  );
}
function Home() {
  const { data } = useStudio();
  const projects = data.projects.filter((p) => !p.archived);
  const active = projects.filter(
    (p) => !["complete", "cancelled"].includes(p.status),
  );
  const completed = projects.filter((p) => p.status === "complete");
  const pending = data.approvals.filter((a) => a.status === "pending");
  return (
    <>
      <PageTitle
        eyebrow="YOUR CREATIVE WORKSPACE"
        title="Good things are taking shape."
        description="A clear view of the work. Room for what’s next."
      >
        {data.capabilities.canCreateProject && <NewProjectButton />}
      </PageTitle>
      <div className="stats-strip">
        {[
          { value: active.length, label: "Projects in motion" },
          { value: pending.length, label: "Waiting for your eye" },
          {
            value: data.agents.filter((a) => a.status === "working").length,
            label: "Agents at work",
          },
          { value: completed.length, label: "Ready for the world" },
        ].map((s, i) => (
          <div key={s.label}>
            <span className={i === 1 ? "accent" : ""}>
              <AnimatedNumber value={s.value} />
            </span>
            <small>{s.label}</small>
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <Link
          to={`/projects/${pending[0].projectId}?tab=review`}
          className="approval-banner"
        >
          <span className="approval-icon">
            <CheckCheck size={24} />
          </span>
          <div>
            <span className="eyebrow">YOUR PERSPECTIVE IS NEEDED</span>
            <h3>
              {data.projects.find((p) => p.id === pending[0].projectId)?.name}{" "}
              is ready for your review.
            </h3>
            <p>
              {pending[0].kind} approval · Take a look before the next chapter.
            </p>
          </div>
          <span className="button light">
            Review {pending[0].kind === "Direction" ? "direction" : "project"}
            <ArrowUpRight size={17} />
          </span>
        </Link>
      )}
      <SectionTitle
        title="On the studio floor"
        to="/projects"
        label="All projects"
      />
      <div className="project-grid">
        {active.slice(0, 3).map((p) => (
          <ProjectCard key={p.id} project={p} agents={data.agents} />
        ))}
        {active.length === 0 && (
          <Empty
            title="Room for something new"
            copy="Start a project to bring your next website to life."
          />
        )}
      </div>
      <div className="home-lower">
        <section className="panel">
          <SectionTitle
            title="Around the studio"
            to="/agents"
            label="Agent station"
          />
          <Activity events={data.events.slice(0, 4)} />
        </section>
        <section className="panel completed-panel">
          <SectionTitle
            title="Freshly finished"
            to="/projects?filter=complete"
          />
          {completed.slice(0, 2).map((p) => (
            <Link
              className="completed-project"
              key={p.id}
              to={`/projects/${p.id}?tab=review`}
            >
              <PreviewThumb url={p.previewUrl} theme={p.theme} name={p.name} />
              <div>
                <span className="eyebrow">{p.industry}</span>
                <h3>{p.name}</h3>
                <Status status="complete" />
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
          {completed.length === 0 && (
            <Empty
              title="Great work takes shape here"
              copy="Finished projects will appear here."
            />
          )}
          <div className="small-note">A finished website. A new beginning.</div>
        </section>
      </div>
    </>
  );
}
function Projects() {
  const { data } = useStudio();
  const location = useLocation();
  const [filter, setFilter] = useState(
    new URLSearchParams(location.search).get("filter") || "all",
  );
  const [query, setQuery] = useState("");
  const projects = data.projects.filter(
    (p) =>
      (filter === "archived" ? p.archived : !p.archived) &&
      (filter === "all" || filter === "archived" || p.status === filter) &&
      `${p.name} ${p.industry}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="THE WORK"
        title="Every project, in perspective."
        description="From the first thought to the final detail."
      >
        {data.capabilities.canCreateProject && <NewProjectButton />}
      </PageTitle>
      <div className="toolbar">
        <div className="filter-tabs">
          {[
            ["all", "All projects"],
            ["working", "In progress"],
            ["waiting", "Needs approval"],
            ["blocked", "Needs content"],
            ["complete", "Completed"],
            ["archived", "Archived"],
          ].map(([value, label]) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search projects"
            placeholder="Find a project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} agents={data.agents} />
        ))}
      </div>
      {!projects.length && (
        <Empty
          title="No projects here yet"
          copy="Try another filter or start something new."
        />
      )}
    </>
  );
}
function Agents() {
  const { data } = useStudio();
  return (
    <>
      <PageTitle
        eyebrow="THE TEAM BEHIND THE WORK"
        title="Agent station."
        description="Who’s working, what’s happening, and what comes next."
      />
      {data.mode === "mock" && (
        <div className="info-note">
          Demo assignments · Real agent status will come from your Dev Lab.
        </div>
      )}
      <div className="agent-grid">
        {data.agents.map((a) => (
          <AgentCard key={a.id} agent={a} projects={data.projects} />
        ))}
      </div>
      <section className="panel">
        <SectionTitle title="Latest from the team" />
        <Activity events={data.events.slice(0, 8)} />
      </section>
    </>
  );
}
function Approvals() {
  const { data } = useStudio();
  const pending = data.approvals.filter(
    (a) =>
      a.status === "pending" &&
      data.projects.some((p) => p.id === a.projectId && !p.archived),
  );
  const history = data.approvals.filter((a) => a.status !== "pending");
  return (
    <>
      <PageTitle
        eyebrow="A HUMAN TOUCH"
        title="Your eye makes the difference."
        description="A few considered decisions. Then the studio keeps moving."
      />
      <SectionTitle title={`Waiting for you · ${pending.length}`} />
      <div className="approval-grid">
        {pending.map((a) => {
          const p = data.projects.find((p) => p.id === a.projectId)!;
          return (
            <article key={a.id} className="approval-card">
              <PreviewThumb url={p.previewUrl} theme={p.theme} name={p.name} />
              <div>
                <span className="eyebrow">{a.kind} APPROVAL</span>
                <h2>{p.name}</h2>
                <p>{a.description}</p>
                <Link
                  className="button primary"
                  to={`/projects/${p.id}?tab=review`}
                >
                  Review{" "}
                  {a.kind === "Direction"
                    ? "concepts"
                    : a.kind === "Build"
                      ? "design"
                      : "website"}
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!pending.length && (
        <Empty
          title="You’re all caught up."
          copy="The studio will ask when a human decision is needed."
        />
      )}
      {history.length > 0 && (
        <section className="panel">
          <SectionTitle title="Decision history" />
          {history.map((a) => (
            <div key={a.id} className="history-row">
              <div>
                <strong>
                  {data.projects.find((p) => p.id === a.projectId)?.name}
                </strong>
                <p>
                  {a.kind} ·{" "}
                  {a.status === "approved" ? "Approved" : a.status === "cancelled" ? "Cancelled" : "Changes requested"}
                  {a.feedback && ` — ${a.feedback}`}
                </p>
              </div>
              <small>{date(a.resolvedAt || a.createdAt)}</small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function Library() {
  const { data } = useStudio();
  const [filter, setFilter] = useState("All work");
  const [selected, setSelected] = useState<string[]>([]);
  const categories = [
    "All work",
    ...new Set(data.library.map((l) => l.category)),
  ];
  return (
    <>
      <PageTitle
        eyebrow="GOOD IDEAS HAVE A SECOND LIFE"
        title="The design library."
        description="References to build on. Never templates to be boxed into."
      >
        {data.capabilities.canCreateProject && selected.length > 0 && (
          <Link
            className="button primary"
            to={`/new?references=${selected.join(",")}`}
          >
            New project with {selected.length} reference
            {selected.length > 1 ? "s" : ""}
            <ArrowRight size={17} />
          </Link>
        )}
      </PageTitle>
      {!data.capabilities.canReadLibrary && <Empty title="Library unavailable" copy="The active adapter does not support reading the design library." />}
      <div className="filter-tabs library-filters">
        {categories.map((c) => (
          <button
            className={filter === c ? "active" : ""}
            key={c}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="library-grid">
        {(data.capabilities.canReadLibrary ? data.library : [])
          .filter((l) => filter === "All work" || l.category === filter)
          .map((l) => (
            <article className="library-card" key={l.id}>
              <PreviewThumb url={l.previewUrl} theme={l.theme} name={l.name} />
              <div className="library-body">
                <div className="row">
                  <span className="eyebrow">{l.category}</span>
                  <small>{date(l.createdAt)}</small>
                </div>
                <h3>{l.name}</h3>
                <p>{l.description}</p>
                <div className="library-meta">
                  <span>{l.style}</span>
                  <span>{l.industry}</span>
                </div>
                <button
                  className={`button ${selected.includes(l.id) ? "primary" : "secondary"}`}
                  disabled={!data.capabilities.canReadLibrary || !data.capabilities.canCreateProject}
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(l.id)
                        ? s.filter((id) => id !== l.id)
                        : [...s, l.id],
                    )
                  }
                >
                  {selected.includes(l.id) ? (
                    <CheckCheck size={16} />
                  ) : (
                    <Layers3 size={16} />
                  )}{" "}
                  {selected.includes(l.id)
                    ? "Reference selected"
                    : "Use as reference"}
                </button>
              </div>
            </article>
          ))}
      </div>
    </>
  );
}
