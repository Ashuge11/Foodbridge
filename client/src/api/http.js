export const TOKEN_KEY = "foodbridge_token";
export const API_URL = (import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8080/api").replace(/\/$/, "");

export async function api(path, { method = "GET", body, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(API_URL + path, {
      method, headers, signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && token &&
          sessionStorage.getItem(TOKEN_KEY) === token) {
        window.dispatchEvent(new Event("foodbridge:unauthorized"));
      }
      const details = Array.isArray(data?.details) ? data.details : [];
      const message = details.map(i => (i.field ? i.field + ": " : "") + i.message).join(" ");
      const error = new Error(message || data?.message || "The request failed.");
      error.status = response.status;
      error.details = details;
      throw error;
    }
    if (!data || typeof data !== "object" || data.success === false) {
      throw new Error(data?.message || "The server returned an invalid response.");
    }
    return data;
  } catch (error) {
    if (timedOut) throw new Error(
      "Request timed out. Refresh to check whether your action succeeded before trying again.");
    if (error.name === "AbortError") throw error;
    if (error instanceof TypeError) throw new Error(
      "Cannot reach the backend. Check your connection and that the backend is running.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
