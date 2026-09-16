import type {
  StudioContext,
  StudioProject,
  StudioSnapshot,
  ProjectDetail,
} from "./types";
import "./server-only";
import { emptyContext } from "./defaults";
export { emptyContext } from "./defaults";
export const stageNames = [
  "Intake",
  "Research",
  "Concept",
  "Design",
  "Build",
  "QA",
  "Ready",
];
const date = (days = 0) => new Date(Date.now() - days * 86400000).toISOString();
export function stagesAt(index: number) {
  return stageNames.map((name, i) => ({
    id: name.toLowerCase(),
    name,
    status: (i < index ? "complete" : i === index ? "active" : "pending") as
      "complete" | "active" | "pending",
  }));
}
export interface DemoState {
  projects: StudioProject[];
  agents: StudioSnapshot["agents"];
  events: StudioSnapshot["events"];
  approvals: StudioSnapshot["approvals"];
  library: StudioSnapshot["library"];
  artifacts: ProjectDetail["artifacts"];
  iterations: ProjectDetail["iterations"];
  reviews: ProjectDetail["review"][];
  pausedStatuses: Record<string, StudioProject["status"]>;
}
export function createSeed(): DemoState {
  const specs = [
    {
      id: "forma",
      name: "Forma Studio",
      industry: "Architecture",
      summary: "A new perspective on spaces.",
      theme: "forma",
      status: "working" as const,
      index: 4,
      agentId: "coder",
    },
    {
      id: "offscript",
      name: "Offscript",
      industry: "Lifestyle & culture",
      summary: "An independent point of view.",
      theme: "offscript",
      status: "waiting" as const,
      index: 2,
      agentId: "architect",
    },
    {
      id: "kinfolk",
      name: "Kinfolk Coffee",
      industry: "Food & beverage",
      summary: "Good mornings, thoughtfully made.",
      theme: "kinfolk",
      status: "blocked" as const,
      index: 4,
      agentId: "manager",
    },
    {
      id: "orbit",
      name: "Orbit Finance",
      industry: "Financial technology",
      summary: "A clearer view of your money.",
      theme: "orbit",
      status: "complete" as const,
      index: 7,
      agentId: undefined,
    },
  ];
  const projects = specs.map((s) => ({
    ...s,
    stageId: stageNames[Math.min(s.index, stageNames.length - 1)].toLowerCase(),
    stages: stagesAt(s.index),
    createdAt: date(8),
    updatedAt: date(),
    archived: false,
    actions: [],
    referenceIds: [],
    previewUrl: `/previews/${s.theme}.html`,
    websiteUrl: `/previews/${s.theme}.html`,
    context: {
      ...emptyContext,
      description: s.summary,
      goals:
        "Create a distinctive website that communicates the brand and turns interest into inquiries.",
      audience:
        "Design-conscious customers looking for a thoughtful, personal experience.",
      requirements:
        "Responsive across desktop, tablet, and mobile. Clear navigation and accessible interactions.",
      notes:
        s.id === "kinfolk"
          ? "Awaiting approved menu copy and the privacy policy."
          : "Editorial design, confident typography, and a clear story.",
      email: `hello@${s.id}.example`,
      links: [],
    },
  }));
  const agents: DemoState["agents"] = [
    {
      id: "architect",
      name: "Architect",
      role: "Direction & systems",
      status: "waiting",
      task: "Waiting for creative direction approval",
      projectId: "offscript",
      latestResult: "Two editorial directions ready to review",
      initials: "Ar",
      color: "purple",
    },
    {
      id: "coder",
      name: "Coder",
      role: "Design & implementation",
      status: "working",
      task: "Building the responsive project gallery",
      projectId: "forma",
      latestResult: "Homepage and navigation implemented",
      initials: "Co",
      color: "blue",
    },
    {
      id: "tester",
      name: "Tester",
      role: "Quality & experience",
      status: "idle",
      task: "Ready for the next review",
      latestResult: "Orbit Finance passed its final checks",
      initials: "Te",
      color: "green",
    },
    {
      id: "manager",
      name: "Dev Manager",
      role: "Production & delivery",
      status: "blocked",
      task: "Needs approved menu copy and privacy policy",
      projectId: "kinfolk",
      latestResult: "Missing content flagged for the client",
      initials: "Dm",
      color: "orange",
    },
  ];
  const events = [
    [
      "forma",
      "Coder",
      "Building the responsive project gallery",
      "Implementation demo: gallery layout and responsive breakpoints.",
    ],
    [
      "offscript",
      "Architect",
      "Creative directions are ready for your review",
      "Gate: direction approval. Production waits for a human decision.",
    ],
    [
      "kinfolk",
      "Dev Manager",
      "Flagged two missing content items",
      "Missing: approved menu copy, privacy policy. No real client has been contacted.",
    ],
    [
      "forma",
      "Architect",
      "Completed the design system",
      "Artifacts: typography, spatial rhythm, navigation behavior.",
    ],
    [
      "orbit",
      "Tester",
      "Completed the final quality review",
      "Demo report: all required checks passed.",
    ],
  ].map((e, i) => ({
    id: `event-${i}`,
    projectId: e[0],
    agentName: e[1],
    message: e[2],
    details: e[3],
    createdAt: new Date(Date.now() - i * 12 * 60000).toISOString(),
  }));
  const approvals = [
    {
      id: "direction-offscript",
      projectId: "offscript",
      title: "A direction worth pursuing.",
      description:
        "Review the editorial concept and visual system for Offscript before the studio moves into design.",
      kind: "Direction",
      status: "pending" as const,
      createdAt: date(),
    },
  ];
  const artifacts: DemoState["artifacts"] = projects.flatMap((p) => [
    {
      id: `${p.id}-research`,
      projectId: p.id,
      title: "Brand & audience research",
      metadata: { demo: true },
      type: "Research",
      createdAt: date(5),
      content: `${p.name} — Research notes\n\nAudience\n${p.context.audience}\n\nOpportunity\nLead with a distinct point of view. Make the value proposition immediate and the next step clear.\n\nDesign principles\n1. Let typography carry the identity.\n2. Use a restrained, intentional color system.\n3. Keep navigation simple and content useful.\n\nThese are illustrative demo findings, not live research.`,
    },
    {
      id: `${p.id}-concept`,
      projectId: p.id,
      title: "Creative direction / 01",
      metadata: { demo: true },
      type: "Concepts",
      previewUrl: `/previews/${p.theme}.html?v=1`,
      createdAt: date(4),
      content:
        "Expressive editorial typography with a focused palette. Strong contrast, open spacing, and a clear hierarchy.",
    },
    {
      id: `${p.id}-design`,
      projectId: p.id,
      title: "Visual system / 02",
      metadata: { demo: true },
      type: "Design",
      previewUrl: `/previews/${p.theme}.html`,
      createdAt: date(2),
      content:
        "Refined hierarchy, clear action labels, and responsive layouts. Review at each device width.",
    },
    {
      id: `${p.id}-mockups`,
      projectId: p.id,
      title: "Responsive composition",
      metadata: { demo: true },
      type: "Mockups",
      previewUrl: `/previews/${p.theme}.html`,
      createdAt: date(1),
    },
  ]);
  artifacts.push({id:"forma-brief",projectId:"forma",title:"Sample brand brief",type:"Media",mimeType:"text/plain",size:113,createdAt:date(6),uploaded:true,downloadUrl:"/previews/sample-brand-brief.txt",metadata:{demo:true}});
  const iterations = projects.flatMap((p) =>
    [1, 2, 3].map((v) => ({
      id: `${p.id}-v${v}`,
      projectId: p.id,
      name: `Iteration 0${v}`,
      summary: [
        "Initial direction and content hierarchy",
        "Refined typography and visual rhythm",
        "Responsive layout and interaction polish",
      ][v - 1],
      createdAt: date(4 - v),
      previewUrl: `/previews/${p.theme}.html?v=${v}`,
      status: v === 3 ? "Current" : "Previous",
    })),
  );
  const reviews = projects.map((p) => ({
    projectId: p.id,
    categories: [
      {
        id: "visual",
        name: "Visual quality",
        value: p.id === "orbit" ? "9.2 / 10" : "8.4 / 10",
        status: "pass" as const,
      },
      ...["Responsive", "Accessibility", "Performance", "Interactions"].map(
        (name) => ({
          id: name.toLowerCase(),
          name,
          value: "Pass",
          status: "pass" as const,
        }),
      ),
      {
        id: "content",
        name: "Content",
        value: p.id === "kinfolk" ? "2 blockers" : "Pass",
        status: p.id === "kinfolk" ? ("fail" as const) : ("pass" as const),
      },
    ],
    issues:
      p.id === "kinfolk"
        ? [
            {
              id: "menu",
              section: "Menu",
              message: "Approved menu copy is missing.",
              severity: "blocker" as const,
            },
            {
              id: "privacy",
              section: "Footer",
              message: "Privacy policy needs client approval.",
              severity: "blocker" as const,
            },
            {
              id: "hero",
              section: "Hero",
              message: "Layout and typography checks passed.",
              severity: "passed" as const,
            },
          ]
        : [
            {
              id: "layout",
              section: "Layout",
              message:
                "Typography and layout checks passed in this demo report.",
              severity: "passed" as const,
            },
            {
              id: "devices",
              section: "Responsive",
              message: "Desktop, tablet, and mobile compositions reviewed.",
              severity: "passed" as const,
            },
          ],
  }));
  const library = [
    {
      id: "lib-forma",
      name: "Forma / Spatial editorial",
      category: "Projects",
      style: "Minimal · Editorial",
      industry: "Architecture",
      theme: "forma",
      description: "Oversized typography and an architectural grid.",
    },
    {
      id: "lib-offscript",
      name: "Offscript / Bold perspective",
      category: "Design directions",
      style: "Expressive · Bold",
      industry: "Lifestyle",
      theme: "offscript",
      description: "A confident editorial identity with purposeful contrast.",
    },
    {
      id: "lib-kinfolk",
      name: "The everyday ritual",
      category: "Sections",
      style: "Warm · Typographic",
      industry: "Hospitality",
      theme: "kinfolk",
      description: "A focused introduction with an unmistakable brand voice.",
    },
    {
      id: "lib-type",
      name: "Type with presence",
      category: "Typography",
      style: "Grotesk · Display",
      industry: "Cross-industry",
      theme: "offscript",
      description:
        "A flexible scale for strong headlines and readable body copy.",
    },
    {
      id: "lib-color",
      name: "Electric & ink",
      category: "Color systems",
      style: "High contrast",
      industry: "Technology",
      theme: "orbit",
      description: "A blue, ink, and white system for clear visual hierarchy.",
    },
    {
      id: "lib-grid",
      name: "The open grid",
      category: "Primitives",
      style: "Structured · Flexible",
      industry: "Cross-industry",
      theme: "forma",
      description:
        "Reusable spacing and grid ideas, adaptable to each project.",
    },
    {
      id: "lib-orbit",
      name: "Orbit / Product clarity",
      category: "References",
      style: "Precise · Digital",
      industry: "Finance",
      theme: "orbit",
      description:
        "Clear product communication with a bright, accessible palette.",
    },
  ].map((l) => ({
    ...l,
    createdAt: date(3),
    previewUrl: `/previews/${l.theme}.html`,
  }));
  return {
    projects,
    agents,
    events,
    approvals,
    artifacts,
    iterations,
    reviews,
    library,
    pausedStatuses: {},
  };
}
