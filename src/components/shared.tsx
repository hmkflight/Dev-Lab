import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  LoaderCircle,
  Plus,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  StudioProject,
  StudioAgent,
  StudioEvent,
  StudioStage,
} from "../../lib/studio-adapter/types";
export const statusNames: Record<string, string> = {
  working: "In progress",
  waiting: "Needs approval",
  blocked: "Needs content",
  paused: "Paused",
  complete: "Complete",
  cancelled: "Cancelled",
  draft: "Draft",
  idle: "Available",
};
export function Status({ status }: { status: string }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusNames[status] || status}
    </span>
  );
}
export function date(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export function time(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
export function Empty({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="empty">
      <FileText size={26} />
      <h3>{title}</h3>
      {copy && <p>{copy}</p>}
    </div>
  );
}
export function PreviewThumb({
  url,
  theme,
  name,
  screenshot,
}: {
  url?: string;
  theme: string;
  name: string;
  screenshot?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`preview-thumb ${theme}`}>
      {safeUrl(screenshot) && !failed ? (
        <img
          src={screenshot}
          alt={`${name} website preview`}
          onError={() => setFailed(true)}
        />
      ) : safeUrl(url) ? (
        <iframe
          aria-hidden="true"
          title={`${name} thumbnail`}
          src={url}
          loading="lazy"
          sandbox="allow-scripts"
          tabIndex={-1}
        />
      ) : (
        <div className="preview-placeholder">
          <span>YOUR NEXT GREAT WEBSITE</span>
          <strong>{name}</strong>
          <small>The story starts here.</small>
        </div>
      )}
      <span className="preview-shade" />
    </div>
  );
}
export function ProjectCard({
  project,
  agents,
}: {
  project: StudioProject;
  agents: StudioAgent[];
}) {
  const agent = agents.find((a) => a.id === project.agentId);
  return (
    <Link to={`/projects/${project.id}`} className="project-card">
      <PreviewThumb
        screenshot={project.screenshotUrl}
        url={project.previewUrl}
        name={project.name}
        theme={project.theme}
      />
      <div className="project-card-body">
        <div className="row">
          <span className="eyebrow">{project.industry || "New project"}</span>
          <ArrowUpRight size={17} />
        </div>
        <h3>{project.name}</h3>
        <div className="row card-status">
          <Status status={project.status} />
          <span className="stage-label">
            {project.stages.find((s) => s.id === project.stageId)?.name}
          </span>
        </div>
        <div className="card-footer">
          <span>
            {agent ? (
              <>
                <span className={`avatar tiny ${agent.color}`}>
                  {agent.initials}
                </span>
                {agent.name}
              </>
            ) : project.status === "complete" ? (
              "Ready to share"
            ) : (
              "Studio workspace"
            )}
          </span>
          <small>{date(project.updatedAt)}</small>
        </div>
      </div>
    </Link>
  );
}
export function Timeline({ stages }: { stages: StudioStage[] }) {
  return (
    <ol className="timeline">
      {stages.map((s) => (
        <li className={s.status} key={s.id}>
          <span className="stage-node">
            {s.status === "complete" ? (
              <Check size={16} />
            ) : s.status === "active" ? (
              <Circle size={13} fill="currentColor" />
            ) : (
              <Circle size={13} />
            )}
          </span>
          <strong>{s.name}</strong>
          <small>
            {s.status === "active"
              ? "In progress"
              : s.status === "complete"
                ? "Done"
                : s.status === "blocked"
                  ? "Blocked"
                  : "Upcoming"}
          </small>
        </li>
      ))}
    </ol>
  );
}
export function Activity({
  events,
  details = false,
}: {
  events: StudioEvent[];
  details?: boolean;
}) {
  return (
    <div className="activity-feed">
      {events.length ? (
        events.map((e) => (
          <div className="activity" key={e.id}>
            <span className="activity-marker">
              <Check size={13} />
            </span>
            <div>
              <p>
                {e.agentName && <strong>{e.agentName} </strong>}
                {e.message}
              </p>
              <small>
                {date(e.createdAt)} · {time(e.createdAt)}
              </small>
              {details && <pre>{e.details || "No additional details."}</pre>}
            </div>
          </div>
        ))
      ) : (
        <Empty
          title="A fresh start"
          copy="Project activity will appear here."
        />
      )}
    </div>
  );
}
export function AgentCard({
  agent,
  projects,
}: {
  agent: StudioAgent;
  projects: StudioProject[];
}) {
  const project = projects.find((p) => p.id === agent.projectId);
  return (
    <article className="agent-card">
      <div className="row">
        <span className={`avatar large ${agent.color}`}>{agent.initials}</span>
        <Status status={agent.status} />
      </div>
      <h3>{agent.name}</h3>
      <small>{agent.role}</small>
      <p className="agent-task">{agent.task}</p>
      {project ? (
        <Link className="agent-project" to={`/projects/${project.id}`}>
          {project.name}
          <ArrowUpRight size={14} />
        </Link>
      ) : (
        <span className="muted">No current project</span>
      )}
      <div className="latest-result">
        <span className="eyebrow">LATEST RESULT</span>
        <p>{agent.latestResult}</p>
      </div>
    </article>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function NewProjectButton() {
  return (
    <Link className="button primary" to="/new">
      <Plus size={17} />
      New project
    </Link>
  );
}
export function SectionTitle({
  title,
  to,
  label = "View all",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link to={to}>
          {label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" />
      Loading your studio…
    </div>
  );
}
export function safeUrl(url?: string) {
  return (
    !!url &&
    (/^https?:\/\//i.test(url) ||
      (/^\/(?!\/)/.test(url) && !url.includes("\\")))
  );
}
