import type { ApiErrorBody } from '@hr-demo/shared';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'hr_demo_access_token';
export const FEISHU_TASK_TOKEN_KEY = 'hr_demo_feishu_task_token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const feishuTaskTokenStorage = {
  get: () => sessionStorage.getItem(FEISHU_TASK_TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(FEISHU_TASK_TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(FEISHU_TASK_TOKEN_KEY),
};

export async function feishuTaskRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = feishuTaskTokenStorage.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    const messages = Array.isArray(body.message) ? body.message : body.message ? [body.message] : [];
    throw new ApiError(messages[0] ?? `请求失败 (${response.status})`, response.status, messages);
  }
  const body = await response.text();
  return body.trim() === '' ? undefined as T : JSON.parse(body) as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && token) {
    tokenStorage.clear();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    const messages = Array.isArray(body.message) ? body.message : body.message ? [body.message] : [];
    throw new ApiError(messages[0] ?? `请求失败 (${response.status})`, response.status, messages);
  }

  if (response.status === 204) return undefined as T;

  const body = await response.text();
  if (body.trim() === '') return null as T;
  return JSON.parse(body) as T;
}
