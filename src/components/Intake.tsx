import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  X,
  File,
  LoaderCircle,
  Layers3,
} from "lucide-react";
import type { StudioContext } from "../../lib/studio-adapter/types";
import { api } from "../api";
import { useStudio } from "../App";
import { PageTitle } from "./shared";
import { emptyContext as blankContext } from "../../lib/studio-adapter/defaults";
export function ContextFields({
  value,
  onChange,
  links,
  onLinks,
}: {
  value: StudioContext;
  onChange: (c: StudioContext) => void;
  links: string;
  onLinks: (s: string) => void;
}) {
  const field = (
    key: keyof StudioContext,
    label: string,
    placeholder: string,
    rows = 3,
  ) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={String(value[key])}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <section className="form-section">
        <div className="form-section-title">
          <span>01</span>
          <div>
            <h2>The big picture</h2>
            <p>Give the studio a little context. Rough notes are welcome.</p>
          </div>
        </div>
        {field(
          "description",
          "About the company",
          "What do they do? What makes them different?",
        )}
        <div className="two-col">
          {field("goals", "Goals", "What should this website achieve?")}
          {field("audience", "Audience", "Who are we creating this for?")}
        </div>
        {field(
          "requirements",
          "Requirements",
          "Must-have pages, features, content, or constraints…",
        )}
        {field(
          "notes",
          "Notes",
          "Anything you have learned about the client…",
          2,
        )}
      </section>
      <section className="form-section">
        <div className="form-section-title">
          <span>02</span>
          <div>
            <h2>A little inspiration</h2>
            <p>
              Client websites, social profiles, competitors, or anything worth
              seeing.
            </p>
          </div>
        </div>
        <label className="field">
          <span>Useful links</span>
          <textarea
            rows={4}
            placeholder={
              "https://client-website.com\nhttps://a-site-you-love.com"
            }
            value={links}
            onChange={(e) => onLinks(e.target.value)}
          />
          <small>Paste multiple links, separated by spaces or new lines.</small>
        </label>
      </section>
      <section className="form-section">
        <div className="form-section-title">
          <span>03</span>
          <div>
            <h2>The practical details</h2>
            <p>Contact information and the essentials.</p>
          </div>
        </div>
        <div className="two-col">
          {(["email", "phone", "address", "socials"] as const).map((key) => (
            <label className="field" key={key}>
              <span>
                {
                  {
                    email: "Email",
                    phone: "Phone",
                    address: "Address",
                    socials: "Social handles",
                  }[key]
                }
              </span>
              <input
                type={
                  key === "email" ? "email" : key === "phone" ? "tel" : "text"
                }
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                placeholder={
                  {
                    email: "hello@company.com",
                    phone: "+1 (555) 000-0000",
                    address: "City, street, or full address",
                    socials: "@company on Instagram",
                  }[key]
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="form-section">
        {field(
          "anythingElse",
          "Anything else the studio should know?",
          "The half-formed ideas, the non-negotiables, the things that don’t fit anywhere else.",
          5,
        )}
      </section>
    </>
  );
}
export function parseLinks(text: string) {
  const links = [...new Set(text.split(/[\s,]+/).filter(Boolean))];
  for (const link of links) {
    try {
      if (!["http:", "https:"].includes(new URL(link).protocol))
        throw new Error();
    } catch {
      throw new Error(`Use a complete http or https URL: ${link}`);
    }
  }
  return links;
}
export function FileDrop({
  files,
  setFiles,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  function add(incoming: File[]) {
    if (files.length + incoming.length > 20) {
      setError("Choose up to 20 files at a time.");
      return;
    }
    if (incoming.some((f) => f.size > 25 * 1024 * 1024)) {
      setError("Each file must be 25 MB or smaller.");
      return;
    }
    setError("");
    setFiles([...files, ...incoming]);
  }
  return (
    <>
      <button
        type="button"
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(Array.from(e.dataTransfer.files));
        }}
      >
        <UploadCloud size={29} />
        <strong>Drop the good stuff here</strong>
        <span>or click to choose files</span>
        <small>
          Logos, images, video, PDFs, documents & brand files
          <br />
          Up to 20 files · 25 MB per file
        </small>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="file-list">
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`}>
            <File size={16} />
            <span>
              {file.name}
              <small>{(file.size / 1024).toFixed(0)} KB</small>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${file.name}`}
              onClick={() => setFiles(files.filter((_, n) => n !== i))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
export function Intake() {
  const { data, refresh, notify } = useStudio();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [context, setContext] = useState(blankContext);
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string>();
  const refs = (params.get("references") || "")
    .split(",")
    .filter((id) => data.library.some((l) => l.id === id));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.capabilities.canCreateProject) { setError("Project creation is unavailable."); return; }
    setBusy(true);
    setError("");
    try {
      const nextContext = { ...context, links: parseLinks(links) };
      let id = createdId;
      if (!id) {
        const project = await api.create({
          name,
          industry,
          context: nextContext,
          referenceIds: refs,
        });
        id = project.id;
        setCreatedId(id);
      } else await api.context(id, nextContext);
      if (files.length) {
        await api.upload(id, files);
        setFiles([]);
      }
      if (data.capabilities.canStartRun) await api.action(id, "start");
      await refresh();
      notify(
        !data.capabilities.canStartRun ? "Project draft saved." : data.mode === "mock"
          ? "Demo factory started. Your project is ready."
          : "Factory started. Your project is ready.",
      );
      navigate(`/projects/${id}?tab=progress`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to="/" className="back-link">
        <ArrowLeft size={15} />
        Back to the studio
      </Link>
      <PageTitle
        eyebrow="SOMETHING GREAT STARTS HERE"
        title="Let’s meet your next project."
        description="Bring the context. The studio will take it from here."
      />
      <form className="intake-layout" onSubmit={submit}>
        <div>
          <section className="form-section project-basics">
            <label className="field">
              <span>
                Client / project name <b>*</b>
              </span>
              <input
                required
                maxLength={100}
                disabled={!!createdId}
                placeholder="A name to make it yours"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Industry</span>
              <input
                placeholder="e.g. Architecture, hospitality, technology"
                disabled={!!createdId}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                maxLength={100}
              />
            </label>
          </section>
          <ContextFields
            value={context}
            onChange={setContext}
            links={links}
            onLinks={setLinks}
          />
        </div>
        <aside className="intake-aside">
          <section className="panel">
            <h2>All the pieces.</h2>
            <p className="muted">A home for everything the client shared.</p>
            {data.capabilities.canUploadMedia && <FileDrop files={files} setFiles={setFiles} />}
          </section>
          {refs.length > 0 && (
            <section className="panel">
              <h3>
                <Layers3 size={18} /> Selected references
              </h3>
              {refs.map((id) => (
                <p key={id}>{data.library.find((l) => l.id === id)?.name}</p>
              ))}
              <small>Ideas to explore, not templates to follow.</small>
            </section>
          )}
          <section className="start-panel">
            <span className="eyebrow">FROM CONTEXT TO CREATION</span>
            <h2>Ready when you are.</h2>
            <p>
              You can add more context and assets as the project takes shape.
            </p>
            {data.mode === "mock" && (
              <div className="demo-explainer">
                Demo mode saves your intake on the studio server and starts an illustrative
                workflow. It does not generate a real website.
              </div>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
                {createdId && (
                  <>
                    {" "}
                    Your draft is saved. Retry here or{" "}
                    <Link to={`/projects/${createdId}`}>open the draft</Link>.
                  </>
                )}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !data.capabilities.canCreateProject}
              aria-busy={busy}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ArrowRight size={18} />
              )}{" "}
              {busy
                ? "Preparing your project…"
                : !data.capabilities.canStartRun ? "Save draft" : createdId
                  ? "Retry start factory"
                  : "Start factory"}
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}
