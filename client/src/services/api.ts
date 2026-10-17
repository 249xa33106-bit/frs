const BASE_URL = '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('hostel_safety_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
  } catch (netErr: any) {
    throw new Error(`Connection error: Unable to reach backend server. (${netErr.message})`);
  }

  if (response.status === 401) {
    // If unauthorized, clear token and notify
    localStorage.removeItem('hostel_safety_token');
    localStorage.removeItem('hostel_safety_user');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  let data: any = {};
  const rawText = await response.text();
  if (rawText && rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Server responded with status ${response.status}`);
  }

  return data;
}

export const api = {
  get: <T = any>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string) => apiRequest<T>(url, { method: 'DELETE' })
};
