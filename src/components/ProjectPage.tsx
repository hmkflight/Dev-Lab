import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Play,
  Pause,
  X,
  Archive,
  CheckCheck,
  ArrowRight,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  FileText,
  Download,
  AlertCircle,
  Check,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import type {
  ProjectDetail,
  ProjectAction,
  StudioApproval,
  StudioArtifact,
} from "../../lib/studio-adapter/types";
import { api } from "../api";
import { useStudio } from "../App";
import {
  Status,
  Timeline,
  Activity,
  AgentCard,
  Empty,
  Spinner,
  PageTitle,
  SectionTitle,
  date,
  safeUrl,
} from "./shared";
import { Dialog } from "./Dialog";
import { ContextFields, parseLinks, FileDrop } from "./Intake";
export function ProjectPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const { data, refresh, notify } = useStudio();
  const [detail, setDetail] = useState<ProjectDetail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ProjectAction>();
  const [logs, setLogs] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    const next = await api.project(id);
    setDetail(next);
  }, [id]);
  useEffect(() => {
    setDetail(undefined);
    setError("");
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      void load().catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);
  async function mutate(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      await Promise.all([load(), refresh()]);
      notify(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function action(action: ProjectAction) {
    await mutate(
      () => api.action(id!, action),
      action === "advance-demo"
        ? "Demo moved to the next stage."
        : action === "resolve-demo"
          ? "Demo content marked as supplied."
          : `Project ${action === "pause" ? "paused" : action === "resume" ? "resumed" : action === "archive" ? "archived" : action === "start" ? "started" : "cancelled"}.`,
    );
    setConfirm(undefined);
  }
  if (!detail)
    return error ? (
      <div className="error-banner" role="alert">
        {error}
        <Link to="/projects">Back to projects</Link>
      </div>
    ) : (
      <Spinner />
    );
  const p = detail.project;
  const pending = detail.approvals.find((a) => a.status === "pending");
  const actions = p.actions;
  const currentAgent = data.agents.find((a) => a.id === p.agentId);
  const tabs = [
    "overview",
    "context",
    "progress",
    "agents",
    "artifacts",
    "media",
    "iterations",
    "review",
    "qa",
  ];
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={15} />
        All projects
      </Link>
      <PageTitle
        eyebrow={`${p.industry || "YOUR PROJECT"}${p.archived ? " · ARCHIVED" : ""}`}
        title={p.name}
        description={p.summary}
      >
        <div className="project-actions">
          {safeUrl(p.websiteUrl) && (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="button secondary"
            >
              Open website
              <ArrowUpRight size={16} />
            </a>
          )}
          {actions.includes("start") && (
            <button
              disabled={busy}
              className="button primary"
              onClick={() => void action("start")}
            >
              <Play size={15} />
              Start factory
            </button>
          )}
          {actions.includes("resume") && (
            <button
              disabled={busy}
              className="button primary"
              onClick={() => void action("resume")}
            >
              <Play size={15} />
              Continue
            </button>
          )}
          {actions.includes("pause") && (
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => void action("pause")}
            >
              <Pause size={15} />
              Pause
            </button>
          )}
          {actions.includes("archive") && (
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => void action("archive")}
            >
              <Archive size={15} />
              Archive
            </button>
          )}
          {actions.includes("cancel") && (
            <button
              disabled={busy}
              className="icon-button cancel-action"
              aria-label="Cancel run"
              title="Cancel run"
              onClick={() => setConfirm("cancel")}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </PageTitle>
      <div className="project-meta">
        <Status status={p.status} />
        <span>
          Stage{" "}
          <strong>
            {p.stages.find((s) => s.id === p.stageId)?.name || p.stageId}
          </strong>
        </span>
        <span>
          Agent <strong>{currentAgent?.name || "Unassigned"}</strong>
        </span>
        <span>
          Updated <strong>{date(p.updatedAt)}</strong>
        </span>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {p.status === "blocked" && (
        <div className="blocked-banner">
          <AlertCircle size={21} />
          <div>
            <strong>A few pieces are missing.</strong>
            <p>
              {p.context.notes ||
                "Review the quality report and add the missing client content."}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => setParams({ tab: "context" })}
          >
            Add context
            <ArrowRight size={16} />
          </button>
          {actions.includes("resolve-demo") && (
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => void action("resolve-demo")}
            >
              Demo: mark supplied
            </button>
          )}
        </div>
      )}
      {pending && (
        <ApprovalPanel
          approval={pending}
          project={detail}
          busy={busy}
          onReview={() => setParams({ tab: "review" })}
          onDecision={(decision, feedback) =>
            mutate(
              () => api.approve(p.id, pending.id, decision, feedback),
              decision === "approve"
                ? "Approval saved."
                : data.mode === "demo"
                  ? "Feedback saved. A new demo review is ready."
                  : "Feedback sent to Dev Lab.",
            )
          }
          compact={tab !== "review"}
        />
      )}
      <div
        className="project-tabs"
        role="tablist"
        aria-label="Project sections"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const next =
              tabs[
                (tabs.indexOf(tab) +
                  (e.key === "ArrowRight" ? 1 : -1) +
                  tabs.length) %
                  tabs.length
              ];
            setParams({ tab: next });
            (
              e.currentTarget.querySelector(
                `[data-tab="${next}"]`,
              ) as HTMLButtonElement
            )?.focus();
          }
        }}
      >
        {tabs.map((t) => (
          <button
            role="tab"
            data-tab={t}
            tabIndex={tab === t ? 0 : -1}
            aria-selected={tab === t}
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setParams({ tab: t })}
          >
            {t === "qa" ? "QA" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {(tab === "overview" || tab === "progress") && (
          <>
            <section className="panel progress-panel">
              <div className="section-heading">
                <h2>
                  {p.status === "complete"
                    ? "From idea to finished."
                    : "The work, taking shape."}
                </h2>
                {actions.includes("advance-demo") && (
                  <button
                    disabled={busy}
                    className="button secondary small"
                    onClick={() => void action("advance-demo")}
                  >
                    <Play size={14} />
                    Continue demo
                  </button>
                )}
              </div>
              <Timeline stages={p.stages} />
              {data.mode === "demo" && (
                <p className="demo-caption">
                  Demo stages advance only when you press Continue demo.
                  Approval gates require a decision.
                </p>
              )}
            </section>
            {tab === "overview" && (
              <div className="overview-grid">
                <section className="panel overview-preview">
                  <SectionTitle title="The latest perspective" />
                  <Review detail={detail} compact />
                  <button
                    className="button secondary full"
                    onClick={() => setParams({ tab: "review" })}
                  >
                    Open presentation view
                    <ArrowUpRight size={17} />
                  </button>
                </section>
                <section className="panel">
                  <SectionTitle title="Project notes" />
                  <h3>The ambition</h3>
                  <p className="reading">
                    {p.context.goals || "Add the project goals in Context."}
                  </p>
                  <h3>Made for</h3>
                  <p className="reading">
                    {p.context.audience ||
                      "Tell the studio about the audience."}
                  </p>
                  <h3>Quality at a glance</h3>
                  <div className="mini-qa">
                    {detail.review.categories.slice(0, 3).map((c) => (
                      <div key={c.id}>
                        <span>{c.name}</span>
                        <strong className={c.status}>{c.value}</strong>
                      </div>
                    ))}
                    {!detail.review.categories.length && (
                      <p className="muted">
                        Quality results appear after the review stage.
                      </p>
                    )}
                  </div>
                  {p.referenceIds.length > 0 && (
                    <>
                      <h3>Design references</h3>
                      {p.referenceIds.map((ref) => (
                        <p key={ref}>
                          {data.library.find((l) => l.id === ref)?.name || ref}
                        </p>
                      ))}
                    </>
                  )}
                </section>
              </div>
            )}
            <section className="panel">
              <div className="section-heading">
                <h2>Studio activity</h2>
                <button className="text-button" onClick={() => setLogs(!logs)}>
                  {logs ? "Hide details" : "View details"}
                  <ChevronDown size={15} />
                </button>
              </div>
              <Activity events={detail.events} details={logs} />
            </section>
          </>
        )}
        {tab === "context" && (
          <ProjectContext
            detail={detail}
            onSave={(context) =>
              mutate(
                () => api.context(p.id, context),
                "Client context updated.",
              )
            }
            busy={busy}
          />
        )}
        {tab === "agents" && (
          <div className="agent-grid">
            {detail.agents.map((a) => (
              <AgentCard key={a.id} agent={a} projects={data.projects} />
            ))}
            {!detail.agents.length && (
              <Empty
                title="No agents assigned"
                copy="The adapter will show assignments when the run needs them."
              />
            )}
          </div>
        )}
        {tab === "artifacts" && (
          <Artifacts artifacts={detail.artifacts.filter((a) => !a.uploaded)} />
        )}
        {tab === "media" && (
          <Media
            detail={detail}
            busy={busy}
            onUpload={(files) =>
              mutate(
                () => api.upload(p.id, files),
                "Assets saved to the project.",
              )
            }
          />
        )}
        {tab === "iterations" && (
          <div className="iteration-list">
            {[...detail.iterations].reverse().map((it) => (
              <article className="panel iteration-card" key={it.id}>
                <div>
                  <span className="eyebrow">
                    {it.status} · {date(it.createdAt)}
                  </span>
                  <h2>{it.name}</h2>
                  <p>{it.summary}</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setParams({ tab: "review", iteration: it.id })}
                >
                  Review iteration
                  <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
            {!detail.iterations.length && (
              <Empty
                title="The first idea is still taking shape"
                copy="Each saved iteration will appear here."
              />
            )}
          </div>
        )}
        {tab === "review" && (
          <Review
            detail={detail}
            initialIteration={params.get("iteration") || undefined}
          />
        )}
        {tab === "qa" && <Quality detail={detail} />}
      </div>
      {confirm && (
        <Dialog
          alert
          labelledBy="cancel-title"
          onClose={() => setConfirm(undefined)}
        >
          <h2 id="cancel-title">Cancel this demo run?</h2>
          <p>
            The project, context, and artifacts will remain available. The run
            will stop and pending approvals will close.
          </p>
          <div className="button-row">
            <button
              autoFocus
              className="button secondary"
              onClick={() => setConfirm(undefined)}
            >
              Keep working
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void action("cancel")}
            >
              Cancel run
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function ApprovalPanel({
  approval,
  project,
  busy,
  onReview,
  onDecision,
  compact,
}: {
  approval: StudioApproval;
  project: ProjectDetail;
  busy: boolean;
  onReview: () => void;
  onDecision: (
    decision: "approve" | "changes",
    feedback: string,
  ) => Promise<boolean>;
  compact: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [change, setChange] = useState(false);
  const paused = project.project.status === "paused";
  return (
    <section className="approval-panel">
      <div className="approval-panel-heading">
        <span className="approval-icon">
          <CheckCheck size={23} />
        </span>
        <div>
          <span className="eyebrow">{approval.kind} APPROVAL REQUIRED</span>
          <h3>{approval.title}</h3>
          <p>
            {paused
              ? "Resume this project to make a decision."
              : approval.description}
          </p>
        </div>
        {compact && (
          <button className="button primary" onClick={onReview}>
            Review{" "}
            {approval.kind === "Direction"
              ? "concepts"
              : approval.kind === "Build"
                ? "design"
                : "website"}
            <ArrowUpRight size={16} />
          </button>
        )}
      </div>
      {!compact && (
        <div className="approval-decision">
          {change && (
            <label className="field">
              <span>What should change?</span>
              <textarea
                autoFocus
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="A clear note helps the studio find the next direction."
              />
            </label>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={busy || paused}
              onClick={() => void onDecision("approve", feedback)}
            >
              <Check size={17} />{" "}
              {approval.kind === "Final"
                ? "Approve & complete"
                : "Approve " + approval.kind.toLowerCase()}
            </button>
            {change ? (
              <>
                <button
                  className="button secondary"
                  disabled={busy || paused || !feedback.trim()}
                  onClick={() =>
                    void onDecision("changes", feedback).then((ok) => {
                      if (ok) {
                        setChange(false);
                        setFeedback("");
                      }
                    })
                  }
                >
                  Send feedback
                </button>
                <button
                  className="text-button"
                  onClick={() => setChange(false)}
                >
                  Keep reviewing
                </button>
              </>
            ) : (
              <button
                className="button secondary"
                disabled={busy || paused}
                onClick={() => setChange(true)}
              >
                Request changes
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function ProjectContext({
  detail,
  onSave,
  busy,
}: {
  detail: ProjectDetail;
  onSave: (context: ProjectDetail["project"]["context"]) => Promise<boolean>;
  busy: boolean;
}) {
  const [context, setContext] = useState(detail.project.context);
  const [links, setLinks] = useState(context.links.join("\n"));
  const [error, setError] = useState("");
  const locked =
    detail.project.archived ||
    ["complete", "cancelled"].includes(detail.project.status);
  return (
    <form
      className="context-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const parsed = parseLinks(links);
          setError("");
          void onSave({ ...context, links: parsed });
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <fieldset disabled={locked || busy}>
        <ContextFields
          value={context}
          onChange={setContext}
          links={links}
          onLinks={setLinks}
        />
      </fieldset>
      {error && <p className="field-error">{error}</p>}
      {locked ? (
        <p className="info-note">
          Context is read-only for finished or archived projects.
        </p>
      ) : (
        <button className="button primary" disabled={busy}>
          Save context
          <Check size={16} />
        </button>
      )}
    </form>
  );
}
function Artifacts({ artifacts }: { artifacts: StudioArtifact[] }) {
  return artifacts.length ? (
    <div className="artifact-list">
      {artifacts.map((a) => (
        <article className="panel artifact" key={a.id}>
          <FileText size={23} />
          <div>
            <span className="eyebrow">
              {a.type} · {date(a.createdAt)}
            </span>
            <h3>{a.name}</h3>
            {a.content && (
              <details>
                <summary>Read artifact</summary>
                <p className="artifact-content">{a.content}</p>
              </details>
            )}
          </div>
          {safeUrl(a.url) && (
            <a
              className="button secondary"
              href={a.url}
              target="_blank"
              rel="noreferrer"
            >
              Open
              <ExternalLink size={15} />
            </a>
          )}
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title="A place for the work"
      copy="Research, design directions, and other artifacts will appear here."
    />
  );
}
function Media({
  detail,
  busy,
  onUpload,
}: {
  detail: ProjectDetail;
  busy: boolean;
  onUpload: (files: File[]) => Promise<boolean>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const locked =
    detail.project.archived ||
    ["complete", "cancelled"].includes(detail.project.status);
  return (
    <div className="media-layout">
      <section>
        <SectionTitle title="Client assets" />
        {detail.artifacts
          .filter((a) => a.uploaded)
          .map((a) => (
            <article className="panel asset-row" key={a.id}>
              <FileText size={23} />
              <div>
                <strong>{a.name}</strong>
                <small>
                  {a.mimeType} · {Math.ceil((a.size || 0) / 1024)} KB
                </small>
              </div>
              {safeUrl(a.url) && (
                <a
                  href={a.url}
                  className="icon-button"
                  aria-label={`Download ${a.name}`}
                >
                  <Download size={18} />
                </a>
              )}
            </article>
          ))}
        {!detail.artifacts.some((a) => a.uploaded) && (
          <Empty
            title="All the pieces, together"
            copy="Upload the client’s logos, imagery, and documents."
          />
        )}
      </section>
      {!locked && (
        <section className="panel">
          <h2>Add to the collection</h2>
          <FileDrop files={files} setFiles={setFiles} />
          <button
            className="button primary full"
            disabled={busy || !files.length}
            onClick={() =>
              void onUpload(files).then((ok) => {
                if (ok) setFiles([]);
              })
            }
          >
            Upload {files.length || ""} asset{files.length === 1 ? "" : "s"}
          </button>
        </section>
      )}
    </div>
  );
}
function Quality({ detail }: { detail: ProjectDetail }) {
  const { data } = useStudio();
  const review = detail.review;
  const sections = [...new Set(review.issues.map((i) => i.section))];
  return (
    <>
      {data.mode === "demo" && (
        <div className="info-note">
          Illustrative demo QA · These results are not live audits of the
          website.
        </div>
      )}
      {review.categories.length ? (
        <>
          <div className="qa-grid">
            {review.categories.map((c) => (
              <article className="qa-card" key={c.id}>
                <span>{c.name}</span>
                <strong className={c.status}>
                  {c.status === "pass" ? (
                    <Check size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}{" "}
                  {c.value}
                </strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <SectionTitle title="The details that matter" />
            {sections.map((section) => (
              <div className="qa-section" key={section}>
                <h3>{section}</h3>
                {review.issues
                  .filter((i) => i.section === section)
                  .map((i) => (
                    <div className={`qa-issue ${i.severity}`} key={i.id}>
                      {i.severity === "passed" ? (
                        <Check size={18} />
                      ) : (
                        <AlertCircle size={18} />
                      )}
                      <span>{i.message}</span>
                      {i.severity === "blocker" && <small>BLOCKER</small>}
                    </div>
                  ))}
              </div>
            ))}
          </section>
        </>
      ) : (
        <Empty
          title="Quality review is up next"
          copy="Results will appear when Dev Lab supplies its first report."
        />
      )}
    </>
  );
}
function Review({
  detail,
  compact = false,
  initialIteration,
}: {
  detail: ProjectDetail;
  compact?: boolean;
  initialIteration?: string;
}) {
  const { data } = useStudio();
  const p = detail.project;
  const iterations = detail.iterations;
  const [iterationId, setIterationId] = useState(
    initialIteration || iterations.at(-1)?.id || "",
  );
  const [device, setDevice] = useState("desktop");
  const [section, setSection] = useState("Website");
  const [compare, setCompare] = useState(false);
  const artifactTypes = [
    ...new Set(detail.artifacts.filter((a) => !a.uploaded).map((a) => a.type)),
  ];
  const selected =
    iterations.find((i) => i.id === iterationId) || iterations.at(-1);
  const url = selected?.previewUrl || p.previewUrl;
  const index = iterations.findIndex((i) => i.id === selected?.id);
  const previous = iterations[index - 1];
  const widths: Record<string, number> = {
    desktop: 1280,
    tablet: 768,
    mobile: 390,
  };
  if (compact)
    return safeUrl(url) ? (
      <div className="compact-preview">
        <iframe
          src={url}
          title={`${p.name} latest website`}
          sandbox="allow-scripts"
          tabIndex={-1}
        />
      </div>
    ) : (
      <Empty
        title="The canvas is waiting"
        copy="A preview will appear when the first concept is ready."
      />
    );
  return (
    <section className="review">
      <div className="review-sections">
        <div className="filter-tabs">
          {[...artifactTypes, "Iterations", "Website"].map((s) => (
            <button
              key={s}
              className={section === s ? "active" : ""}
              onClick={() => setSection(s)}
            >
              {s === "Website" ? "Final website" : s}
            </button>
          ))}
        </div>
      </div>
      {artifactTypes.includes(section) ? (
        <Artifacts
          artifacts={detail.artifacts.filter((a) => a.type === section)}
        />
      ) : (
        <>
          <div className="review-toolbar">
            <div className="device-toggle" aria-label="Preview device">
              {[
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ].map(([name, Icon]) => {
                const Component = Icon as typeof Monitor;
                return (
                  <button
                    key={String(name)}
                    className={device === name ? "active" : ""}
                    onClick={() => setDevice(String(name))}
                    aria-label={`${name} preview`}
                    aria-pressed={device === name}
                  >
                    <Component size={18} />
                    <span>{String(name)}</span>
                  </button>
                );
              })}
            </div>
            <div className="review-controls">
              {iterations.length > 0 && (
                <select
                  aria-label="Select iteration"
                  value={selected?.id || ""}
                  onChange={(e) => setIterationId(e.target.value)}
                >
                  {iterations.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} · {it.status}
                    </option>
                  ))}
                </select>
              )}
              {previous && (
                <button
                  className={`button secondary small ${compare ? "selected" : ""}`}
                  onClick={() => setCompare(!compare)}
                >
                  {compare ? "Single view" : "Compare previous"}
                </button>
              )}
              {safeUrl(url) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label="Open preview in new tab"
                >
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>
          {safeUrl(url) ? (
            <div
              className={`preview-stage ${compare && previous ? "compare" : ""}`}
            >
              <div className="preview-column">
                {compare && previous && (
                  <span className="preview-label">
                    Current selection · {selected?.name}
                  </span>
                )}
                <div
                  className="browser-frame"
                  style={{ width: widths[device], maxWidth: "100%" }}
                >
                  <div className="browser-chrome">
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                    <small>
                      {p.name} / {data.mode === "demo" ? "demo" : "preview"}
                    </small>
                    <RefreshCw size={12} />
                  </div>
                  <iframe
                    key={`${url}-${device}`}
                    src={url}
                    title={`${p.name} ${selected?.name || ""} ${device} preview`}
                    sandbox="allow-scripts"
                  />
                </div>
              </div>
              {compare && previous && (
                <div className="preview-column">
                  <span className="preview-label">
                    Previous iteration · {previous.name}
                  </span>
                  <div
                    className="browser-frame"
                    style={{ width: widths[device], maxWidth: "100%" }}
                  >
                    <div className="browser-chrome">
                      <small>Previous iteration</small>
                    </div>
                    <iframe
                      src={previous.previewUrl}
                      title={`Previous iteration ${previous.name}`}
                      sandbox="allow-scripts"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Empty
              title="A new perspective is on its way"
              copy="The website preview will appear when an iteration is available."
            />
          )}
          <div className="review-caption">
            <span>{selected?.summary || "Website preview"}</span>
            <span>
              {data.mode === "demo"
                ? "Illustrative demo website"
                : "Website preview"}{" "}
              ·{" "}
              {device === "desktop"
                ? "Fits available canvas"
                : `${widths[device]}px canvas when space allows`}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
