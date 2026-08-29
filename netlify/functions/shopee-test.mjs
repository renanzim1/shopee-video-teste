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

  "Accept-Language":
    "pt-BR,pt;q=0.9,en;q=0.8",
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
    if (
      /https?:\/\/[^"'\\\s]+\.mp4(?:\?[^"'\\\s]*)?/i.test(
        value
      )
    ) {
      const matches =
        value.match(
          /https?:\/\/[^"'\\\s]+\.mp4(?:\?[^"'\\\s]*)?/gi
        ) || [];

      for (const url of matches) {
        results.push({
          path,
          key: path.split(".").pop(),

          url: url
            .replace(/\\u0026/g, "&")
            .replace(/\\\//g, "/"),
        });
      }
    }

    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findMp4Fields(
        item,
        `${path}[${index}]`,
        results
      );
    });

    return results;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      findMp4Fields(
        item,
        `${path}.${key}`,
        results
      );
    }
  }

  return results;
}

/*
 * IMPORTANTE:
 *
 * A Shopee fornece uma URL que contém o sufixo
 * usado pela versão watermark.
 *
 * Nós usamos essa informação SOMENTE internamente
 * para descobrir o endereço base do vídeo original.
 *
 * A versão watermark NÃO é mais devolvida pela API.
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

    const filename =
      url.pathname.split("/").pop();

    if (
      !filename ||
      !filename.toLowerCase().endsWith(".mp4")
    ) {
      return null;
    }

    /*
     * Exemplo:
     *
     * Entrada interna:
     *
     * arquivo.16003551753240105.7278.mp4
     *
     * Original:
     *
     * arquivo.mp4
     */
    const match = filename.match(
      /^(.+?)\.\d{6,}\.\d+\.mp4$/i
    );

    if (!match?.[1]) {
      return null;
    }

    const baseFilename =
      `${match[1]}.mp4`;

    const parts =
      url.pathname.split("/");

    parts[parts.length - 1] =
      baseFilename;

    url.pathname =
      parts.join("/");

    /*
     * Não carregamos parâmetros da
     * variante utilizada como referência.
     */
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
     * Não baixa o vídeo inteiro.
     *
     * Range serve somente para confirmar
     * que o arquivo original existe no CDN.
     */
    const response =
      await fetchTimeout(
        url,
        {
          method: "GET",

          headers: {
            "User-Agent":
              browserHeaders["User-Agent"],

            Accept:
              "video/mp4,video/*;q=0.9,*/*;q=0.8",

            Range:
              "bytes=0-1",
          },

          redirect: "follow",
        },
        12000
      );

    const contentType =
      response.headers.get(
        "content-type"
      );

    const contentLength =
      response.headers.get(
        "content-range"
      ) ||
      response.headers.get(
        "content-length"
      );

    const looksLikeVideo =
      response.ok ||
      response.status === 206;

    const typeIsValid =
      !contentType ||
      contentType.includes("video") ||
      contentType.includes(
        "octet-stream"
      );

    return {
      ok:
        looksLikeVideo &&
        typeIsValid,

      status:
        response.status,

      contentType,

      contentLength,

      finalUrl:
        response.url || url,
    };
  } catch (error) {
    return {
      ok: false,

      status: null,

      contentType: null,

      contentLength: null,

      error: String(
        error?.message || error
      ),
    };
  }
}

export default async (request) => {
  /*
   * CORS
   */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,

      headers: {
        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Headers":
          "Content-Type",

        "Access-Control-Allow-Methods":
          "POST, OPTIONS",
      },
    });
  }

  /*
   * Apenas POST
   */
  if (request.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "Use POST.",
      },
      {
        status: 405,

        headers: {
          "Access-Control-Allow-Origin":
            "*",
        },
      }
    );
  }

  try {
    const body =
      await request
        .json()
        .catch(() => ({}));

    const input =
      body.url ||
      body.link ||
      body.videoUrl ||
      "";

    const initialUrl =
      safeUrl(
        String(input).trim()
      );

    if (!initialUrl) {
      return Response.json(
        {
          ok: false,

          error:
            "Link da Shopee inválido.",
        },
        {
          status: 400,

          headers: {
            "Access-Control-Allow-Origin":
              "*",
          },
        }
      );
    }

    /*
     * 1.
     * Resolve link curto da Shopee.
     */
    const firstResponse =
      await fetchTimeout(
        initialUrl.toString(),
        {
          headers:
            browserHeaders,

          redirect:
            "follow",
        },
        15000
      );

    let resolvedUrl =
      firstResponse.url ||
      initialUrl.toString();

    /*
     * 2.
     * Resolve universal-link.
     */
    const universalRedirect =
      getUniversalRedirect(
        resolvedUrl
      );

    if (universalRedirect) {
      resolvedUrl =
        universalRedirect;
    }

    /*
     * 3.
     * Carrega a página pública
     * do Shopee Video.
     */
    const pageResponse =
      await fetchTimeout(
        resolvedUrl,
        {
          headers:
            browserHeaders,

          redirect:
            "follow",
        },
        15000
      );

    const finalPageUrl =
      pageResponse.url ||
      resolvedUrl;

    const html =
      await pageResponse.text();

    /*
     * 4.
     * Obtém os dados Next.js.
     */
    const nextData =
      extractNextData(html);

    if (!nextData) {
      return Response.json(
        {
          ok: false,

          version:
            "6.1-original-only",

          stage:
            "next_data_not_found",

          final_url:
            finalPageUrl,

          error:
            "__NEXT_DATA__ não encontrado.",
        },
        {
          status: 200,

          headers: {
            "Access-Control-Allow-Origin":
              "*",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * 5.
     * Procura os MP4 existentes
     * nos dados da página.
     */
    const mp4Fields =
      findMp4Fields(nextData);

    /*
     * Precisamos localizar internamente
     * a referência watermark para derivar
     * o endereço base.
     *
     * ELA NÃO SERÁ DEVOLVIDA AO RADAR.
     */
    const referenceMp4 =
      mp4Fields.find(
        (item) =>
          item.key
            .toLowerCase()
            .includes("watermark")
      ) ||
      mp4Fields.find(
        (item) =>
          item.path
            .toLowerCase()
            .includes("watermark")
      ) ||
      mp4Fields[0] ||
      null;

    if (!referenceMp4?.url) {
      return Response.json(
        {
          ok: false,

          version:
            "6.1-original-only",

          stage:
            "video_reference_not_found",

          final_url:
            finalPageUrl,

          error:
            "Não foi possível localizar a referência do vídeo.",
        },
        {
          status: 200,

          headers: {
            "Access-Control-Allow-Origin":
              "*",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * 6.
     * Cria UMA ÚNICA candidata:
     *
     * ORIGINAL / HD
     */
    const candidateOriginal =
      deriveBaseVideoUrl(
        referenceMp4.url
      );

    if (!candidateOriginal) {
      return Response.json(
        {
          ok: false,

          version:
            "6.1-original-only",

          stage:
            "original_candidate_not_created",

          original_found:
            false,

          error:
            "Não foi possível gerar a URL do vídeo original.",
        },
        {
          status: 200,

          headers: {
            "Access-Control-Allow-Origin":
              "*",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * 7.
     * Confirma que o Original/HD
     * realmente existe.
     */
    const verification =
      await verifyVideo(
        candidateOriginal
      );

    if (!verification.ok) {
      /*
       * IMPORTANTE:
       *
       * Não existe mais fallback.
       *
       * Se o Original/HD falhar,
       * NÃO entregamos a versão
       * com watermark.
       */
      return Response.json(
        {
          ok: false,

          version:
            "6.1-original-only",

          stage:
            "original_not_found",

          original_found:
            false,

          verification,

          error:
            "Vídeo Original/HD não encontrado.",
        },
        {
          status: 200,

          headers: {
            "Access-Control-Allow-Origin":
              "*",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * 8.
     * ORIGINAL / HD CONFIRMADO.
     *
     * Esta passa a ser a ÚNICA
     * variação devolvida.
     */
    const originalUrl =
      verification.finalUrl ||
      candidateOriginal;

    return Response.json(
      {
        ok: true,

        version:
          "6.1-original-only",

        stage:
          "original_found",

        original_found:
          true,

        /*
         * Mantemos media e mp4
         * para facilitar integração
         * com o Radar.
         */
        media:
          originalUrl,

        mp4:
          originalUrl,

        original_url:
          originalUrl,

        /*
         * APENAS UMA VARIAÇÃO.
         */
        variants: [
          {
            type: "mp4",

            source:
              "original_base",

            label:
              "Original / HD",

            url:
              originalUrl,

            verified:
              true,

            status:
              verification.status,

            content_type:
              verification.contentType,

            content_length:
              verification.contentLength,
          },
        ],

        verification,

        diagnostics: {
          next_data_found:
            true,

          original_candidate_created:
            true,

          original_verified:
            true,

          original_http_status:
            verification.status,

          original_content_type:
            verification.contentType,
        },
      },
      {
        status: 200,

        headers: {
          "Access-Control-Allow-Origin":
            "*",

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,

        version:
          "6.1-original-only",

        stage:
          "error",

        error: String(
          error?.message || error
        ),
      },
      {
        status: 200,

        headers: {
          "Access-Control-Allow-Origin":
            "*",

          "Cache-Control":
            "no-store",
        },
      }
    );
  }
};
