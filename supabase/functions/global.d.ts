// Type declarations for Supabase Edge Functions (Deno runtime)
// Suppresses IDE errors for Deno globals and URL imports

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }
  export const env: Env;
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Allow URL imports (esm.sh, deno.land, etc.)
declare module "https://*" {
  const mod: any;
  export default mod;
  export const createClient: any;
}
