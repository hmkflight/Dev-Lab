import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { IframeHTMLAttributes } from "react";
import type { StudioStage } from "../../lib/studio-adapter/types";
import { requestActivity } from "../request-activity";

export function LoadingSignal() {
  const pending = useSyncExternalStore(requestActivity.subscribe, requestActivity.getSnapshot, () => 0);
  const [visible, setVisible] = useState(false);
  const active = pending > 0;
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(timer);
  }, [active]);
  return <div className={`request-signal ${visible ? "is-loading" : ""}`} aria-hidden="true"><span /></div>;
}

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const from = previous.current;
    let frame = 0;
    const settle = () => { cancelAnimationFrame(frame); previous.current = value; setDisplay(value); };
    if (preference.matches) { settle(); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 680, 1);
      previous.current = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      setDisplay(previous.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    preference.addEventListener("change", settle);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener("change", settle); };
  }, [value]);
  return <span aria-label={String(value)}><span aria-hidden="true">{String(display).padStart(2, "0")}</span></span>;
}

export function StageProgress({ stages, active = false, compact = false }: { stages: StudioStage[]; active?: boolean; compact?: boolean }) {
  const complete = stages.filter(stage => stage.status === "complete").length;
  const percent = stages.length ? complete / stages.length * 100 : 0;
  return <div className={`stage-progress ${compact ? "compact" : ""} ${active ? "is-active" : ""}`}>
    {!compact && <div className="progress-caption"><span>Stage completion</span><span>{complete} / {stages.length} stages</span></div>}
    <div className="progress-track" role="progressbar" aria-label="Completed stages" aria-valuemin={0} aria-valuemax={Math.max(stages.length, 1)} aria-valuenow={complete} aria-valuetext={stages.length ? `${complete} of ${stages.length} stages complete` : "No stages defined"}>
      <span className="progress-fill" style={{ width: `${percent}%` }}><i /></span>
    </div>
  </div>;
}

/** Remount by preview URL at the call site to reset the load state for new content. */
export function PreviewFrame(props: IframeHTMLAttributes<HTMLIFrameElement>) {
  const [loaded, setLoaded] = useState(false);
  return <>
    <iframe {...props} className={`${props.className || ""} reveal-frame ${loaded ? "is-loaded" : ""}`} onLoad={event => { setLoaded(true); props.onLoad?.(event); }} />
    {!loaded && <div className="preview-loading" role="status"><span className="preview-loader" aria-hidden="true" /><span>Loading preview…</span></div>}
  </>;
}
