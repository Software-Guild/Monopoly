import type { BackendOrderResult, BackendSnapshot } from "../types/backend";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/game${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Game request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const gameApi = {
  order: (playerIds: string[]) => request<BackendOrderResult>("/order", {
    method: "POST",
    body: JSON.stringify({ playerIds }),
  }),
  create: (players: Array<{ id: string; name: string }>) => request<BackendSnapshot>("", {
    method: "POST",
    body: JSON.stringify({ players }),
  }),
  decision: (gameId: string, playerId: string, decision: object) => request<BackendSnapshot>(`/${gameId}/decision`, {
    method: "POST",
    body: JSON.stringify({ playerId, decision }),
  }),
  endTurn: (gameId: string, playerId: string) => request<BackendSnapshot>(`/${gameId}/end-turn`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  }),
  action: (gameId: string, action: object) => request<BackendSnapshot>(`/${gameId}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  }),
};
