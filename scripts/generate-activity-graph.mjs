import { mkdir, writeFile } from "node:fs/promises";

import {
  fetchContributionDays,
  renderActivityGraph,
} from "../src/activity-graph.mjs";

const username =
  process.env.PROFILE_USERNAME?.trim() ||
  process.env.GITHUB_REPOSITORY_OWNER?.trim();
const outputUrl = new URL("../dist/github-activity-graph.svg", import.meta.url);
const days = await fetchContributionDays(username, process.env.GITHUB_TOKEN);
const svg = renderActivityGraph(days, username);

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(outputUrl, svg, "utf8");

console.log(
  `Generated github-activity-graph.svg from the latest ${Math.min(days.length, 30)} contribution days.`,
);
