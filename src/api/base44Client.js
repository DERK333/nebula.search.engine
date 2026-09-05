import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import {
  DEFAULT_APP_BASE_URL,
  DEFAULT_APP_ID,
  resolveServerUrl,
} from './server-url.js';

export {
  DEFAULT_APP_BASE_URL,
  DEFAULT_APP_ID,
  DEFAULT_SERVER_URL,
  resolveServerUrl,
} from './server-url.js';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId: appId || DEFAULT_APP_ID,
  token,
  functionsVersion,
  serverUrl: resolveServerUrl({
    hostedAppBaseUrl: appBaseUrl || DEFAULT_APP_BASE_URL,
  }),
  requiresAuth: false,
  appBaseUrl: appBaseUrl || DEFAULT_APP_BASE_URL,
});
