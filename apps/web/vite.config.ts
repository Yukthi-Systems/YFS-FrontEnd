import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowedHostsString = env.VITE_ALLOWED_HOSTS || "localhost";
  const allowedHosts = allowedHostsString.split(',').map(host => host.trim());

  return {
    plugins: [react()],
    // ... other config
    server: {
      allowedHosts: allowedHosts,
    }
  };
})
