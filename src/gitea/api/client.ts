import { GITEA_API_URL, GITEA_AUTH_SCHEME } from "./config";

export type RequestOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  rawResponse?: boolean;
};

export type GiteaClient = {
  request<T>(options: RequestOptions): Promise<T>;
  get<T>(path: string, query?: RequestOptions["query"]): Promise<T>;
  post<T>(path: string, body?: unknown, query?: RequestOptions["query"]): Promise<T>;
  put<T>(path: string, body?: unknown, query?: RequestOptions["query"]): Promise<T>;
  patch<T>(path: string, body?: unknown, query?: RequestOptions["query"]): Promise<T>;
  delete<T>(
    path: string,
    body?: unknown,
    query?: RequestOptions["query"],
  ): Promise<T>;
  getText(path: string, query?: RequestOptions["query"]): Promise<string>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = GITEA_API_URL.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function createGiteaClient(token: string): GiteaClient {
  async function request<T>(options: RequestOptions): Promise<T> {
    const { method, path, query, body, headers, rawResponse } = options;
    const url = buildUrl(path, query);

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      Authorization: `${GITEA_AUTH_SCHEME} ${token}`,
      ...headers,
    };

    const init: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Gitea API request failed: ${method} ${url} -> ${response.status} ${response.statusText}. ${text}`,
      );
    }

    if (rawResponse) {
      return (await response.text()) as unknown as T;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    request,
    get: (path, query) => request({ method: "GET", path, query }),
    post: (path, body, query) => request({ method: "POST", path, query, body }),
    put: (path, body, query) => request({ method: "PUT", path, query, body }),
    patch: (path, body, query) => request({ method: "PATCH", path, query, body }),
    delete: (path, body, query) =>
      request({ method: "DELETE", path, query, body }),
    getText: (path, query) =>
      request({ method: "GET", path, query, rawResponse: true }),
  };
}
