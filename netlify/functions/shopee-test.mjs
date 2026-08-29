const ALLOWED_INPUT_HOSTS = [
  "br.shp.ee",
  "shopee.com.br",
  "www.shopee.com.br",
  "sv.shopee.com.br"
];

function allowedInput(hostname) {
  hostname = String(hostname || "").toLowerCase();

  return (
    ALLOWED_INPUT_HOSTS.includes(hostname) ||
    hostname.endsWith(".shopee.com.br") ||
    hostname.endsWith(".shp.ee")
  );
}

function safeInputUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;
    if (!allowedInput(url.hostname)) return null;

    return url;
  } catch {
    return null;
  }
}

function decodeText(value) {
  let text = String(value || "");

  text = text
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&");

  return text;
}

function getUniversalRedirect(urlString) {
  try {
    const url = new URL(urlString);

    if (!url.pathname.includes("/universal-link")) {
      return null;
    }

    const redir = url.searchParams.get("redir");

    if (!redir) return null;

    let decoded = redir;

    for (let i = 0; i < 2; i++) {
      try {
        const next = decodeURIComponent(decoded);

        if (next === decoded) break;

        decoded = next;
      } catch {
        break;
      }
    }

    const target = new URL(decoded);

    if (
      target.protocol !== "https:" ||
      !allowedInput(target.hostname)
    ) {
      return null;
    }

    return target.toString();
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeMediaUrl(value, baseUrl) {
  if (!value) return null;

  let cleaned = decodeText(value).trim();

  cleaned = cleaned
    .replace(/^["']/, "")
    .replace(/["']$/, "");

  try {
    const url = new URL(cleaned, baseUrl);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function classifyMedia(url) {
  const lower = String(url).toLowerCase();

  if (lower.includes(".mp4")) return "mp4";
  if (lower.includes(".m3u8")) return "m3u8";

  return "unknown";
}

function extractAllMedia(text, baseUrl) {
  const results = [];

  const decoded = decodeText(text);

  const patterns = [
    /https?:\/\/[^"'<>\\\s]+?\.mp4(?:\?[^"'<>\\\s]*)?/gi,

    /https?:\\\/\\\/[^"'<>\\\s]+?\.mp4(?:\\\?[^"'<>\\\s]*)?/gi,

    /https?:\/\/[^"'<>\\\s]+?\.m3u8(?:\?[^"'<>\\\s]*)?/gi,

    /https?:\\\/\\\/[^"'<>\\\s]+?\.m3u8(?:\\\?[^"'<>\\\s]*)?/gi,

    /"(?:videoUrl|video_url|playUrl|play_url|playbackUrl|playback_url|downloadUrl|download_url|src)"\s*:\s*"([^"]+)"/gi,

    /'(?:videoUrl|video_url|playUrl|play_url|playbackUrl|playback_url|downloadUrl|download_url|src)'\s*:\s*'([^']+)'/gi,

    /<video[^>]+src=["']([^"']+)["']/gi,

    /<source[^>]+src=["']([^"']+)["']/gi,

    /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/gi,

    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(decoded)) !== null) {
      const raw = match[1] || match[0];

      const normalized =
        normalizeMediaUrl(raw, baseUrl);

      if (!normalized) continue;

      const type = classifyMedia(normalized);

      if (type === "unknown") continue;

      results.push({
        url: normalized,
        type
      });
    }
  }

  const seen = new Set();

  return results.filter(item => {
    if (seen.has(item.url)) return false;

    seen.add(item.url);
    return true;
  });
}

function extractScripts(html, baseUrl) {
  const scripts = [];

  const regex =
    /<script[^>]+src=["']([^"']+)["']/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const url =
        new URL(
          decodeText(match[1]),
          baseUrl
        );

      if (
        url.protocol === "https:" &&
        (
          url.hostname.endsWith("shopee.com.br") ||
          url.hostname.endsWith("shopee.com")
        )
      ) {
        scripts.push(url.toString());
      }
    } catch {
      // ignora
    }
  }

  return unique(scripts);
}

function extractNextData(html) {
  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  return match?.[1] || "";
}

function extractInterestingKeys(text) {
  const decoded = decodeText(text);

  const keys = [
    "videoUrl",
    "video_url",
    "playUrl",
    "play_url",
    "playbackUrl",
    "playback_url",
    "downloadUrl",
    "download_url",
    "videoInfo",
    "video_info",
    "postId",
    "coverUrl",
    "cover_url",
    "originUrl",
    "origin_url"
  ];

  const found = [];

  for (const key of keys) {
    if (
      decoded.toLowerCase().includes(
        key.toLowerCase()
      )
    ) {
      found.push(key);
    }
  }

  return unique(found);
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 12000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language":
    "pt-BR,pt;q=0.9,en;q=0.7",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"
};

export default async (request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Content-Type":
      "application/json; charset=utf-8"
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
    const body =
      await request.json();

    const input =
      safeInputUrl(body?.url);

    if (!input) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Link Shopee inválido."
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const inputUrl =
      input.toString();

    let current =
      inputUrl;

    let response =
      null;

    const steps = [];

    /*
     * RESOLVE LINK CURTO
     */
    for (let i = 0; i < 8; i++) {
      const universal =
        getUniversalRedirect(current);

      if (universal) {
        steps.push({
          type: "universal_redir",
          from: current,
          to: universal
        });

        current = universal;
        continue;
      }

      const parsed =
        safeInputUrl(current);

      if (!parsed) {
        throw new Error(
          "Redirecionamento bloqueado."
        );
      }

      response =
        await fetchWithTimeout(
          current,
          {
            method: "GET",
            headers: browserHeaders,
            redirect: "manual"
          }
        );

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location =
          response.headers.get(
            "location"
          );

        if (!location) break;

        const next =
          new URL(
            location,
            current
          );

        if (
          next.protocol !== "https:" ||
          !allowedInput(next.hostname)
        ) {
          throw new Error(
            "Redirecionamento externo bloqueado."
          );
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

      break;
    }

    /*
     * UNIVERSAL LINK -> SHARE VIDEO
     */
    const universal =
      getUniversalRedirect(current);

    if (universal) {
      steps.push({
        type: "universal_redir",
        from: current,
        to: universal
      });

      current = universal;
      response = null;
    }

    /*
     * CARREGA PÁGINA SHARE VIDEO
     */
    if (
      !response ||
      current.includes(
        "/share-video/"
      )
    ) {
      response =
        await fetchWithTimeout(
          current,
          {
            method: "GET",
            headers: browserHeaders,
            redirect: "follow"
          }
        );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let html = "";

    if (
      contentType.includes("text/html") ||
      contentType.includes("text/plain") ||
      !contentType
    ) {
      html =
        await response.text();

      if (html.length > 3500000) {
        html =
          html.slice(
            0,
            3500000
          );
      }
    }

    /*
     * BUSCA MÍDIA NO HTML
     */
    const htmlMedia =
      extractAllMedia(
        html,
        current
      );

    /*
     * BUSCA __NEXT_DATA__
     */
    const nextData =
      extractNextData(html);

    const nextMedia =
      nextData
        ? extractAllMedia(
            nextData,
            current
          )
        : [];

    /*
     * DESCOBRE SCRIPTS
     */
    const scriptUrls =
      extractScripts(
        html,
        current
      );

    /*
     * NÃO VAMOS BAIXAR DEZENAS DE JS.
     * SOMENTE OS MAIS PROVÁVEIS.
     */
    const interestingScripts =
      scriptUrls.filter(url => {
        const lower =
          url.toLowerCase();

        return (
          lower.includes(
            "share-video"
          ) ||
          lower.includes(
            "video"
          )
        );
      }).slice(0, 5);

    const scriptDiagnostics = [];

    const scriptMedia = [];

    for (
      const scriptUrl
      of interestingScripts
    ) {
      try {
        const scriptResponse =
          await fetchWithTimeout(
            scriptUrl,
            {
              headers: {
                ...browserHeaders,
                "Accept":
                  "*/*"
              }
            },
            8000
          );

        if (!scriptResponse.ok) {
          scriptDiagnostics.push({
            url: scriptUrl,
            status:
              scriptResponse.status
          });

          continue;
        }

        let js =
          await scriptResponse.text();

        /*
         * limite para evitar peso excessivo
         */
        if (js.length > 1500000) {
          js =
            js.slice(
              0,
              1500000
            );
        }

        const foundMedia =
          extractAllMedia(
            js,
            current
          );

        scriptMedia.push(
          ...foundMedia
        );

        scriptDiagnostics.push({
          url: scriptUrl,
          status:
            scriptResponse.status,

          size:
            js.length,

          interesting_keys:
            extractInterestingKeys(
              js
            ),

          media_found:
            foundMedia.length
        });

      } catch (error) {
        scriptDiagnostics.push({
          url: scriptUrl,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        });
      }
    }

    /*
     * JUNTA TODAS AS VARIANTES
     */
    const combined = [
      ...htmlMedia.map(
        item => ({
          ...item,
          source: "html"
        })
      ),

      ...nextMedia.map(
        item => ({
          ...item,
          source:
            "__NEXT_DATA__"
        })
      ),

      ...scriptMedia.map(
        item => ({
          ...item,
          source:
            "javascript"
        })
      )
    ];

    const seen =
      new Set();

    const variants =
      combined.filter(item => {
        if (
          seen.has(item.url)
        ) {
          return false;
        }

        seen.add(item.url);

        return true;
      });

    const mp4 =
      variants
        .filter(
          item =>
            item.type === "mp4"
        )
        .map(
          item => item.url
        );

    const m3u8 =
      variants
        .filter(
          item =>
            item.type === "m3u8"
        )
        .map(
          item => item.url
        );

    return new Response(
      JSON.stringify(
        {
          ok: true,

          version:
            "3.0-diagnostic",

          stage:
            variants.length
              ? "variants_found"
              : "page_loaded",

          input_url:
            inputUrl,

          final_url:
            current,

          http_status:
            response.status,

          page_loaded:
            response.ok,

          share_video_found:
            current.includes(
              "sv.shopee.com.br/share-video/"
            ),

          mp4_found:
            mp4.length > 0,

          m3u8_found:
            m3u8.length > 0,

          variant_count:
            variants.length,

          media:
            mp4.length
              ? mp4
              : m3u8,

          mp4,

          m3u8,

          variants,

          diagnostics: {
            html_size:
              html.length,

            next_data_found:
              nextData.length > 0,

            next_data_size:
              nextData.length,

            html_interesting_keys:
              extractInterestingKeys(
                html
              ),

            next_data_interesting_keys:
              extractInterestingKeys(
                nextData
              ),

            total_scripts:
              scriptUrls.length,

            inspected_scripts:
              interestingScripts.length,

            script_results:
              scriptDiagnostics
          },

          steps
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

          version:
            "3.0-diagnostic",

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
