// Electron Forge configuration (ES Module format)

export default {
  packagerConfig: {
    appId: 'com.mosaic.companion',
    name: 'Mosaic Companion',
    executableName: 'mosaic-companion',
    asar: true,
    // Unpack native modules that need file system access
    asarUnpack: [
      'node_modules/onnxruntime-node/**',
      'node_modules/sharp/**'
    ],
    // Files to ignore (exclude from package)
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
      /forge\.config\.js$/
    ],
    // macOS specific - use ad-hoc signing for now
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
        name: 'MosaicCompanion',
        authors: 'hypercycle',
        description: 'Mosaic Companion Application',
        // Remote releases for delta updates
        remoteReleases: 'https://mosaic-release.s3.us-east-2.amazonaws.com/releases/win32/x64'
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
        format: 'ULFO'
      }
    },
    // Linux - Deb package
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          maintainer: 'hern@hypercycle.ai',
          homepage: 'https://hypercycle.ai',
          categories: ['Utility'],
          section: 'utils'
        }
      }
    },
    // Linux - ZIP as fallback (always works)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['linux']
    }
  ],

  publishers: [
    {
      name: '@electron-forge/publisher-s3',
      config: {
        bucket: 'mosaic-release',
        region: 'us-east-2',
        public: true,
        // Custom key resolver to organize by platform/arch
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
    }
  }
};
