# Mosaic Browser - Dependency Setup Guide

This document outlines the specific dependency installation commands and configuration changes required to successfully build and run the Mosaic Browser application. These fixes address various build errors encountered with esbuild, TypeScript, and Vite during the development process.

## Overview

The Mosaic Browser project encountered several dependency-related issues during the build process:

1. **esbuild resolution errors** - Cannot resolve dynamic requires for certain packages
2. **Missing TypeScript modules** - qr-image module not installed
3. **Vite frontend resolution errors** - Frontend unable to resolve certain dependencies
4. **React version conflicts** - Peer dependency conflicts requiring legacy resolution

## Required Commands

Navigate to the `mosaic-browser` directory and run the following commands in order:

```bash
cd mosaic-browser

# Install missing qr-image dependency and its TypeScript types
npm install qr-image --legacy-peer-deps
npm install --save-dev @types/qr-image --legacy-peer-deps

# Install dependencies for frontend module resolution
npm install encode-utf8 xtend --legacy-peer-deps
```

## Configuration Changes

### esbuild.config.js External Dependencies

Add the following entries to the `external` array in `esbuild.config.js`:

```javascript
// In esbuild.config.js
await esbuild.build({
  // ... existing configuration
  external: [
    // ... existing externals
    // Other unresolved dependencies
    "xtend",
    "encode-utf8",
  ],
});
```

## Problem Details & Solutions

### 1. esbuild Resolution Errors

**Problem:**
```
ERROR: Could not resolve "xtend"
ERROR: Could not resolve "encode-utf8"
```

**Root Cause:** 
- `eth-query` package requires `xtend` via dynamic `require()`
- `qrcode` package requires `encode-utf8` via dynamic `require()`
- esbuild cannot resolve dynamic requires during bundling

**Solution:** 
Mark these dependencies as `external` in esbuild configuration so they are resolved at runtime instead of bundle time.

### 2. TypeScript Module Errors

**Problem:**
```
error TS2307: Cannot find module 'qr-image' or its corresponding type declarations.
```

**Root Cause:** 
The `walletconnect` plugin imports `qr-image` but it wasn't installed as a project dependency.

**Solution:** 
Install `qr-image` and `@types/qr-image` packages.

### 3. Vite Frontend Resolution Errors

**Problem:**
```
Uncaught TypeError: Failed to resolve module specifier "encode-utf8"
```

**Root Cause:** 
Vite (frontend bundler) encounters imports for packages that don't exist in `node_modules`. Unlike the backend esbuild external solution, the frontend needs actual packages.

**Solution:** 
Install the required packages so Vite can bundle them for the renderer process.

### 4. React Version Conflicts

**Problem:**
```
npm error ERESOLVE could not resolve
npm error peer react@"17.x || 18.x" from connectkit@1.9.1
```

**Root Cause:** 
The project uses React 19, but `connectkit` requires React 17.x or 18.x, creating a peer dependency conflict.

**Solution:** 
Use `--legacy-peer-deps` flag to bypass strict peer dependency resolution and allow potentially incompatible versions.

## Why --legacy-peer-deps?

The `--legacy-peer-deps` flag is required because:

- The project uses React 19.x
- Some dependencies (like `connectkit`) require older React versions (17.x or 18.x)
- npm 7+ enforces strict peer dependency resolution by default
- This flag reverts to npm 6 behavior, allowing potentially conflicting peer dependencies

## Verification

After running the commands, you should be able to:

1. Run `npm run start` without esbuild errors
2. See the Electron app launch successfully
3. No console errors related to missing modules in the developer tools

## Additional Notes

- These dependency issues are common in Electron applications that bundle both Node.js and browser code
- The `external` configuration tells esbuild not to bundle certain packages, leaving them for Node.js to resolve at runtime
- Installing packages directly ensures both esbuild and Vite can properly handle the dependencies for their respective contexts
- The `--legacy-peer-deps` approach may need to be reconsidered if React compatibility becomes critical

## Troubleshooting

If you encounter similar dependency errors:

1. Check if the error is from esbuild (backend) or Vite (frontend)
2. For esbuild errors: Add the package to the `external` array
3. For Vite errors: Install the package as a regular dependency
4. Use `--legacy-peer-deps` if you encounter peer dependency conflicts
5. Always test both build and runtime to ensure the fix works in both contexts