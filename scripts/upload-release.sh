#!/bin/bash
# Upload release artifacts to S3 with Docker support for Windows builds
# Usage: ./scripts/upload-release.sh [patch|minor|major] [platform] [arch]
# Examples:
#   ./scripts/upload-release.sh patch linux x64
#   ./scripts/upload-release.sh patch win32 x64

set -e

BUCKET="mosaic-release"
S3_PATH="releases"
BUILD_DIR="out/make"
BUCKET_URL="https://mosaic-release.s3.us-east-2.amazonaws.com/releases"

# Get arguments
VERSION_TYPE="${1:-patch}"
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Error: Invalid version type. Use: patch, minor, or major"
    exit 1
fi

# Get platform (optional, default to current)
DETECTED_PLATFORM=$(node -p "require('os').platform()")
PLATFORM="${2:-$DETECTED_PLATFORM}"
if [[ ! "$PLATFORM" =~ ^(linux|darwin|win32)$ ]]; then
    echo "Error: Invalid platform '$PLATFORM'. Use: linux, darwin, or win32"
    exit 1
fi

# Get architecture (optional, default to native)
DETECTED_ARCH=$(node -p "os.arch()")
ARCH="${3:-$DETECTED_ARCH}"
if [[ ! "$ARCH" =~ ^(x64|arm64)$ ]]; then
    echo "Error: Invalid architecture '$ARCH'. Use: x64 or arm64"
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "=========================================="
echo "    MOSAIC COMPANION RELEASE SCRIPT"
echo "=========================================="
echo "Version: ${VERSION} (${VERSION_TYPE})"
echo "Platform: ${PLATFORM}"
echo "Arch   : ${ARCH}"
echo "=========================================="
echo ""

# Helper function to ask for confirmation
confirm() {
    read -p "$1 [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Step 1: Build and Upload to S3
echo "=== Step 1: Build and Upload to S3 ==="

# Determine if we need Docker for Windows builds on Linux
USE_DOCKER=false
if [ "$DETECTED_PLATFORM" == "linux" ] && [ "$PLATFORM" == "win32" ]; then
    echo "Windows build requested on Linux host."
    if confirm "Use Docker for Windows build? (Recommended)"; then
        USE_DOCKER=true
    fi
fi

if confirm "Build and upload artifacts to S3 using Electron Forge?"; then
    
    if [ "$USE_DOCKER" == "true" ]; then
        echo "Building Windows release using Docker..."
        echo "This will use the electronuserland/builder:wine-mono image."
        echo ""
        
        # Load AWS credentials from .env.local or environment
        if [ -f .env.local ]; then
            echo "Loading AWS credentials from .env.local..."
            # Source the file to handle quoted values properly
            set -a
            source .env.local
            set +a
        fi
        
        # Check if AWS credentials are available
        if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
            echo "Warning: AWS credentials not found in .env.local or environment."
            echo "Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set."
            if ! confirm "Continue anyway (build only, no upload)?"; then
                echo "Aborted."
                exit 1
            fi
        fi
        
        # Run Docker build - pass AWS credentials explicitly via -e flags
        # The --env-file option doesn't handle quoted values properly
        docker run --rm -ti \
          -e "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" \
          -e "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" \
          -v ${PWD}:/project \
          -v ~/.cache/electron:/root/.cache/electron \
          -v ~/.cache/electron-builder:/root/.cache/electron-builder \
          electronuserland/builder:wine-mono \
          /bin/bash -c "apt-get update && apt-get install -y zip && npm install && npx electron-forge publish --platform win32 --arch ${ARCH}"
        
        # Fix ownership of generated files
        echo "Fixing file ownership..."
        sudo chown -R $USER:$USER out/
        
        echo "✓ Windows binaries built and uploaded via Docker"
        echo ""
    else
        # Native build (Linux or macOS)
        echo "Publishing for platform: ${PLATFORM}, architecture: ${ARCH}..."
        
        # Determine the npm script to run
        if [ "$ARCH" == "x64" ]; then
            NPM_SCRIPT="deploy:x64"
        else
            NPM_SCRIPT="deploy:arm64"
        fi
        
        # Use the selected architecture
        npm run "$NPM_SCRIPT"
        
        echo "✓ Binaries built and uploaded via Electron Forge (S3 Publisher)"
        echo ""
    fi

    # Update and upload index.html (only on first/main platform build)
    if confirm "Update static installation page (index.html)?"; then
        echo "Updating static installation page..."
        mkdir -p tmp_static
        sed "s/{{VERSION}}/${VERSION}/g" static/install-page/index.template.html > tmp_static/index.html
        aws s3 cp tmp_static/index.html "s3://${BUCKET}/index.html" \
            --cache-control "no-cache, must-revalidate" \
            --content-type "text/html"
        aws s3 cp static/install-page/style.css "s3://${BUCKET}/style.css" \
            --cache-control "no-cache, must-revalidate" \
            --content-type "text/css"
        rm -rf tmp_static
        echo "✓ Static page uploaded"
        echo ""
    fi

    # Update and upload latest.json (Linux only or confirmation)
    if [ "$PLATFORM" == "linux" ]; then
        if confirm "Linux build detected. Update Latest Version Metadata (latest.json)?"; then
            echo "Updating version metadata for linux..."
            mkdir -p tmp_static
            RELEASE_DATE=$(date -u +%Y-%m-%d)
            sed -e "s/{{VERSION}}/${VERSION}/g" -e "s/{{RELEASE_DATE}}/${RELEASE_DATE}/g" static/install-page/latest.template.json > tmp_static/latest.json
            aws s3 cp tmp_static/latest.json "s3://${BUCKET}/releases/latest.json" \
                --cache-control "no-cache, must-revalidate" \
                --content-type "application/json"
            rm -rf tmp_static
            echo "✓ latest.json uploaded"
        fi
    else
        echo "Non-Linux platform ($PLATFORM) detected. Skipping latest.json update by default."
    fi
    echo ""
else
    echo "Skipped S3 upload."
    echo ""
    exit 1
fi

# Step 2: Create git tag (only offer if this is the final platform)
if confirm "Is this the final platform build? (Will create git tag)"; then
    echo "=== Step 2: Create Git Tag ==="
    echo "Tag: v${VERSION}"

    TAG_MESSAGE="Release v${VERSION} (${VERSION_TYPE})

Download links:
- Linux x64 (AppImage): ${BUCKET_URL}/linux/x64/mosaic-companion-${VERSION}-x64.AppImage
- Linux x64 (deb): ${BUCKET_URL}/linux/x64/mosaic-companion_${VERSION}_amd64.deb
- Linux arm64 (AppImage): ${BUCKET_URL}/linux/arm64/mosaic-companion-${VERSION}-arm64.AppImage
- Linux arm64 (deb): ${BUCKET_URL}/linux/arm64/mosaic-companion_${VERSION}_arm64.deb
- Windows x64 (Setup): ${BUCKET_URL}/win32/x64/mosaic-companion-${VERSION}-Setup.exe
- macOS x64 (dmg): ${BUCKET_URL}/darwin/x64/mosaic-companion-${VERSION}-x64.dmg
- macOS arm64 (dmg): ${BUCKET_URL}/darwin/arm64/mosaic-companion-${VERSION}-arm64.dmg"

    echo "Message:"
    echo "$TAG_MESSAGE"
    echo ""

    if confirm "Create tag v${VERSION}?"; then
        git tag -a "v${VERSION}" -m "$TAG_MESSAGE"
        echo "✓ Tag v${VERSION} created locally"
        echo ""
    else
        echo "Skipped tag creation."
        echo ""
    fi

    # Step 3: Push to GitHub
    echo "=== Step 3: Push to GitHub ==="
    if confirm "Push tag v${VERSION} to origin?"; then
        git push origin "v${VERSION}"
        echo "✓ Tag pushed to GitHub"
        echo ""
    else
        echo "Skipped push. Run manually: git push origin v${VERSION}"
        echo ""
    fi
else
    echo "Skipped git tag creation (not final platform build)."
    echo ""
fi

echo "=== Done! ==="
echo "Platform: ${PLATFORM} (${ARCH})"
echo "Version: ${VERSION}"
