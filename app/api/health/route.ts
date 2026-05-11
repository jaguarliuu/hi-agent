/**
 * Liveness probe endpoint.
 *
 * The local Trae IDE (and a few other dev tools) periodically pings
 * the running dev server with `HEAD /api/health/` to figure out
 * whether the user-facing server is still alive. Without a handler
 * this floods the terminal with `HEAD /api/health/ 404` lines.
 *
 * We intentionally:
 *
 *   1. Only export a `GET` handler. Next.js auto-derives a `HEAD`
 *      response (status + headers, empty body) from the GET handler,
 *      which is exactly what livenes probes consume.
 *   2. Mark the route `force-static` so it survives `output: 'export'`
 *      in `next.config.mjs`. Without this Next refuses to statically
 *      build dynamic Route Handlers and the production export breaks.
 *   3. Return zero PII / build info. This endpoint is reachable from
 *      whatever loopback the dev server binds to, and we do not want
 *      to leak commit hashes or env names to anything that can hit it.
 *
 * The handler returns 200 with a tiny JSON body. Probes that only
 * care about the status code will see green; humans hitting it in a
 * browser see a stable shape.
 */

export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
