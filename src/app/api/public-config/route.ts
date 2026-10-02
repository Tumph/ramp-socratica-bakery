export const dynamic = "force-dynamic";

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Browser-safe runtime configuration.
 *
 * Workers Builds does not inline Worker secrets into client bundles. These two
 * values are intentionally public Supabase identifiers, so expose them from
 * the runtime instead of baking an environment-specific value into the build.
 */
export function GET() {
  return Response.json(
    {
      supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
      supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
