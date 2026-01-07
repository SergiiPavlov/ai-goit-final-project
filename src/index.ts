import { createApp } from "./app";
import { loadEnv } from "./config/env";

(global as any).__APP_STARTED_AT__ = Date.now();

async function main() {
  const env = loadEnv();
  const app = createApp({ env });

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[ai-assistant] listening on :${env.PORT} env=${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});
