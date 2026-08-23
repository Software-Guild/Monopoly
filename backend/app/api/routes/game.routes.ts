import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { determineInitialOrder } from '../../engine/index.js';
import type { Decision } from '../../engine/index.js';
import { gameStore, type GameAction } from '../../game/gameRuntime.js';

const router = Router();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const asyncHandler = (handler: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };

const routeId = (id: string | string[] | undefined): string | undefined =>
  Array.isArray(id) ? id[0] : id;

const requireRuntime = (rawId: string | string[] | undefined) => {
  const id = routeId(rawId);
  if (!id) throw new Error('A game id is required');
  const runtime = gameStore.get(id);
  if (!runtime) {
    const error = new Error('Game not found');
    error.name = 'NotFoundError';
    throw error;
  }
  return runtime;
};

router.post('/order', (req: Request, res: Response) => {
  const playerIds = req.body?.playerIds;
  if (!Array.isArray(playerIds) || !playerIds.every((id) => typeof id === 'string')) {
    res.status(400).json({ success: false, message: 'playerIds must be an array of strings' });
    return;
  }
  res.json(determineInitialOrder(playerIds));
});

router.post('/', asyncHandler(async (req, res) => {
  const players = req.body?.players;
  if (
    !Array.isArray(players) ||
    !players.every((player) =>
      player && typeof player.id === 'string' && typeof player.name === 'string')
  ) {
    res.status(400).json({ success: false, message: 'players must contain id and name strings' });
    return;
  }
  const runtime = gameStore.create(randomUUID(), players);
  await runtime.start();
  res.status(201).json({ state: runtime.state });
}));

router.get('/:id', (req: Request, res: Response) => {
  const runtime = requireRuntime(req.params.id);
  res.json({ state: runtime.state });
});

router.post('/:id/decision', asyncHandler(async (req, res) => {
  const runtime = requireRuntime(req.params.id);
  const { playerId, decision } = req.body ?? {};
  if (typeof playerId !== 'string' || !decision || typeof decision.type !== 'string') {
    res.status(400).json({ success: false, message: 'playerId and decision are required' });
    return;
  }
  await runtime.submitDecision(playerId, decision as Decision);
  res.json({ state: runtime.state });
}));

router.post('/:id/end-turn', asyncHandler(async (req, res) => {
  const runtime = requireRuntime(req.params.id);
  if (typeof req.body?.playerId !== 'string') {
    res.status(400).json({ success: false, message: 'playerId is required' });
    return;
  }
  await runtime.endTurn(req.body.playerId);
  res.json({ state: runtime.state });
}));

router.post('/:id/action', asyncHandler(async (req, res) => {
  const runtime = requireRuntime(req.params.id);
  const action = req.body?.action;
  if (!action || typeof action.type !== 'string' || typeof action.playerId !== 'string') {
    res.status(400).json({ success: false, message: 'A typed action and playerId are required' });
    return;
  }
  await runtime.perform(action as GameAction);
  res.json({ state: runtime.state });
}));

router.delete('/:id', (req: Request, res: Response) => {
  res.status(gameStore.delete(routeId(req.params.id) ?? '') ? 204 : 404).end();
});

export default router;
