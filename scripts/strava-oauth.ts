import http from "node:http";
import { execSync } from "node:child_process";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables",
  );
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:8080/callback";
const AUTH_URL =
  `https://www.strava.com/oauth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=activity:read_all`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:8080`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("No code parameter");
    return;
  }

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    res.writeHead(500);
    res.end(`Token exchange failed: ${error}`);
    server.close();
    return;
  }

  const data = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Done! You can close this tab.</h1>");

  console.log("\n--- Strava OAuth Tokens ---");
  console.log(`Access Token:  ${data.access_token}`);
  console.log(`Refresh Token: ${data.refresh_token}`);
  console.log(`Expires At:    ${data.expires_at}`);
  console.log("\n--- Next Steps ---");
  console.log("Add these to your .env file:");
  console.log(`  STRAVA_ACCESS_TOKEN=${data.access_token}`);
  console.log(`  STRAVA_REFRESH_TOKEN=${data.refresh_token}`);
  console.log(`  STRAVA_EXPIRES_AT=${data.expires_at}`);
  console.log("\nThen seed to KV (replace YOUR_NAMESPACE_ID):");
  console.log(
    `  cd worker && npx wrangler kv key put "strava_tokens" '${JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at })}' --namespace-id YOUR_NAMESPACE_ID --remote`,
  );

  server.close();
});

server.listen(8080, () => {
  console.log("Listening on http://localhost:8080");
  console.log(`\nOpening browser for Strava authorization...\n`);

  const platform = process.platform;
  const open =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    execSync(`${open} "${AUTH_URL}"`);
  } catch {
    console.log(`Open this URL manually:\n${AUTH_URL}`);
  }
});
