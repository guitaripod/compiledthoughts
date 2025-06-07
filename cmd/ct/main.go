package main

import (
	"fmt"
	"os"

	"github.com/marcusziade/compiledthoughts/internal/appstore"
	"github.com/marcusziade/compiledthoughts/internal/github"
	"github.com/marcusziade/compiledthoughts/internal/build"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "fetch-appstore":
		if err := appstore.FetchData(); err != nil {
			fmt.Fprintf(os.Stderr, "Error fetching App Store data: %v\n", err)
			os.Exit(1)
		}
	case "fetch-github":
		if err := github.FetchData(); err != nil {
			fmt.Fprintf(os.Stderr, "Error fetching GitHub data: %v\n", err)
			os.Exit(1)
		}
	case "prebuild":
		if err := build.PreBuild(); err != nil {
			fmt.Fprintf(os.Stderr, "Pre-build error: %v\n", err)
			os.Exit(1)
		}
	case "postbuild":
		if err := build.PostBuild(); err != nil {
			fmt.Fprintf(os.Stderr, "Post-build error: %v\n", err)
			os.Exit(1)
		}
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: ct <command>")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  fetch-appstore  Fetch latest App Store data")
	fmt.Println("  fetch-github    Fetch latest GitHub repository data")
	fmt.Println("  prebuild        Run pre-build tasks")
	fmt.Println("  postbuild       Run post-build optimizations")
	fmt.Println("  help            Show this help message")
}