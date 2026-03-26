# The Assembly

**The Assembly** is a multiplayer social deduction and strategy engine combining real-time gameplay with intense Discord Activity capabilities. Featuring real-time socket communication, stateful authentication, and a scalable Node.js architecture with Redis pub/sub.

## 🗂 Project Structure

- **`src/`** — Houses all frontend React/Vite code (UI components, game views, asset loaders, and WebRTC context logic).
- **`server/`** — Comprises the core backend systems, including the Socket.IO `GameEngine`, REST API routes, Pino structured logger, and authentication schemas.
- **`server.ts`** — The entry point for the Express backend, binding the HTTP server, Socket.IO instance, and Vite development middleware.
- **`dist/`** — Contains the optimized and bundled frontend payload, served by the Express backend during production runtime.

## 🛠 Local Development Setup

To test and develop The Assembly locally:

1. **Install Dependencies**  
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure Environment Variables**  
   Copy the example environment template into a working `.env` file at the root.
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   Fill out the `.env` file with your local instances or service keys (Supabase, Stripe, Google, Discord, Redis, etc.) as listed in `.env.example`.

3. **Run the Development Server**  
   Start both the backend server and the Vite HMR module simultaneously:
   \`\`\`bash
   npm run dev
   \`\`\`
   The application will be accessible at [http://localhost:3000](http://localhost:3000).

## 🚀 Build and Deploy

The project follows a standard build procedure that compiles the TypeScript and bundles the assets before being launched via a standalone Node process.

1. **Build for Production**  
   \`\`\`bash
   npm run build
   \`\`\`
   This command generates the `/dist` directory for the frontend and correctly transpiles the backend dependencies if applicable.

2. **Start the Production Server**  
   \`\`\`bash
   npm start
   \`\`\`
   This boots the backend Express app exclusively via `server.ts` statically serving the frontend bundle. Ideal for standard container environments (e.g. Docker, GCP Cloud Run).
