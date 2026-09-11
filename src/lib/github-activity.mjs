export const LOGIN = 'guitaripod';
export const WINDOW_DAYS = 168;
export const SPARK_DAYS = 28;
export const MAX_REPOS = 7;
export const RELEASE_FRESH_DAYS = 30;

const SLICE_DAYS = 56;
const GRAPHQL_URL = 'https://api.github.com/graphql';
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

const REPO_FIELDS = `
  nameWithOwner name url description isPrivate isFork isArchived stargazerCount pushedAt homepageUrl
  primaryLanguage { name color }`;

function contributionsQuery(slices) {
  const parts = slices.map(
    (_, i) => `
    w${i}: contributionsCollection(from: $from${i}, to: $to${i}) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
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
    user(login: $login) { login url ${parts.join('')} }
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

/// Per-repo days come from public commit contributions (they name repos); the day totals
/// come from GitHub's contribution calendar, which counts private work too without naming it.
function mergeContributions(user, slices) {
  const repos = new Map();
  const dayCounts = new Map();
  const seenDays = new Set();
  for (let i = 0; i < slices.length; i++) {
    const collection = user[`w${i}`];
    for (const week of collection.contributionCalendar?.weeks ?? []) {
      for (const day of week.contributionDays) {
        if (!dayCounts.has(day.date)) dayCounts.set(day.date, day.contributionCount);
      }
    }
    for (const entry of collection.commitContributionsByRepository) {
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
      }
    }
  }
  return { repos, dayCounts };
}

/// One aliased query for the latest release of every repo on the board.
function releasesQuery(repoNames) {
  const parts = repoNames.map((fullName, i) => {
    const [owner, name] = fullName.split('/');
    return `
    r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { tagName publishedAt url isPrerelease isDraft }
      }
    }`;
  });
  return `query { ${parts.join('')} }`;
}

export async function buildActivitySnapshot({ token, fetchImpl = fetch, now = new Date() }) {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  const slices = contributionSlices(now);
  const variables = { login: LOGIN };
  slices.forEach((s, i) => {
    variables[`from${i}`] = s.from;
    variables[`to${i}`] = s.to;
  });
  const data = await graphql(token, fetchImpl, contributionsQuery(slices), variables);
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
      release: null,
    }));

  const focusWindow = pickFocusWindow(repoRecords);
  const focusKey = focusWindow === 7 ? 'commits7d' : 'commits30d';
  const board = rankRepos(repoRecords, focusWindow)
    .filter((r) => r[focusKey] > 0)
    .slice(0, MAX_REPOS + 1);

  if (board.length) {
    const lookup = await graphql(token, fetchImpl, releasesQuery(board.map((r) => r.fullName)), {});
    const freshSince = dayKey(daysAgo(now, RELEASE_FRESH_DAYS - 1));
    board.forEach((rec, i) => {
      const release = lookup[`r${i}`]?.releases?.nodes?.[0];
      if (!release || release.isDraft || !release.publishedAt) return;
      if (release.publishedAt.slice(0, 10) < freshSince) return;
      rec.release = {
        tag: release.tagName,
        url: release.url,
        publishedAt: release.publishedAt,
        prerelease: release.isPrerelease,
      };
    });
  }

  const calendar = buildCalendar(dayCounts, now);
  const streak = computeStreak(calendar);

  const languageTotals = new Map();
  for (const r of board) {
    if (!r.language) continue;
    const cur = languageTotals.get(r.language.name) ?? { ...r.language, commits: 0 };
    cur.commits += r[focusKey];
    languageTotals.set(r.language.name, cur);
  }
  const languageCommits = [...languageTotals.values()].reduce((a, l) => a + l.commits, 0);
  const languages = [...languageTotals.values()]
    .sort((a, b) => b.commits - a.commits)
    .map((l) => ({ ...l, share: languageCommits ? l.commits / languageCommits : 0 }));

  const lastPush = repoRecords.reduce(
    (latest, r) => (r.pushedAt && (!latest || r.pushedAt > latest) ? r.pushedAt : latest),
    null
  );

  return {
    generatedAt: now.toISOString(),
    login: user.login,
    profileUrl: user.url,
    windowDays: WINDOW_DAYS,
    focusWindow,
    lastPush,
    calendar,
    totals: {
      contributions7d: sumSince(dayCounts, since7),
      contributions30d: sumSince(dayCounts, since30),
      contributionsWindow: calendar.reduce((a, d) => a + d.count, 0),
      activeRepos7d: repoRecords.filter((r) => r.commits7d > 0).length,
      activeRepos30d: repoRecords.filter((r) => r.commits30d > 0).length,
      streak: streak.current,
      longestStreak: streak.longest,
    },
    repos: board,
    languages,
  };
}
