"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { GameboyControlPulse } from "@/components/arcade/gameboy-games";
import {
  getBlackjackCardAssetKey,
  loadGameboyBlackjackAssets,
  type BlackjackRank,
  type BlackjackSuit,
  type GameboyBlackjackAssets,
} from "@/games/blackjack/gameboy-blackjack-assets";
import { useScoreSave } from "@/games/shared/use-score-save";
import {
  GAMEBOY_TETRIS_DARK,
  GAMEBOY_TETRIS_LIGHT,
} from "@/games/tetris/gameboy-tetris-theme";
import type { SessionUser, SoloGameResult } from "@/lib/contracts";
import {
  configureGameboyScreenCanvas,
  GAMEBOY_SCREEN_BACKING_HEIGHT,
  GAMEBOY_SCREEN_BACKING_WIDTH,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
} from "@/lib/gameboy-screen";

type ArcadeGameboyBlackjackProps = {
  controlPulse: GameboyControlPulse | null;
  sessionUser: SessionUser | null;
  onExit: () => void;
  ignoredPulseSeq?: number | null;
};

type BlackjackCard = {
  suit: BlackjackSuit;
  rank: BlackjackRank;
  assetKey: string;
};

type BlackjackPhase = "splash" | "betting" | "playerTurn" | "dealerTurn" | "roundEnd" | "bankEmpty";
type RoundOutcome = "win" | "lose" | "push" | "blackjack" | "bust" | null;

type BlackjackState = {
  bank: number;
  bet: number;
  phase: BlackjackPhase;
  playerHand: BlackjackCard[];
  dealerHand: BlackjackCard[];
  outcome: RoundOutcome;
  delta: number;
  handsPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  resolvedSeq: number;
};

const SCREEN_WIDTH = GAMEBOY_SCREEN_WIDTH;
const SCREEN_HEIGHT = GAMEBOY_SCREEN_HEIGHT;
const FONT_FAMILY = '"Gameboy Tetris", "IBM Plex Sans", monospace';
const MIN_BET = 10;
const START_BANK = 100;
const CARD_WIDTH = 54;
const CARD_HEIGHT = 74;
const SCREEN_BG = GAMEBOY_TETRIS_DARK;
const SCREEN_DEEP = "#0f380f";
const SCREEN_PANEL = GAMEBOY_TETRIS_LIGHT;
const HINT_TOP = 18;
const HINT_LEFT = 14;
const HINT_CENTER = SCREEN_WIDTH / 2;
const HINT_RIGHT = SCREEN_WIDTH - 14;
const DEALER_ROW_Y = 56;
const PLAYER_ROW_Y = 146;
const HUD_LABEL_Y = SCREEN_HEIGHT - 38;
const HUD_VALUE_Y = SCREEN_HEIGHT - 16;
const BALANCE_X = 14;
const BET_VALUE_RIGHT = SCREEN_WIDTH - 44;
const BET_LABEL_X = BET_VALUE_RIGHT;
const BET_ARROW_X = SCREEN_WIDTH - 22;
const SUITS: BlackjackSuit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: BlackjackRank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES: Record<BlackjackRank, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
};

function createInitialState(bank = START_BANK, showSplash = true): BlackjackState {
  const normalizedBank = Math.max(0, Math.floor(bank));
  const bet = clampBet(MIN_BET, normalizedBank);

  return {
    bank: normalizedBank,
    bet,
    phase: normalizedBank < MIN_BET ? "bankEmpty" : showSplash ? "splash" : "betting",
    playerHand: [],
    dealerHand: [],
    outcome: null,
    delta: 0,
    handsPlayed: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    resolvedSeq: 0,
  };
}

function clampBet(bet: number, bank: number) {
  if (bank < MIN_BET) {
    return Math.max(0, bank);
  }

  return Math.max(MIN_BET, Math.min(bank, bet));
}

function drawRandomCard(): BlackjackCard {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]!;
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)]!;
  return {
    suit,
    rank,
    assetKey: getBlackjackCardAssetKey(suit, rank),
  };
}

function getHandValue(hand: BlackjackCard[]) {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    total += RANK_VALUES[card.rank];
    if (card.rank === "A") {
      aces += 1;
    }
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isBlackjack(hand: BlackjackCard[]) {
  return hand.length === 2 && getHandValue(hand) === 21;
}

function compareHands(
  playerHand: BlackjackCard[],
  dealerHand: BlackjackCard[],
): Exclude<RoundOutcome, null | "blackjack" | "bust"> {
  const playerTotal = getHandValue(playerHand);
  const dealerTotal = getHandValue(dealerHand);

  if (dealerTotal > 21) {
    return "win";
  }
  if (playerTotal > dealerTotal) {
    return "win";
  }
  if (playerTotal < dealerTotal) {
    return "lose";
  }

  return "push";
}

function settleRound(
  state: BlackjackState,
  outcome: Exclude<RoundOutcome, null>,
): BlackjackState {
  const delta =
    outcome === "blackjack"
      ? Math.round(state.bet * 2.5)
      : outcome === "win"
        ? state.bet * 2
        : outcome === "push"
          ? state.bet
          : 0;
  const bank = Math.max(0, state.bank + delta);
  const wins = state.wins + (outcome === "win" || outcome === "blackjack" ? 1 : 0);
  const losses = state.losses + (outcome === "lose" || outcome === "bust" ? 1 : 0);
  const pushes = state.pushes + (outcome === "push" ? 1 : 0);

  return {
    ...state,
    bank,
    bet: clampBet(state.bet, bank),
    phase: bank < MIN_BET ? "bankEmpty" : "roundEnd",
    outcome,
    delta,
    handsPlayed: state.handsPlayed + 1,
    wins,
    losses,
    pushes,
    resolvedSeq: state.resolvedSeq + 1,
  };
}

function startRound(state: BlackjackState): BlackjackState {
  if (state.bank < MIN_BET) {
    return {
      ...state,
      phase: "bankEmpty" as const,
      playerHand: [],
      dealerHand: [],
      outcome: null,
      delta: 0,
    };
  }

  const bet = clampBet(state.bet, state.bank);
  const bank = Math.max(0, state.bank - bet);
  const playerHand = [drawRandomCard(), drawRandomCard()];
  const dealerHand = [drawRandomCard(), drawRandomCard()];
  const nextState: BlackjackState = {
    ...state,
    bank,
    bet,
    phase: "playerTurn",
    playerHand,
    dealerHand,
    outcome: null,
    delta: 0,
  };

  const playerBlackjack = isBlackjack(playerHand);
  const dealerBlackjack = isBlackjack(dealerHand);

  if (!playerBlackjack && !dealerBlackjack) {
    return nextState;
  }

  if (playerBlackjack && dealerBlackjack) {
    return settleRound(nextState, "push");
  }

  return settleRound(nextState, playerBlackjack ? "blackjack" : "lose");
}

function stepDealerTurn(state: BlackjackState): BlackjackState {
  if (state.phase !== "dealerTurn") {
    return state;
  }

  if (getHandValue(state.dealerHand) < 17) {
    return {
      ...state,
      dealerHand: [...state.dealerHand, drawRandomCard()],
    };
  }

  return settleRound(state, compareHands(state.playerHand, state.dealerHand));
}

function clearRound(state: BlackjackState): BlackjackState {
  return {
    ...state,
    phase: "betting",
    playerHand: [],
    dealerHand: [],
    outcome: null,
    delta: 0,
  };
}

function enterDealerTurn(
  state: BlackjackState,
  playerHand: BlackjackCard[] = state.playerHand,
): BlackjackState {
  return {
    ...state,
    playerHand,
    phase: "dealerTurn",
  };
}

function getOverlayContent(state: BlackjackState) {
  if (state.phase === "bankEmpty") {
    return {
      title: "BANK EMPTY",
      subtitle: "PRESS START TO RESET",
    };
  }

  if (state.phase !== "roundEnd") {
    return null;
  }

  if (state.outcome === "blackjack") {
    return { title: "BLACKJACK" };
  }
  if (state.outcome === "win") {
    return { title: "YOU WIN" };
  }
  if (state.outcome === "push") {
    return { title: "PUSH" };
  }
  if (state.outcome === "bust") {
    return { title: "BUST" };
  }
  if (state.outcome === "lose") {
    return { title: "DEALER WINS" };
  }

  return null;
}

function getPromptText(state: BlackjackState) {
  if (state.phase === "splash") {
    return ["START PLAY", "BLACKJACK", "SELECT MENU"];
  }
  if (state.phase === "betting") {
    return ["START DEAL", "", "UP/DOWN BET"];
  }
  if (state.phase === "playerTurn") {
    return ["A HIT", "B STAND", "Z ZOOM"];
  }
  if (state.phase === "dealerTurn") {
    return ["DEALER PLAYING", "PLEASE WAIT"];
  }
  if (state.phase === "roundEnd") {
    return ["START NEXT", "SELECT MENU"];
  }

  return ["START RESET", "SELECT MENU"];
}

function formatBank(bank: number) {
  return `$${Math.max(0, Math.floor(bank))}`;
}

function getHudFontSize(value: string) {
  if (value.length >= 11) {
    return 8;
  }
  if (value.length >= 9) {
    return 10;
  }
  if (value.length >= 8) {
    return 12;
  }
  return 16;
}

function drawHintRow(context: CanvasRenderingContext2D, prompts: string[]) {
  context.fillStyle = SCREEN_PANEL;
  context.font = `8px ${FONT_FAMILY}`;
  context.textAlign = "left";
  context.fillText(prompts[0] ?? "", HINT_LEFT, HINT_TOP);
  context.textAlign = "center";
  context.fillText(prompts[1] ?? "", HINT_CENTER, HINT_TOP);
  context.textAlign = "right";
  context.fillText(prompts[2] ?? "", HINT_RIGHT, HINT_TOP);
  context.textAlign = "left";
}

function drawCenterPrompt(context: CanvasRenderingContext2D, label: string) {
  context.fillStyle = SCREEN_PANEL;
  context.font = `14px ${FONT_FAMILY}`;
  context.textAlign = "center";
  context.fillText(label, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
  context.textAlign = "left";
}

function drawHudLabel(context: CanvasRenderingContext2D, label: string, x: number, align: CanvasTextAlign) {
  context.fillStyle = SCREEN_PANEL;
  context.font = `8px ${FONT_FAMILY}`;
  context.textAlign = align;
  context.fillText(label, x, HUD_LABEL_Y);
  context.textAlign = "left";
}

function drawBalance(context: CanvasRenderingContext2D, bank: number, ready: boolean) {
  const bankText = ready ? formatBank(bank) : "$0000";
  const fontSize = getHudFontSize(bankText);
  drawHudLabel(context, "BALANCE", BALANCE_X, "left");
  context.fillStyle = SCREEN_PANEL;
  context.font = `${fontSize}px ${FONT_FAMILY}`;
  context.textAlign = "left";
  context.fillText(bankText, BALANCE_X, HUD_VALUE_Y);
}

function drawBet(context: CanvasRenderingContext2D, bet: number) {
  const betText = formatBank(bet);
  const fontSize = getHudFontSize(betText);
  drawHudLabel(context, "BET", BET_LABEL_X, "right");
  context.fillStyle = SCREEN_PANEL;
  context.font = `${fontSize}px ${FONT_FAMILY}`;
  context.textAlign = "right";
  context.fillText(betText, BET_VALUE_RIGHT, HUD_VALUE_Y);
  context.textAlign = "left";
}

function drawBetArrows(context: CanvasRenderingContext2D) {
  context.fillStyle = SCREEN_PANEL;
  context.beginPath();
  context.moveTo(BET_ARROW_X - 4, HUD_VALUE_Y - 14);
  context.lineTo(BET_ARROW_X + 4, HUD_VALUE_Y - 14);
  context.lineTo(BET_ARROW_X, HUD_VALUE_Y - 20);
  context.closePath();
  context.fill();

  context.beginPath();
  context.moveTo(BET_ARROW_X - 4, HUD_VALUE_Y - 2);
  context.lineTo(BET_ARROW_X + 4, HUD_VALUE_Y - 2);
  context.lineTo(BET_ARROW_X, HUD_VALUE_Y + 4);
  context.closePath();
  context.fill();
}

function drawHand(
  context: CanvasRenderingContext2D,
  assets: GameboyBlackjackAssets,
  hand: BlackjackCard[],
  top: number,
  hiddenSecondCard: boolean,
) {
  if (!hand.length) {
    return;
  }

  const spread = hand.length >= 5 ? 22 : hand.length >= 4 ? 26 : 30;
  const width = CARD_WIDTH + Math.max(0, hand.length - 1) * spread;
  const startX = Math.round((SCREEN_WIDTH - width) / 2);

  hand.forEach((card, index) => {
    const x = startX + index * spread;
    const y = top + Math.abs(index - (hand.length - 1) / 2) * 3;
    const image =
      hiddenSecondCard && index === 1
        ? assets.back
        : assets.faces[card.assetKey] ?? assets.back;

    context.drawImage(image, x, y, CARD_WIDTH, CARD_HEIGHT);
  });
}

function drawHandTotal(
  context: CanvasRenderingContext2D,
  total: number,
  y: number,
) {
  context.fillStyle = SCREEN_PANEL;
  context.font = `10px ${FONT_FAMILY}`;
  context.textAlign = "center";
  context.fillText(`${total}`, SCREEN_WIDTH / 2, y);
  context.textAlign = "left";
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  title: string,
  subtitle?: string,
) {
  context.fillStyle = "rgba(198, 207, 161, 0.94)";
  context.fillRect(64, 111, 192, 66);
  context.strokeStyle = SCREEN_DEEP;
  context.lineWidth = 2;
  context.strokeRect(64.5, 111.5, 191, 65);

  context.fillStyle = SCREEN_DEEP;
  context.textAlign = "center";
  context.font = `15px ${FONT_FAMILY}`;
  context.fillText(title, SCREEN_WIDTH / 2, subtitle ? 138 : 147);

  if (subtitle) {
    context.font = `10px ${FONT_FAMILY}`;
    context.fillText(subtitle, SCREEN_WIDTH / 2, 156);
  }
}

function drawTiltedSplashCard(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
) {
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(rotation);
  context.beginPath();
  context.roundRect(-width / 2, -height / 2, width, height, 6);
  context.clip();
  context.fillStyle = "#dce6b3";
  context.fillRect(-width / 2, -height / 2, width, height);
  context.drawImage(image, 3, 3, 34, 50, -width / 2, -height / 2, width, height);
  context.restore();
}

function drawBlackjackSplash(
  context: CanvasRenderingContext2D,
  assets: GameboyBlackjackAssets | null,
) {
  const aceKey = getBlackjackCardAssetKey("spades", "A");
  const kingKey = getBlackjackCardAssetKey("diamonds", "K");
  const aceCard = assets?.faces[aceKey] ?? null;
  const kingCard = assets?.faces[kingKey] ?? null;

  context.fillStyle = SCREEN_BG;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.fillStyle = SCREEN_PANEL;
  context.textAlign = "center";
  context.font = `30px ${FONT_FAMILY}`;
  context.textBaseline = "middle";
  context.fillText("BLACKJACK", SCREEN_WIDTH / 2, 80);

  context.fillStyle = "rgba(15, 56, 15, 0.3)";
  context.fillRect(90, 188, 136, 8);

  if (kingCard) {
    drawTiltedSplashCard(context, kingCard, 94, 120, 74, 102, -0.08);
  }
  if (aceCard) {
    drawTiltedSplashCard(context, aceCard, 146, 110, 80, 110, 0.06);
  }

  context.fillStyle = SCREEN_PANEL;
  context.font = `12px ${FONT_FAMILY}`;
  context.fillText("START", SCREEN_WIDTH / 2, 240);
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
}

function drawBlackjackScene(
  context: CanvasRenderingContext2D,
  assets: GameboyBlackjackAssets | null,
  state: BlackjackState,
  bankReady: boolean,
) {
  if (state.phase === "splash") {
    drawBlackjackSplash(context, assets);
    return;
  }

  context.fillStyle = SCREEN_BG;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawHintRow(context, getPromptText(state));
  drawBalance(context, state.bank, bankReady);
  drawBet(context, state.bet);

  if (state.phase === "betting") {
    drawBetArrows(context);
    drawCenterPrompt(context, "PLACE YOUR BET");
  }

  if (assets) {
    drawHand(context, assets, state.dealerHand, DEALER_ROW_Y, state.phase === "playerTurn");
    drawHand(context, assets, state.playerHand, PLAYER_ROW_Y, false);
  }

  if (state.playerHand.length > 0) {
    drawHandTotal(context, getHandValue(state.playerHand), PLAYER_ROW_Y + CARD_HEIGHT + 16);
  }

  const overlay = getOverlayContent(state);
  if (overlay) {
    drawOverlay(context, overlay.title, overlay.subtitle);
  }
}

export function ArcadeGameboyBlackjack({
  controlPulse,
  sessionUser,
  onExit,
  ignoredPulseSeq,
}: ArcadeGameboyBlackjackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPulseRef = useRef<number | null>(ignoredPulseSeq ?? null);
  const dealerTimerRef = useRef<number | null>(null);
  const runStartedAtRef = useRef(0);
  const handledResolutionRef = useRef(0);
  const lastSavedBankRef = useRef<number | null>(null);
  const latestBankRef = useRef(START_BANK);
  const latestPhaseRef = useRef<BlackjackPhase>("splash");
  const [assets, setAssets] = useState<GameboyBlackjackAssets | null>(null);
  const [bankReady, setBankReady] = useState(sessionUser === null);
  const [submissionResult, setSubmissionResult] = useState<SoloGameResult | null>(null);
  const [submissionResetKey, setSubmissionResetKey] = useState(0);
  const [state, setState] = useState<BlackjackState>(() => createInitialState());

  useScoreSave({
    manifestId: "blackjack",
    sessionUser,
    result: submissionResult,
    resetKey: submissionResetKey,
  });

  useEffect(() => {
    latestBankRef.current = state.bank;
    latestPhaseRef.current = state.phase;
  }, [state.bank, state.phase]);

  const persistBank = useEffectEvent((bank: number, keepalive = false) => {
    if (!sessionUser || lastSavedBankRef.current === bank) {
      return;
    }

    lastSavedBankRef.current = bank;
    void fetch("/api/blackjack-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank }),
      keepalive,
    }).catch(() => undefined);
  });

  useEffect(() => {
    let cancelled = false;

    if (!runStartedAtRef.current) {
      runStartedAtRef.current = Date.now();
    }

    void loadGameboyBlackjackAssets().then((loadedAssets) => {
      if (!cancelled) {
        setAssets(loadedAssets);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      return;
    }

    let cancelled = false;

    void fetch("/api/blackjack-bank", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load blackjack bank.");
        }

        const payload = (await response.json()) as { bank?: unknown };
        const bank =
          typeof payload.bank === "number" && Number.isFinite(payload.bank) ? payload.bank : START_BANK;

        if (cancelled) {
          return;
        }

        lastSavedBankRef.current = bank;
        setState(createInitialState(bank, true));
        setBankReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        lastSavedBankRef.current = START_BANK;
        setState(createInitialState(START_BANK, true));
        setBankReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  useEffect(() => {
    return () => {
      if (
        latestPhaseRef.current === "playerTurn" ||
        latestPhaseRef.current === "dealerTurn"
      ) {
        persistBank(latestBankRef.current, true);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);
    context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawBlackjackScene(context, assets, state, bankReady);
  }, [assets, bankReady, state]);

  useEffect(() => {
    if (state.phase !== "dealerTurn") {
      if (dealerTimerRef.current) {
        window.clearTimeout(dealerTimerRef.current);
        dealerTimerRef.current = null;
      }
      return;
    }

    dealerTimerRef.current = window.setTimeout(() => {
      setState((current) => stepDealerTurn(current));
    }, 420);

    return () => {
      if (dealerTimerRef.current) {
        window.clearTimeout(dealerTimerRef.current);
        dealerTimerRef.current = null;
      }
    };
  }, [state.phase, state.dealerHand]);

  useEffect(() => {
    if (!state.resolvedSeq || handledResolutionRef.current === state.resolvedSeq) {
      return;
    }

    handledResolutionRef.current = state.resolvedSeq;

    if (!state.outcome || state.outcome === "push") {
      return;
    }

    setSubmissionResult({
      score: state.bank,
      durationMs: Date.now() - runStartedAtRef.current,
      stats: {
        outcome: state.outcome,
        bank: state.bank,
        bet: state.bet,
        handsPlayed: state.handsPlayed,
        wins: state.wins,
        losses: state.losses,
        pushes: state.pushes,
        playerTotal: getHandValue(state.playerHand),
        dealerTotal: getHandValue(state.dealerHand),
      },
    });
    setSubmissionResetKey((value) => value + 1);

    persistBank(state.bank);
  }, [state]);

  const handleControlPulse = useEffectEvent((pulse: GameboyControlPulse) => {
    if (!bankReady) {
      return;
    }

    if (pulse.button === "select") {
      if (state.phase !== "betting") {
        persistBank(state.bank, true);
      }
      onExit();
      return;
    }

    if (pulse.button === "up") {
      setState((current) => {
        if (current.phase !== "betting") {
          return current;
        }

        return {
          ...current,
          bet: clampBet(current.bet + 10, current.bank),
        };
      });
      return;
    }

    if (pulse.button === "down") {
      setState((current) => {
        if (current.phase !== "betting") {
          return current;
        }

        return {
          ...current,
          bet: clampBet(current.bet - 10, current.bank),
        };
      });
      return;
    }

    if (pulse.button === "start") {
      if (state.phase === "bankEmpty") {
        latestBankRef.current = START_BANK;
        latestPhaseRef.current = "betting";
        runStartedAtRef.current = Date.now();
        handledResolutionRef.current = 0;
        setSubmissionResult(null);
        persistBank(START_BANK, true);
        setState(createInitialState(START_BANK, false));
        return;
      }

      setState((current) => {
        if (current.phase === "splash") {
          return {
            ...current,
            phase: "betting",
          };
        }

        if (current.phase === "betting") {
          return startRound(current);
        }

        if (current.phase === "roundEnd") {
          return clearRound(current);
        }

        return current;
      });
      return;
    }

    if (pulse.button === "a") {
      setState((current) => {
        if (current.phase !== "playerTurn") {
          return current;
        }

        const playerHand = [...current.playerHand, drawRandomCard()];
        if (getHandValue(playerHand) > 21) {
          return settleRound(
            {
              ...current,
              playerHand,
            },
            "bust",
          );
        }

        if (getHandValue(playerHand) === 21) {
          return enterDealerTurn(current, playerHand);
        }

        return {
          ...current,
          playerHand,
        };
      });
      return;
    }

    if (pulse.button === "b") {
      setState((current) => {
        if (current.phase !== "playerTurn") {
          return current;
        }

        return enterDealerTurn(current);
      });
    }
  });

  useEffect(() => {
    if (!controlPulse || lastPulseRef.current === controlPulse.seq || !controlPulse.pressed) {
      return;
    }

    lastPulseRef.current = controlPulse.seq;
    handleControlPulse(controlPulse);
  }, [controlPulse]);

  return (
    <canvas
      ref={canvasRef}
      width={GAMEBOY_SCREEN_BACKING_WIDTH}
      height={GAMEBOY_SCREEN_BACKING_HEIGHT}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        background: SCREEN_BG,
      }}
    />
  );
}
