/**
 * Canonical address of the FastAPI/LangGraph service.
 *
 * Azure Container Apps gives the backend its own HTTPS FQDN. Keep this URL
 * server-only (`PYTHON_BACKEND_URL`) so it is not exposed to browser code.
 */
export function getPythonBackendUrl(): string {
  const raw =
    process.env.PYTHON_BACKEND_URL ||
    process.env.FLASK_BACKEND_URL ||
    "http://localhost:5000";

  return raw.replace(/\/$/, "");
}

/** Headers for trusted server-to-server calls from Next.js to FastAPI. */
export function getInternalBackendHeaders(headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (internalSecret) {
    merged.set("X-Internal-Secret", internalSecret);
  }

  return merged;
}
