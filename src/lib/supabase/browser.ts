import { createBrowserClient } from "@supabase/ssr";

type PublicSupabaseConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

let configRequest: Promise<PublicSupabaseConfig> | undefined;

export function createBrowserSupabaseClient() {
  configRequest ??= fetch("/api/public-config", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error("Unable to load sign-in configuration.");
    return response.json() as Promise<PublicSupabaseConfig>;
  });

  return configRequest.then(({ supabaseUrl, supabasePublishableKey }) =>
    createBrowserClient(supabaseUrl, supabasePublishableKey, {
      auth: { flowType: "implicit" },
    }),
  );
}
