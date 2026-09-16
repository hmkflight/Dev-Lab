/** Runtime defense in depth; Vite's import-graph guard enforces this at build time. */
if (typeof window !== "undefined") {
  throw new Error("Studio adapter implementations are server-only. Use the Studio API.");
}
export {};
