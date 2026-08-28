const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const GRAPH_WIDTH = 856;
const GRAPH_HEIGHT = 260;

export function normalizeContributionDays(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    throw new Error("GitHub returned an empty contribution calendar");
  }

  const days = weeks
    .flatMap((week) => week.contributionDays ?? [])
    .map((day) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        throw new Error("GitHub returned an invalid contribution date");
      }
      if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0) {
        throw new Error("GitHub returned an invalid contribution count");
      }

      return {
        date: day.date,
        count: day.contributionCount,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  if (days.length === 0) {
    throw new Error("GitHub returned a contribution calendar without days");
  }

  return days;
}

export function renderActivityGraph(days, username, visibleDays = 30) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error("At least one contribution day is required");
  }
  if (!Number.isInteger(visibleDays) || visibleDays < 1) {
    throw new Error("visibleDays must be a positive integer");
  }

  const contributions = [...days]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-visibleDays);
  const margin = { top: 58, right: 22, bottom: 42, left: 58 };
  const chartWidth = GRAPH_WIDTH - margin.left - margin.right;
  const chartHeight = GRAPH_HEIGHT - margin.top - margin.bottom;
  const maxCount = Math.max(...contributions.map((day) => day.count));
  const yMax = niceUpperBound(maxCount);
  const baseline = margin.top + chartHeight;
  const xFor = (index) =>
    margin.left +
    (contributions.length === 1
      ? chartWidth / 2
      : (index / (contributions.length - 1)) * chartWidth);
  const yFor = (count) => baseline - (count / yMax) * chartHeight;
  const points = contributions.map((day, index) => ({
    ...day,
    svgX: xFor(index),
    svgY: yFor(day.count),
  }));
  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${formatNumber(point.svgX)} ${formatNumber(point.svgY)}`,
    )
    .join(" ");
  const areaPath = [
    `M${formatNumber(points[0].svgX)} ${baseline}`,
    ...points.map(
      (point) =>
        `L${formatNumber(point.svgX)} ${formatNumber(point.svgY)}`,
    ),
    `L${formatNumber(points.at(-1).svgX)} ${baseline}`,
    "Z",
  ].join(" ");

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = (yMax * index) / 4;
    return {
      label: Number.isInteger(value) ? value.toString() : value.toFixed(1),
      y: yFor(value),
    };
  });
  const xTickIndexes = Array.from(
    new Set([
      0,
      ...Array.from(
        { length: Math.floor((contributions.length - 1) / 5) },
        (_, index) => (index + 1) * 5,
      ),
      contributions.length - 1,
    ]),
  );
  const firstDate = formatShortDate(contributions[0].date);
  const lastDate = formatShortDate(contributions.at(-1).date);
  const yLabels = yTicks
    .map(
      (tick) =>
        `    <text class="axis-label" x="${margin.left - 10}" y="${formatNumber(tick.y + 4)}" text-anchor="end">${tick.label}</text>`,
    )
    .join("\n");
  const xLabels = xTickIndexes
    .map((index) => {
      const point = points[index];
      return `    <text class="axis-label" x="${formatNumber(point.svgX)}" y="${GRAPH_HEIGHT - 17}" text-anchor="middle">${escapeXml(formatShortDate(point.date))}</text>`;
    })
    .join("\n");
  const pointElements = points
    .map(
      (point) =>
        `    <circle class="point" cx="${formatNumber(point.svgX)}" cy="${formatNumber(point.svgY)}" r="3"><title>${escapeXml(point.date)}: ${point.count} contribution${point.count === 1 ? "" : "s"}</title></circle>`,
    )
    .join("\n");
  const emptyState =
    maxCount === 0
      ? `\n    <text class="empty-state" x="${margin.left + chartWidth / 2}" y="${margin.top + chartHeight / 2}" text-anchor="middle">No contributions in the last ${contributions.length} days</text>`
      : "";

  // A static SVG has no cold start. It also cannot wake up grumpy. 🙂
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}" role="img" aria-labelledby="activity-title activity-description">
  <title id="activity-title">${escapeXml(username)}'s contribution graph</title>
  <desc id="activity-description">Daily GitHub contributions from ${escapeXml(firstDate)} to ${escapeXml(lastDate)}.</desc>
  <style>
    :root { --text: #0000ff; --muted: #57606a; --axis: #d0d7de; --line: #0000ff; --point: #0000ff; --area: #add8e6; }
    @media (prefers-color-scheme: dark) { :root { --text: #58a6ff; --muted: #8b949e; --axis: #30363d; --line: #58a6ff; --point: #58a6ff; --area: #388bfd; } }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .title { fill: var(--text); font-size: 19px; font-weight: 600; }
    .subtitle, .axis-label, .empty-state { fill: var(--muted); font-size: 11px; }
    .axis { stroke: var(--axis); stroke-width: 1; }
    .area { fill: var(--area); fill-opacity: 0.5; }
    .line { fill: none; stroke: var(--line); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
    .point { fill: var(--point); stroke: var(--point); }
    .empty-state { font-size: 14px; }
  </style>
  <text class="title" x="${GRAPH_WIDTH / 2}" y="27" text-anchor="middle">${escapeXml(username)}'s Contribution Graph</text>
  <text class="subtitle" x="${GRAPH_WIDTH / 2}" y="45" text-anchor="middle">Last ${contributions.length} days · updated by GitHub Actions</text>
  <g id="axes">
    <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${baseline}"/>
    <line class="axis" x1="${margin.left}" y1="${baseline}" x2="${GRAPH_WIDTH - margin.right}" y2="${baseline}"/>
${yLabels}
${xLabels}
  </g>
  <g id="activity">
    <path class="area" d="${areaPath}"/>
    <path class="line" d="${linePath}"/>
${pointElements}${emptyState}
  </g>
</svg>
`;
}

export async function fetchContributionDays(username, githubToken) {
  const profileUsername = username?.trim();
  if (!profileUsername) {
    throw new Error("PROFILE_USERNAME or GITHUB_REPOSITORY_OWNER is required");
  }
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required to read GitHub contributions");
  }

  const query = `
    query ContributionCalendar($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "github-profile-activity-graph",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables: { login: profileUsername } }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors[0].message}`);
  }

  return normalizeContributionDays(
    payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks,
  );
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function niceUpperBound(value) {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatShortDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
