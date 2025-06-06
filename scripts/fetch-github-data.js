import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_USERNAME = 'marcusziade';
const GITHUB_API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`;

// Projects to exclude (forks, configs, etc)
const EXCLUDE_REPOS = [
  'marcusziade', // profile repo
  'isowords', // fork
  'swift-composable-architecture', // fork
  'homebrew-apod-cli', // homebrew tap
  'homebrew-songlink-cli', // homebrew tap
];

// Minimum number of commits to be considered an active project
const MIN_COMMITS = 5;

// Category mapping based on repo characteristics
function categorizeProject(repo) {
  const name = repo.name.toLowerCase();
  const language = repo.language;
  const description = (repo.description || '').toLowerCase();

  if (name.includes('-cli') || description.includes('cli')) {
    return 'CLI Tools';
  } else if (language === 'Swift' && (name.includes('kit') || description.includes('package'))) {
    return 'Swift Packages';
  } else if (
    description.includes('gtk') ||
    description.includes('desktop') ||
    description.includes('app')
  ) {
    return 'Desktop Apps';
  } else if (language === 'Swift') {
    return 'Swift Projects';
  } else if (language === 'Go') {
    return 'Go Projects';
  }
  return 'Other Projects';
}

// Extract key highlights from repo data
function getHighlights(repo) {
  const highlights = [];
  const description = (repo.description || '').toLowerCase();
  const name = repo.name.toLowerCase();

  // Check for homebrew
  if (repo.topics?.includes('homebrew') || description.includes('homebrew')) {
    highlights.push('Homebrew available');
  }

  // Check for cross-platform
  if (
    description.includes('cross-platform') ||
    description.includes('linux') ||
    description.includes('macos')
  ) {
    highlights.push('Cross-platform');
  }

  // Check for testing
  if (repo.topics?.includes('testing') || description.includes('test')) {
    highlights.push('Well-tested');
  }

  // Check for AI/ML
  if (
    description.includes('ai') ||
    description.includes('ml') ||
    description.includes('openai') ||
    description.includes('dalle')
  ) {
    highlights.push('AI-powered');
  }

  // Check for specific technologies
  if (description.includes('gtk')) highlights.push('GTK4');
  if (description.includes('async')) highlights.push('async/await');
  if (description.includes('vim')) highlights.push('Vim controls');
  if (description.includes('zero dependencies')) highlights.push('Zero dependencies');
  if (description.includes('batch')) highlights.push('Batch generation');

  // Language-specific
  if (repo.language === 'Swift' && description.includes('linux')) {
    highlights.push('Cross-platform Swift');
  }

  // Add topics as highlights
  if (repo.topics && repo.topics.length > 0) {
    repo.topics.slice(0, 2).forEach((topic) => {
      if (!highlights.some((h) => h.toLowerCase() === topic)) {
        highlights.push(topic.charAt(0).toUpperCase() + topic.slice(1));
      }
    });
  }

  return highlights.slice(0, 3); // Return max 3 highlights
}

// Determine platforms based on repo info
function getPlatforms(repo) {
  const platforms = [];
  const description = (repo.description || '').toLowerCase();
  const name = repo.name.toLowerCase();

  if (repo.language === 'Swift' || description.includes('swift')) {
    platforms.push('macOS');
    if (description.includes('linux')) platforms.push('Linux');
    if (description.includes('ios')) platforms.push('iOS');
  } else if (repo.language === 'Go' || name.includes('-cli')) {
    platforms.push('macOS', 'Linux', 'Windows');
  } else if (description.includes('gtk') || description.includes('linux')) {
    platforms.push('Linux');
  } else if (description.includes('cross-platform')) {
    platforms.push('macOS', 'Linux', 'Windows');
  }

  return [...new Set(platforms)]; // Remove duplicates
}

// Fetch commit count for a repository
async function getCommitCount(repo, headers) {
  try {
    // First try to get contributor stats which includes commit counts
    const contributorsUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo.name}/contributors`;
    const response = await fetch(contributorsUrl, { headers });

    if (response.ok) {
      const contributors = await response.json();
      // Find the owner's contributions
      const ownerContribution = contributors.find((c) => c.login === GITHUB_USERNAME);
      return ownerContribution ? ownerContribution.contributions : 0;
    }

    // Fallback: count commits in the default branch
    const commitsUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo.name}/commits?author=${GITHUB_USERNAME}&per_page=100`;
    const commitsResponse = await fetch(commitsUrl, { headers });

    if (commitsResponse.ok) {
      const commits = await commitsResponse.json();
      return commits.length;
    }

    return 0;
  } catch (error) {
    console.error(`Error fetching commit count for ${repo.name}:`, error.message);
    return 0;
  }
}

async function fetchGitHubData() {
  try {
    console.log('Fetching GitHub repository data...');

    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'marcusziade-website',
        // Add token if available in environment
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const repos = await response.json();

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'marcusziade-website',
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      }),
    };

    // Filter repos and check commit counts
    console.log('Checking commit counts for repositories...');
    const reposWithCommits = [];

    for (const repo of repos) {
      // Skip if it's in the exclude list or doesn't meet basic criteria
      if (
        repo.fork ||
        repo.private ||
        EXCLUDE_REPOS.includes(repo.name) ||
        !repo.description ||
        (!repo.stargazers_count && !repo.topics?.length && !repo.language)
      ) {
        continue;
      }

      // Check commit count
      const commitCount = await getCommitCount(repo, headers);

      if (commitCount >= MIN_COMMITS) {
        reposWithCommits.push({
          ...repo,
          commitCount,
        });
        console.log(`  ✓ ${repo.name}: ${commitCount} commits`);
      } else {
        console.log(`  ✗ ${repo.name}: ${commitCount} commits (skipped)`);
      }
    }

    // Transform filtered repos
    const projects = reposWithCommits
      .map((repo) => ({
        id: repo.name.toLowerCase(),
        name: repo.name,
        description: repo.description || '',
        language: repo.language || 'Unknown',
        platforms: getPlatforms(repo),
        stars: repo.stargazers_count,
        githubUrl: repo.html_url,
        category: categorizeProject(repo),
        highlights: getHighlights(repo),
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
        topics: repo.topics || [],
        commitCount: repo.commitCount,
      }))
      .sort((a, b) => {
        // Sort by stars first, then by commit count, then by update date
        if (b.stars !== a.stars) return b.stars - a.stars;
        if (b.commitCount !== a.commitCount) return b.commitCount - a.commitCount;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

    // Select top projects for homepage (mix of different categories)
    const featuredProjects = [];
    const categories = [...new Set(projects.map((p) => p.category))];

    // Get top project from each category
    categories.forEach((category) => {
      const topInCategory = projects.filter((p) => p.category === category).slice(0, 2);
      featuredProjects.push(...topInCategory);
    });

    // Ensure we have at least 6-8 good projects
    if (featuredProjects.length < 8) {
      const remaining = projects
        .filter((p) => !featuredProjects.includes(p))
        .slice(0, 8 - featuredProjects.length);
      featuredProjects.push(...remaining);
    }

    const outputData = {
      lastUpdated: new Date().toISOString(),
      totalRepos: repos.length,
      projects: featuredProjects.slice(0, 12), // Keep top 12 projects
    };

    // Write to file
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'opensource.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log(`\n✓ Successfully fetched ${outputData.projects.length} open source projects`);
    console.log(`✓ Data written to ${outputPath}`);

    // Summary
    const categoryCounts = outputData.projects.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    const totalCommits = outputData.projects.reduce((sum, p) => sum + (p.commitCount || 0), 0);

    console.log('\nProject breakdown:');
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    console.log(`\nTotal commits across all projects: ${totalCommits}`);
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    process.exit(1);
  }
}

// Run the script
fetchGitHubData();
