export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;
  data?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string>,
    data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = options.token !== undefined ? options.token : inMemoryToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof data.error === 'string' ? data.error : `Request failed (${response.status})`;
    const errors =
      data.errors && typeof data.errors === 'object'
        ? (data.errors as Record<string, string>)
        : undefined;
    throw new ApiError(message, response.status, errors, data);
  }

  return data as T;
}
