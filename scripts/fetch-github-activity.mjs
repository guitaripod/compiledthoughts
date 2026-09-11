#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildActivitySnapshot } from '../src/lib/github-activity.mjs';

const OUT = path.join(process.cwd(), 'src', 'data', 'github-activity.json');

/// CI exports GITHUB_TOKEN; a local run borrows the gh CLI's login so the snapshot can be
/// refreshed without pasting a token.
function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

async function main() {
  const token = resolveToken();
  if (!token) {
    console.log('⚠️  No GITHUB_TOKEN and no gh login — keeping existing github-activity.json.');
    return;
  }
  const snapshot = await buildActivitySnapshot({ token });
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  const focus = snapshot.repos[0];
  console.log(
    `✓ github-activity.json: ${snapshot.totals.contributions7d} contributions / 7d across ${snapshot.totals.activeRepos7d} repos, focus ${focus?.name ?? '—'}, streak ${snapshot.totals.streak}d`
  );
}

main().catch((err) => {
  console.log(`⚠️  GitHub activity fetch failed (${err.message}) — keeping existing data.`);
});
