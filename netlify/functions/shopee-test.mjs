const ALLOWED_HOSTS = [
  "br.shp.ee",
  "shopee.com.br",
  "www.shopee.com.br",
  "sv.shopee.com.br",
];

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();

  return (
    ALLOWED_HOSTS.includes(host) ||
    host.endsWith(".shopee.com.br") ||
    host.endsWith(".shp.ee")
  );
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (!isAllowedHost(url.hostname)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function decodeValue(value) {
  let result = value;

  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(result);

      if (decoded === result) break;

      result = decoded;
    } catch {
      break;
    }
  }

  return result;
}

function getUniversalRedirect(url) {
  try {
    const parsed = new URL(url);

    const redir =
      parsed.searchParams.get("redir") ||
      parsed.searchParams.get("redirect") ||
      parsed.searchParams.get("url");

    if (!redir) return null;

    const decoded = decodeValue(redir);

    return safeUrl(decoded)?.toString() || null;
  } catch {
    return null;
  }
}

async function fetchTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

function extractNextData(html) {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function findMp4Fields(value, path = "root", results = []) {
  if (value === null || value === undefined) {
    return results;
  }

  if (typeof value === "string") {
    if (/https?:\/\/[^"'\\\s]+\.mp4(?:\?[^"'\\\s]*)?/i.test(value)) {
      const matches =
        value.match(/https?:\/\/[^"'\\\s]+\.mp4(?:\?[^"'\\\s]*)?/gi) || [];

      for (const url of matches) {
        results.push({
          path,
          key: path.split(".").pop(),
          url: url.replace(/\\u0026/g, "&").replace(/\\\//g, "/"),
        });
      }
    }

    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findMp4Fields(item, `${path}[${index}]`, results);
    });

    return results;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      findMp4Fields(item, `${path}.${key}`, results);
    }
  }

  return results;
}

function findWatermarkFields(value, path = "root", results = []) {
  if (!value || typeof value !== "object") {
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findWatermarkFields(item, `${path}[${index}]`, results);
    });

    return results;
  }

  for (const [key, item] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;

    if (key.toLowerCase().includes("watermark")) {
      results.push({
        path: currentPath,
        key,
        value: item,
      });
    }

    if (item && typeof item === "object") {
      findWatermarkFields(item, currentPath, results);
    }
  }

  return results;
}

/*
 * Exemplo confirmado:
 *
 * watermark:
 * br-11110124-6kfkq-mciohuath7aqdc.16003551753240105.7278.mp4
 *
 * base:
 * br-11110124-6kfkq-mciohuath7aqdc.mp4
 *
 * A função abaixo NÃO faz brute force.
 * Ela apenas remove o sufixo numérico da variante watermark.
 */
function deriveBaseVideoUrl(watermarkUrl) {
  try {
    const url = new URL(watermarkUrl);

    if (
      !url.hostname.endsWith(".vod.susercontent.com") &&
      url.hostname !== "vod.susercontent.com"
    ) {
      return null;
    }

    const filename = url.pathname.split("/").pop();

    if (!filename || !filename.toLowerCase().endsWith(".mp4")) {
      return null;
    }

    const match = filename.match(
      /^(.+?)\.\d{6,}\.\d+\.mp4$/i
    );

    if (!match?.[1]) {
      return null;
    }

    const baseFilename = `${match[1]}.mp4`;

    const parts = url.pathname.split("/");
    parts[parts.length - 1] = baseFilename;

    url.pathname = parts.join("/");

    // Não carregamos parâmetros da variante watermark
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

async function verifyVideo(url) {
  if (!url) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
    };
  }

  try {
    /*
     * Range evita baixar o vídeo inteiro dentro da Function.
     * Só precisamos confirmar que o CDN reconhece o arquivo.
     */
    const response = await fetchTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": browserHeaders["User-Agent"],
          Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
          Range: "bytes=0-1",
        },
        redirect: "follow",
      },
      12000
    );

    const contentType = response.headers.get("content-type");
    const contentLength =
      response.headers.get("content-range") ||
      response.headers.get("content-length");

    const looksLikeVideo =
      response.ok ||
      response.status === 206;

    const typeIsValid =
      !contentType ||
      contentType.includes("video") ||
      contentType.includes("octet-stream");

    return {
      ok: looksLikeVideo && typeIsValid,
      status: response.status,
      contentType,
      contentLength,
      finalUrl: response.url || url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      error: String(error?.message || error),
    };
  }
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "Use POST.",
      },
      {
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    const input =
      body.url ||
      body.link ||
      body.videoUrl ||
      "";

    const initialUrl = safeUrl(String(input).trim());

    if (!initialUrl) {
      return Response.json(
        {
          ok: false,
          error: "Link da Shopee inválido.",
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    /*
     * 1. Resolve link curto.
     */
    const firstResponse = await fetchTimeout(
      initialUrl.toString(),
      {
        headers: browserHeaders,
        redirect: "follow",
      },
      15000
    );

    let resolvedUrl = firstResponse.url || initialUrl.toString();

    /*
     * 2. Alguns links terminam em universal-link.
     *    Extraímos o redir para share-video.
     */
    const universalRedirect = getUniversalRedirect(resolvedUrl);

    if (universalRedirect) {
      resolvedUrl = universalRedirect;
    }

    /*
     * 3. Carrega página pública do Shopee Video.
     */
    const pageResponse = await fetchTimeout(
      resolvedUrl,
      {
        headers: browserHeaders,
        redirect: "follow",
      },
      15000
    );

    const finalPageUrl = pageResponse.url || resolvedUrl;
    const html = await pageResponse.text();

    const nextData = extractNextData(html);

    if (!nextData) {
      return Response.json(
        {
          ok: false,
          version: "6.0-original-test",
          stage: "next_data_not_found",
          final_url: finalPageUrl,
          error: "__NEXT_DATA__ não encontrado.",
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    /*
     * 4. Encontra MP4s existentes no JSON.
     */
    const mp4Fields = findMp4Fields(nextData);
    const watermarkFields = findWatermarkFields(nextData);

    const watermarkMp4 =
      mp4Fields.find((item) =>
        item.key.toLowerCase().includes("watermark")
      ) ||
      mp4Fields.find((item) =>
        item.path.toLowerCase().includes("watermark")
      ) ||
      mp4Fields[0] ||
      null;

    if (!watermarkMp4?.url) {
      return Response.json(
        {
          ok: false,
          version: "6.0-original-test",
          stage: "watermark_not_found",
          final_url: finalPageUrl,
          mp4_fields: mp4Fields,
          watermark_fields: watermarkFields,
          error: "watermarkVideoUrl não encontrada.",
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    /*
     * 5. Deriva UMA única URL-base.
     */
    const candidateOriginal = deriveBaseVideoUrl(
      watermarkMp4.url
    );

    /*
     * 6. Confirma no CDN sem baixar o arquivo inteiro.
     */
    const verification = await verifyVideo(
      candidateOriginal
    );

    const originalFound =
      Boolean(candidateOriginal) &&
      verification.ok;

    const variants = [];

    if (originalFound) {
      variants.push({
        type: "mp4",
        source: "original_base",
        label: "Original / HD",
        url: verification.finalUrl || candidateOriginal,
        verified: true,
        status: verification.status,
        content_type: verification.contentType,
        content_length: verification.contentLength,
      });
    }

    /*
     * Watermark continua disponível como fallback.
     */
    variants.push({
      type: "mp4",
      source: "watermarkVideoUrl",
      label: "Watermark / fallback",
      url: watermarkMp4.url,
      verified: true,
    });

    return Response.json(
      {
        ok: true,
        version: "6.0-original-test",
        stage: originalFound
          ? "original_found"
          : "original_not_found",

        original_found: originalFound,

        media: originalFound
          ? verification.finalUrl || candidateOriginal
          : watermarkMp4.url,

        mp4: originalFound
          ? verification.finalUrl || candidateOriginal
          : watermarkMp4.url,

        original_url: originalFound
          ? verification.finalUrl || candidateOriginal
          : null,

        candidate_original_url: candidateOriginal,

        watermark_url: watermarkMp4.url,

        verification,

        variants,

        mp4_fields: mp4Fields,
        watermark_fields: watermarkFields,

        diagnostics: {
          next_data_found: true,
          mp4_found: mp4Fields.length > 0,
          original_candidate_created:
            Boolean(candidateOriginal),
          original_verified: originalFound,
          original_http_status:
            verification.status,
          original_content_type:
            verification.contentType,
        },
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        version: "6.0-original-test",
        stage: "error",
        error: String(error?.message || error),
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  }
};
