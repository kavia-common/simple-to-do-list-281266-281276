const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Minimal JSON fetch wrapper with timeout + helpful error messages.
 * We keep this dependency-free (no axios) to match the lightweight template.
 */
async function fetchJson(path, { method = "GET", body, signal } = {}) {
  // Prefer explicit env override, but default to the local dev backend (port 3001)
  // so the app works out-of-the-box in the multi-container preview environment.
  const baseUrl =
    process.env.REACT_APP_TODO_API_BASE_URL?.replace(/\/*$/, "") ||
    "http://localhost:3001";

  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const message =
        (payload && typeof payload === "object" && payload.detail) ||
        (typeof payload === "string" && payload) ||
        `Request failed with status ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// PUBLIC_INTERFACE
export async function listTodos() {
  /** Fetch all todos. Returns an array of todos. */
  return fetchJson("/todos");
}

// PUBLIC_INTERFACE
export async function createTodo({ title }) {
  /** Create a new todo. Accepts {title}. Returns created todo. */
  return fetchJson("/todos", { method: "POST", body: { title } });
}

// PUBLIC_INTERFACE
export async function updateTodo(id, updates) {
  /** Update a todo by id. Accepts partial fields like {title, completed}. Returns updated todo. */
  return fetchJson(`/todos/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: updates,
  });
}

// PUBLIC_INTERFACE
export async function deleteTodo(id) {
  /** Delete a todo by id. Returns backend response (if any). */
  return fetchJson(`/todos/${encodeURIComponent(id)}`, { method: "DELETE" });
}
