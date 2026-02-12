// forge.config.js
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

/**
 * Generates the Linux AppImage wrapper script for sandbox auto-detection.
 */
function generateLinuxWrapperScript(binaryName) {
    return `#!/bin/bash
# Mosaic Companion - Linux AppImage Wrapper
# Auto-detects sandbox compatibility for Ubuntu 24.04+

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BINARY="$SCRIPT_DIR/${binaryName}"

sandbox_compatible() {
    [ -z "$APPIMAGE" ] && return 0
    local restrict="/proc/sys/kernel/apparmor_restrict_unprivileged_userns"
    [ -f "$restrict" ] && [ "$(cat "$restrict" 2>/dev/null)" = "1" ] && return 1
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
        name: 'mosaic-companion-hyperinsight',
        executableName: 'mosaic-companion-hyperinsight',
        icon: 'assets/icon',
        asar: true,
        asarUnpack: [
            'node_modules/onnxruntime-node/**',
            'node_modules/sharp/**'
        ],
        ignore: [
            // Source directories (not needed in build)
            /^\/src$/,
            /^\/electron$/,           // TypeScript source files
            /^\/\.git/,
            /^\/\.github/,
            /^\/\.vscode/,
            /^\/docs$/,
            /^\/static$/,
            /^\/scripts$/,
            /^\/release$/,
            /^\/out$/,
            // Config and dev files
            /\.md$/,
            /\.sh$/,
            /tsconfig.*\.json$/,
            /vite\.config\.ts$/,
            /esbuild\.config\.js$/,
            /forge\.config\.js$/,
            /package-lock\.json/,
            /\.antigravityignore/,
            /\.env$/,
            /\.env\.local$/,
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
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'mosaic-companion',
                productName: 'Mosaic Companion',
                authors: 'hypercycle',
                description: 'Mosaic Companion Application',
                loadingGif: 'assets/loading.gif',
                setupIcon: 'assets/icon.ico'
            }
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin']
        },
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
        {
            name: '@reforged/maker-appimage',
            platforms: ['linux'],
            config: {
                options: {
                    categories: ['Utility']
                }
            }
        },
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
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                keyResolver: (fileName, platform, arch) => {
                    const experimentalPath = process.env.EXPERIMENTAL_S3_PATH;
                    if (experimentalPath) {
                        console.log(`📦 Experimental upload: ${experimentalPath}/${platform}/${arch}/${fileName}`);
                        return `${experimentalPath}/${platform}/${arch}/${fileName}`;
                    }
                    return `releases/${platform}/${arch}/${fileName}`;
                }
            }
        }
    ],

    hooks: {
        generateAssets: async () => {
            const { execSync } = await import('child_process');
            
            // 1. Build Electron TypeScript with esbuild
            console.log('🔨 Building Electron with esbuild...');
            execSync('node esbuild.config.js', { stdio: 'inherit' });
            
            // 2. Build frontend with Vite
            console.log('🔨 Building frontend with Vite...');
            execSync('npm run build', { stdio: 'inherit' });
        },
        
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