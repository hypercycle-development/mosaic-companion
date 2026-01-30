#!/bin/bash
# Upload EXPERIMENTAL release artifacts to S3
# Each experimental release lives in its own folder: /releases/experimental/{EXPERIMENT_NAME}/
# 
# Usage: ./scripts/upload-experimental-release.sh <experiment_name> [patch|minor|major] [platform] [arch]
# Examples:
#   ./scripts/upload-experimental-release.sh screenpipe patch linux x64
#   ./scripts/upload-experimental-release.sh gmail patch win32 x64
#   ./scripts/upload-experimental-release.sh ai-assistant minor darwin arm64
#
# Before running:
#   1. Update package.json "name" to include your experiment: "mosaic-companion-screenpipe"
#   2. Update forge.config.js packagerConfig.name to match: "mosaic-companion-screenpipe"
#   3. Build artifacts will be named accordingly (e.g., mosaic-companion-screenpipe-0.0.50.deb)
#
# This script will:
#   - Upload artifacts to /releases/experimental/{experiment}/
#   - Create a separate latest.json in /releases/experimental/{experiment}/
#   - Keep your experimental release completely isolated from main releases

set -e

# Check for experiment name (required first argument)
EXPERIMENT_NAME="$1"
if [ -z "$EXPERIMENT_NAME" ]; then
    echo "Error: Experiment name is required."
    echo "Usage: ./scripts/upload-experimental-release.sh <experiment_name> [patch|minor|major] [platform] [arch]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/upload-experimental-release.sh screenpipe patch linux x64"
    echo "  ./scripts/upload-experimental-release.sh gmail patch win32 x64"
    exit 1
fi

# Validate experiment name (alphanumeric and hyphens only)
if [[ ! "$EXPERIMENT_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
    echo "Error: Experiment name must contain only alphanumeric characters and hyphens."
    exit 1
fi

# Shift to get remaining arguments
shift

BUCKET="mosaic-release"
S3_PATH="releases/experimental/${EXPERIMENT_NAME}"
BUILD_DIR="out/make"
BUCKET_URL="https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/${EXPERIMENT_NAME}"

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

# Get version and app name from package.json
VERSION=$(node -p "require('./package.json').version")
APP_NAME=$(node -p "require('./package.json').name")

# Verify app name matches expected pattern for experimental
EXPECTED_NAME_PREFIX="mosaic-companion-${EXPERIMENT_NAME}"
if [[ "$APP_NAME" != "mosaic-companion-${EXPERIMENT_NAME}" ]]; then
    echo "⚠️  Warning: package.json name is '$APP_NAME'"
    echo "   For experiment '${EXPERIMENT_NAME}', expected name: '${EXPECTED_NAME_PREFIX}'"
    echo ""
    echo "   Make sure to update:"
    echo "   1. package.json: \"name\": \"mosaic-companion-${EXPERIMENT_NAME}\""
    echo "   2. forge.config.js: packagerConfig.name: \"mosaic-companion-${EXPERIMENT_NAME}\""
    echo ""
    read -p "Continue anyway? [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY]) ;;
        *) echo "Aborted."; exit 1 ;;
    esac
fi

echo "=============================================="
echo "  MOSAIC COMPANION EXPERIMENTAL RELEASE"
echo "=============================================="
echo "Experiment: ${EXPERIMENT_NAME}"
echo "App Name  : ${APP_NAME}"
echo "Version   : ${VERSION} (${VERSION_TYPE})"
echo "Platform  : ${PLATFORM}"
echo "Arch      : ${ARCH}"
echo "S3 Path   : ${S3_PATH}"
echo "=============================================="
echo ""

# Helper function to ask for confirmation
confirm() {
    read -p "$1 [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Generate experimental forge config override
generate_experimental_forge_env() {
    echo "Setting up experimental S3 path: ${S3_PATH}"
    export EXPERIMENTAL_S3_PATH="${S3_PATH}"
    export EXPERIMENTAL_NAME="${EXPERIMENT_NAME}"
}

# Step 1: Build and Upload to S3
echo "=== Step 1: Build and Upload to S3 ==="
echo "Note: Artifacts will be uploaded to: ${BUCKET_URL}/"
echo ""

# Determine if we need Docker for Windows builds on Linux
USE_DOCKER=false
if [ "$DETECTED_PLATFORM" == "linux" ] && [ "$PLATFORM" == "win32" ]; then
    echo "Windows build requested on Linux host."
    if confirm "Use Docker for Windows build? (Recommended)"; then
        USE_DOCKER=true
    fi
fi

if confirm "Build and upload experimental artifacts to S3?"; then
    
    # Set experimental environment variables
    generate_experimental_forge_env
    
    if [ "$USE_DOCKER" == "true" ]; then
        echo "Building Windows experimental release using Docker..."
        echo ""
        
        # Load AWS credentials from .env.local or environment
        if [ -f .env.local ]; then
            echo "Loading AWS credentials from .env.local..."
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
        
        # Run Docker build with experimental path
        docker run --rm -ti \
          -e "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" \
          -e "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" \
          -e "EXPERIMENTAL_S3_PATH=${S3_PATH}" \
          -e "EXPERIMENTAL_NAME=${EXPERIMENT_NAME}" \
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
        echo "Publishing experimental release for platform: ${PLATFORM}, architecture: ${ARCH}..."
        echo "Using S3 path: ${S3_PATH}"
        
        # Determine the npm script to run
        if [ "$ARCH" == "x64" ]; then
            NPM_SCRIPT="deploy:x64"
        else
            NPM_SCRIPT="deploy:arm64"
        fi
        
        # Use the selected architecture
        npm run "$NPM_SCRIPT"
        
        echo "✓ Experimental binaries built and uploaded via Electron Forge (S3 Publisher)"
        echo ""
    fi

    # Update and upload experimental latest.json
    if [ "$PLATFORM" == "linux" ]; then
        if confirm "Linux build detected. Update experimental latest.json?"; then
            echo "Updating experimental version metadata..."
            mkdir -p tmp_static
            RELEASE_DATE=$(date -u +%Y-%m-%d)
            
            # Create experimental latest.json with experiment-specific download URL
            cat > tmp_static/latest.json << EOF
{
  "version": "${VERSION}",
  "releaseDate": "${RELEASE_DATE}",
  "experiment": "${EXPERIMENT_NAME}",
  "appName": "${APP_NAME}",
  "downloadUrl": "${BUCKET_URL}/linux/x64/${APP_NAME}-${VERSION}-x64.AppImage",
  "downloads": {
    "linux": {
      "x64": {
        "appimage": "${BUCKET_URL}/linux/x64/${APP_NAME}-${VERSION}-x64.AppImage",
        "deb": "${BUCKET_URL}/linux/x64/${APP_NAME}_${VERSION}_amd64.deb",
        "zip": "${BUCKET_URL}/linux/x64/${APP_NAME}-linux-x64-${VERSION}.zip"
      },
      "arm64": {
        "appimage": "${BUCKET_URL}/linux/arm64/${APP_NAME}-${VERSION}-arm64.AppImage",
        "deb": "${BUCKET_URL}/linux/arm64/${APP_NAME}_${VERSION}_arm64.deb",
        "zip": "${BUCKET_URL}/linux/arm64/${APP_NAME}-linux-arm64-${VERSION}.zip"
      }
    },
    "win32": {
      "x64": {
        "setup": "${BUCKET_URL}/win32/x64/${APP_NAME}-${VERSION}-Setup.exe",
        "zip": "${BUCKET_URL}/win32/x64/${APP_NAME}-win32-x64-${VERSION}.zip"
      }
    },
    "darwin": {
      "x64": {
        "dmg": "${BUCKET_URL}/darwin/x64/${APP_NAME}-${VERSION}-x64.dmg",
        "zip": "${BUCKET_URL}/darwin/x64/${APP_NAME}-darwin-x64-${VERSION}.zip"
      },
      "arm64": {
        "dmg": "${BUCKET_URL}/darwin/arm64/${APP_NAME}-${VERSION}-arm64.dmg",
        "zip": "${BUCKET_URL}/darwin/arm64/${APP_NAME}-darwin-arm64-${VERSION}.zip"
      }
    }
  }
}
EOF
            
            aws s3 cp tmp_static/latest.json "s3://${BUCKET}/${S3_PATH}/latest.json" --content-type "application/json"
            rm -rf tmp_static
            echo "✓ Experimental latest.json uploaded to ${S3_PATH}/"
        fi
    else
        echo "Non-Linux platform ($PLATFORM) detected. Skipping latest.json update."
    fi
    echo ""

    # Check for custom experimental install page
    EXPERIMENTAL_PAGE_DIR="static/experimental/${EXPERIMENT_NAME}"
    if [ -d "$EXPERIMENTAL_PAGE_DIR" ]; then
        echo "=== Custom Install Page Detected ==="
        echo "Found custom install page for '${EXPERIMENT_NAME}' at ${EXPERIMENTAL_PAGE_DIR}"
        if confirm "Process and upload custom install page to S3?"; then
            echo "Injecting version ${VERSION} into install page..."
            
            # Create a temporary directory for processing
            mkdir -p tmp_page
            cp -r "$EXPERIMENTAL_PAGE_DIR/"* tmp_page/
            
            # Replace {{VERSION}} in index.html if it exists
            if [ -f "tmp_page/index.html" ]; then
                sed -i "s/{{VERSION}}/${VERSION}/g" "tmp_page/index.html"
                echo "✓ Version injected into index.html"
            fi
            
            # Upload the processed files
            aws s3 cp tmp_page/ "s3://${BUCKET}/${S3_PATH}/" --recursive
            echo "✓ Custom install page uploaded to ${S3_PATH}/"
            echo "Install Page URL: https://${BUCKET}.s3.us-east-2.amazonaws.com/${S3_PATH}/index.html"
            
            # Clean up
            rm -rf tmp_page
        fi
        echo ""
    fi
else
    echo "Skipped S3 upload."
    echo ""
    exit 1
fi

# Step 2: Create experimental git tag (optional)
if confirm "Create experimental git tag?"; then
    echo "=== Step 2: Create Experimental Git Tag ==="
    TAG_NAME="v${VERSION}-experimental-${EXPERIMENT_NAME}"
    echo "Tag: ${TAG_NAME}"

    TAG_MESSAGE="Experimental Release: ${EXPERIMENT_NAME} v${VERSION}

Experiment: ${EXPERIMENT_NAME}
Version: ${VERSION}

Download links (${EXPERIMENT_NAME}):
- Linux x64 (AppImage): ${BUCKET_URL}/linux/x64/${APP_NAME}-${VERSION}-x64.AppImage
- Linux x64 (deb): ${BUCKET_URL}/linux/x64/${APP_NAME}_${VERSION}_amd64.deb
- Windows x64 (Setup): ${BUCKET_URL}/win32/x64/${APP_NAME}-${VERSION}-Setup.exe
- macOS x64 (dmg): ${BUCKET_URL}/darwin/x64/${APP_NAME}-${VERSION}-x64.dmg
- macOS arm64 (dmg): ${BUCKET_URL}/darwin/arm64/${APP_NAME}-${VERSION}-arm64.dmg

This is an experimental release. Use at your own risk."

    echo "Message:"
    echo "$TAG_MESSAGE"
    echo ""

    if confirm "Create tag ${TAG_NAME}?"; then
        git tag -a "${TAG_NAME}" -m "$TAG_MESSAGE"
        echo "✓ Tag ${TAG_NAME} created locally"
        echo ""
        
        if confirm "Push tag ${TAG_NAME} to origin?"; then
            git push origin "${TAG_NAME}"
            echo "✓ Tag pushed to GitHub"
            echo ""
        else
            echo "Skipped push. Run manually: git push origin ${TAG_NAME}"
            echo ""
        fi
    else
        echo "Skipped tag creation."
        echo ""
    fi
else
    echo "Skipped git tag creation."
    echo ""
fi

echo "=== Done! ==="
echo ""
echo "Experimental Release Summary:"
echo "  Experiment: ${EXPERIMENT_NAME}"
echo "  Version   : ${VERSION}"
echo "  Platform  : ${PLATFORM} (${ARCH})"
echo "  S3 Bucket : s3://${BUCKET}/${S3_PATH}/"
echo "  Web URL   : ${BUCKET_URL}/"
echo ""
echo "To verify your upload:"
echo "  aws s3 ls s3://${BUCKET}/${S3_PATH}/ --recursive"
echo ""
echo "To download latest.json:"
echo "  curl ${BUCKET_URL}/latest.json"