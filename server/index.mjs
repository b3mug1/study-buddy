import { config as loadEnv } from "dotenv";
import { createApp } from "./app.mjs";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const isProduction =
  process.env.NODE_ENV === "production" || process.argv.includes("--production");
const port = Number(
  process.env.API_PROXY_PORT || (isProduction ? 1000 : 1001),
);

const app = createApp({ serveStatic: isProduction });

app.listen(port, "0.0.0.0", () => {
  console.log(`Study Buddy API proxy listening on port ${port}`);
});
