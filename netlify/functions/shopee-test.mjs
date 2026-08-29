const ALLOWED_HOSTS = [
  "br.shp.ee",
  "shopee.com.br",
  "www.shopee.com.br",
  "sv.shopee.com.br"
];

function allowedHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  return (
    ALLOWED_HOSTS.includes(host) ||
    host.endsWith(".shopee.com.br") ||
    host.endsWith(".shp.ee")
  );
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;
    if (!allowedHost(url.hostname)) return null;

    return url;
  } catch {
    return null;
  }
}

function decodeValue(value) {
  return String(value || "")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u002f", "/")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&");
}

function getUniversalRedirect(value) {
  try {
    const url = new URL(value);

    if (!url.pathname.includes("/universal-link")) {
      return null;
    }

    const redir = url.searchParams.get("redir");

    if (!redir) return null;

    let decoded = redir;

    for (let i = 0; i < 3; i++) {
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
      !allowedHost(target.hostname)
    ) {
      return null;
    }

    return target.toString();
  } catch {
    return null;
  }
}

async function fetchTimeout(
  url,
  options = {},
  timeout = 12000
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
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

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language":
    "pt-BR,pt;q=0.9,en-US;q=0.7",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"
};

function extractNextData(html) {
  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/*
 * Procura recursivamente objetos que tenham
 * campos relacionados a vídeo.
 */
function findVideoObjects(value) {
  const results = [];
  const visited = new WeakSet();

  function walk(node, path = "root") {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        walk(
          item,
          `${path}[${index}]`
        );
      });

      return;
    }

    const keys = Object.keys(node);

    const interestingKeys =
      keys.filter(key => {
        const lower =
          key.toLowerCase();

        return (
          lower.includes("video") ||
          lower.includes("watermark") ||
          lower.includes("media") ||
          lower.includes("play") ||
          lower.includes("download") ||
          lower.includes("duration")
        );
      });

    if (interestingKeys.length) {
      const values = {};

      for (const key of keys) {
        const item = node[key];

        /*
         * Retorna somente valores simples.
         * Assim o JSON não fica gigantesco.
         */
        if (
          item === null ||
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean"
        ) {
          values[key] = item;
        }
      }

      results.push({
        path,
        interesting_keys:
          interestingKeys,
        values
      });
    }

    for (const [key, child] of Object.entries(node)) {
      if (
        child &&
        typeof child === "object"
      ) {
        walk(
          child,
          `${path}.${key}`
        );
      }
    }
  }

  walk(value);

  return results.slice(0, 100);
}

/*
 * Procura especificamente por campos
 * cujo nome contenha "watermark".
 */
function findWatermarkFields(value) {
  const results = [];
  const visited = new WeakSet();

  function walk(node, path = "root") {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        walk(
          item,
          `${path}[${index}]`
        );
      });

      return;
    }

    for (const [key, child] of Object.entries(node)) {
      const currentPath =
        `${path}.${key}`;

      if (
        key
          .toLowerCase()
          .includes("watermark")
      ) {
        results.push({
          path: currentPath,
          key,
          value:
            typeof child === "object"
              ? "[object]"
              : child
        });
      }

      if (
        child &&
        typeof child === "object"
      ) {
        walk(
          child,
          currentPath
        );
      }
    }
  }

  walk(value);

  return results.slice(0, 50);
}

/*
 * Encontra URLs de MP4 dentro do NEXT_DATA
 * e registra o caminho de onde vieram.
 */
function findMp4Fields(value) {
  const results = [];
  const visited = new WeakSet();

  function walk(node, path = "root") {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        walk(
          item,
          `${path}[${index}]`
        );
      });

      return;
    }

    for (const [key, child] of Object.entries(node)) {
      const currentPath =
        `${path}.${key}`;

      if (
        typeof child === "string"
      ) {
        const decoded =
          decodeValue(child);

        if (
          decoded
            .toLowerCase()
            .includes(".mp4")
        ) {
          results.push({
            path: currentPath,
            key,
            url: decoded
          });
        }
      }

      if (
        child &&
        typeof child === "object"
      ) {
        walk(
          child,
          currentPath
        );
      }
    }
  }

  walk(value);

  return results.slice(0, 50);
}

export default async (request) => {
  const cors = {
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
      headers: cors
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
        headers: cors
      }
    );
  }

  try {
    const body =
      await request.json();

    const input =
      safeUrl(body?.url);

    if (!input) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Link Shopee inválido."
        }),
        {
          status: 400,
          headers: cors
        }
      );
    }

    const inputUrl =
      input.toString();

    let current =
      inputUrl;

    let response = null;

    const steps = [];

    /*
     * Resolve o link curto.
     */
    for (let i = 0; i < 8; i++) {
      const universal =
        getUniversalRedirect(
          current
        );

      if (universal) {
        steps.push({
          type:
            "universal_redir",
          from: current,
          to: universal
        });

        current =
          universal;

        response =
          null;

        continue;
      }

      const checked =
        safeUrl(current);

      if (!checked) {
        throw new Error(
          "Redirecionamento bloqueado."
        );
      }

      response =
        await fetchTimeout(
          current,
          {
            method: "GET",
            headers: HEADERS,
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
          !allowedHost(
            next.hostname
          )
        ) {
          throw new Error(
            "Redirecionamento externo bloqueado."
          );
        }

        steps.push({
          type:
            "http_redirect",
          status:
            response.status,
          from:
            current,
          to:
            next.toString()
        });

        current =
          next.toString();

        response =
          null;

        continue;
      }

      break;
    }

    /*
     * Alguns links terminam numa universal-link.
     */
    const finalUniversal =
      getUniversalRedirect(
        current
      );

    if (finalUniversal) {
      steps.push({
        type:
          "universal_redir",
        from:
          current,
        to:
          finalUniversal
      });

      current =
        finalUniversal;

      response =
        null;
    }

    /*
     * Carrega a página final.
     */
    if (!response) {
      response =
        await fetchTimeout(
          current,
          {
            method: "GET",
            headers: HEADERS,
            redirect: "follow"
          }
        );
    }

    const html =
      await response.text();

    /*
     * NEXT_DATA
     */
    const nextData =
      extractNextData(html);

    if (!nextData) {
      return new Response(
        JSON.stringify(
          {
            ok: true,
            version:
              "5.0-media-info",

            stage:
              "next_data_not_found",

            input_url:
              inputUrl,

            final_url:
              current,

            next_data_found:
              false,

            message:
              "__NEXT_DATA__ não foi encontrado."
          },
          null,
          2
        ),
        {
          status: 200,
          headers: cors
        }
      );
    }

    /*
     * Investigação focada.
     */
    const videoObjects =
      findVideoObjects(
        nextData
      );

    const watermarkFields =
      findWatermarkFields(
        nextData
      );

    const mp4Fields =
      findMp4Fields(
        nextData
      );

    /*
     * Mantém compatibilidade com
     * nosso index.html atual.
     */
    const mp4 =
      [
        ...new Set(
          mp4Fields
            .map(item => item.url)
            .filter(Boolean)
        )
      ];

    const variants =
      mp4.map((url, index) => {
        const match =
          mp4Fields.find(
            item =>
              item.url === url
          );

        return {
          url,
          type: "mp4",
          source:
            match?.key ||
            `NEXT_DATA_${index + 1}`
        };
      });

    return new Response(
      JSON.stringify(
        {
          ok: true,

          version:
            "5.0-media-info",

          stage:
            "media_info_inspected",

          input_url:
            inputUrl,

          final_url:
            current,

          next_data_found:
            true,

          video_object_count:
            videoObjects.length,

          watermark_field_count:
            watermarkFields.length,

          mp4_field_count:
            mp4Fields.length,

          video_objects:
            videoObjects,

          watermark_fields:
            watermarkFields,

          mp4_fields:
            mp4Fields,

          variant_count:
            variants.length,

          variants,

          mp4,

          m3u8: [],

          media:
            mp4,

          mp4_found:
            mp4.length > 0,

          m3u8_found:
            false,

          diagnostics: {
            next_data_found:
              true,

            total_scripts:
              0,

            inspected_scripts:
              0,

            video_objects:
              videoObjects.length,

            watermark_fields:
              watermarkFields.length,

            mp4_fields:
              mp4Fields.length
          },

          steps
        },
        null,
        2
      ),
      {
        status: 200,
        headers: cors
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          ok: false,

          version:
            "5.0-media-info",

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
        headers: cors
      }
    );
  }
};
