import { relativeTime, sparkline } from './github-activity.mjs';

export interface ActivityCommit {
  repo: string;
  fullName: string;
  headline: string;
  date: string;
  url: string;
  branch: string;
  additions: number;
  deletions: number;
}

export interface ActivityRepo {
  name: string;
  fullName: string;
  url: string;
  homepageUrl: string | null;
  description: string;
  language: { name: string; color: string | null } | null;
  stars: number;
  isFork: boolean;
  pushedAt: string;
  commits7d: number;
  commits30d: number;
  commitsWindow: number;
  spark: number[];
  latest: ActivityCommit | null;
  release: { tag: string; url: string; publishedAt: string } | null;
}

export interface ActivityRelease {
  repo: string;
  fullName: string;
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
}

export interface ActivitySnapshot {
  generatedAt: string;
  login: string;
  profileUrl: string;
  windowDays: number;
  focusWindow: 7 | 30;
  lastPush: string | null;
  calendar: { date: string; count: number }[];
  totals: {
    commits7d: number;
    commits30d: number;
    commitsWindow: number;
    activeRepos7d: number;
    activeRepos30d: number;
    streak: number;
    longestStreak: number;
    busiestDay: { date: string; count: number };
  };
  repos: ActivityRepo[];
  commits: ActivityCommit[];
  releases: ActivityRelease[];
  languages: { name: string; color: string | null; commits: number; share: number }[];
}

const esc = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );

const num = (n: number): string => Number(n ?? 0).toLocaleString('en-US');
const ago = (iso: string | null | undefined, now: Date): string => relativeTime(iso, now) ?? '—';
const fallbackLanguageColor = '#9198a1';

const CELL = 10;
const STEP = 13;
const LEFT_PAD = 22;
const TOP_PAD = 12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const muted = 'text-paper-muted dark:text-term-muted';
const faint = 'text-paper-faint dark:text-term-faint';
const text = 'text-paper-text dark:text-term-text';
const green = 'text-paper-green dark:text-term-green';
const amber = 'text-paper-amber dark:text-term-amber';
const hoverGreen = 'hover:text-paper-green dark:hover:text-term-green transition-colors';

/// Quartiles of the non-zero days, so a 90-commit outlier doesn't flatten a normal
/// 10-commit day down to the faintest shade.
function levelThresholds(calendar: ActivitySnapshot['calendar']): number[] {
  const active = calendar
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (!active.length) return [1, 2, 3, 4];
  const q = (p: number) => active[Math.min(active.length - 1, Math.floor(active.length * p))];
  return [q(0), q(0.25), q(0.5), q(0.75)];
}

function level(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  let lvl = 1;
  for (let i = 1; i < thresholds.length; i++) if (count >= thresholds[i]) lvl = i + 1;
  return lvl;
}

function renderHeatmap(calendar: ActivitySnapshot['calendar']): string {
  if (!calendar.length) return '';
  const thresholds = levelThresholds(calendar);
  const firstWeekday = new Date(`${calendar[0].date}T00:00:00Z`).getUTCDay();
  const cols = Math.ceil((calendar.length + firstWeekday) / 7);
  const width = LEFT_PAD + cols * STEP;
  const height = TOP_PAD + 7 * STEP;

  const cells: string[] = [];
  const monthLabels: string[] = [];
  let lastMonth = -1;
  calendar.forEach((day, i) => {
    const slot = i + firstWeekday;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const x = LEFT_PAD + col * STEP;
    const y = TOP_PAD + row * STEP;
    const month = Number(day.date.slice(5, 7)) - 1;
    if (row === 0 && month !== lastMonth) {
      if (lastMonth !== -1 || i === 0) {
        monthLabels.push(`<text x="${x}" y="8" class="act-hm-label">${MONTHS[month]}</text>`);
      }
      lastMonth = month;
    }
    const label = `${day.date} · ${day.count} commit${day.count === 1 ? '' : 's'}`;
    cells.push(
      `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="act-c act-c${level(day.count, thresholds)}"><title>${esc(label)}</title></rect>`
    );
  });
  const dayLabels = [
    [1, 'M'],
    [3, 'W'],
    [5, 'F'],
  ]
    .map(
      ([row, label]) =>
        `<text x="0" y="${TOP_PAD + (row as number) * STEP + 8}" class="act-hm-label">${label}</text>`
    )
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Commits per day over the last ${calendar.length} days" class="block act-heatmap">${monthLabels.join('')}${dayLabels}${cells.join('')}</svg>`;
}

function languageDot(repo: ActivityRepo): string {
  if (!repo.language) return '';
  const color = repo.language.color ?? fallbackLanguageColor;
  return `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${esc(color)}"></span>${esc(repo.language.name)}</span>`;
}

function renderLanguages(languages: ActivitySnapshot['languages'], windowLabel: string): string {
  if (!languages.length) return '';
  const segments = languages
    .map(
      (l) =>
        `<span class="h-full" style="width:${(l.share * 100).toFixed(2)}%;background:${esc(l.color ?? fallbackLanguageColor)}" title="${esc(l.name)} · ${num(l.commits)} commits"></span>`
    )
    .join('');
  const legend = languages
    .slice(0, 4)
    .map(
      (l) =>
        `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${esc(l.color ?? fallbackLanguageColor)}"></span>${esc(l.name)} <span class="${faint}">${Math.round(l.share * 100)}%</span></span>`
    )
    .join('');
  return `
    <div class="mt-4">
      <div class="flex items-baseline justify-between mb-1.5">
        <span class="term-label">languages · ${windowLabel}</span>
      </div>
      <div class="flex h-1.5 gap-px rounded-sm overflow-hidden bg-paper-raised dark:bg-term-raised">${segments}</div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] ${muted}">${legend}</div>
    </div>`;
}

function statTile(value: string, label: string, accent = false): string {
  return `
    <div>
      <div class="text-xl sm:text-2xl font-bold tracking-tight ${accent ? 'phosphor' : text}">${value}</div>
      <div class="text-[11px] ${muted} mt-0.5">${label}</div>
    </div>`;
}

function renderFocus(data: ActivitySnapshot, now: Date): string {
  const focus = data.repos[0];
  const windowLabel = data.focusWindow === 7 ? 'this week' : 'this month';
  if (!focus) {
    return `
      <p class="term-label mb-3">now building</p>
      <h1 class="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 leading-[1.05] tracking-tight ${text}">
        Between<br /><span class="phosphor">pushes.</span>
      </h1>
      <p class="text-base sm:text-lg ${muted} max-w-2xl">
        Nothing public landed in the last 30 days. The calendar on the right is what the quiet looks like.
      </p>`;
  }
  const commitsInWindow = data.focusWindow === 7 ? focus.commits7d : focus.commits30d;
  const chips: string[] = [];
  if (focus.language) chips.push(languageDot(focus));
  if (focus.stars > 0) chips.push(`<span class="${amber}">★ ${num(focus.stars)}</span>`);
  chips.push(
    `<span><strong class="${text}">${num(commitsInWindow)}</strong> commits · ${data.focusWindow}d</span>`
  );
  if (data.focusWindow === 7 && focus.commits30d > focus.commits7d) {
    chips.push(`<span><strong class="${text}">${num(focus.commits30d)}</strong> · 30d</span>`);
  }
  if (focus.release) {
    chips.push(
      `<a href="${esc(focus.release.url)}" target="_blank" rel="noopener noreferrer" class="${amber} ${hoverGreen}">${esc(focus.release.tag)} · ${ago(focus.release.publishedAt, now)}</a>`
    );
  }
  const latest = focus.latest;
  const commitLine = latest
    ? `
      <a href="${esc(latest.url)}" target="_blank" rel="noopener noreferrer" class="group/commit block mt-6 max-w-2xl">
        <div class="flex items-baseline gap-2 text-[11px] ${faint} mb-1">
          <span class="${amber}">${esc(latest.branch)}</span>
          <span>${ago(latest.date, now)}</span>
          <span class="${green}">+${num(latest.additions)}</span>
          <span class="text-paper-red dark:text-term-red">−${num(latest.deletions)}</span>
        </div>
        <p class="text-sm sm:text-base ${text} leading-snug group-hover/commit:text-paper-green dark:group-hover/commit:text-term-green transition-colors">
          <span class="${green}">›</span> <span class="act-type cursor-blink" data-text="${esc(latest.headline)}">${esc(latest.headline)}</span>
        </p>
      </a>`
    : '';
  const spark = sparkline(focus.spark);
  return `
    <p class="term-label mb-3">now building · ${windowLabel}</p>
    <h1 class="text-4xl sm:text-6xl md:text-7xl font-bold mb-4 leading-[1.05] tracking-tight break-words">
      <a href="${esc(focus.url)}" target="_blank" rel="noopener noreferrer" class="phosphor hover:opacity-90 transition-opacity">${esc(focus.name)}</a>
    </h1>
    <p class="text-base sm:text-lg ${muted} leading-relaxed max-w-2xl">${esc(focus.description || 'No description yet.')}</p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs ${muted}">${chips.join('')}</div>
    ${commitLine}
    <div class="mt-5 flex items-baseline gap-3 text-xs ${faint}">
      <span class="act-spark ${green} text-base leading-none tracking-tight" aria-label="Commits per day, last ${focus.spark.length} days">${spark}</span>
      <span>${focus.spark.length}d</span>
    </div>`;
}

function renderCalendarPanel(data: ActivitySnapshot, now: Date): string {
  const t = data.totals;
  const windowLabel = data.focusWindow === 7 ? '7d' : '30d';
  const weeks = Math.round(data.windowDays / 7);
  return `
    <div class="term-frame p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-3 mb-3">
        <p class="prompt-line truncate">git log --since=${weeks}.weeks</p>
        <span class="text-[11px] ${faint} whitespace-nowrap">${num(t.commitsWindow)} commits</span>
      </div>
      ${renderHeatmap(data.calendar)}
      <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
        ${statTile(`${num(t.streak)}d`, 'streak', true)}
        ${statTile(num(t.commits30d), 'commits · 30d')}
        ${statTile(num(t.activeRepos30d), 'repos · 30d')}
        ${statTile(num(t.busiestDay?.count ?? 0), `best day · ${esc(t.busiestDay?.date?.slice(5) ?? '')}`)}
      </dl>
      ${renderLanguages(data.languages, windowLabel)}
      <p class="mt-4 text-[10px] ${faint}">synced ${ago(data.generatedAt, now)} · public repos only</p>
    </div>`;
}

function renderBench(data: ActivitySnapshot, now: Date): string {
  const rows = data.repos.slice(1);
  const key = data.focusWindow === 7 ? 'commits7d' : 'commits30d';
  const body = rows.length
    ? rows
        .map(
          (repo) => `
        <li>
          <a href="${esc(repo.url)}" target="_blank" rel="noopener noreferrer" class="group/row block py-2.5 border-t border-paper-border dark:border-term-border first:border-t-0">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${esc(repo.language?.color ?? fallbackLanguageColor)}" title="${esc(repo.language?.name ?? '')}"></span>
              <span class="text-sm font-semibold ${text} truncate group-hover/row:text-paper-green dark:group-hover/row:text-term-green transition-colors">${esc(repo.name)}</span>
              <span class="act-spark ${green} text-xs leading-none tracking-tight ml-auto hidden sm:inline" aria-hidden="true">${sparkline(repo.spark)}</span>
              <span class="text-xs ${muted} whitespace-nowrap w-16 text-right"><strong class="${text}">${num(repo[key])}</strong> · ${data.focusWindow}d</span>
              <span class="text-[11px] ${faint} whitespace-nowrap w-14 text-right">${ago(repo.latest?.date ?? repo.pushedAt, now)}</span>
            </div>
            ${
              repo.latest
                ? `<p class="text-xs ${muted} truncate mt-1 pl-5"><span class="${amber}">${esc(repo.latest.branch)}</span> ${esc(repo.latest.headline)}</p>`
                : ''
            }
          </a>
        </li>`
        )
        .join('')
    : `<li class="py-3 text-xs ${faint}">One repo carried the whole ${data.focusWindow === 7 ? 'week' : 'month'}.</li>`;
  return `
    <div class="term-frame p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-3 mb-1">
        <p class="prompt-line truncate">ls ~/bench --sort=commits</p>
        <span class="text-[11px] ${faint} whitespace-nowrap">${num(data.totals[data.focusWindow === 7 ? 'activeRepos7d' : 'activeRepos30d'])} active · ${data.focusWindow}d</span>
      </div>
      <ul>${body}</ul>
    </div>`;
}

function renderCommits(data: ActivitySnapshot, now: Date): string {
  const rows = data.commits
    .map(
      (c) => `
      <li>
        <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" class="group/c flex items-baseline gap-3 py-1.5 text-xs min-w-0">
          <span class="${faint} w-14 flex-shrink-0 whitespace-nowrap tabular-nums">${ago(c.date, now)}</span>
          <span class="${amber} flex-shrink-0 max-w-[9rem] truncate">${esc(c.repo)}</span>
          <span class="${muted} truncate group-hover/c:text-paper-green dark:group-hover/c:text-term-green transition-colors">${esc(c.headline)}</span>
        </a>
      </li>`
    )
    .join('');
  return `
    <div class="term-frame p-4 sm:p-5">
      <p class="prompt-line mb-2 truncate">git log --all --author=${esc(data.login)} -${data.commits.length}</p>
      <ul>${rows || `<li class="py-2 text-xs ${faint}">No public commits yet.</li>`}</ul>
    </div>`;
}

function renderReleases(data: ActivitySnapshot, now: Date): string {
  if (!data.releases.length) return '';
  const rows = data.releases
    .map(
      (r) => `
      <li>
        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="group/r flex items-baseline gap-3 py-1.5 text-xs min-w-0">
          <span class="${green} font-semibold flex-shrink-0">${esc(r.tag)}</span>
          <span class="${text} truncate group-hover/r:text-paper-green dark:group-hover/r:text-term-green transition-colors">${esc(r.repo)}</span>
          ${r.prerelease ? `<span class="${amber} flex-shrink-0">pre</span>` : ''}
          <span class="${faint} ml-auto flex-shrink-0">${ago(r.publishedAt, now)}</span>
        </a>
      </li>`
    )
    .join('');
  return `
    <div class="term-frame p-4 sm:p-5">
      <p class="prompt-line mb-2 truncate">gh release list --limit ${data.releases.length}</p>
      <ul>${rows}</ul>
    </div>`;
}

export function renderActivityBoard(data: ActivitySnapshot, now: Date): string {
  const lastPush = data.lastPush ? ago(data.lastPush, now) : null;
  return `
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-6">
      <p class="prompt-line">tail -f ~/activity.log</p>
      ${
        lastPush
          ? `<a href="${esc(data.profileUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-xs text-paper-greendim dark:text-term-greendim ${hoverGreen}">
              <span class="relative flex w-1.5 h-1.5">
                <span class="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-paper-green dark:bg-term-green opacity-75"></span>
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-paper-green dark:bg-term-green"></span>
              </span>
              last push ${lastPush} · @${esc(data.login)}
            </a>`
          : ''
      }
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div class="lg:col-span-7 min-w-0">${renderFocus(data, now)}</div>
      <div class="lg:col-span-5 min-w-0">${renderCalendarPanel(data, now)}</div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mt-6 lg:mt-8 items-start">
      <div class="lg:col-span-7 min-w-0">${renderBench(data, now)}</div>
      <div class="lg:col-span-5 min-w-0 flex flex-col gap-6">${renderCommits(data, now)}${renderReleases(data, now)}</div>
    </div>`;
}
