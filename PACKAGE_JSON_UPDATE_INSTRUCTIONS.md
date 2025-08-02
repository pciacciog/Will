# Package.json Update Instructions

## Current Scripts (Lines 6-12)
```json
"scripts": {
  "dev": "NODE_ENV=development tsx server/index.ts",
  "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push"
}
```

## ✅ REQUIRED UPDATE
Replace the existing scripts section with:

```json
"scripts": {
  "dev": "NODE_ENV=development npx tsx server/index-standalone.ts",
  "build": "esbuild server/index-standalone.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push"
}
```

## Changes Made
1. **dev**: Changed from `server/index.ts` to `server/index-standalone.ts` (eliminates vite dependency)
2. **build**: Removed `vite build &&` prefix and updated source file to `index-standalone.ts`
3. **start**: Kept the same (already correct)

## Manual Steps
1. Open `package.json` in the file editor
2. Navigate to lines 6-12 (the scripts section)
3. Replace the content exactly as shown above
4. Save the file

After this update:
- Development server will use the standalone version
- Build process will work without vite dependency
- Deployment will succeed
- APNs integration will continue working

## Test After Update
```bash
npm run build
npm run start
```

This will eliminate the `Cannot find package 'vite'` error permanently.