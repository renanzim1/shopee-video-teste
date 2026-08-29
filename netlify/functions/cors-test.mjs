const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  return Response.json(
    {
      ok: true,
      message: "CORS funcionando",
      method: request.method,
      origin: request.headers.get("origin"),
    },
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
      },
    }
  );
};
