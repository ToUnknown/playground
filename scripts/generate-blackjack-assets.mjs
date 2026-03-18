import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CARD_DIR = path.join(ROOT, "public/blackjack-gameboy-assets/cards");
const BACK_PATH = path.join(ROOT, "public/blackjack-gameboy-assets/back.svg");

const CARD_WIDTH = 42;
const CARD_HEIGHT = 58;
const CARD_CENTER_X = 21;
const CARD_CENTER_Y = 29;

const SUITS = ["clubs", "diamonds", "hearts", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const SUIT_CODES = {
  clubs: "c",
  diamonds: "d",
  hearts: "h",
  spades: "s",
};

const RANK_CODES = {
  A: "a",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "j",
  Q: "q",
  K: "k",
};

const SUIT_SYMBOLS = {
  clubs: "&#9827;",
  diamonds: "&#9830;",
  hearts: "&#9829;",
  spades: "&#9824;",
};

const COLORS = {
  shadow: "#0f380f",
  border: "#306230",
  rim: "#8fa319",
  face: "#c6cfa1",
  faceInset: "#dce6b3",
  shine: "#eff7c8",
  suitDark: "#0f380f",
  suitWarm: "#5d7631",
};

const CENTER_SUIT_LAYOUTS = {
  clubs: { x: 19.8, y: 30.5, size: 24 },
  diamonds: { x: 19.8, y: 30.3, size: 22 },
  hearts: { x: 19.8, y: 30.6, size: 23 },
  spades: { x: 19.8, y: 30.5, size: 24 },
};

function suitColor(suit) {
  return suit === "hearts" || suit === "diamonds" ? COLORS.suitWarm : COLORS.suitDark;
}

function roundedRect(x, y, width, height, rx, fill, stroke = null, strokeWidth = 0) {
  const attrs = [`x="${x}"`, `y="${y}"`, `width="${width}"`, `height="${height}"`, `rx="${rx}"`, `fill="${fill}"`];
  if (stroke) {
    attrs.push(`stroke="${stroke}"`, `stroke-width="${strokeWidth}"`);
  }
  return `<rect ${attrs.join(" ")}/>`;
}

function text(content, x, y, options = {}) {
  const {
    size = 8,
    fill = COLORS.suitDark,
    anchor = "start",
    weight = 700,
    family = "Helvetica, sans-serif",
    baseline = "middle",
    letterSpacing,
  } = options;
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${family}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    `text-anchor="${anchor}"`,
    `dominant-baseline="${baseline}"`,
  ];
  if (letterSpacing !== undefined) {
    attrs.push(`letter-spacing="${letterSpacing}"`);
  }
  return `<text ${attrs.join(" ")}>${content}</text>`;
}

function cardFrame() {
  return [
    roundedRect(2, 2, 38, 54, 3, COLORS.shadow),
    roundedRect(1, 1, 38, 54, 3, COLORS.border),
    roundedRect(2, 2, 36, 52, 2, COLORS.face),
    roundedRect(4, 4, 32, 48, 1.5, COLORS.faceInset, COLORS.rim, 1),
    roundedRect(4.5, 4.5, 31, 1, 0.5, COLORS.shine),
  ].join("");
}

function topLeftRank(rank, suit) {
  const color = suitColor(suit);
  const rankSize = rank === "10" ? 6.6 : 8;
  return text(rank, rank === "10" ? 5.2 : 6.4, 11.0, {
    size: rankSize,
    fill: color,
    weight: 800,
    family: "Helvetica, sans-serif",
  });
}

function bottomRightRank(rank, suit) {
  const color = suitColor(suit);
  const rankSize = rank === "10" ? 6.6 : 8;
  return text(rank, 33.2, 50.4, {
    size: rankSize,
    fill: color,
    weight: 800,
    family: "Helvetica, sans-serif",
    anchor: "end",
    baseline: "alphabetic",
  });
}

function centerSuitBody(suit) {
  const color = suitColor(suit);
  const layout = CENTER_SUIT_LAYOUTS[suit];
  return [
    text(SUIT_SYMBOLS[suit], layout.x, layout.y, {
      size: layout.size,
      fill: color,
      anchor: "middle",
      family: "Times New Roman, Georgia, serif",
      weight: 700,
    }),
  ].join("");
}

function buildCard(rank, suit) {
  const body = centerSuitBody(suit);
  const topCorner = topLeftRank(rank, suit);
  const bottomCorner = bottomRightRank(rank, suit);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    cardFrame(),
    topCorner,
    bottomCorner,
    body,
    "</svg>",
  ].join("");
}

function buildBack() {
  const stripes = [];
  for (let offset = -16; offset <= 40; offset += 6) {
    stripes.push(`<path d="M ${offset} 47 L ${offset + 18} 9" stroke="${offset % 12 === 0 ? COLORS.rim : COLORS.border}" stroke-width="2"/>`);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    '<defs><clipPath id="card-back-panel"><rect x="6" y="6" width="28" height="44" rx="1.5"/></clipPath></defs>',
    cardFrame(),
    roundedRect(6, 6, 28, 44, 1.5, COLORS.face, COLORS.rim, 1),
    `<g clip-path="url(#card-back-panel)">${stripes.join("")}</g>`,
    "</svg>",
  ].join("");
}

function main() {
  mkdirSync(CARD_DIR, { recursive: true });

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const filePath = path.join(CARD_DIR, `${SUIT_CODES[suit]}-${RANK_CODES[rank]}.svg`);
      writeFileSync(filePath, buildCard(rank, suit));
    }
  }

  writeFileSync(BACK_PATH, buildBack());
}

main();
