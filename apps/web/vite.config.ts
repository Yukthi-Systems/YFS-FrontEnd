import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowedHostsString = env.VITE_ALLOWED_HOSTS || "localhost";
  const allowedHosts = allowedHostsString.split(',').map(host => host.trim());

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    // The @yfs/* workspace packages ship raw TypeScript (main -> ./src/index.ts),
    // so let Vite serve them straight from source. Pre-bundling them caches a stale
    // export surface, which breaks with "does not provide an export named ..." the
    // moment one of those packages gains a new export.
    optimizeDeps: {
      exclude: ['@yfs/service', '@yfs/utils'],
    },
    // ... other config
    server: {
      allowedHosts: allowedHosts,
    }
  };
})
