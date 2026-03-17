import type * as Party from "partykit/server";

import type {
  MultiplayerPlayerSnapshot,
  MultiplayerState,
  PartyClientMessage,
  PartyServerMessage,
  SnakeSegment,
} from "../src/lib/contracts";

const BOARD = { width: 16, height: 16 };
const COLORS = ["#74f7b2", "#ffd05f"];
const TICK_RATE_MS = 120;

type Direction = "up" | "down" | "left" | "right";

type PlayerRuntime = MultiplayerPlayerSnapshot & {
  direction: Direction;
  nextDirection: Direction;
};

function vector(direction: Direction) {
  return (
    {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    } as const
  )[direction];
}

function isOpposite(a: Direction, b: Direction) {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

export default class Server implements Party.Server {
  private players = new Map<string, PlayerRuntime>();
  private snakes = new Map<string, SnakeSegment[]>();
  private food: SnakeSegment | null = null;
  private status: MultiplayerState["status"] = "waiting";
  private countdownEndsAt: number | undefined;
  private winnerUserId: string | undefined;
  private resultLabel: string | undefined;
  private rematchVotes = new Set<string>();
  private readonly tickHandle: ReturnType<typeof setInterval>;

  constructor(readonly room: Party.Room) {
    this.tickHandle = setInterval(() => this.tick(), TICK_RATE_MS);
  }

  onConnect(connection: Party.Connection) {
    if (this.players.size >= 2) {
      connection.send(
        JSON.stringify({
          type: "error",
          message: "That room is already full.",
        } satisfies PartyServerMessage),
      );
      connection.close();
      return;
    }

    const player: PlayerRuntime = {
      connectionId: connection.id,
      userId: connection.id,
      username: `Guest ${this.players.size + 1}`,
      color: COLORS[this.players.size] ?? COLORS[0],
      score: 0,
      ready: false,
      alive: true,
      direction: this.players.size === 0 ? "right" : "left",
      nextDirection: this.players.size === 0 ? "right" : "left",
    };

    this.players.set(connection.id, player);
    connection.send(JSON.stringify(this.createStateMessage()));
    this.broadcastState();
  }

  onMessage(message: string, connection: Party.Connection) {
    const player = this.players.get(connection.id);
    if (!player) {
      return;
    }

    const payload = JSON.parse(message) as PartyClientMessage;

    if (payload.type === "join") {
      player.userId = payload.userId;
      player.username = payload.username;
    }

    if (payload.type === "ready") {
      player.ready = payload.ready;
      this.maybeStartCountdown();
    }

    if (payload.type === "input" && this.status === "running") {
      if (!isOpposite(player.direction, payload.direction)) {
        player.nextDirection = payload.direction;
      }
    }

    if (payload.type === "rematch") {
      this.rematchVotes.add(connection.id);
      if (
        this.players.size === 2 &&
        [...this.players.keys()].every((connectionId) =>
          this.rematchVotes.has(connectionId),
        )
      ) {
        this.resetRoom();
      }
    }

    this.broadcastState();
  }

  async onClose(connection: Party.Connection) {
    const player = this.players.get(connection.id);
    this.players.delete(connection.id);
    this.snakes.delete(connection.id);
    this.rematchVotes.delete(connection.id);

    if (player && this.status === "running" && this.players.size === 1) {
      const survivor = [...this.players.values()][0];
      if (survivor) {
        await this.finishMatch(survivor.userId, `${survivor.username} wins by forfeit`);
      }
    }

    if (this.players.size === 0) {
      clearInterval(this.tickHandle);
    }

    this.broadcastState();
  }

  private maybeStartCountdown() {
    if (
      this.status !== "waiting" ||
      this.players.size !== 2 ||
      ![...this.players.values()].every((player) => player.ready)
    ) {
      return;
    }

    this.status = "countdown";
    this.countdownEndsAt = Date.now() + 3000;
    this.broadcastState();

    setTimeout(() => {
      if (this.status === "countdown") {
        this.beginMatch();
      }
    }, 3000);
  }

  private beginMatch() {
    const [left, right] = [...this.players.values()];
    if (!left || !right) {
      this.status = "waiting";
      return;
    }

    this.status = "running";
    this.countdownEndsAt = undefined;
    this.winnerUserId = undefined;
    this.resultLabel = undefined;
    this.rematchVotes.clear();

    left.ready = false;
    right.ready = false;
    left.score = 0;
    right.score = 0;
    left.alive = true;
    right.alive = true;
    left.direction = "right";
    left.nextDirection = "right";
    right.direction = "left";
    right.nextDirection = "left";

    this.snakes.set(left.connectionId, [
      { x: 3, y: 8 },
      { x: 2, y: 8 },
      { x: 1, y: 8 },
    ]);
    this.snakes.set(right.connectionId, [
      { x: 12, y: 8 },
      { x: 13, y: 8 },
      { x: 14, y: 8 },
    ]);
    this.spawnFood();
    this.broadcastState();
  }

  private tick() {
    if (this.status !== "running") {
      return;
    }

    const players = [...this.players.values()];
    const nextHeads = new Map<string, SnakeSegment>();
    const eating = new Set<string>();
    const dead = new Set<string>();

    for (const player of players) {
      player.direction = player.nextDirection;
      const head = this.snakes.get(player.connectionId)?.[0];
      if (!head) {
        dead.add(player.connectionId);
        continue;
      }
      const delta = vector(player.direction);
      const nextHead = { x: head.x + delta.x, y: head.y + delta.y };
      nextHeads.set(player.connectionId, nextHead);

      if (this.food && nextHead.x === this.food.x && nextHead.y === this.food.y) {
        eating.add(player.connectionId);
      }
    }

    const occupancy = new Map<string, string>();
    for (const [connectionId, snake] of this.snakes.entries()) {
      const segments = eating.has(connectionId) ? snake : snake.slice(0, -1);
      for (const segment of segments) {
        occupancy.set(`${segment.x}:${segment.y}`, connectionId);
      }
    }

    const heads = [...nextHeads.entries()];
    for (const [connectionId, head] of heads) {
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= BOARD.width ||
        head.y >= BOARD.height ||
        occupancy.has(`${head.x}:${head.y}`)
      ) {
        dead.add(connectionId);
      }
    }

    if (heads.length === 2) {
      const [first, second] = heads;
      if (
        first[1].x === second[1].x &&
        first[1].y === second[1].y
      ) {
        dead.add(first[0]);
        dead.add(second[0]);
      }
    }

    for (const player of players) {
      const snake = this.snakes.get(player.connectionId) ?? [];
      if (dead.has(player.connectionId)) {
        player.alive = false;
        continue;
      }

      snake.unshift(nextHeads.get(player.connectionId)!);
      if (!eating.has(player.connectionId)) {
        snake.pop();
      } else {
        player.score += 1;
      }
      this.snakes.set(player.connectionId, snake);
    }

    if (eating.size > 0) {
      this.spawnFood();
    }

    const survivors = players.filter((player) => !dead.has(player.connectionId));
    if (survivors.length <= 1) {
      void this.finishMatch(
        survivors[0]?.userId,
        survivors[0]
          ? `${survivors[0].username} takes the round`
          : "Mutual destruction",
      );
      return;
    }

    this.broadcastState();
  }

  private createState(): MultiplayerState {
    return {
      roomCode: this.room.id.toUpperCase(),
      status: this.status,
      boardSize: BOARD,
      food: this.food,
      players: [...this.players.values()].map((player) => ({
        userId: player.userId,
        username: player.username,
        connectionId: player.connectionId,
        color: player.color,
        score: player.score,
        ready: player.ready,
        alive: player.alive,
      })),
      snakes: Object.fromEntries(this.snakes.entries()),
      countdownEndsAt: this.countdownEndsAt,
      winnerUserId: this.winnerUserId,
      resultLabel: this.resultLabel,
      winnerLabel: this.players.size
        ? [...this.players.values()].find((player) => player.userId === this.winnerUserId)
            ?.username
        : undefined,
    };
  }

  private createStateMessage(): PartyServerMessage {
    return {
      type: this.status === "finished" ? "gameOver" : "state",
      payload: this.createState(),
    };
  }

  private broadcastState() {
    this.room.broadcast(JSON.stringify(this.createStateMessage()));
  }

  private spawnFood() {
    let candidate: SnakeSegment;
    do {
      candidate = {
        x: Math.floor(Math.random() * BOARD.width),
        y: Math.floor(Math.random() * BOARD.height),
      };
    } while (
      [...this.snakes.values()].some((snake) =>
        snake.some((segment) => segment.x === candidate.x && segment.y === candidate.y),
      )
    );
    this.food = candidate;
  }

  private resetRoom() {
    this.status = "waiting";
    this.countdownEndsAt = undefined;
    this.winnerUserId = undefined;
    this.resultLabel = undefined;
    this.food = null;
    this.rematchVotes.clear();
    for (const player of this.players.values()) {
      player.ready = false;
      player.alive = true;
      player.score = 0;
    }
    this.snakes.clear();
    this.broadcastState();
  }

  private async finishMatch(
    winnerUserId: string | undefined,
    resultLabel: string,
  ) {
    if (this.status === "finished") {
      return;
    }

    this.status = "finished";
    this.winnerUserId = winnerUserId;
    this.resultLabel = resultLabel;
    this.broadcastState();

    const appUrl = process.env.APP_URL;
    const token = process.env.PARTYKIT_SERVER_TOKEN;
    if (!appUrl || !token) {
      return;
    }

    await fetch(`${appUrl}/api/multiplayer/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        gameId: "snake",
        roomCode: this.room.id.toUpperCase(),
        winnerUserId,
        result: resultLabel,
        summary: {
          status: this.status,
          finishedAt: Date.now(),
        },
        players: [...this.players.values()].map((player) => ({
          userId: player.userId,
          username: player.username,
          score: player.score,
        })),
      }),
    });
  }
}

Server satisfies Party.Worker;
