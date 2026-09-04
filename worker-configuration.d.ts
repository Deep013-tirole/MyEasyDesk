// Cloudflare Worker Environment Types
interface CloudflareEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  NODE_ENV?: string;
  [key: string]: any;
}
