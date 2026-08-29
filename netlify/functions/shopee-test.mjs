const ALLOWED = [
  "br.shp.ee",
  "shp.ee",
  "sv.shopee.com.br",
  "shopee.com.br"
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language":
    "pt-BR,pt;q=0.9,en;q=0.7",

  "Cache-Control": "no-cache"
};

function allowed(hostname) {
  const host = hostname.toLowerCase();

  return ALLOWED.some(
    item =>
      host === item ||
      host.endsWith("." + item)
  );
}

function validateUrl(value) {
  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    !allowed(url.hostname)
  ) {
    throw new Error(
      "Use um link HTTPS válido da Shopee."
    );
  }

  return url;
}

async function request(url) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: HEADERS,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function clean(value) {
  return String(value || "")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u002f", "/")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u003D", "=")
    .replaceAll("\\u003d", "=");
}

function findMedia(html) {
  const text = clean(html);

  const results = new Set();

  const patterns = [
    /https?:\/\/[^"'<>\\\s]+?\.mp4(?:\?[^"'<>\\\s]*)?/gi,
    /https?:\/\/[^"'<>\\\s]+?\.m3u8(?:\?[^"'<>\\\s]*)?/gi
  ];

  for (const pattern of patterns) {
    for (const item of text.match(pattern) || []) {
      results.add(item);
    }
  }

  // Meta tags de vídeo
  const metaPatterns = [
    /<meta[^>]+property=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url|:secure_url)?["']/gi,

    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:stream["']/gi
  ];

  for (const pattern of metaPatterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        results.add(clean(match[1]));
      }
    }
  }

  return [...results]
    .filter(item => item.startsWith("https://"))
    .slice(0, 30);
}

function getUniversalRedirect(urlString) {
  try {
    const url = new URL(urlString);

    if (
      !url.pathname.includes(
        "/universal-link"
      )
    ) {
      return null;
    }

    const redir =
      url.searchParams.get("redir");

    if (!redir) {
      return null;
    }

    let decoded = redir;

    // Alguns links podem chegar codificados
    // mais de uma vez.
    for (let i = 0; i < 3; i++) {
      try {
        const next =
          decodeURIComponent(decoded);

        if (next === decoded) {
          break;
        }

        decoded = next;
      } catch {
        break;
      }
    }

    const target =
      new URL(decoded);

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

export default async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(
      null,
      { status: 204 }
    );
  }

  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "Use POST."
      },
      {
        status: 405
      }
    );
  }

  try {

    const body =
      await req.json();

    const start =
      validateUrl(body?.url);

    let current =
      start.toString();

    let finalResponse =
      null;

    const steps = [];

    // Até 10 etapas para permitir:
    //
    // br.shp.ee
    // ↓
    // universal-link
    // ↓
    // share-video
    // ↓
    // redirects adicionais

    for (let i = 0; i < 10; i++) {

      // =====================================
      // NOVO:
      // detecta universal-link antes do fetch
      // =====================================

      const universalTarget =
        getUniversalRedirect(current);

      if (universalTarget) {

        steps.push({
          type: "universal_redir",
          from: current,
          to: universalTarget
        });

        current =
          universalTarget;

        continue;
      }

      // =====================================
      // REQUEST NORMAL
      // =====================================

      const response =
        await request(current);

      if (
        [301, 302, 303, 307, 308]
          .includes(response.status)
      ) {

        const location =
          response.headers.get(
            "location"
          );

        if (!location) {
          throw new Error(
            "Redirect sem Location."
          );
        }

        const next =
          new URL(
            location,
            current
          );

        if (
          next.protocol !== "https:" ||
          !allowed(next.hostname)
        ) {

          return Response.json({
            ok: false,

            stage:
              "redirect_blocked",

            input_ok: true,

            redirect_found: true,

            share_video_found:
              current.includes(
                "/share-video/"
              ),

            page_loaded: false,

            mp4_found: false,
            m3u8_found: false,

            final_url:
              current,

            redirect_target:
              next.toString(),

            steps
          });
        }

        steps.push({
          type: "http_redirect",
          status: response.status,
          from: current,
          to: next.toString()
        });

        current =
          next.toString();

        continue;
      }

      // =====================================
      // Se chegou numa página normal
      // =====================================

      finalResponse =
        response;

      break;
    }

    if (!finalResponse) {
      throw new Error(
        "Número máximo de etapas atingido."
      );
    }

    const contentType =
      finalResponse.headers
        .get("content-type") || "";

    let html = "";

    if (
      contentType.includes("text") ||
      contentType.includes("html") ||
      contentType.includes("json") ||
      !contentType
    ) {

      html =
        (await finalResponse.text())
          .slice(0, 3000000);
    }

    const media =
      findMedia(html);

    const shareVideo =
      current.includes(
        "sv.shopee.com.br/share-video/"
      );

    const mp4 =
      media.filter(item =>
        /\.mp4(?:\?|$)/i.test(item)
      );

    const m3u8 =
      media.filter(item =>
        /\.m3u8(?:\?|$)/i.test(item)
      );

    let stage =
      "page_loaded";

    if (media.length) {
      stage =
        "media_found";
    }

    else if (shareVideo) {
      stage =
        "share_video_loaded";
    }

    return Response.json({

      ok: true,

      version: "2.0",

      stage,

      input_ok: true,

      redirect_found:
        steps.length > 0,

      share_video_found:
        shareVideo,

      page_loaded:
        finalResponse.status >= 200 &&
        finalResponse.status < 400,

      mp4_found:
        mp4.length > 0,

      m3u8_found:
        m3u8.length > 0,

      input_url:
        start.toString(),

      final_url:
        current,

      http_status:
        finalResponse.status,

      content_type:
        contentType,

      steps,

      media,

      mp4,

      m3u8,

      diagnostic: {
        html_received:
          html.length > 0,

        html_size:
          html.length,

        universal_redirect_used:
          steps.some(
            step =>
              step.type ===
              "universal_redir"
          ),

        reached_share_video:
          shareVideo
      }
    });

  } catch (error) {

    console.error(
      "Shopee V2:",
      error
    );

    return Response.json(
      {
        ok: false,

        version: "2.0",

        stage: "error",

        input_ok: false,
        redirect_found: false,
        share_video_found: false,
        page_loaded: false,
        mp4_found: false,
        m3u8_found: false,

        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      {
        status: 400
      }
    );
  }
};
