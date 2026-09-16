import { beginRequest } from "./request-activity";
import type {
  StudioSnapshot,
  ProjectDetail,
  StudioProject,
  ProjectInput,
  StudioContext,
  ProjectAction,
} from "../lib/studio-adapter/types";
async function request<T>(path: string, options?: RequestInit, background = false): Promise<T> {
  const finish = background ? () => {} : beginRequest();
  try {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "Studio is unavailable." }));
    throw new Error(body.error || "Request failed.");
  }
  return await response.json();
  } finally { finish(); }
}
const json = (body: unknown, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const api = {
  snapshot: (background = false) => request<StudioSnapshot>("/studio", undefined, background),
  project: (id: string, background = false) => request<ProjectDetail>(`/projects/${id}`, undefined, background),
  create: (input: ProjectInput) =>
    request<StudioProject>("/projects", json(input)),
  action: (id: string, action: ProjectAction) =>
    request<StudioProject>(`/projects/${id}/actions`, json({ action })),
  context: (id: string, context: StudioContext) =>
    request<StudioProject>(`/projects/${id}/context`, json(context, "PUT")),
  approve: (
    id: string,
    gateId: string,
    decision: "approve" | "changes",
    feedback: string,
  ) =>
    request(
      `/projects/${id}/approvals/${gateId}`,
      json({ decision, feedback }),
    ),
  upload: (id: string, files: File[]) => {
    const data = new FormData();
    files.forEach((f) => data.append("files", f));
    return request(`/projects/${id}/assets`, { method: "POST", body: data });
  },
};
