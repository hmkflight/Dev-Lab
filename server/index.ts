import express from "express";
import multer from "multer";
import { mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { studioAdapter as adapter } from "../lib/studio-adapter/index.server";
import { StudioError, MockStudioAdapter } from "../lib/studio-adapter/mock";
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
app.get("/api/studio", async (_req, res) =>
  res.json(await adapter.getSnapshot()),
);
app.get("/api/projects/:id", async (req, res) =>
  res.json(await adapter.getProject(z.string().parse(req.params.id))),
);
app.post("/api/projects", async (req, res) =>
  res.status(201).json(await adapter.createProject(input.parse(req.body))),
);
app.put("/api/projects/:id/context", async (req, res) =>
  res.json(
    await adapter.updateContext(
      z.string().parse(req.params.id),
      context.parse(req.body),
    ),
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
  if (action === "advance-demo" || action === "resolve-demo") {
    if (!(adapter instanceof MockStudioAdapter))
      throw new StudioError("Demo actions are unavailable.", 409);
    res.json(
      await (action === "advance-demo"
        ? adapter.advanceDemo(z.string().parse(req.params.id))
        : adapter.resolveDemo(z.string().parse(req.params.id))),
    );
    return;
  }
  const f = {
    start: adapter.startRun,
    pause: adapter.pauseRun,
    resume: adapter.resumeRun,
    cancel: adapter.cancelRun,
    archive: adapter.archiveProject,
  }[action];
  res.json(await f.call(adapter, z.string().parse(req.params.id)));
});
app.post("/api/projects/:id/approvals/:gateId", async (req, res) => {
  const body = z
    .object({
      decision: z.enum(["approve", "changes"]),
      feedback: z.string().max(10000).optional(),
    })
    .parse(req.body);
  await adapter.approveGate(
    z.string().parse(req.params.id),
    req.params.gateId,
    body.decision,
    body.feedback,
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
      (a) => a.url === `/api/assets/${z.string().parse(req.params.id)}`,
    );
    if (asset) break;
  }
  if (!asset) throw new StudioError("Asset not found.", 404);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.download(resolve(uploadDir, z.string().parse(req.params.id)), asset.name);
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
    if (!known) console.error(error);
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
  console.log(`Studio ready at http://localhost:${port} (DEMO MODE)`),
);
