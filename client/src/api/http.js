export const TOKEN_KEY = "foodbridge_token";

export const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8080/api"
).replace(/\/$/, "");

export async function api(
  path,
  { method = "GET", body, token, signal } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Cannot reach the backend. Check that it is running on port 8080."
    );
  }

  const data = await response.json().catch(() => ({
    message: "The server returned an unreadable response."
  }));

  if (!response.ok) {
    if (
      response.status === 401 &&
      token &&
      sessionStorage.getItem(TOKEN_KEY) === token
    ) {
      window.dispatchEvent(new Event("foodbridge:unauthorized"));
    }

    const details = Array.isArray(data.details)
      ? data.details.map((item) => item.message).join(" ")
      : "";

    const error = new Error(
      details || data.message || "The request failed."
    );

    error.status = response.status;
    throw error;
  }

  return data;
}