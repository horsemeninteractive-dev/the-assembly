import { DiscordSDK } from "@discord/embedded-app-sdk";
import { DISCORD_CLIENT_ID } from "../constants";

export let discordSdk: DiscordSDK | null = null;

export const setupDiscordSdk = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    console.log("Discord SDK Setup: URL Params keys:", Array.from(urlParams.keys()));
    
    if (!urlParams.has("frame_id") && !urlParams.has("instance_id")) {
      console.warn("frame_id/instance_id not found in URL - are we definitely in a Discord Activity?");
      return;
    }
    const clientId = DISCORD_CLIENT_ID;
    if (!clientId) {
      console.error("VITE_DISCORD_CLIENT_ID is missing from environment");
      return;
    }
    console.log("Initializing Discord SDK with clientId:", clientId);
    discordSdk = new DiscordSDK(clientId);
    // Add a timeout to ready() to prevent hanging in some environments
    const readyPromise = discordSdk.ready();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Discord SDK ready() timed out (5s)')), 5000)
    );
    
    console.log("Waiting for discordSdk.ready()...");
    await Promise.race([readyPromise, timeoutPromise]);
    console.log("Discord SDK is ready. instanceId:", discordSdk?.instanceId);
  } catch (err) {
    console.error("Failed to initialize Discord SDK:", err);
  }
};
