import "./server-only";
import { StudioError } from "./errors";
import type { StudioArtifact } from "./types";
/** Only application-owned routes or HTTPS URLs cross this boundary. No filesystem paths. */
export function browserArtifactUrl(value?: string): string | undefined {
  if (!value) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { throw new StudioError("Invalid artifact URL."); }
  if (/[\\\u0000-\u0020]/.test(decoded) || decoded.includes("..") || /(?:\/Users\/|\/home\/|\/private\/|\/etc\/|file:)/i.test(decoded)) throw new StudioError("Invalid artifact URL.");
  if (/^\/(?:api\/assets|api\/bridge\/artifacts|previews)\//.test(decoded) && !decoded.startsWith("//")) return value;
  try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|\[::1\])/.test(url.hostname)) return value; } catch { /* Fail closed. */ }
  throw new StudioError("Invalid artifact URL.");
}
/** Whitelist output fields, also accepting previous locally persisted demo records. */
export function toStudioArtifact(source: StudioArtifact | Record<string, unknown>): StudioArtifact {
  const a = source as unknown as Record<string, unknown>;
  return { id: String(a.id), projectId: String(a.projectId), title: String(a.title ?? a.name ?? "Artifact"),
    type: String(a.type), createdAt: String(a.createdAt), mimeType: typeof a.mimeType === "string" ? a.mimeType : undefined,
    previewUrl: browserArtifactUrl((a.previewUrl ?? (!a.uploaded ? a.url : undefined)) as string | undefined),
    downloadUrl: browserArtifactUrl((a.downloadUrl ?? (a.uploaded ? a.url : undefined)) as string | undefined),
    content: typeof a.content === "string" ? a.content : undefined, size: typeof a.size === "number" ? a.size : undefined,
    uploaded: a.uploaded === true, metadata: {demo:true},
  };
}

/** Transport providers publish only authorized, browser-addressable objects. Empty URLs mean metadata only. */
export interface ArtifactTransport { urls(artifactId: string): Pick<StudioArtifact, 'previewUrl'|'downloadUrl'|'thumbnailUrl'>; }
export const unpublishedArtifactTransport: ArtifactTransport = {urls: () => ({})};
