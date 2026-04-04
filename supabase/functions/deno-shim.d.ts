/**
 * Declares Deno globals for the TypeScript language service only.
 * Edge Functions still run on Deno in Supabase; Node does not provide these types.
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
