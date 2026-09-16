import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "studio-browser-"));
const port = 4189;
const origin = `http://localhost:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    STUDIO_DATA_DIR: dir,
    NODE_ENV: "production",
    DEVLAB_ADAPTER_MODE: "mock",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (d) => (serverOutput += d));
server.stderr.on("data", (d) => (serverOutput += d));
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${origin}/api/studio`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 79) throw new Error(serverOutput);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "Good things are taking shape." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Integration guide" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Design library", exact: true }).click();
  await page.getByRole("button", { name: "Use as reference" }).first().click();
  await page
    .getByRole("link", { name: "New project with 1 reference", exact: true })
    .click();
  await page.getByLabel("Client / project name").fill("Browser workflow test");
  await page.getByLabel("Industry", { exact: true }).fill("Architecture");
  await page
    .getByLabel("About the company")
    .fill("A boutique architecture practice.");
  await page
    .getByLabel("Goals", { exact: true })
    .fill("Showcase recent work and generate qualified inquiries.");
  await page
    .getByLabel("Useful links")
    .fill("https://example.com\nhttps://example.org");
  await page.getByLabel("Email", { exact: true }).fill("studio@example.com");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "brand-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Test brand context"),
    });
  await page
    .getByRole("button", { name: "Start factory", exact: true })
    .click();
  await page.waitForURL(/\/projects\/[^?]+\?tab=progress/);
  await expect(
    page.getByRole("heading", { name: "Browser workflow test", exact: true }),
  ).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/").pop();
  let detail = await (
    await fetch(`${origin}/api/projects/${projectId}`)
  ).json();
  assert.deepEqual(detail.project.referenceIds, ["lib-forma"]);
  assert.equal(detail.artifacts[0].title, "brand-notes.txt");
  assert.equal(detail.project.context.links.length, 2);
  const asset = await fetch(`${origin}${detail.artifacts[0].downloadUrl}`);
  assert.match(asset.headers.get("content-disposition"), /attachment/);
  assert.equal(await asset.text(), "Test brand context");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser workflow test", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue demo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review concepts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await page
    .getByLabel("What should change?")
    .fill("Make the hierarchy more confident.");
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await expect(page.getByLabel("What should change?")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Approve direction", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Approve direction", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue demo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review design", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve build", exact: true })
    .click();
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue demo", exact: true })
    .click();
  await expect(page.locator(".project-meta")).toContainText("Build");
  await page
    .getByRole("button", { name: "Continue demo", exact: true })
    .click();
  await expect(page.locator(".project-meta")).toContainText("QA");
  await page
    .getByRole("button", { name: "Continue demo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review website", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve & complete", exact: true })
    .click();
  await expect(page.locator(".project-meta")).toContainText("Complete");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".page-title")).toContainText("ARCHIVED");
  await page.goto(`${origin}/projects/forma?tab=review`);
  await page
    .getByRole("button", { name: "mobile preview", exact: true })
    .click();
  await expect(page.locator(".browser-frame")).toHaveCSS("width", "390px");
  await page
    .getByRole("button", { name: "Compare previous", exact: true })
    .click();
  await expect(page.locator(".browser-frame iframe")).toHaveCount(2);
  await page
    .getByRole("button", { name: "tablet preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Single view", exact: true }).click();
  await expect(page.locator(".browser-frame")).toHaveCSS("width", "768px");
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/review.png", fullPage: true });
  await page.goto(`${origin}/projects/kinfolk?tab=qa`);
  await expect(page.getByText("Approved menu copy is missing.")).toBeVisible();
  await page
    .getByRole("button", { name: "Demo: mark supplied", exact: true })
    .click();
  await expect(page.getByText("Approved menu copy is missing.")).toHaveCount(0);
  await page.goto(`${origin}/agents`);
  await expect(
    page.getByRole("heading", { name: "Coder", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "Good things are taking shape." }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every project, in perspective." }),
  ).toBeVisible();
  assert.equal((await fetch(`${origin}/api/projects/missing`)).status, 404);
  assert.equal(
    (
      await fetch(`${origin}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    400,
  );
  // Capability changes must remove actions even if project actions still list them.
  await page.route('**/api/studio', async route => {
    const response = await route.fetch();
    const body = await response.json();
    for (const key of Object.keys(body.capabilities)) body.capabilities[key] = false;
    await route.fulfill({response,json:body});
  });
  await page.route('**/api/projects/forma', async route => {
    const response = await route.fetch();
    const body = await response.json();
    for (const key of Object.keys(body.capabilities)) body.capabilities[key] = false;
    await route.fulfill({response,json:body});
  });
  await page.setViewportSize({width:1440,height:1050});
  await page.goto(`${origin}/projects/forma`);
  await expect(page.getByRole('heading',{name:'Forma Studio',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue demo',exact:true})).toHaveCount(0);
  await page.goto(origin);
  await expect(page.getByRole('heading',{name:'Good things are taking shape.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'New project',exact:true})).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: reference → intake + upload → pause/resume → feedback → approvals → QA → completion → archive; preview widths, comparison, mobile navigation, download and API validation.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
