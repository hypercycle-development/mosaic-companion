import 'dotenv/config';

export default {
  packagerConfig: {
    appId: 'com.mosaic.companion',
    name: 'mosaic-companion',
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
      /forge\.config\.js$/,
      /package-lock\.json/,
      /\.antigravityignore/
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
        name: 'mosaic-companion',
        authors: 'hypercycle',
        description: 'Mosaic Companion Application',
        loadingGif: 'assets/loading.gif',
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
      platforms: ['linux']
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
    }
  }
};