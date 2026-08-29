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
  return String(value || "")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u002f", "/")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

function mediaType(url) {
  const lower = String(url).toLowerCase();

  if (lower.includes(".mp4")) return "mp4";
  if (lower.includes(".m3u8")) return "m3u8";

  return null;
}

function extractMedia(text, baseUrl, source) {
  const decoded = decodeText(text);

  const results = [];

  const patterns = [
    /https?:\/\/[^"'<>\\\s]+?\.mp4(?:\?[^"'<>\\\s]*)?/gi,
    /https?:\\\/\\\/[^"'<>\\\s]+?\.mp4(?:\\\?[^"'<>\\\s]*)?/gi,

    /https?:\/\/[^"'<>\\\s]+?\.m3u8(?:\?[^"'<>\\\s]*)?/gi,
    /https?:\\\/\\\/[^"'<>\\\s]+?\.m3u8(?:\\\?[^"'<>\\\s]*)?/gi,

    /"(?:videoUrl|video_url|playUrl|play_url|playbackUrl|playback_url|downloadUrl|download_url|originUrl|origin_url|src)"\s*:\s*"([^"]+)"/gi,

    /<video[^>]+src=["']([^"']+)["']/gi,
    /<source[^>]+src=["']([^"']+)["']/gi,

    /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(decoded)) !== null) {
      const raw = match[1] || match[0];

      const url = normalizeMediaUrl(
        raw.replaceAll("\\/", "/"),
        baseUrl
      );

      if (!url) continue;

      const type = mediaType(url);

      if (!type) continue;

      results.push({
        url,
        type,
        source
      });
    }
  }

  return results;
}

function extractScripts(html, baseUrl) {
  const scripts = [];

  const regex =
    /<script[^>]+src=["']([^"']+)["']/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(
        decodeText(match[1]),
        baseUrl
      );

      if (url.protocol !== "https:") continue;

      const host = url.hostname.toLowerCase();

      if (
        host.endsWith("shopee.com.br") ||
        host.endsWith("shopee.com") ||
        host.endsWith("shopeemobile.com")
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

function extractKeys(text) {
  const decoded = decodeText(text);

  const wanted = [
    "videoUrl",
    "video_url",
    "playUrl",
    "play_url",
    "playbackUrl",
    "playback_url",
    "downloadUrl",
    "download_url",
    "originUrl",
    "origin_url",
    "sourceUrl",
    "source_url",
    "videoInfo",
    "video_info",
    "videoId",
    "video_id",
    "postId",
    "post_id",
    "coverUrl",
    "cover_url",
    "duration",
    "watermark",
    "withoutWatermark",
    "noWatermark",
    "originalVideo",
    "original_video"
  ];

  return wanted.filter(key =>
    decoded.toLowerCase().includes(
      key.toLowerCase()
    )
  );
}

function extractPaths(text) {
  const decoded = decodeText(text);

  const results = [];

  /*
   * Apenas caminhos encontrados no JS.
   * Não fazemos requisição para eles.
   */
  const regexes = [
    /["'`](\/api\/[^"'`\s\\]{2,180})["'`]/gi,
    /["'`](\/[^"'`\s\\]*(?:video|media|play|post)[^"'`\s\\]{0,150})["'`]/gi
  ];

  for (const regex of regexes) {
    let match;

    while ((match = regex.exec(decoded)) !== null) {
      let value = match[1];

      value = decodeText(value);

      if (
        value.length > 2 &&
        value.length < 200
      ) {
        results.push(value);
      }
    }
  }

  return unique(results).slice(0, 80);
}

function extractContext(text, keyword) {
  const decoded = decodeText(text);

  const lower = decoded.toLowerCase();
  const target = keyword.toLowerCase();

  const contexts = [];

  let position = 0;

  while (true) {
    const index = lower.indexOf(
      target,
      position
    );

    if (index === -1) break;

    const start = Math.max(
      0,
      index - 120
    );

    const end = Math.min(
      decoded.length,
      index + target.length + 220
    );

    let snippet = decoded
      .slice(start, end)
      .replace(/\s+/g, " ");

    /*
     * Não precisamos devolver megabytes
     * de código para a tela.
     */
    if (snippet.length > 400) {
      snippet = snippet.slice(0, 400);
    }

    contexts.push(snippet);

    position = index + target.length;

    if (contexts.length >= 5) {
      break;
    }
  }

  return unique(contexts);
}

function inspectText(text) {
  const keys = extractKeys(text);

  const contexts = {};

  const important = [
    "videoUrl",
    "playUrl",
    "downloadUrl",
    "originUrl",
    "watermark",
    "originalVideo",
    "postId"
  ];

  for (const key of important) {
    const found = extractContext(
      text,
      key
    );

    if (found.length) {
      contexts[key] = found;
    }
  }

  return {
    keys,
    paths: extractPaths(text),
    contexts
  };
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 12000
) {
  const controller = new AbortController();

  const timer = setTimeout(
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
    "pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.6",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"
};

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

    const input = safeInputUrl(
      body?.url
    );

    if (!input) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Link Shopee inválido."
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const inputUrl = input.toString();

    let current = inputUrl;

    let response = null;

    const steps = [];

    /*
     * 1 - RESOLVE LINK CURTO
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

        current = next.toString();

        continue;
      }

      break;
    }

    /*
     * 2 - UNIVERSAL -> SHARE VIDEO
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
     * 3 - CARREGA SHARE VIDEO
     */
    if (
      !response ||
      current.includes("/share-video/")
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
      html = await response.text();

      if (html.length > 4000000) {
        html = html.slice(
          0,
          4000000
        );
      }
    }

    /*
     * 4 - HTML
     */
    const htmlMedia =
      extractMedia(
        html,
        current,
        "html"
      );

    const htmlInspection =
      inspectText(html);

    /*
     * 5 - NEXT DATA
     */
    const nextData =
      extractNextData(html);

    const nextMedia =
      nextData
        ? extractMedia(
            nextData,
            current,
            "__NEXT_DATA__"
          )
        : [];

    const nextInspection =
      nextData
        ? inspectText(nextData)
        : {
            keys: [],
            paths: [],
            contexts: {}
          };

    /*
     * 6 - TODOS OS SCRIPTS PÚBLICOS
     */
    const scriptUrls =
      extractScripts(
        html,
        current
      );

    const scriptResults = [];

    const scriptMedia = [];

    /*
     * Limite de segurança:
     * até 20 scripts.
     */
    const scriptsToInspect =
      scriptUrls.slice(0, 20);

    for (
      let index = 0;
      index < scriptsToInspect.length;
      index++
    ) {

      const scriptUrl =
        scriptsToInspect[index];

      try {

        const scriptResponse =
          await fetchWithTimeout(
            scriptUrl,
            {
              method: "GET",
              headers: {
                ...browserHeaders,
                "Accept": "*/*"
              },
              redirect: "follow"
            },
            8000
          );

        if (!scriptResponse.ok) {
          scriptResults.push({
            index: index + 1,
            url: scriptUrl,
            status: scriptResponse.status,
            ok: false
          });

          continue;
        }

        let js =
          await scriptResponse.text();

        /*
         * Máximo de 2 MB por script.
         */
        if (js.length > 2000000) {
          js = js.slice(
            0,
            2000000
          );
        }

        const foundMedia =
          extractMedia(
            js,
            current,
            `script_${index + 1}`
          );

        scriptMedia.push(
          ...foundMedia
        );

        const inspection =
          inspectText(js);

        scriptResults.push({
          index: index + 1,
          url: scriptUrl,
          status: scriptResponse.status,
          ok: true,
          size: js.length,
          media_found: foundMedia.length,
          keys: inspection.keys,
          paths: inspection.paths,
          contexts: inspection.contexts
        });

      } catch (error) {

        scriptResults.push({
          index: index + 1,
          url: scriptUrl,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        });

      }
    }

    /*
     * 7 - JUNTA MÍDIAS
     */
    const allMedia = [
      ...htmlMedia,
      ...nextMedia,
      ...scriptMedia
    ];

    const seen = new Set();

    const variants =
      allMedia.filter(item => {

        if (seen.has(item.url)) {
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

    /*
     * 8 - RESUMO DE PISTAS
     */
    const scriptsWithVideoKeys =
      scriptResults.filter(
        item =>
          item.ok &&
          Array.isArray(item.keys) &&
          item.keys.length > 0
      );

    const scriptsWithPaths =
      scriptResults.filter(
        item =>
          item.ok &&
          Array.isArray(item.paths) &&
          item.paths.length > 0
      );

    const allCandidatePaths =
      unique([
        ...htmlInspection.paths,
        ...nextInspection.paths,

        ...scriptResults.flatMap(
          item =>
            Array.isArray(item.paths)
              ? item.paths
              : []
        )
      ]).slice(0, 100);

    return new Response(
      JSON.stringify(
        {
          ok: true,

          version:
            "4.0-investigation",

          stage:
            "investigation_complete",

          input_url:
            inputUrl,

          final_url:
            current,

          page_loaded:
            response.ok,

          http_status:
            response.status,

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

          /*
           * Mantém compatibilidade
           * com a interface atual.
           */
          media:
            mp4.length
              ? mp4
              : m3u8,

          mp4,

          m3u8,

          variants,

          investigation: {

            html: {
              size: html.length,
              keys:
                htmlInspection.keys,
              paths:
                htmlInspection.paths,
              contexts:
                htmlInspection.contexts
            },

            next_data: {
              found:
                nextData.length > 0,

              size:
                nextData.length,

              keys:
                nextInspection.keys,

              paths:
                nextInspection.paths,

              contexts:
                nextInspection.contexts
            },

            scripts: {
              total_found:
                scriptUrls.length,

              total_inspected:
                scriptsToInspect.length,

              with_video_keys:
                scriptsWithVideoKeys.length,

              with_candidate_paths:
                scriptsWithPaths.length,

              results:
                scriptResults
            },

            candidate_paths:
              allCandidatePaths
          },

          /*
           * Mantemos diagnostics
           * para o index V3 não quebrar.
           */
          diagnostics: {
            html_size:
              html.length,

            next_data_found:
              nextData.length > 0,

            next_data_size:
              nextData.length,

            total_scripts:
              scriptUrls.length,

            inspected_scripts:
              scriptsToInspect.length,

            scripts_with_video_keys:
              scriptsWithVideoKeys.length,

            scripts_with_candidate_paths:
              scriptsWithPaths.length
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
            "4.0-investigation",

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
