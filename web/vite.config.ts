import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Di `vite dev`, layani POST /api/faucet dengan logika yang sama seperti Vercel function (api/faucet.ts). */
function faucetDev(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'faucet-dev',
    configureServer(server) {
      server.middlewares.use('/api/faucet', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Pakai POST' }));
        }
        let raw = '';
        for await (const c of req) raw += c;
        let body: { address?: unknown } = {};
        try {
          body = JSON.parse(raw);
        } catch {}
        const mod = await server.ssrLoadModule('/api/_faucet.ts');
        const hasil = await mod.kirimSaldoAwal(body.address, env);
        res.statusCode = hasil.status;
        res.end(JSON.stringify(hasil.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env: Record<string, string | undefined> = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  // Anvil lokal tanpa FAUCET_PRIVATE_KEY: faucet memakai akun #5 dari mnemonic publik anvil.
  if (!env.FAUCET_PRIVATE_KEY && (env.VITE_CHAIN_ID ?? '31337') === '31337') env.FAUCET_DEV_ANVIL = '1';
  env.FAUCET_RPC_URL ||= env.VITE_RPC_URL || 'http://127.0.0.1:8545';

  return {
    plugins: [react(), faucetDev(env)],
    server: {
      // shared/ (ABI + helper) ada di luar folder web/
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
      // Di Windows watcher bawaan kadang melewatkan edit beruntun; polling lebih andal.
      watch: { usePolling: true, interval: 150 },
    },
  };
});
