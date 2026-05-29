// SDK v0.8.30 — import from subpath to bypass stale Vite dep cache for '@base44/sdk'
import { createClient } from '@base44/sdk/dist/client.js';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});