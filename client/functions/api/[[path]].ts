/**
 * Cloudflare Pages Function proxy for /api/*
 *
 * This file captures all requests sent to /api/* on the Cloudflare Pages domain
 * and transparently forwards them to the bound Worker (NETPULSE_API).
 *
 * This eliminates CORS preflight delays, enables full security headers,
 * and makes deployment seamless without any hardcoded URLs.
 */

interface Env {
  NETPULSE_API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.NETPULSE_API) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "NETPULSE_API service binding is missing in your Cloudflare Pages Settings. Please add it to route /api/* requests to your Worker.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    return await env.NETPULSE_API.fetch(request.clone());
  } catch (err) {
    console.error("NETPULSE_API routing error:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Upstream service unavailable.",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};
