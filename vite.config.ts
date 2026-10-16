import path from 'path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const rawPort = process.env.PORT || '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || '/';

function appBasePath(value: string) {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

function offlineRecoveryPlugin(configuredBasePath: string): Plugin {
  const base = appBasePath(configuredBasePath);
  const recoveryRoute = `${base}offline-recovery`.replace(/\/{2,}/g, '/');
  const shellPath = `${base}offline-recovery-shell.html`.replace(/\/{2,}/g, '/');
  const manifestPath = `${base}offline-recovery-manifest.json`.replace(/\/{2,}/g, '/');
  const developmentShell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#071116" />
    <title>Offline Recovery | Armoreum</title>
    <link rel="icon" type="image/png" href="${base}armoreum-logo-light.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import RefreshRuntime from "${base}@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="${base}src/main.tsx"></script>
  </body>
</html>`;

  return {
    name: 'armoreum-offline-recovery',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = new URL(request.url || '/', 'http://armoreum.local').pathname;
        const normalizedPath = requestPath.replace(/\/+$/, '') || '/';

        if (normalizedPath === recoveryRoute.replace(/\/+$/, '') || normalizedPath === shellPath.replace(/\/+$/, '')) {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(developmentShell);
          return;
        }

        if (normalizedPath === manifestPath.replace(/\/+$/, '')) {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end('{"error":"Build the application to generate the offline asset manifest."}');
          return;
        }

        next();
      });
    },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((file) => file.type === 'chunk');
      const hasModule = (file: (typeof chunks)[number], moduleSuffix: string) => {
        const facade = file.facadeModuleId?.replaceAll('\\', '/');
        return Boolean(facade?.endsWith(moduleSuffix))
          || Object.keys(file.modules).some((id) => id.replaceAll('\\', '/').includes(moduleSuffix));
      };
      const mainChunk = chunks.find((file) => hasModule(file, '/src/main.tsx'));
      const recoveryChunk = chunks.find((file) => hasModule(file, '/src/offline-recovery-entry.tsx'));
      if (!mainChunk || !recoveryChunk) {
        const availableModules = chunks.flatMap((file) => Object.keys(file.modules)).filter((id) =>
          id.includes('/src/main.') || id.includes('/src/offline-recovery'),
        );
        this.error(`Offline recovery entry points were not found in the production build. Found: ${availableModules.join(', ') || 'none'}.`);
      }

      const assetFiles = new Set<string>(['armoreum-logo-light.png']);
      const visitStaticImports = (fileName: string, visited = new Set<string>()) => {
        if (visited.has(fileName)) return;
        visited.add(fileName);
        const file = bundle[fileName];
        if (!file) return;
        if (file.type === 'asset') {
          assetFiles.add(file.fileName);
          return;
        }

        assetFiles.add(file.fileName);
        for (const cssFile of file.viteMetadata?.importedCss ?? []) assetFiles.add(cssFile);
        for (const imported of file.imports) visitStaticImports(imported, visited);
      };

      visitStaticImports(mainChunk.fileName);
      visitStaticImports(recoveryChunk.fileName);
      for (const cssFile of recoveryChunk.viteMetadata?.importedCss ?? []) assetFiles.add(cssFile);
      assetFiles.add('offline-recovery-shell.html');

      const styles = [...(recoveryChunk.viteMetadata?.importedCss ?? [])]
        .map((fileName) => `<link rel="stylesheet" href="${base}${fileName}" />`)
        .join('\n    ');
      const shell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#071116" />
    <title>Offline Recovery | Armoreum</title>
    <link rel="icon" type="image/png" href="${base}armoreum-logo-light.png" />
    ${styles}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${base}${mainChunk.fileName}"></script>
  </body>
</html>`;

      this.emitFile({ type: 'asset', fileName: 'offline-recovery-shell.html', source: shell });
      this.emitFile({
        type: 'asset',
        fileName: 'offline-recovery-manifest.json',
        source: JSON.stringify({ version: 5, assets: [...assetFiles].sort() }),
      });
      // The worker must change when hashed dependencies change, even when its
      // handwritten source has not. Otherwise browsers keep an obsolete manifest.
      const buildId = createHash('sha256').update([...assetFiles].sort().join('\n')).digest('hex');
      const worker = readFileSync(path.resolve(import.meta.dirname, 'public/offline-recovery-sw.js'), 'utf8');
      this.emitFile({
        type: 'asset', fileName: 'offline-recovery-sw.js',
        source: worker.replace('__OFFLINE_RECOVERY_BUILD_ID__', `Build ${buildId}`),
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    offlineRecoveryPlugin(basePath),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
