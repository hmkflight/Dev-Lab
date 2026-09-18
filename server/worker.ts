import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { z } from "zod";
import { input, context } from "./validation";
import { StudioError } from "../lib/studio-adapter/errors";
import type { AdapterEnvironment } from "../lib/studio-adapter/index.server";
import { performAction, requireCapability } from "./studio-actions";
import { loadStudio } from "./hosted-storage";
import { authenticate, type BridgeEnv } from "./bridge-auth";
import { bridgeAPI } from "./bridge-api";
type Env = AdapterEnvironment & BridgeEnv & { DB: D1Database; BUCKET: R2Bucket; ASSETS: { fetch(request: Request): Promise<Response> } };
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {"Cache-Control":"no-store"}});
async function body(request: Request) {
  const value = await request.text();
  if (value.length > 1024 * 1024) throw new StudioError("Request is too large.", 413);
  try { return JSON.parse(value); } catch { throw new StudioError("Invalid JSON."); }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const result = await env.ASSETS.fetch(request);
      if (result.status !== 404 || !request.headers.get("accept")?.includes("text/html")) return result;
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    const uploaded: string[] = [];
    let committed = false;
    try {
      const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      if (mutation && request.headers.get("origin") && request.headers.get("origin") !== url.origin) throw new StudioError("Requests must come from this studio.", 403);
      const actor = await authenticate(request,env);
      if (mutation && actor.role !== "runner" && request.headers.get("authorization") === null && request.headers.get("origin") !== url.origin) throw new StudioError("A same-origin request is required.",403);
      if (url.pathname.startsWith("/api/bridge/")) return await bridgeAPI(request,env,actor,body);
      if (actor.role === "runner") throw new StudioError("Runner endpoint not permitted.",403);
      if (mutation && actor.role !== "owner") throw new StudioError("Owner access required.",403);
      const {adapter, persistence} = await loadStudio(env.DB,env);
      const p = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const id = p[2];
      let result: unknown; let status = 200;
      if (request.method === "GET" && p[1] === "studio" && p.length === 2) return json(await adapter.getSnapshot());
      if (request.method === "GET" && p[1] === "assets" && p.length === 3) {
        if (!z.uuid().safeParse(id).success) throw new StudioError("Asset not found.",404);
        const projects = await adapter.getProjects();
        const artifacts = (await Promise.all(projects.map(p=>adapter.getMedia(p.id)))).flat();
        const artifact = artifacts.find(a => a.downloadUrl === `/api/assets/${id}`);
        const object = artifact && await env.BUCKET.get(id);
        if (!artifact || !object) throw new StudioError("Asset not found.",404);
        return new Response(object.body as unknown as ReadableStream, { headers: {
          "Content-Type": "application/octet-stream", "X-Content-Type-Options":"nosniff", "Cache-Control":"no-store",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(artifact.title)}`,
        }});
      }
      if (p[1] !== "projects") throw new StudioError("Endpoint not found.",404);
      if (request.method === "GET" && p.length === 3) return json(await adapter.getProject(id));
      if (request.method === "POST" && p.length === 2) { requireCapability(adapter,"canCreateProject"); result = await adapter.createProject(input.parse(await body(request))); status = 201; }
      else if (request.method === "PUT" && p[3] === "context" && p.length === 4) result = await (requireCapability(adapter,"canUpdateContext"), adapter.updateContext(id, context.parse(await body(request))));
      else if (request.method === "POST" && p[3] === "actions" && p.length === 4) {
        const {action} = z.object({action:z.enum(["start","pause","resume","cancel","archive","advance-demo","resolve-demo"])}).parse(await body(request));
        result = await performAction(adapter,id,action);
      } else if (request.method === "POST" && p[3] === "approvals" && p.length === 5) {
        const value = z.object({decision:z.enum(["approve","changes"]),feedback:z.string().max(10000).optional()}).parse(await body(request));
        requireCapability(adapter,"canApprove");
        await adapter.approveGate(id,p[4],value); result = {ok:true};
      } else if (request.method === "POST" && p[3] === "assets" && p.length === 4) {
        requireCapability(adapter,"canUploadMedia");
        const {project} = await adapter.getProject(id);
        if (project.archived || ["cancelled","complete"].includes(project.status)) throw new StudioError("Uploads are closed for this project.",409);
        // Keep multipart parsing below the hosted runtime's memory limit.
        const length = Number(request.headers.get("content-length"));
        if (!length || length > 27 * 1024 * 1024) throw new StudioError("Upload files in batches up to 25 MB.",413);
        const form = await request.formData();
        const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
        if (!files.length) throw new StudioError("Choose at least one file.");
        if (files.length > 20 || files.reduce((n,f)=>n+f.size,0)>25*1024*1024) throw new StudioError("Upload files in batches up to 25 MB.",413);
        const assets = [];
        for (const file of files) {
          const key = crypto.randomUUID(); uploaded.push(key);
          await env.BUCKET.put(key, await file.arrayBuffer());
          assets.push({name:file.name,mimeType:file.type,size:file.size,url:`/api/assets/${key}`});
        }
        result = await adapter.addAssets(id,assets); status = 201;
      } else throw new StudioError("Endpoint not found.",404);
      if (persistence) await persistence.save(); committed = true;
      return json(result,status);
    } catch (error) {
      if (!committed && uploaded.length) await env.BUCKET.delete(uploaded).catch(()=>{});
      if (error instanceof StudioError) return json({error:error.message},error.status);
      if (error instanceof z.ZodError) return json({error:error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")},400);
      let diagnostic = error instanceof Error ? (error.stack || error.message) : "UnknownError";
      for (const [key,value] of Object.entries(env)) if (/TOKEN|KEY|SECRET/.test(key) && typeof value === "string" && value) diagnostic=diagnostic.replaceAll(value,"[credential]");
      console.error("Studio request failed",diagnostic.slice(0,1200));
      return json({error:"The studio could not complete this request. Please try again."},500);
    }
  }
};
