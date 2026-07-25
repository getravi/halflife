/**
 * Response helpers. Their own module because every route imports them and
 * index.js imports every route; putting them in index.js is an import cycle.
 */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function error(message, status) {
  return json({ error: message }, status);
}
