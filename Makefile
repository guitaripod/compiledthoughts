.PHONY: build install clean test

# Build the ct binary
build:
	go build -o ct ./cmd/ct

# Install dependencies and build
install:
	go mod download
	go build -o ct ./cmd/ct

# Clean build artifacts
clean:
	rm -f ct

# Run tests
test:
	go test ./...

# Build for multiple platforms
build-all:
	GOOS=darwin GOARCH=amd64 go build -o ct-darwin-amd64 ./cmd/ct
	GOOS=darwin GOARCH=arm64 go build -o ct-darwin-arm64 ./cmd/ct
	GOOS=linux GOARCH=amd64 go build -o ct-linux-amd64 ./cmd/ct
	GOOS=windows GOARCH=amd64 go build -o ct-windows-amd64.exe ./cmd/ct