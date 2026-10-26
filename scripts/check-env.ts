import "./local-env";

// Presence only: never print values, lengths, hashes or dotenv parsed results.
const groups = [
  { name: "Economics daily usage / value views", required: true, variables: [
    ["ZENMUX_MANAGEMENT_API_KEY"],
  ] },
  { name: "Live snapshots (server)", required: true, variables: [
    ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  ] },
  { name: "Live billing origin (read-only)", required: true, variables: [
    ["TOKEN_ECON_LIVE_DB_HOST"], ["TOKEN_ECON_LIVE_DB_PORT"],
    ["TOKEN_ECON_LIVE_DB_USER"], ["TOKEN_ECON_LIVE_DB_PASSWORD"],
    ["TOKEN_ECON_LIVE_DB_DATABASE"],
  ] },
  { name: "Study/personality model calls (optional for web)", required: false, variables: [
    ["ZENMUX_API_KEY"],
  ] },
  { name: "Supabase role-isolation checks (optional for web)", required: false, variables: [
    ["SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  ] },
  { name: "Supabase administration (optional; never deploy)", required: false, variables: [
    ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL"],
  ] },
];
let missing = false;
for (const group of groups) {
  console.log(`\n${group.name}`);
  for (const names of group.variables) {
    const configured = names.some((name) => Boolean(process.env[name]?.trim()));
    console.log(`  ${names.join(" or ")}: ${configured ? "configured" : "not configured"}`);
    if (group.required && !configured) missing = true;
  }
}
if (missing) process.exitCode = 1;
