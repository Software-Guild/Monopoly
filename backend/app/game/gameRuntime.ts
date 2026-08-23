import {
  HumanAgent,
  acceptPendingTrade,
  advanceToNextPlayer,
  auction,
  buyBuilding,
  checkGameOver,
  createGameState,
  declareVoluntaryBankruptcy,
  declinePendingTrade,
  mortgageProperty,
  proposeTrade,
  randomRoller,
  sellBuilding,
  takeTurn,
  unmortgageProperty,
} from '../engine/index.js';
import type {
  Decision,
  NewPlayerInput,
} from '../engine/index.js';
import type { GameState, Pending, TradeSide } from '../models/index.js';

const MAX_ENGINE_TICKS = 100;

const nextTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export type GameAction =
  | { type: 'BUILD'; playerId: string; position: number }
  | { type: 'SELL_BUILDING'; playerId: string; position: number }
  | { type: 'MORTGAGE'; playerId: string; position: number }
  | { type: 'UNMORTGAGE'; playerId: string; position: number }
  | {
      type: 'PROPOSE_TRADE';
      playerId: string;
      recipientId: string;
      offered: TradeSide;
      requested: TradeSide;
    }
  | { type: 'ACCEPT_TRADE'; playerId: string }
  | { type: 'DECLINE_TRADE'; playerId: string }
  | { type: 'BANKRUPT'; playerId: string; creditorId?: string | null };

/**
 * Owns one live engine instance. The engine itself remains transport-free:
 * HumanAgent promises pause it at a decision and this class resumes that
 * exact promise when the matching HTTP request arrives.
 */
export class GameRuntime {
  readonly state: GameState;
  private readonly agents: Map<string, HumanAgent>;
  private turnPromise: Promise<void> | null = null;
  private turnError: Error | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(id: string, players: NewPlayerInput[]) {
    this.state = createGameState(id, players);
    this.agents = new Map(
      players.map((player) => [player.id, new HumanAgent(player.id)]),
    );
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.mutationQueue.then(operation, operation);
    this.mutationQueue = queued.then(() => undefined, () => undefined);
    return queued;
  }

  private assertHealthy(): void {
    if (this.turnError) {
      const error = this.turnError;
      this.turnError = null;
      throw error;
    }
  }

  private async waitForPause(previousPending: Pending | null): Promise<void> {
    for (let tick = 0; tick < MAX_ENGINE_TICKS; tick += 1) {
      this.assertHealthy();
      if (this.state.phase === 'FINISHED' || this.state.awaitingEndTurn) return;
      if (this.state.pending && this.state.pending !== previousPending) return;
      await nextTick();
    }
    throw new Error('The game engine did not reach its next decision');
  }

  private launchTurn(): void {
    if (this.turnPromise || this.state.phase !== 'IN_PROGRESS') return;
    this.launchEngineTask(() => takeTurn(this.state, this.agents, { roll: randomRoller }));
  }

  private launchEngineTask(task: () => Promise<void>): void {
    if (this.turnPromise || this.state.phase !== 'IN_PROGRESS') return;
    this.state.awaitingEndTurn = false;
    this.turnPromise = task()
      .then(() => {
        this.state.pending = null;
        if (!checkGameOver(this.state, { roll: randomRoller })) {
          this.state.awaitingEndTurn = true;
        }
      })
      .catch((error: unknown) => {
        this.turnError = error instanceof Error ? error : new Error(String(error));
      })
      .finally(() => {
        this.turnPromise = null;
      });
  }

  start(): Promise<GameState> {
    return this.enqueue(async () => {
      this.launchTurn();
      await this.waitForPause(null);
      return this.state;
    });
  }

  submitDecision(playerId: string, decision: Decision): Promise<GameState> {
    return this.enqueue(async () => {
      const pending = this.state.pending;
      if (!pending) throw new Error('The game is not waiting for a decision');
      if (pending.playerId !== playerId) throw new Error('That decision belongs to another player');
      const agent = this.agents.get(playerId);
      if (!agent || agent.awaiting !== pending) throw new Error('The engine is not waiting for that player');
      agent.submit(decision);
      await this.waitForPause(pending);
      return this.state;
    });
  }

  endTurn(playerId: string): Promise<GameState> {
    return this.enqueue(async () => {
      const current = this.state.players[this.state.currentPlayerIndex];
      if (!current || current.id !== playerId) throw new Error('Only the current player can end the turn');
      if (!this.state.awaitingEndTurn) throw new Error('The current turn is not ready to end');
      if (checkGameOver(this.state, { roll: randomRoller })) return this.state;
      this.state.awaitingEndTurn = false;
      advanceToNextPlayer(this.state);
      this.launchTurn();
      await this.waitForPause(null);
      return this.state;
    });
  }

  perform(action: GameAction): Promise<GameState> {
    return this.enqueue(async () => {
      switch (action.type) {
        case 'BUILD':
          this.assertBetweenRollActions(action.playerId);
          buyBuilding(this.state, action.playerId, action.position);
          break;
        case 'SELL_BUILDING':
          this.assertBetweenRollActions(action.playerId);
          sellBuilding(this.state, action.playerId, action.position);
          break;
        case 'MORTGAGE':
          this.assertBetweenRollActions(action.playerId);
          mortgageProperty(this.state, action.playerId, action.position);
          break;
        case 'UNMORTGAGE':
          this.assertBetweenRollActions(action.playerId);
          unmortgageProperty(this.state, action.playerId, action.position);
          break;
        case 'PROPOSE_TRADE':
          this.assertTradeWindow(action.playerId);
          proposeTrade(
            this.state,
            action.playerId,
            action.recipientId,
            action.offered,
            action.requested,
          );
          break;
        case 'ACCEPT_TRADE':
          acceptPendingTrade(this.state, action.playerId);
          this.state.awaitingEndTurn = true;
          break;
        case 'DECLINE_TRADE':
          declinePendingTrade(this.state, action.playerId);
          this.state.awaitingEndTurn = true;
          break;
        case 'BANKRUPT':
          await this.cancelActiveTurn('The player declared bankruptcy');
          {
            const result = declareVoluntaryBankruptcy(this.state, action.playerId, action.creditorId ?? null);
            if (checkGameOver(this.state, { roll: randomRoller })) break;
            if (result.toAuction.length > 0) {
              this.launchEngineTask(async () => {
                for (const position of result.toAuction) {
                  await auction(this.state, position, this.agents);
                }
              });
              await this.waitForPause(null);
              break;
            }
            this.state.awaitingEndTurn = true;
          }
          break;
      }
      return this.state;
    });
  }

  private assertBetweenRollActions(playerId: string): void {
    const current = this.state.players[this.state.currentPlayerIndex];
    if (!this.state.awaitingEndTurn || this.state.pending) {
      throw new Error('That action is only available after the turn has resolved');
    }
    if (!current || current.id !== playerId) throw new Error('That action belongs to the current player');
  }

  private assertTradeWindow(playerId: string): void {
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (!this.state.awaitingEndTurn || this.state.pending) {
      throw new Error('Trades are only available after the current move has resolved');
    }
    if (!player || player.bankrupt) throw new Error('That player cannot propose a trade');
  }

  private async cancelActiveTurn(reason: string): Promise<void> {
    if (!this.turnPromise) return;
    for (const agent of this.agents.values()) agent.cancel(reason);
    await this.turnPromise;
    this.turnError = null;
    this.state.pending = null;
  }
}

export class GameStore {
  private readonly games = new Map<string, GameRuntime>();

  create(id: string, players: NewPlayerInput[]): GameRuntime {
    const runtime = new GameRuntime(id, players);
    this.games.set(id, runtime);
    return runtime;
  }

  get(id: string): GameRuntime | undefined {
    return this.games.get(id);
  }

  delete(id: string): boolean {
    return this.games.delete(id);
  }
}

export const gameStore = new GameStore();
