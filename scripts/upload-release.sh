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
echo "Target: s3://${BUCKET}/${S3_PATH}/"
if confirm "Upload artifacts to S3?"; then
    
    # Linux deb
    if [ -d "$BUILD_DIR/deb" ]; then
        echo "Uploading Linux deb packages..."
        for arch_dir in "$BUILD_DIR/deb"/*; do
            arch=$(basename "$arch_dir")
            aws s3 cp "$arch_dir/" "s3://${BUCKET}/${S3_PATH}/linux/${arch}/" --recursive \
                --exclude "*" --include "*.deb" 2>/dev/null && echo "✓ Linux/${arch} deb uploaded" || true
        done
    fi

    # Linux/Darwin zip
    if [ -d "$BUILD_DIR/zip" ]; then
        echo "Uploading zip packages..."
        for platform_dir in "$BUILD_DIR/zip"/*; do
            platform=$(basename "$platform_dir")
            for arch_dir in "$platform_dir"/*; do
                arch=$(basename "$arch_dir")
                aws s3 cp "$arch_dir/" "s3://${BUCKET}/${S3_PATH}/${platform}/${arch}/" --recursive \
                    --exclude "*" --include "*.zip" 2>/dev/null && echo "✓ ${platform}/${arch} zip uploaded" || true
            done
        done
    fi

    # Windows (Squirrel)
    if [ -d "$BUILD_DIR/squirrel.windows" ]; then
        echo "Uploading Windows installers..."
        for arch_dir in "$BUILD_DIR/squirrel.windows"/*; do
            arch=$(basename "$arch_dir")
            aws s3 cp "$arch_dir/" "s3://${BUCKET}/${S3_PATH}/win32/${arch}/" --recursive \
                --exclude "*" --include "*.exe" --include "*.nupkg" --include "RELEASES" \
                2>/dev/null && echo "✓ Windows/${arch} uploaded" || true
        done
    fi

    # macOS DMG
    if ls "$BUILD_DIR"/*.dmg 1>/dev/null 2>&1; then
        echo "Uploading macOS DMG..."
        # DMGs are at the root of out/make for Forge
        aws s3 cp "$BUILD_DIR/" "s3://${BUCKET}/${S3_PATH}/darwin/x64/" --recursive \
            --exclude "*" --include "*.dmg" 2>/dev/null && echo "✓ macOS DMG uploaded" || true
    fi

    echo ""

    # Update and upload index.html and latest.json
    echo "Updating static installation page and version info..."
    mkdir -p tmp_static
    
    # Update index.html
    sed "s/{{VERSION}}/${VERSION}/g" static/install-page/index.template.html > tmp_static/index.html
    
    # Generate latest.json from template
    RELEASE_DATE=$(date -u +%Y-%m-%d)
    sed -e "s/{{VERSION}}/${VERSION}/g" -e "s/{{RELEASE_DATE}}/${RELEASE_DATE}/g" static/install-page/latest.template.json > tmp_static/latest.json

    aws s3 cp tmp_static/index.html "s3://${BUCKET}/index.html" --content-type "text/html"
    aws s3 cp static/install-page/style.css "s3://${BUCKET}/style.css" --content-type "text/css"
    aws s3 cp tmp_static/latest.json "s3://${BUCKET}/latest.json" --content-type "application/json"
    
    rm -rf tmp_static
    echo "✓ Static page and latest.json uploaded"
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
- Linux x64 (deb): ${BUCKET_URL}/linux/x64/mosaic-companion_${VERSION}_amd64.deb
- Linux arm64 (deb): ${BUCKET_URL}/linux/arm64/mosaic-companion_${VERSION}_arm64.deb
- Windows x64: ${BUCKET_URL}/win32/x64/MosaicCompanion-${VERSION}-Setup.exe
- macOS x64: ${BUCKET_URL}/darwin/x64/Mosaic Companion-${VERSION}-x64.dmg
- macOS arm64: ${BUCKET_URL}/darwin/arm64/Mosaic Companion-${VERSION}-arm64.dmg"

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
