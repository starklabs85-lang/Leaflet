// Phase 14 verification: exercises the deployed weather-tips Edge Function
// end-to-end with the dev test user. Run: node supabase/verification/verify-weather-tips.js
const fs = require("fs");
const path = require("path");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");

      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = env.EXPO_PUBLIC_DEV_TEST_EMAIL;
const password = env.EXPO_PUBLIC_DEV_TEST_PASSWORD;

function localDateString() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

async function main() {
  if (!supabaseUrl || !anonKey || !email || !password) {
    console.log("SKIP: missing env values for verification.");
    return;
  }

  const signIn = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password })
  });

  if (!signIn.ok) {
    console.log("FAIL: dev test sign-in rejected:", signIn.status);
    process.exit(1);
  }

  const { access_token: token } = await signIn.json();

  async function callFunction(body) {
    const started = Date.now();
    const response = await fetch(`${supabaseUrl}/functions/v1/weather-tips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    return {
      status: response.status,
      ms: Date.now() - started,
      body: await response.json().catch(() => null)
    };
  }

  // 1. Valid request — Berlin coords (rounded 2dp like the client sends).
  const first = await callFunction({
    latitude: 52.52,
    longitude: 13.41,
    localDate: localDateString()
  });

  console.log("first call:", first.status, `${first.ms}ms`);

  if (first.status !== 200 || !first.body?.weather) {
    console.log("FAIL: expected 200 with weather. Body:", JSON.stringify(first.body)?.slice(0, 400));
    process.exit(1);
  }

  const weather = first.body.weather;

  console.log(
    "weather:",
    weather.timezone,
    `today ${weather.today.minTemp}..${weather.today.maxTemp}°C`,
    `current ${weather.current.temperature}°C hum ${weather.current.humidity}%`
  );
  console.log("tips:", first.body.tips.length);

  for (const tip of first.body.tips) {
    console.log(
      ` - [${tip.severity}] ${tip.signal} (${tip.plantName ?? "all plants"}, phrased=${tip.phrased}, notify=${tip.notify}, action=${tip.action ? tip.action.kind : "none"})`
    );
    console.log(`   "${tip.message}"`);
  }

  // 2. Same-day repeat — should hit the weather cache (faster, same data).
  const second = await callFunction({
    latitude: 52.52,
    longitude: 13.41,
    localDate: localDateString()
  });

  console.log(
    "second call:",
    second.status,
    `${second.ms}ms`,
    second.body?.weather?.fetchedAt === weather.fetchedAt
      ? "(cache hit: same snapshot)"
      : "(snapshot differs)"
  );

  // 3. Invalid request -> 400.
  const bad = await callFunction({ latitude: "x" });

  console.log("invalid request:", bad.status === 400 ? "400 as expected" : `unexpected ${bad.status}`);

  // 4. No auth -> 401.
  const unauth = await fetch(`${supabaseUrl}/functions/v1/weather-tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ latitude: 52.52, longitude: 13.41 })
  });

  console.log("no-auth request:", unauth.status === 401 ? "401 as expected" : `unexpected ${unauth.status}`);

  console.log("VERIFY DONE");
}

main().catch((error) => {
  console.log("FAIL:", error.message);
  process.exit(1);
});
