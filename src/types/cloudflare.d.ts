declare module 'cloudflare:node' {
  export function httpServerHandler(optionsOrServer?: any): {
    fetch: (request: Request, env?: any, ctx?: any) => Promise<Response>;
  };
}
