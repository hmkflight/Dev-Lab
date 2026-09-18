import express from "express";
import multer from "multer";
import { mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStudioAdapter } from "../lib/studio-adapter/index.server";
import { performAction, requireCapability } from "./studio-actions";
const adapter = getStudioAdapter();
import { StudioError } from "../lib/studio-adapter/errors";
const app = express();
const port = Number(process.env.PORT || 4173);
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      origin &&
      ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)
    ) {
      res.status(403).json({ error: "Requests must come from this studio." });
      return;
    }
  }
  next();
});
import { context, input } from "./validation";
app.get("/api/bridge/status", (_req,res)=>res.json({mode:"MOCK",runner:null,commands:[],canSubmit:false}));
app.get("/api/studio", async (_req, res) =>
  res.json(await adapter.getSnapshot()),
);
app.get("/api/projects/:id", async (req, res) =>
  res.json(await adapter.getProject(z.string().parse(req.params.id))),
);
app.post("/api/projects", async (req, res) =>
  res.status(201).json(await (requireCapability(adapter,"canCreateProject"), adapter.createProject(input.parse(req.body)))),
);
app.put("/api/projects/:id/context", async (req, res) =>
  res.json(
    await (requireCapability(adapter,"canUpdateContext"), adapter.updateContext(
      z.string().parse(req.params.id),
      context.parse(req.body),
    )),
  ),
);
app.post("/api/projects/:id/actions", async (req, res) => {
  const { action } = z
    .object({
      action: z.enum([
        "start",
        "pause",
        "resume",
        "cancel",
        "archive",
        "advance-demo",
        "resolve-demo",
      ]),
    })
    .parse(req.body);
  res.json(await performAction(adapter,z.string().parse(req.params.id),action));
});
app.post("/api/projects/:id/approvals/:gateId", async (req, res) => {
  const body = z
    .object({
      decision: z.enum(["approve", "changes"]),
      feedback: z.string().max(10000).optional(),
    })
    .parse(req.body);
  requireCapability(adapter,"canApprove");
  await adapter.approveGate(
    z.string().parse(req.params.id),
    req.params.gateId,
    body,
  );
  res.json({ ok: true });
});
const uploadDir = resolve(process.env.STUDIO_DATA_DIR || ".studio", "uploads");
mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});
app.post(
  "/api/projects/:id/assets",
  async (req, res, next) => {
    try {
      requireCapability(adapter,"canUploadMedia");
      const d = await adapter.getProject(z.string().parse(req.params.id));
      if (
        d.project.archived ||
        ["cancelled", "complete"].includes(d.project.status)
      )
        throw new StudioError("Uploads are closed for this project.", 409);
      next();
    } catch (e) {
      next(e);
    }
  },
  upload.array("files", 20),
  async (req, res, next) => {
    const files = (req.files || []) as Express.Multer.File[];
    try {
      if (!files.length) throw new StudioError("Choose at least one file.");
      res.status(201).json(
        await adapter.addAssets(
          z.string().parse(req.params.id),
          files.map((f) => ({
            name: f.originalname,
            mimeType: f.mimetype,
            size: f.size,
            url: `/api/assets/${f.filename}`,
          })),
        ),
      );
    } catch (e) {
      files.forEach((f) => unlinkSync(f.path));
      next(e);
    }
  },
);
app.get("/api/assets/:id", async (req, res) => {
  if (!z.uuid().safeParse(z.string().parse(req.params.id)).success)
    throw new StudioError("Asset not found.", 404);
  const projects = await adapter.getProjects();
  let asset;
  for (const p of projects) {
    asset = (await adapter.getArtifacts(p.id)).find(
      (a) => a.downloadUrl === `/api/assets/${z.string().parse(req.params.id)}`,
    );
    if (asset) break;
  }
  if (!asset) throw new StudioError("Asset not found.", 404);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.download(resolve(uploadDir, z.string().parse(req.params.id)), asset.title);
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const known =
      error instanceof StudioError ||
      error instanceof z.ZodError ||
      error instanceof multer.MulterError;
    res
      .status(
        error instanceof StudioError
          ? error.status
          : error instanceof multer.MulterError
            ? 413
            : known
              ? 400
              : 500,
      )
      .json({
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : known
              ? (error as Error).message
              : "The studio could not complete this request.",
      });
    if (!known) console.error("Studio request failed", error instanceof Error ? error.name : "UnknownError");
  },
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(port, "127.0.0.1", () =>
  console.log(`Studio ready at http://localhost:${port} (${adapter.mode === "mock" ? "DEMO MODE" : "DEV LAB READ ONLY"})`),
);
