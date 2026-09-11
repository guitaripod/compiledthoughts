export const LOGIN = 'guitaripod';
export const WINDOW_DAYS = 168;
export const SPARK_DAYS = 28;
export const MAX_REPOS = 7;
export const MAX_COMMITS = 8;
const HEADLINE_MAX = 160;
export const MAX_RELEASES = 5;

const SLICE_DAYS = 56;
const MAX_REPO_LOOKUPS = 40;
const MAX_PUSH_HEADS = 16;
const EVENT_PAGES = 3;
const GRAPHQL_URL = 'https://api.github.com/graphql';
const REST_URL = 'https://api.github.com';
const USER_AGENT = 'midgarcorp.cc (https://midgarcorp.cc)';
const TIMEOUT_MS = 20000;
const DAY_MS = 86400000;

/// Repos that are real pushes but not "work": the profile README and the dotfiles/config
/// repos. They still count towards the calendar; they just never headline the board.
export const QUIET_REPOS = new Set([
  'guitaripod',
  'claudeconfig',
  'macconfig',
  'archconfig',
  'opencodeconfig',
  'ghostty-config',
]);

export function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function daysAgo(now, days) {
  return new Date(now.getTime() - days * DAY_MS);
}

/// One entry per calendar day for the `days` days ending today, oldest first.
export function buildCalendar(dayCounts, now, days = WINDOW_DAYS) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(daysAgo(now, i));
    out.push({ date, count: dayCounts.get(date) ?? 0 });
  }
  return out;
}

/// Consecutive active days ending today, or ending yesterday when today has no commit yet
/// (GitHub counts a streak the same way). `longest` is the best run inside the window.
export function computeStreak(calendar) {
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const day of calendar) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  const last = calendar.length - 1;
  const start = calendar[last]?.count > 0 ? last : last - 1;
  for (let i = start; i >= 0 && calendar[i].count > 0; i--) current++;
  return { current, longest };
}

export function sumSince(days, sinceKey) {
  let total = 0;
  for (const [date, count] of days) if (date >= sinceKey) total += count;
  return total;
}

/// Sort busiest-first inside the focus window, newest push breaking ties.
export function rankRepos(repos, focusWindow) {
  const key = focusWindow === 7 ? 'commits7d' : 'commits30d';
  return [...repos].sort(
    (a, b) => b[key] - a[key] || (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')
  );
}

/// The week is the focus window unless it was quiet; then the month carries the board.
export function pickFocusWindow(repos) {
  return repos.some((r) => r.commits7d > 0) ? 7 : 30;
}

export function relativeTime(iso, now) {
  if (!iso) return null;
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['w', 604800],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];
  for (const [label, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n}${label} ago`;
  }
  return 'just now';
}

async function graphql(token, fetchImpl, query, variables) {
  const res = await fetchImpl(GRAPHQL_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const body = await res.json();
  if (body.errors?.length && !body.data) throw new Error(body.errors[0].message);
  return body.data;
}

async function rest(token, fetchImpl, path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchImpl(`${REST_URL}${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitHub REST ${res.status} for ${path}`);
  return res.json();
}

const REPO_FIELDS = `
  nameWithOwner name url description isPrivate isFork isArchived stargazerCount pushedAt homepageUrl
  primaryLanguage { name color }`;

const COMMIT_FIELDS = `oid message committedDate url additions deletions`;

function contributionsQuery(slices) {
  const parts = slices.map(
    (_, i) => `
    w${i}: contributionsCollection(from: $from${i}, to: $to${i}) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { ${REPO_FIELDS} }
        contributions(first: 100, orderBy: { field: OCCURRED_AT, direction: DESC }) {
          nodes { occurredAt commitCount }
        }
      }
    }`
  );
  const vars = slices.map((_, i) => `$from${i}: DateTime!, $to${i}: DateTime!`).join(', ');
  return `query($login: String!, ${vars}) {
    user(login: $login) { id login avatarUrl url ${parts.join('')} }
  }`;
}

/// Three back-to-back 56-day slices: one collection call caps per-repo contribution nodes
/// at 100, and a daily-pushed repo would blow past that over the full 24-week window.
function contributionSlices(now) {
  const slices = [];
  for (let i = 0; i < WINDOW_DAYS / SLICE_DAYS; i++) {
    const to = daysAgo(now, i * SLICE_DAYS);
    const from = daysAgo(to, SLICE_DAYS);
    slices.push({ from: from.toISOString(), to: to.toISOString() });
  }
  return slices;
}

function mergeContributions(user, slices) {
  const repos = new Map();
  const dayCounts = new Map();
  const seenDays = new Set();
  for (let i = 0; i < slices.length; i++) {
    for (const entry of user[`w${i}`].commitContributionsByRepository) {
      const repo = entry.repository;
      if (repo.isPrivate) continue;
      let rec = repos.get(repo.nameWithOwner);
      if (!rec) {
        rec = { repo, days: new Map() };
        repos.set(repo.nameWithOwner, rec);
      }
      for (const node of entry.contributions.nodes) {
        const date = node.occurredAt.slice(0, 10);
        const dedupe = `${repo.nameWithOwner}|${date}`;
        if (seenDays.has(dedupe)) continue;
        seenDays.add(dedupe);
        rec.days.set(date, (rec.days.get(date) ?? 0) + node.commitCount);
        dayCounts.set(date, (dayCounts.get(date) ?? 0) + node.commitCount);
      }
    }
  }
  return { repos, dayCounts };
}

/// The public events feed is the only place a push to a feature branch shows up; it carries
/// the branch and head sha (no commit details any more), which the lookup query resolves.
async function fetchPushHeads(token, fetchImpl) {
  const pages = Array.from({ length: EVENT_PAGES }, (_, i) =>
    rest(token, fetchImpl, `/users/${LOGIN}/events/public?per_page=100&page=${i + 1}`).catch(
      () => []
    )
  );
  const heads = [];
  for (const events of await Promise.all(pages)) {
    for (const event of events) {
      if (event.type !== 'PushEvent' || !event.payload?.head) continue;
      heads.push({
        fullName: event.repo.name,
        branch: String(event.payload.ref ?? '').replace(/^refs\/heads\//, ''),
        oid: event.payload.head,
        pushedAt: event.created_at,
      });
    }
  }
  return heads;
}

function lookupQuery(repoNames, extraHeads, userId) {
  const parts = [];
  repoNames.forEach((fullName, i) => {
    const [owner, name] = fullName.split('/');
    const head = extraHeads.latestByRepo.get(fullName);
    parts.push(`
    r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      ${head ? `pushed: object(oid: ${JSON.stringify(head.oid)}) { ... on Commit { ${COMMIT_FIELDS} } }` : ''}
      defaultBranchRef { name target { ... on Commit {
        history(first: 1, author: { id: ${JSON.stringify(userId)} }) { nodes { ${COMMIT_FIELDS} } }
      } } }
      releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { tagName name publishedAt url isPrerelease isDraft }
      }
    }`);
  });
  extraHeads.ticker.forEach((head, i) => {
    const [owner, name] = head.fullName.split('/');
    parts.push(`
    p${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      pushed: object(oid: ${JSON.stringify(head.oid)}) { ... on Commit { ${COMMIT_FIELDS} } }
    }`);
  });
  return `query { ${parts.join('')} }`;
}

/// The newest push per repo rides along with that repo's lookup; every other recent head
/// (older pushes, repos outside the lookup) is resolved on its own for the commit ticker.
function splitPushHeads(pushHeads, lookupSet) {
  const latestByRepo = new Map();
  const ticker = [];
  const seenOids = new Set();
  for (const head of pushHeads) {
    if (QUIET_REPOS.has(head.fullName.split('/')[1]) || seenOids.has(head.oid)) continue;
    seenOids.add(head.oid);
    const isRepoLatest = !latestByRepo.has(head.fullName);
    if (isRepoLatest) latestByRepo.set(head.fullName, head);
    const ridesWithLookup = isRepoLatest && lookupSet.has(head.fullName);
    if (!ridesWithLookup && ticker.length < MAX_PUSH_HEADS) ticker.push(head);
  }
  return { latestByRepo, ticker };
}

/// GitHub's own messageHeadline cuts a long subject at ~72 characters; these commit
/// subjects are sentences, so take the first paragraph whole and cap it ourselves.
export function commitHeadline(message) {
  const paragraph = String(message ?? '')
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  if (paragraph.length <= HEADLINE_MAX) return paragraph;
  return `${paragraph.slice(0, HEADLINE_MAX - 1).replace(/\s+\S*$/, '')}…`;
}

function commitRecord(commit, fullName, branch) {
  if (!commit?.oid) return null;
  return {
    repo: fullName.split('/')[1],
    fullName,
    headline: commitHeadline(commit.message),
    date: commit.committedDate,
    url: commit.url,
    branch,
    additions: commit.additions ?? 0,
    deletions: commit.deletions ?? 0,
  };
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.date >= b.date ? a : b;
}

export async function buildActivitySnapshot({ token, fetchImpl = fetch, now = new Date() }) {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  const slices = contributionSlices(now);
  const variables = { login: LOGIN };
  slices.forEach((s, i) => {
    variables[`from${i}`] = s.from;
    variables[`to${i}`] = s.to;
  });
  const [data, pushHeads] = await Promise.all([
    graphql(token, fetchImpl, contributionsQuery(slices), variables),
    fetchPushHeads(token, fetchImpl),
  ]);
  const user = data.user;
  const { repos, dayCounts } = mergeContributions(user, slices);

  const since7 = dayKey(daysAgo(now, 6));
  const since30 = dayKey(daysAgo(now, 29));

  const repoRecords = [...repos.values()]
    .filter(({ repo }) => !QUIET_REPOS.has(repo.name) && !repo.isArchived)
    .map(({ repo, days }) => ({
      name: repo.name,
      fullName: repo.nameWithOwner,
      url: repo.url,
      homepageUrl: repo.homepageUrl || null,
      description: repo.description || '',
      language: repo.primaryLanguage
        ? { name: repo.primaryLanguage.name, color: repo.primaryLanguage.color }
        : null,
      stars: repo.stargazerCount,
      isFork: repo.isFork,
      pushedAt: repo.pushedAt,
      commits7d: sumSince(days, since7),
      commits30d: sumSince(days, since30),
      commitsWindow: [...days.values()].reduce((a, b) => a + b, 0),
      spark: buildCalendar(days, now, SPARK_DAYS).map((d) => d.count),
      latest: null,
      release: null,
    }));

  const focusWindow = pickFocusWindow(repoRecords);
  const ranked = rankRepos(repoRecords, focusWindow);
  const lookupNames = ranked.slice(0, MAX_REPO_LOOKUPS).map((r) => r.fullName);
  const lookupSet = new Set(lookupNames);

  const { latestByRepo, ticker } = splitPushHeads(pushHeads, lookupSet);

  const lookup = await graphql(
    token,
    fetchImpl,
    lookupQuery(lookupNames, { latestByRepo, ticker }, user.id),
    {}
  );

  const commits = [];
  const releases = [];
  const byName = new Map(ranked.map((r) => [r.fullName, r]));
  lookupNames.forEach((fullName, i) => {
    const node = lookup[`r${i}`];
    const rec = byName.get(fullName);
    if (!node || !rec) return;
    const head = latestByRepo.get(fullName);
    const pushed = head ? commitRecord(node.pushed, fullName, head.branch) : null;
    const defaultHead = commitRecord(
      node.defaultBranchRef?.target?.history?.nodes?.[0],
      fullName,
      node.defaultBranchRef?.name ?? 'master'
    );
    rec.latest = newer(pushed, defaultHead);
    for (const c of [pushed, defaultHead]) if (c) commits.push(c);
    const release = node.releases?.nodes?.[0];
    if (release && !release.isDraft && release.publishedAt) {
      rec.release = { tag: release.tagName, url: release.url, publishedAt: release.publishedAt };
      releases.push({
        repo: rec.name,
        fullName,
        tag: release.tagName,
        name: release.name || release.tagName,
        url: release.url,
        publishedAt: release.publishedAt,
        prerelease: release.isPrerelease,
      });
    }
  });
  ticker.forEach((head, i) => {
    const c = commitRecord(lookup[`p${i}`]?.pushed, head.fullName, head.branch);
    if (c) commits.push(c);
  });

  const seenCommitUrls = new Set();
  const recentCommits = commits
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((c) => (seenCommitUrls.has(c.url) ? false : seenCommitUrls.add(c.url)))
    .slice(0, MAX_COMMITS);

  const windowStart = dayKey(daysAgo(now, WINDOW_DAYS - 1));
  const recentReleases = releases
    .filter((r) => r.publishedAt.slice(0, 10) >= windowStart)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_RELEASES);

  const calendar = buildCalendar(dayCounts, now);
  const streak = computeStreak(calendar);
  const busiestDay = calendar.reduce((best, d) => (d.count > best.count ? d : best), calendar[0]);
  const focusKey = focusWindow === 7 ? 'commits7d' : 'commits30d';
  const active = ranked.filter((r) => r[focusKey] > 0);

  const languageTotals = new Map();
  for (const r of active) {
    if (!r.language) continue;
    const cur = languageTotals.get(r.language.name) ?? { ...r.language, commits: 0 };
    cur.commits += r[focusKey];
    languageTotals.set(r.language.name, cur);
  }
  const languageCommits = [...languageTotals.values()].reduce((a, l) => a + l.commits, 0);
  const languages = [...languageTotals.values()]
    .sort((a, b) => b.commits - a.commits)
    .map((l) => ({ ...l, share: languageCommits ? l.commits / languageCommits : 0 }));

  const lastPush = recentCommits[0]?.date ?? ranked[0]?.pushedAt ?? null;

  return {
    generatedAt: now.toISOString(),
    login: user.login,
    avatarUrl: user.avatarUrl,
    profileUrl: user.url,
    windowDays: WINDOW_DAYS,
    focusWindow,
    lastPush,
    calendar,
    totals: {
      commits7d: sumSince(dayCounts, since7),
      commits30d: sumSince(dayCounts, since30),
      commitsWindow: calendar.reduce((a, d) => a + d.count, 0),
      activeRepos7d: repoRecords.filter((r) => r.commits7d > 0).length,
      activeRepos30d: repoRecords.filter((r) => r.commits30d > 0).length,
      streak: streak.current,
      longestStreak: streak.longest,
      busiestDay,
    },
    repos: active.slice(0, MAX_REPOS + 1),
    commits: recentCommits,
    releases: recentReleases,
    languages,
  };
}
