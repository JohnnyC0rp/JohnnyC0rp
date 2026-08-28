import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchContributionDays,
  normalizeContributionDays,
  renderActivityGraph,
} from "../src/activity-graph.mjs";

test("normalizes and chronologically sorts GitHub contribution days", () => {
  const days = normalizeContributionDays([
    {
      contributionDays: [
        { contributionCount: 4, date: "2026-08-28" },
        { contributionCount: 0, date: "2026-08-27" },
      ],
    },
  ]);

  assert.deepEqual(days, [
    { count: 0, date: "2026-08-27" },
    { count: 4, date: "2026-08-28" },
  ]);
});

test("renders only the latest 30 days and escapes profile text", () => {
  const days = Array.from({ length: 35 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 6, 25 + index)).toISOString().slice(0, 10),
    count: index === 34 ? 7 : 0,
  }));
  const svg = renderActivityGraph(days, 'Johnny<&"\'');

  assert.match(svg, /Johnny&lt;&amp;&quot;&apos;'s Contribution Graph/);
  assert.match(svg, /2026-08-28: 7 contributions/);
  assert.doesNotMatch(svg, /2026-07-25: 0 contributions/);
  assert.doesNotMatch(svg, /<script|foreignObject|Bearer|GITHUB_TOKEN/);
});

test("labels a genuine zero-activity period instead of appearing broken", () => {
  const svg = renderActivityGraph(
    [
      { date: "2026-08-27", count: 0 },
      { date: "2026-08-28", count: 0 },
    ],
    "JohnnyC0rp",
    2,
  );

  assert.match(svg, /No contributions in the last 2 days/);
});

test("fetches only GitHub GraphQL and passes the username as a variable", async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return {
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  weeks: [
                    {
                      contributionDays: [
                        { contributionCount: 1, date: "2026-08-28" },
                      ],
                    },
                  ],
                },
              },
            },
          },
        };
      },
    };
  };

  const days = await fetchContributionDays("JohnnyC0rp", "test-token");
  const payload = JSON.parse(request.options.body);

  assert.equal(request.url, "https://api.github.com/graphql");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(payload.variables, { login: "JohnnyC0rp" });
  assert.match(payload.query, /user\(login: \$login\)/);
  assert.doesNotMatch(payload.query, /JohnnyC0rp/);
  assert.deepEqual(days, [{ count: 1, date: "2026-08-28" }]);
});
