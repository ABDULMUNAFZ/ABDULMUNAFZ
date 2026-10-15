import { graphql } from "./svg.mjs";

export async function fetchStats(login, request = graphql) {
  const query = `query($login:String!,$after:String){user(login:$login){
    followers{totalCount}
    pullRequests{totalCount}
    repositories(first:100,after:$after,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){
      totalCount pageInfo{hasNextPage endCursor} nodes{id stargazerCount
      languages(first:10,orderBy:{field:SIZE,direction:DESC}){pageInfo{hasNextPage endCursor} edges{size node{name}}}}}}}`;
  const languageQuery = `query($id:ID!,$after:String){node(id:$id){... on Repository{
    languages(first:100,after:$after,orderBy:{field:SIZE,direction:DESC}){
      pageInfo{hasNextPage endCursor} edges{size node{name}}}}}}`;
  const bytes = new Map();
  let after = null;
  let stars = 0;
  let numbers;
  do {
    const { user } = await request({ query, variables: { login, after } });
    if (!user) throw new Error(`GitHub user not found: ${login}`);
    numbers ??= [
      { label: "PUBLIC REPOS", value: user.repositories.totalCount },
      { label: "STARS", value: 0 },
      { label: "FOLLOWERS", value: user.followers.totalCount },
      { label: "PULL REQUESTS", value: user.pullRequests.totalCount },
    ];
    for (const repo of user.repositories.nodes) {
      stars += repo.stargazerCount;
      let languages = repo.languages;
      let languageCursor = null;
      for (;;) {
        for (const { size, node } of languages.edges) {
          bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
        }
        if (!languages.pageInfo?.hasNextPage) break;
        const next = languages.pageInfo.endCursor;
        if (!next || next === languageCursor) throw new Error("GitHub language pagination did not advance");
        languageCursor = next;
        const result = await request({ query: languageQuery, variables: { id: repo.id, after: next } });
        if (!result.node) throw new Error(`GitHub repository no longer available: ${repo.id}`);
        languages = result.node.languages;
      }
    }
    const { hasNextPage, endCursor } = user.repositories.pageInfo;
    if (hasNextPage && (!endCursor || endCursor === after)) {
      throw new Error("GitHub repository pagination did not advance");
    }
    after = hasNextPage ? endCursor : null;
  } while (after !== null);
  numbers[1].value = stars;
  return { languages: [...bytes].map(([name, size]) => ({ name, size })), numbers };
}
