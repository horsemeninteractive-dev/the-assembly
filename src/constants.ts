export const DISCORD_CLIENT_ID =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_DISCORD_CLIENT_ID
    : process.env.VITE_DISCORD_CLIENT_ID;
