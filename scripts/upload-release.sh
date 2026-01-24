#!/bin/bash
# Upload release artifacts to S3 and create git tag (Electron Forge version)
# Usage: ./scripts/upload-release.sh [patch|minor|major]

set -e

BUCKET="mosaic-release"
S3_PATH="releases"
BUILD_DIR="out/make"
BUCKET_URL="https://mosaic-release.s3.us-east-2.amazonaws.com/releases"

# Get version type from argument (default: patch)
VERSION_TYPE="${1:-patch}"
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Error: Invalid version type. Use: patch, minor, or major"
    exit 1
fi

if [ ! -d "$BUILD_DIR" ]; then
    echo "Error: ${BUILD_DIR}/ directory not found. Run 'npm run make' first."
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "=== Release Script (Electron Forge) ==="
echo "Version: ${VERSION} (${VERSION_TYPE})"
echo ""
echo "Files in ${BUILD_DIR}/:"
find "$BUILD_DIR" -type f | head -20
echo ""

# Helper function to ask for confirmation
confirm() {
    read -p "$1 [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Step 1: Upload to S3
echo "=== Step 1: Upload to S3 ==="
if confirm "Build and upload artifacts to S3 using Electron Forge?"; then
    
    # Detect architecture for local publish
    ARCH=$(node -p "os.arch()")
    echo "Publishing for current architecture: ${ARCH}..."
    
    # Use the renamed deploy script
    npm run deploy -- --arch "$ARCH"
    
    echo "✓ Binaries build and uploaded via Electron Forge (S3 Publisher)"
    echo ""

    # Detect platform
    PLATFORM=$(node -p "require('os').platform()")

    # Update and upload index.html (Default behavior)
    # TODO: Add granular behavior for specific platforms runs (e.g. only update certain links)
    echo "Updating static installation page..."
    mkdir -p tmp_static
    sed "s/{{VERSION}}/${VERSION}/g" static/install-page/index.template.html > tmp_static/index.html
    aws s3 cp tmp_static/index.html "s3://${BUCKET}/index.html" --content-type "text/html"
    aws s3 cp static/install-page/style.css "s3://${BUCKET}/style.css" --content-type "text/css"
    rm -rf tmp_static
    echo "✓ Static page uploaded"

    # Update and upload latest.json (Linux only or confirmation)
    if [ "$PLATFORM" == "linux" ]; then
        if confirm "Linux build detected. Update Latest Version Metadata (latest.json)?"; then
            echo "Updating version metadata for linux..."
            mkdir -p tmp_static
            RELEASE_DATE=$(date -u +%Y-%m-%d)
            sed -e "s/{{VERSION}}/${VERSION}/g" -e "s/{{RELEASE_DATE}}/${RELEASE_DATE}/g" static/install-page/latest.template.json > tmp_static/latest.json
            aws s3 cp tmp_static/latest.json "s3://${BUCKET}/latest.json" --content-type "application/json"
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
fi

# Step 2: Create git tag
echo "=== Step 2: Create Git Tag ==="
echo "Tag: v${VERSION}"

TAG_MESSAGE="Release v${VERSION} (${VERSION_TYPE})

Download links:
- Linux x64 (AppImage): ${BUCKET_URL}/linux/x64/mosaic-companion-${VERSION}-x64.AppImage
- Linux x64 (deb): ${BUCKET_URL}/linux/x64/mosaic-companion_${VERSION}_amd64.deb
- Linux x64 (zip): ${BUCKET_URL}/linux/x64/mosaic-companion-linux-x64-${VERSION}.zip
- Linux arm64 (AppImage): ${BUCKET_URL}/linux/arm64/mosaic-companion-${VERSION}-arm64.AppImage
- Linux arm64 (deb): ${BUCKET_URL}/linux/arm64/mosaic-companion_${VERSION}_arm64.deb
- Linux arm64 (zip): ${BUCKET_URL}/linux/arm64/mosaic-companion-linux-arm64-${VERSION}.zip
- Windows x64: ${BUCKET_URL}/win32/x64/mosaic-companion-${VERSION}-Setup.exe
- macOS x64: ${BUCKET_URL}/darwin/x64/mosaic-companion-${VERSION}-x64.dmg
- macOS arm64: ${BUCKET_URL}/darwin/arm64/mosaic-companion-${VERSION}-arm64.dmg"

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

echo "=== Done! ==="
echo "View tag: git show v${VERSION}"
