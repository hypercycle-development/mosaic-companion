import dotenv from 'dotenv';

// Load .env first, then .env.local (local overrides base)
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

/**
 * Generates the Linux AppImage wrapper script for sandbox auto-detection.
 * This wrapper tries sandbox first and falls back to --no-sandbox if it fails.
 * 
 * @param {string} binaryName - The name of the actual binary (e.g., 'mosaic-companion-bin')
 * @returns {string} The bash wrapper script content
 */
function generateLinuxWrapperScript(binaryName) {
    return `#!/bin/bash
# Mosaic Companion - Linux AppImage Wrapper
# Auto-detects sandbox compatibility for Ubuntu 24.04+

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BINARY="$SCRIPT_DIR/${binaryName}"

# Check if system restricts unprivileged user namespaces (Ubuntu 24.04+)
# This kernel setting breaks Electron's SUID sandbox on AppImages
sandbox_compatible() {
    # If not an AppImage, sandbox works fine
    [ -z "$APPIMAGE" ] && return 0
    
    # Check kernel.apparmor_restrict_unprivileged_userns (Ubuntu 24.04+)
    local restrict="/proc/sys/kernel/apparmor_restrict_unprivileged_userns"
    [ -f "$restrict" ] && [ "$(cat "$restrict" 2>/dev/null)" = "1" ] && return 1
    
    # Check kernel.unprivileged_userns_clone (older restriction)
    local clone="/proc/sys/kernel/unprivileged_userns_clone"
    [ -f "$clone" ] && [ "$(cat "$clone" 2>/dev/null)" = "0" ] && return 1
    
    return 0
}

if sandbox_compatible; then
    exec "$BINARY" "$@"
else
    export MOSAIC_SANDBOX_FALLBACK=1
    exec "$BINARY" --no-sandbox "$@"
fi
`;
}

export default {
    packagerConfig: {
        appId: 'com.mosaic.companion',
        name: 'mosaic-companion',
        executableName: 'mosaic-companion',
        icon: 'assets/icon',
        asar: true,
        asarUnpack: [
            'node_modules/onnxruntime-node/**',
            'node_modules/sharp/**'
        ],
        ignore: [
            /^\/src$/,
            /^\/\.git/,
            /^\/\.github/,
            /^\/\.vscode/,
            /^\/docs$/,
            /^\/static$/,
            /^\/scripts$/,
            /^\/release$/,
            /^\/out$/,
            /\.md$/,
            /\.sh$/,
            /tsconfig\.json$/,
            /vite\.config\.ts$/,
            /forge\.config\.js$/,
            /package-lock\.json/,
            /\.antigravityignore/
        ],
        extraResource: [],
        protocols: [
            {
                name: 'Mosaic Companion',
                schemes: ['mosaic', 'mosaic-companion']
            }
        ],
        appCategoryType: 'public.app-category.utilities',
        osxSign: {
            identity: '-'
        }
    },

    rebuildConfig: {},

    makers: [
        // Windows - Squirrel installer with auto-update support
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'mosaic-companion',
                productName: 'Mosaic Companion',
                authors: 'hypercycle',
                description: 'Mosaic Companion Application',
                loadingGif: 'assets/loading.gif',
                setupIcon: 'assets/icon.ico'
                // Remote releases for delta updates
                // remoteReleases: 'https://mosaic-release.s3.us-east-2.amazonaws.com/releases/win32/x64'
            }
        },
        // macOS - ZIP for auto-updates (required for Squirrel.Mac)
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin']
        },
        // macOS - DMG for distribution
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
            config: {
                format: 'ULFO',
                window: {
                    size: {
                        width: 540,
                        height: 380
                    }
                }
            }
        },
        // Linux - Deb package
        {
            name: '@electron-forge/maker-deb',
            platforms: ['linux'],
            config: {
                name: 'mosaic-companion',
                productName: 'Mosaic Companion',
                options: {
                    maintainer: 'hern@hypercycle.ai',
                    homepage: 'https://hypercycle.ai',
                    categories: ['Utility'],
                    section: 'utils',
                    icon: 'assets/icon.png',
                    genericName: 'Web Browser',
                    mimeType: ['x-scheme-handler/mosaic'],
                    priority: 'optional',
                    depends: [],
                    recommends: [],
                    suggests: []
                }
            }
        },
        // Linux - AppImage (universal, portable)
        {
            name: '@reforged/maker-appimage',
            platforms: ['linux'],
            config: {
                options: {
                    categories: ['Utility']
                }
            }
        },
        // Linux - ZIP as fallback
        {
            name: '@electron-forge/maker-zip',
            platforms: ['linux', 'darwin', 'win32']
        }
    ],

    publishers: [
        {
            name: '@electron-forge/publisher-s3',
            config: {
                bucket: 'mosaic-release',
                region: 'us-east-2',
                // Note: bucket uses bucket policy for public access, not object ACLs
                // Custom key resolver to organize by platform/arch
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                keyResolver: (fileName, platform, arch) => {
                    return `releases/${platform}/${arch}/${fileName}`;
                }
            }
        }
    ],

    hooks: {
        // Ensure frontend is built before packaging
        generateAssets: async () => {
            const { execSync } = await import('child_process');
            console.log('🔨 Building frontend with Vite...');
            execSync('npm run build', { stdio: 'inherit' });
        },
        
        // Create smart wrapper script for Linux AppImage sandbox handling
        // This wrapper detects sandbox failures and automatically falls back to --no-sandbox
        // while setting MOSAIC_SANDBOX_FALLBACK=1 so the UI can show a warning
        //
        // ** NOTE: This wrapper script is inside the AppImage, NOT on the user's machine. **
        //
        // AppImage runs from a FUSE mount where SUID permissions cannot work,
        // so we need to pass --no-sandbox to the Electron binary
        // This is a known issue with Electron AppImage and SUID sandbox on Ubuntu 24.04, see:
        // - https://github.com/electron/electron/issues/17972
        // - https://github.com/electron/electron/issues/42510
        // - https://bugs.launchpad.net/ubuntu/+source/apparmor/+bug/2064672
        //
        postPackage: async (config, packageResult) => {
            if (packageResult.platform !== 'linux') return;
            
            const fs = await import('fs/promises');
            const path = await import('path');
            
            const outputPath = packageResult.outputPaths[0];
            const executableName = config.packagerConfig.executableName || 'mosaic-companion';
            const binaryPath = path.join(outputPath, executableName);
            const wrapperPath = path.join(outputPath, `${executableName}-bin`);
            
            try {
                await fs.access(binaryPath);
                await fs.rename(binaryPath, wrapperPath);
                
                const wrapperScript = generateLinuxWrapperScript(`${executableName}-bin`);
                await fs.writeFile(binaryPath, wrapperScript, { mode: 0o755 });
                
                console.log('✅ Created Linux AppImage sandbox wrapper script');
            } catch (error) {
                console.warn('⚠️ Could not create AppImage wrapper:', error.message);
            }
        }
    }
};
