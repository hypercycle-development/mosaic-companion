#!/bin/bash
# Upload release artifacts to S3 and create git tag
# Usage: ./scripts/upload-release.sh [patch|minor|major]

set -e

BUCKET="mosaic-release"
S3_PATH="releases"
RELEASE_DIR="release"
BUCKET_URL="https://mosaic-release.s3.us-east-2.amazonaws.com/releases"

# Get version type from argument (default: patch)
VERSION_TYPE="${1:-patch}"
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Error: Invalid version type. Use: patch, minor, or major"
    exit 1
fi

if [ ! -d "$RELEASE_DIR" ]; then
    echo "Error: ${RELEASE_DIR}/ directory not found. Run a build first."
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "=== Release Script ==="
echo "Version: ${VERSION} (${VERSION_TYPE})"
echo ""
echo "Files in ${RELEASE_DIR}/:"
ls "$RELEASE_DIR"
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
echo "Target: s3://${BUCKET}/${S3_PATH}/"
if confirm "Upload artifacts to S3?"; then
    cd "$RELEASE_DIR"
    
    # Linux
    aws s3 cp . "s3://${BUCKET}/${S3_PATH}/" --recursive \
        --exclude "*" \
        --exclude "*-unpacked/*" \
        --include "*.AppImage" \
        --include "*.deb" \
        --include "latest-linux*.yml" 2>/dev/null && echo "✓ Linux artifacts uploaded" || true

    # macOS
    aws s3 cp . "s3://${BUCKET}/${S3_PATH}/" --recursive \
        --exclude "*" \
        --exclude "*-unpacked/*" \
        --include "*.dmg" \
        --include "*.zip" \
        --include "latest-mac*.yml" 2>/dev/null && echo "✓ macOS artifacts uploaded" || true

    # Windows
    aws s3 cp . "s3://${BUCKET}/${S3_PATH}/" --recursive \
        --exclude "*" \
        --exclude "*-unpacked/*" \
        --include "*.exe" \
        --include "latest.yml" 2>/dev/null && echo "✓ Windows artifacts uploaded" || true
    
    cd ..
    echo ""

    # Update and upload index.html
    echo "Updating static installation page..."
    mkdir -p tmp_static
    sed "s/{{VERSION}}/${VERSION}/g" static/install-page/index.template.html > tmp_static/index.html
    aws s3 cp tmp_static/index.html "s3://${BUCKET}/index.html" --content-type "text/html"
    aws s3 cp static/install-page/style.css "s3://${BUCKET}/style.css" --content-type "text/css"
    rm -rf tmp_static
    echo "✓ Static page uploaded"
    echo ""
else
    echo "Skipped S3 upload."
    echo ""
fi

# Step 2: Create git tag
echo "=== Step 2: Create Git Tag ==="
echo "Tag: v${VERSION}"

TAG_MESSAGE="Release v${VERSION} (${VERSION_TYPE})

Version names:
- Linux x64: Mosaic-Companion-${VERSION}-x86_64.AppImage
- Linux arm64: Mosaic-Companion-${VERSION}-arm64.AppImage
- Windows x64: Mosaic-Companion-${VERSION}-x64.exe
- macOS x64: Mosaic-Companion-${VERSION}-x64.dmg
- macOS arm64: Mosaic-Companion-${VERSION}-arm64.dmg"

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
