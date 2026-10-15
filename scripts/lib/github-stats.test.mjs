import assert from "node:assert/strict";
import test from "node:test";
import { fetchStats } from "./github-stats.mjs";

const repo = (stars, name, size) => ({
  stargazerCount: stars,
  languages: { edges: [{ size, node: { name } }] },
});
const page = (nodes, hasNextPage, endCursor) => ({ user: {
  followers: { totalCount: 28 }, pullRequests: { totalCount: 12 },
  repositories: { totalCount: 102, nodes, pageInfo: { hasNextPage, endCursor } },
} });

test("stars and language bytes include repositories beyond the first 100 and merge languages across pages", async () => {
  const pages = [
    page(Array.from({ length: 100 }, () => repo(1, "JavaScript", 10)), true, "page-two"),
    page([repo(7, "JavaScript", 50), repo(2, "Python", 20)], false, "last"),
  ];
  const cursors = [];
  const result = await fetchStats("example", async ({ variables }) => {
    cursors.push(variables.after);
    return pages.shift();
  });
  assert.deepEqual(cursors, [null, "page-two"]);
  assert.equal(result.numbers.find(n => n.label === "STARS").value, 109);
  assert.deepEqual(result.languages, [{ name: "JavaScript", size: 1050 }, { name: "Python", size: 20 }]);
});

test("an empty account completes in one request", async () => {
  let calls = 0;
  const result = await fetchStats("example", async () => {
    calls++;
    const response = page([], false, null);
    response.user.repositories.totalCount = 0;
    return response;
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.languages, []);
  assert.equal(result.numbers[0].value, 0);
  assert.equal(result.numbers[1].value, 0);
});

test("a broken cursor fails instead of requesting pages indefinitely", async () => {
  await assert.rejects(fetchStats("example", async () => page([], true, null)), /did not advance/);
});
