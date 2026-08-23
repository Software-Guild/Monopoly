const AUTH_API_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api/auth";

type ApiErrorPayload = {
  message?: string;
  error?: string;
  errors?: Record<string, string[] | undefined>;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Unable to reach the authentication server.");
  }

  const payload = await response.json().catch(() => ({} as ApiErrorPayload));
  if (!response.ok) {
    const fieldErrors = payload.errors ? Object.values(payload.errors).flat().filter(Boolean) : [];
    throw new Error(fieldErrors[0] ?? payload.message ?? payload.error ?? "Authentication request failed.");
  }
  return payload as T;
};

export const authApi = {
  login: (email: string, password: string) => request<{ user: AuthUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),
  register: (username: string, email: string, password: string, confirmPassword: string) => request<{ user: AuthUser }>("/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password, confirmPassword }),
  }),
  me: () => request<{ user: AuthUser }>("/me"),
  logout: () => request<{ message: string }>("/logout", { method: "POST" }),
  checkUsername: (username: string) => request<{ available: boolean }>(`/check-username?username=${encodeURIComponent(username)}`),
};
