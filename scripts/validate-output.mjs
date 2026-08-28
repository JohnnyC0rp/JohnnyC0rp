import { readFile, stat } from "node:fs/promises";

const outputFile = new URL("../dist/github-activity-graph.svg", import.meta.url);
const fileStats = await stat(outputFile);
const svg = await readFile(outputFile, "utf8");

if (fileStats.size === 0 || fileStats.size > 100_000) {
  throw new Error("github-activity-graph.svg must be between 1 byte and 100 KB");
}
if (!svg.startsWith('<?xml version="1.0"') || !svg.endsWith("</svg>\n")) {
  throw new Error("github-activity-graph.svg is not a complete XML document");
}
if (!svg.includes('<svg xmlns="http://www.w3.org/2000/svg"')) {
  throw new Error("github-activity-graph.svg is not a standalone SVG document");
}
if (/Bearer\s+\S+|GITHUB_TOKEN|gh[opsu]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/.test(svg)) {
  throw new Error("github-activity-graph.svg contains credential-like text");
}
if (/<\s*(?:script|foreignObject|iframe|object|embed|image|use|a)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|\burl\s*\(/i.test(svg)) {
  throw new Error("github-activity-graph.svg contains active or external content");
}

console.log("Validated github-activity-graph.svg.");
