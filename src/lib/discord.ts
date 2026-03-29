import { DiscordSDK } from '@discord/embedded-app-sdk';
import { DISCORD_CLIENT_ID } from '../constants';
import { debugLog, debugWarn, debugError } from './utils';

export let discordSdk: DiscordSDK | null = null;

export const setupDiscordSdk = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    debugLog('Discord SDK Setup: URL Params keys:', Array.from(urlParams.keys()));

    if (!urlParams.has('frame_id') && !urlParams.has('instance_id')) {
      debugWarn(
        'frame_id/instance_id not found in URL - are we definitely in a Discord Activity?'
      );
      return;
    }
    const clientId = DISCORD_CLIENT_ID;
    if (!clientId) {
      debugError('VITE_DISCORD_CLIENT_ID is missing from environment');
      return;
    }
    debugLog('Initializing Discord SDK with clientId:', clientId);
    discordSdk = new DiscordSDK(clientId);
    // Add a timeout to ready() to prevent hanging in some environments
    const readyPromise = discordSdk.ready();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Discord SDK ready() timed out (5s)')), 5000)
    );

    debugLog('Waiting for discordSdk.ready()...');
    await Promise.race([readyPromise, timeoutPromise]);
    debugLog('Discord SDK is ready. instanceId:', discordSdk?.instanceId);
  } catch (err) {
    debugError('Failed to initialize Discord SDK:', err);
  }
};
