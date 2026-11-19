const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
    };
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "API_ERROR",
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? "We could not complete your request",
      response.status,
      payload.error?.code,
      payload.error?.details?.fieldErrors,
    );
  }

  return payload;
}
