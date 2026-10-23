// Share only concurrent API reads. Completed reads are never reused here.
export const createApiReadCoordinator = (fetchRequest, baseUrl) => {
  const pending = new Map();
  let generation = 0;
  return (input, init = {}) => {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const method = String(init.method || request?.method || "GET").toUpperCase();
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    let url;
    try { url = new URL(rawUrl, baseUrl); } catch { return fetchRequest(input, init); }
    if (!url.pathname.toLowerCase().startsWith("/api/")) return fetchRequest(input, init);
    if (method !== "GET") {
      if (method === "HEAD") return fetchRequest(input, init);
      generation += 1; pending.clear();
      return Promise.resolve(fetchRequest(input, init)).finally(() => {
        generation += 1; pending.clear();
      });
    }
    // Each caller must retain its own cancellation and explicit reload semantics.
    const cache = init.cache || request?.cache || "default";
    if (init.signal || request || cache === "reload" || cache === "no-cache" || init.keepalive) {
      return fetchRequest(input, init);
    }
    const headers = Array.from(new Headers(init.headers).entries()).sort(([a], [b]) => a.localeCompare(b));
    const key = JSON.stringify([generation, url.href, headers, init.credentials || "same-origin", cache,
      init.mode || "cors", init.redirect || "follow", init.referrer || "", init.referrerPolicy || "", init.integrity || ""]);
    let shared = pending.get(key);
    if (!shared) {
      shared = Promise.resolve().then(() => fetchRequest(input, init));
      pending.set(key, shared);
      const cleanup = () => { if (pending.get(key) === shared) pending.delete(key); };
      shared.then(cleanup, cleanup);
    }
    // Every consumer gets an independent body stream.
    return shared.then((response) => response.clone());
  };
};
