// forge.config.js
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

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
        name: 'mosaic-companion',
        executableName: 'mosaic-companion',
        icon: 'assets/icon',
        // `asarUnpack` was an electron-builder option name. @electron/packager
        // takes `asar: boolean | AsarOptions` and has no such key, so the
        // whole list was silently ignored: no shipped build has ever contained
        // an `app.asar.unpacked` directory, on any platform.
        //
        // It surfaced as a broken IDE terminal on macOS only. node-pty exec's
        // `spawn-helper`, a real executable, and a file inside an asar archive
        // cannot be exec'd. `.node` modules survive because Electron's
        // `dlopen` patch extracts them on load; a plain executable has no such
        // escape hatch.
        //
        // The helper is darwin-only: node-pty's `binding.gyp` defines the
        // `spawn-helper` target inside an `OS=="mac"` conditional, and
        // `src/unix/pty.cc` only exec's it under `__APPLE__`. Windows goes
        // through conpty. That is why Linux and Windows worked throughout and
        // this went unnoticed for as long as it did.
        //
        // Which copy of the helper ships matters. `lib/utils.js` resolves the
        // native directory in the order `build/Release`, `build/Debug`,
        // `prebuilds/<platform>-<arch>`, and `lib/unixTerminal.js` derives
        // `helperPath` from whichever won — then rewrites `app.asar` to
        // `app.asar.unpacked` itself, which is what makes unpacking sufficient.
        // Forge runs @electron/rebuild, which node-gyp-builds every target, so
        // `build/Release/` wins and its helper is mode 755. Do NOT rely on the
        // prebuilt copy: in the published tarball
        // `prebuilds/darwin-*/spawn-helper` is mode **644**, and asar writes
        // unpacked files with the source mode — so a fallback to the prebuild
        // would turn ENOENT into EACCES and the terminal would still be gone.
        // The postPackage hook below therefore checks the execute bit, not
        // mere existence.
        //
        // Two keys, doing different jobs:
        //
        // - `unpack` contains no slash, so minimatch runs with `matchBase` and
        //   matches BASENAMES. (It is matched against the absolute path —
        //   @electron/asar `asar.js:147` — so a slash-bearing pattern here
        //   compares against the whole build-machine path and is easy to get
        //   silently wrong.) This is the half that guarantees the native
        //   binaries land on disk wherever they live in the tree.
        // - `unpackDir` is matched against the app-relative directory path and
        //   preserves the original intent of unpacking these three packages
        //   whole, since they ship sidecar libraries beside their `.node`.
        //
        // The build-check workflow asserts `app.asar.unpacked` exists and
        // holds the native modules, so a regression to the silent-no-op state
        // fails CI rather than shipping.
        asar: {
            unpack: '{*.node,spawn-helper}',
            unpackDir: '**/node_modules/{onnxruntime-node,sharp,node-pty}',
        },
        ignore: [
            // Source directories (not needed in build)
            /^\/src$/,
            /^\/electron$/,           // TypeScript source files
            /^\/\.git/,
            /^\/\.github/,
            /^\/examples/,      // contributor examples + their build artifacts
            /^\/\.vscode/,
            /^\/docs$/,
            /^\/static$/,
            /^\/scripts$/,
            /^\/release$/,
            /^\/out$/,
            /^\/tests$/,              // Test files and test tools
            // Config and dev files
            /\.md$/,
            /\.sh$/,
            /tsconfig.*\.json$/,
            /vite\.config\.ts$/,
            /esbuild\.config\.(js|mjs)$/,   // .mjs was shipping inside the asar
            /forge\.config\.js$/,
            /package-lock\.json/,
            /\.antigravityignore/,
            /\.env$/,
            /\.env\.local$/,
        ],
        extraResource: [
            'config/gmail-credentials.json'
        ],
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
                setupIcon: 'assets/icon.ico',
                // No spaces in the artifact name: GitHub Releases renames
                // assets containing spaces, which would break download links.
                setupExe: `mosaic-companion-${pkg.version}-Setup.exe`
            }
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
        }
    ],

    publishers: [
        {
            // Primary release channel: GitHub Releases. The release workflow
            // selects publishers explicitly via `--target`; releases are
            // created as drafts and published by the workflow's finalize job
            // once every platform's assets are verified present.
            name: '@electron-forge/publisher-github',
            config: {
                repository: {
                    owner: 'hypercycle-development',
                    name: 'mosaic-companion'
                },
                draft: true,
                tagPrefix: 'v'
            }
        }
    ],

    hooks: {
        generateAssets: async () => {
            const { execSync } = await import('child_process');
            
            // 1. Build Electron TypeScript with esbuild
            // MUST stay in sync with `npm run build:electron` — see the header
            // comment in esbuild.config.mjs for what shipped broken when this
            // pointed at a second, stale config instead.
            console.log('🔨 Building Electron with esbuild...');
            execSync('node esbuild.config.mjs', { stdio: 'inherit' });
            
            // 2. Build frontend with Vite
            console.log('🔨 Building frontend with Vite...');
            execSync('npm run build', { stdio: 'inherit' });
        },
        
        postPackage: async (config, packageResult) => {
            const fs = await import('fs/promises');
            const path = await import('path');

            // Assert the asar unpack happened, on the machine that just made
            // the artifact. This is the only check that covers macOS: the
            // build-check workflow has no darwin leg and release.yml has no
            // equivalent assertion, so the silently-ignored-unpack-option
            // state this config once had would otherwise ship again unseen.
            for (const outputPath of packageResult.outputPaths) {
                let resources = path.join(outputPath, 'resources');
                if (packageResult.platform === 'darwin') {
                    const bundle = (await fs.readdir(outputPath)).find((e) => e.endsWith('.app'));
                    if (!bundle) throw new Error(`No .app bundle found in ${outputPath}`);
                    resources = path.join(outputPath, bundle, 'Contents', 'Resources');
                }

                const unpacked = path.join(resources, 'app.asar.unpacked');
                try {
                    await fs.access(unpacked);
                } catch {
                    throw new Error(
                        `app.asar.unpacked is missing from ${resources} — the asar unpack ` +
                        `configuration is a no-op. See the asar comment in packagerConfig.`
                    );
                }

                // X_OK, not existence: the prebuilt helper is mode 644, and an
                // unpacked-but-unexecutable helper fails exactly as a missing
                // one does. Darwin only — no other platform builds it.
                if (packageResult.platform === 'darwin') {
                    const { constants } = await import('fs');
                    const helper = path.join(
                        unpacked, 'node_modules/node-pty/build/Release/spawn-helper'
                    );
                    try {
                        await fs.access(helper, constants.X_OK);
                    } catch {
                        throw new Error(
                            `${helper} is missing or not executable — the IDE terminal ` +
                            `will not work in this build.`
                        );
                    }
                }

                console.log(`✅ asar unpack verified in ${resources}`);
            }

            if (packageResult.platform !== 'linux') return;

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
