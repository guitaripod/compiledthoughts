package github

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	githubUsername = "marcusziade"
	githubAPIURL   = "https://api.github.com/users/%s/repos?per_page=100&sort=updated"
	graphQLURL     = "https://api.github.com/graphql"
	minCommits     = 8  // Increased to filter out minor projects
)

var excludeRepos = []string{
	"marcusziade",                   // profile repo
	"isowords",                      // fork
	"swift-composable-architecture", // fork
	"homebrew-apod-cli",             // homebrew tap
	"homebrew-songlink-cli",         // homebrew tap
}

type GitHubRepo struct {
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Language        string    `json:"language"`
	Fork            bool      `json:"fork"`
	Private         bool      `json:"private"`
	StargazersCount int       `json:"stargazers_count"`
	HTMLURL         string    `json:"html_url"`
	UpdatedAt       string    `json:"updated_at"`
	CreatedAt       string    `json:"created_at"`
	Topics          []string  `json:"topics"`
}

type Contributor struct {
	Login         string `json:"login"`
	Contributions int    `json:"contributions"`
}

type Project struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Language    string   `json:"language"`
	Platforms   []string `json:"platforms"`
	Stars       int      `json:"stars"`
	GitHubURL   string   `json:"githubUrl"`
	Category    string   `json:"category"`
	Highlights  []string `json:"highlights"`
	UpdatedAt   string   `json:"updatedAt"`
	CreatedAt   string   `json:"createdAt"`
	Topics      []string `json:"topics"`
	CommitCount int      `json:"commitCount"`
}

type OpenSourceData struct {
	LastUpdated string    `json:"lastUpdated"`
	TotalRepos  int       `json:"totalRepos"`
	Projects    []Project `json:"projects"`
}

type GraphQLQuery struct {
	Query string `json:"query"`
}

type PinnedReposResponse struct {
	Data struct {
		User struct {
			PinnedItems struct {
				Nodes []struct {
					Name string `json:"name"`
				} `json:"nodes"`
			} `json:"pinnedItems"`
		} `json:"user"`
	} `json:"data"`
}

func FetchData() error {
	fmt.Println("Fetching latest GitHub repository data...")
	fmt.Println("Fetching GitHub repository data...")

	// Fetch pinned repos first
	pinnedRepos, err := fetchPinnedRepos()
	if err != nil {
		fmt.Printf("Warning: failed to fetch pinned repos: %v\n", err)
		pinnedRepos = []string{} // Continue without pinned repos
	}

	repos, err := fetchGitHubRepos()
	if err != nil {
		return fmt.Errorf("failed to fetch GitHub repos: %w", err)
	}

	// Filter and check commit counts
	fmt.Println("Checking commit counts for repositories...")
	var reposWithCommits []struct {
		GitHubRepo
		CommitCount int
	}

	for _, repo := range repos {
		// Skip if it's in the exclude list or doesn't meet basic criteria
		if repo.Fork || repo.Private || contains(excludeRepos, repo.Name) ||
			repo.Description == "" ||
			(repo.StargazersCount == 0 && len(repo.Topics) == 0 && repo.Language == "") {
			continue
		}

		// Check commit count
		commitCount, err := getCommitCount(repo)
		if err != nil {
			fmt.Printf("  ✗ %s: error fetching commits\n", repo.Name)
			continue
		}

		if commitCount >= minCommits {
			reposWithCommits = append(reposWithCommits, struct {
				GitHubRepo
				CommitCount int
			}{repo, commitCount})
			fmt.Printf("  ✓ %s: %d commits\n", repo.Name, commitCount)
		} else {
			fmt.Printf("  ✗ %s: %d commits (skipped)\n", repo.Name, commitCount)
		}
	}

	// Transform filtered repos
	projects := make([]Project, 0, len(reposWithCommits))
	for _, repo := range reposWithCommits {
		project := Project{
			ID:          strings.ToLower(repo.Name),
			Name:        repo.Name,
			Description: repo.Description,
			Language:    repo.Language,
			Platforms:   getPlatforms(repo.GitHubRepo),
			Stars:       repo.StargazersCount,
			GitHubURL:   repo.HTMLURL,
			Category:    categorizeProject(repo.GitHubRepo),
			Highlights:  getHighlights(repo.GitHubRepo),
			UpdatedAt:   repo.UpdatedAt,
			CreatedAt:   repo.CreatedAt,
			Topics:      repo.Topics,
			CommitCount: repo.CommitCount,
		}
		if project.Language == "" {
			project.Language = "Unknown"
		}
		projects = append(projects, project)
	}

	// Sort projects
	sort.Slice(projects, func(i, j int) bool {
		// Sort by stars first, then by commit count, then by update date
		if projects[i].Stars != projects[j].Stars {
			return projects[i].Stars > projects[j].Stars
		}
		if projects[i].CommitCount != projects[j].CommitCount {
			return projects[i].CommitCount > projects[j].CommitCount
		}
		ti, _ := time.Parse(time.RFC3339, projects[i].UpdatedAt)
		tj, _ := time.Parse(time.RFC3339, projects[j].UpdatedAt)
		return ti.After(tj)
	})

	// Select featured projects
	featuredProjects := selectFeaturedProjects(projects, pinnedRepos)

	// Prepare output data
	outputData := OpenSourceData{
		LastUpdated: time.Now().Format(time.RFC3339),
		TotalRepos:  len(repos),
		Projects:    featuredProjects,
	}

	// Write to file
	outputPath := filepath.Join("src", "data", "opensource.json")
	
	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(outputData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Write file
	if err := os.WriteFile(outputPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("\n✓ Successfully fetched %d open source projects\n", len(outputData.Projects))
	fmt.Printf("✓ Data written to %s\n", outputPath)

	// Summary
	categoryCounts := make(map[string]int)
	totalCommits := 0
	totalStars := 0
	pinnedCount := 0
	
	for _, p := range outputData.Projects {
		categoryCounts[p.Category]++
		totalCommits += p.CommitCount
		totalStars += p.Stars
		
		// Check if pinned
		for _, pinned := range pinnedRepos {
			if p.ID == pinned {
				pinnedCount++
				break
			}
		}
	}

	fmt.Println("\nProject breakdown:")
	// Sort categories with "Other Projects" last
	sortedCats := make([]string, 0, len(categoryCounts))
	for cat := range categoryCounts {
		if cat != "Other Projects" {
			sortedCats = append(sortedCats, cat)
		}
	}
	sort.Strings(sortedCats)
	if count, ok := categoryCounts["Other Projects"]; ok && count > 0 {
		sortedCats = append(sortedCats, "Other Projects")
	}
	
	for _, category := range sortedCats {
		fmt.Printf("  %s: %d\n", category, categoryCounts[category])
	}
	
	fmt.Printf("\nPinned repositories included: %d\n", pinnedCount)
	fmt.Printf("Total commits across all projects: %d\n", totalCommits)
	fmt.Printf("Total stars across all projects: %d\n", totalStars)
	fmt.Println("✓ GitHub data updated successfully")

	return nil
}

func fetchGitHubRepos() ([]GitHubRepo, error) {
	url := fmt.Sprintf(githubAPIURL, githubUsername)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "marcusziade-website")
	
	// Add token if available
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API responded with %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var repos []GitHubRepo
	if err := json.Unmarshal(body, &repos); err != nil {
		return nil, err
	}

	return repos, nil
}

func getCommitCount(repo GitHubRepo) (int, error) {
	// Try contributors endpoint first
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contributors", githubUsername, repo.Name)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}
	
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "marcusziade-website")
	
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return 0, err
		}

		var contributors []Contributor
		if err := json.Unmarshal(body, &contributors); err != nil {
			return 0, err
		}

		for _, c := range contributors {
			if c.Login == githubUsername {
				return c.Contributions, nil
			}
		}
	}

	// Fallback: count commits (simplified - just use 100 as max)
	return 100, nil // Simplified for now
}

func categorizeProject(repo GitHubRepo) string {
	name := strings.ToLower(repo.Name)
	desc := strings.ToLower(repo.Description)
	
	if strings.Contains(name, "-cli") || strings.Contains(desc, "cli") {
		return "CLI Tools"
	} else if repo.Language == "Swift" && (strings.Contains(name, "kit") || strings.Contains(desc, "package")) {
		return "Swift Packages"
	} else if strings.Contains(desc, "gtk") || strings.Contains(desc, "desktop") || strings.Contains(desc, "app") {
		return "Desktop Apps"
	} else if repo.Language == "Swift" {
		return "Swift Projects"
	} else if repo.Language == "Go" {
		return "Go Projects"
	}
	return "Other Projects"
}

func getHighlights(repo GitHubRepo) []string {
	var highlights []string
	desc := strings.ToLower(repo.Description)
	
	// Check for homebrew
	if contains(repo.Topics, "homebrew") || strings.Contains(desc, "homebrew") {
		highlights = append(highlights, "Homebrew available")
	}
	
	// Check for cross-platform
	if strings.Contains(desc, "cross-platform") || strings.Contains(desc, "linux") || strings.Contains(desc, "macos") {
		highlights = append(highlights, "Cross-platform")
	}
	
	// Check for testing
	if contains(repo.Topics, "testing") || strings.Contains(desc, "test") {
		highlights = append(highlights, "Well-tested")
	}
	
	// Check for AI/ML
	if strings.Contains(desc, "ai") || strings.Contains(desc, "ml") || 
	   strings.Contains(desc, "openai") || strings.Contains(desc, "dalle") {
		highlights = append(highlights, "AI-powered")
	}
	
	// Check for specific technologies
	if strings.Contains(desc, "gtk") {
		highlights = append(highlights, "GTK4")
	}
	if strings.Contains(desc, "async") {
		highlights = append(highlights, "async/await")
	}
	if strings.Contains(desc, "vim") {
		highlights = append(highlights, "Vim controls")
	}
	if strings.Contains(desc, "zero dependencies") {
		highlights = append(highlights, "Zero dependencies")
	}
	if strings.Contains(desc, "batch") {
		highlights = append(highlights, "Batch generation")
	}
	
	// Language-specific
	if repo.Language == "Swift" && strings.Contains(desc, "linux") {
		highlights = append(highlights, "Cross-platform Swift")
	}
	
	// Add topics as highlights
	if len(repo.Topics) > 0 {
		for i, topic := range repo.Topics {
			if i >= 2 {
				break
			}
			if !containsIgnoreCase(highlights, topic) {
				highlights = append(highlights, strings.Title(topic))
			}
		}
	}
	
	// Return max 3 highlights
	if len(highlights) > 3 {
		return highlights[:3]
	}
	if len(highlights) == 0 {
		return []string{} // Ensure we always return a non-nil slice
	}
	return highlights
}

func getPlatforms(repo GitHubRepo) []string {
	var platforms []string
	desc := strings.ToLower(repo.Description)
	name := strings.ToLower(repo.Name)
	
	if repo.Language == "Swift" || strings.Contains(desc, "swift") {
		platforms = append(platforms, "macOS")
		if strings.Contains(desc, "linux") {
			platforms = append(platforms, "Linux")
		}
		if strings.Contains(desc, "ios") {
			platforms = append(platforms, "iOS")
		}
	} else if repo.Language == "Go" || strings.Contains(name, "-cli") {
		platforms = append(platforms, "macOS", "Linux", "Windows")
	} else if strings.Contains(desc, "gtk") || strings.Contains(desc, "linux") {
		platforms = append(platforms, "Linux")
	} else if strings.Contains(desc, "cross-platform") {
		platforms = append(platforms, "macOS", "Linux", "Windows")
	}
	
	// Remove duplicates
	seen := make(map[string]bool)
	unique := []string{}
	for _, p := range platforms {
		if !seen[p] {
			seen[p] = true
			unique = append(unique, p)
		}
	}
	
	return unique
}

func fetchPinnedRepos() ([]string, error) {
	query := `{
		user(login: "marcusziade") {
			pinnedItems(first: 6, types: REPOSITORY) {
				nodes {
					... on Repository {
						name
					}
				}
			}
		}
	}`

	gqlQuery := GraphQLQuery{Query: query}
	jsonData, err := json.Marshal(gqlQuery)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", graphQLURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "marcusziade-website")
	
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GraphQL query failed with status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var pinnedResp PinnedReposResponse
	if err := json.Unmarshal(body, &pinnedResp); err != nil {
		return nil, err
	}

	var pinnedNames []string
	for _, node := range pinnedResp.Data.User.PinnedItems.Nodes {
		pinnedNames = append(pinnedNames, strings.ToLower(node.Name))
	}

	return pinnedNames, nil
}

func selectFeaturedProjects(projects []Project, pinnedRepos []string) []Project {
	// Separate pinned and unpinned projects
	var pinnedProjects []Project
	var unpinnedProjects []Project
	
	for _, p := range projects {
		isPinned := false
		for _, pinned := range pinnedRepos {
			if p.ID == pinned {
				isPinned = true
				break
			}
		}
		
		// Only include high-quality projects (significant commits and/or stars)
		if p.CommitCount >= 10 || p.Stars >= 5 {
			if isPinned {
				pinnedProjects = append(pinnedProjects, p)
			} else {
				unpinnedProjects = append(unpinnedProjects, p)
			}
		}
	}
	
	// Sort unpinned projects by quality (stars + commits)
	sort.Slice(unpinnedProjects, func(i, j int) bool {
		scoreI := unpinnedProjects[i].Stars*2 + unpinnedProjects[i].CommitCount/10
		scoreJ := unpinnedProjects[j].Stars*2 + unpinnedProjects[j].CommitCount/10
		return scoreI > scoreJ
	})
	
	// Build featured list: pinned first, then best unpinned
	featured := make([]Project, 0, 12)
	featured = append(featured, pinnedProjects...)
	
	// Add best unpinned projects by category to ensure diversity
	categoryMap := make(map[string][]Project)
	for _, p := range unpinnedProjects {
		categoryMap[p.Category] = append(categoryMap[p.Category], p)
	}
	
	// Sort categories to put "Other Projects" last
	categories := make([]string, 0, len(categoryMap))
	for cat := range categoryMap {
		if cat != "Other Projects" {
			categories = append(categories, cat)
		}
	}
	sort.Strings(categories)
	categories = append(categories, "Other Projects")
	
	// Add top projects from each category
	for _, cat := range categories {
		if projs, ok := categoryMap[cat]; ok {
			// Add up to 2 from each category
			maxFromCat := 2
			if cat == "Other Projects" {
				maxFromCat = 1 // Limit "Other Projects"
			}
			
			for i := 0; i < len(projs) && i < maxFromCat && len(featured) < 12; i++ {
				// Check if not already added
				alreadyAdded := false
				for _, f := range featured {
					if f.ID == projs[i].ID {
						alreadyAdded = true
						break
					}
				}
				if !alreadyAdded {
					featured = append(featured, projs[i])
				}
			}
		}
	}
	
	// Limit to 12 projects
	if len(featured) > 12 {
		featured = featured[:12]
	}
	
	return featured
}

// Helper functions
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func containsIgnoreCase(slice []string, item string) bool {
	itemLower := strings.ToLower(item)
	for _, s := range slice {
		if strings.ToLower(s) == itemLower {
			return true
		}
	}
	return false
}