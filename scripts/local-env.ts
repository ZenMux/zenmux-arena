// Shared bootstrap for local Next/Vite config and CLI entrypoints.
// Standard dotenv precedence: inherited process env wins; .env.local only
// fills missing variables. An absent local file leaves CI/runtime env intact.
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
