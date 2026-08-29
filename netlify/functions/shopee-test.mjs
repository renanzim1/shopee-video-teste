const ALLOWED_HOSTS = [
  "br.shp.ee",
  "shopee.com.br",
  "www.shopee.com.br",
  "sv.shopee.com.br"
];

function allowed(hostname) {
  hostname = String(hostname || "").toLowerCase();

  return ALLOWED_HOSTS.includes(hostname) ||
    hostname.endsWith(".shopee.com.br") ||
    hostname.endsWith(".shp.ee");
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return null;
    }

    if (!allowed(url.hostname)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getUniversalRedirect(urlString) {
  try {
    const url = new URL(urlString);

    if (!url.pathname.includes("/universal-link")) {
      return null;
    }

    const redir = url.searchParams.get("redir");

    if (!redir) {
      return null;
    }

    let decoded = redir;

    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(decoded);

        if (next === decoded) {
          break;
        }

        decoded = next;
      } catch {
        break;
      }
    }

    const target = new URL(decoded);

    if (
      target.protocol !== "https:" ||
      !allowed(target.hostname)
    ) {
      return null;
    }

    return target.toString();
  } catch {
    return null;
  }
}

function absolutize(value, base) {
  if (!value) {
    return null;
  }

  let cleaned = String(value)
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&")
    .trim();

  try {
    return new URL(cleaned, base).toString();
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractMedia(html, baseUrl) {
  const found = [];

  const patterns = [
    /https?:\/\/[^"'<>\\\s]+?\.mp4(?:\?[^"'<>\\\s]*)?/gi,
    /https?:\\\/\\\/[^"'<>\\\s]+?\.mp4(?:\\\?[^"'<>\\\s]*)?/gi,

    /https?:\/\/[^"'<>\\\s]+?\.m3u8(?:\?[^"'<>\\\s]*)?/gi,
    /https?:\\\/\\\/[^"'<>\\\s]+?\.m3u8(?:\\\?[^"'<>\\\s]*)?/gi,

    /<video[^>]+src=["']([^"']+)["']/gi,
    /<source[^>]+src=["']([^"']+)["']/gi,

    /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/gi,

    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:stream["']/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1] || match[0];

      const normalized = absolutize(
        raw.replaceAll("\\/", "/"),
        baseUrl
      );

      if (
        normalized &&
        (
          normalized.includes(".mp4") ||
          normalized.includes(".m3u8")
        )
      ) {
        found.push(normalized);
      }
    }
  }

  return unique(found);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default async (request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Use POST."
      }),
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  try {
    const body = await request.json();

    const input = safeUrl(body?.url);

    if (!input) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Link inválido ou domínio não permitido."
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const inputUrl = input.toString();

    let current = inputUrl;

    const steps = [];

    let response = null;

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 15; SM-S711B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

      "Accept-Language":
        "pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.6",

      "Cache-Control":
        "no-cache",

      "Pragma":
        "no-cache"
    };

    for (let i = 0; i < 8; i++) {
      const universalTarget =
        getUniversalRedirect(current);

      if (universalTarget) {
        steps.push({
          type: "universal_redir",
          from: current,
          to: universalTarget
        });

        current = universalTarget;
        continue;
      }

      const parsed = safeUrl(current);

      if (!parsed) {
        throw new Error(
          "Redirecionamento para domínio não permitido."
        );
      }

      response = await fetchWithTimeout(
        current,
        {
          method: "GET",
          headers,
          redirect: "manual"
        }
      );

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location =
          response.headers.get("location");

        if (!location) {
          break;
        }

        const nextUrl =
          new URL(location, current);

        if (
          nextUrl.protocol !== "https:" ||
          !allowed(nextUrl.hostname)
        ) {
          throw new Error(
            "Redirecionamento externo bloqueado."
          );
        }

        steps.push({
          type: "http_redirect",
          status: response.status,
          from: current,
          to: nextUrl.toString()
        });

        current = nextUrl.toString();
        continue;
      }

      break;
    }

    const finalUniversalTarget =
      getUniversalRedirect(current);

    if (finalUniversalTarget) {
      steps.push({
        type: "universal_redir",
        from: current,
        to: finalUniversalTarget
      });

      current = finalUniversalTarget;

      response = await fetchWithTimeout(
        current,
        {
          method: "GET",
          headers,
          redirect: "follow"
        }
      );
    }

    if (!response) {
      response = await fetchWithTimeout(
        current,
        {
          method: "GET",
          headers,
          redirect: "follow"
        }
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    let html = "";

    if (
      contentType.includes("text/html") ||
      contentType.includes("text/plain") ||
      !contentType
    ) {
      html = await response.text();

      if (html.length > 3000000) {
        html = html.slice(0, 3000000);
      }
    }

    const media =
      extractMedia(html, current);

    const mp4 =
      media.filter(
        item =>
          item.toLowerCase().includes(".mp4")
      );

    const m3u8 =
      media.filter(
        item =>
          item.toLowerCase().includes(".m3u8")
      );

    const reachedShareVideo =
      current.includes(
        "sv.shopee.com.br/share-video/"
      );

    const redirectFound =
      steps.length > 0;

    return new Response(
      JSON.stringify(
        {
          ok: true,
          version: "2.0",

          stage:
            media.length
              ? "media_found"
              : "page_loaded",

          input_ok: true,

          redirect_found:
            redirectFound,

          share_video_found:
            reachedShareVideo,

          page_loaded:
            response.ok,

          mp4_found:
            mp4.length > 0,

          m3u8_found:
            m3u8.length > 0,

          input_url:
            inputUrl,

          final_url:
            current,

          http_status:
            response.status,

          content_type:
            contentType,

          steps,

          media,

          mp4,

          m3u8,

          diagnostic: {
            universal_redirect_used:
              steps.some(
                step =>
                  step.type ===
                  "universal_redir"
              ),

            reached_share_video:
              reachedShareVideo,

            html_received:
              html.length > 0,

            html_size:
              html.length
          }
        },
        null,
        2
      ),
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          version: "2.0",
          error:
            error instanceof Error
              ? error.message
              : String(error)
        },
        null,
        2
      ),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
};
