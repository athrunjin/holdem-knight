import { t } from "@/i18n";
/**
 * Draws the settlement result as a PNG. It uses Canvas directly because the content is only text and lines,
 * so no DOM screenshot library is needed; those tend to lose fonts on iOS Safari.
 */
export interface SettlementImageData {
  title: string;
  subtitle: string;
  /** One line each: how a chip difference was handled, and who took the insurance result. */
  notes: readonly string[];
  transferTitle: string;
  transfers: readonly { from: string; to: string; amount: string }[];
  results: readonly {
    name: string;
    hands: string;
    chips: string;
    net: string;
    amount: string;
    /** Above 0 for a win, below 0 for a loss. */
    outcome: number;
  }[];
}

// The image ignores the system theme and always uses the dark table colors
const COLOR = {
  bg: "#13241e",
  row: "#1a3129",
  text: "#e7ede9",
  muted: "#93a59d",
  gold: "#d6b04c",
  win: "#5cc79f",
  loss: "#ef8a7f",
};

const WIDTH = 1080;
const PADDING = 64;
const ROW_HEIGHT = 104;
const ROW_GAP = 16;
const TRANSFER_NAME_MAX_WIDTH = 270;
const RESULT_NAME_MAX_WIDTH = 230;
const RESULT_HEADER_HEIGHT = 56;
const NOTE_HEIGHT = 56;
/** Right edge of each result column. */
const COLUMN = { hands: 390, chips: 535, net: 700, amount: WIDTH - PADDING - 36 };

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && ctx.measureText(`${chars.join("")}…`).width > maxWidth) chars.pop();
  return `${chars.join("")}…`;
}

function roundedRow(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = COLOR.row;
  ctx.beginPath();
  ctx.roundRect(PADDING, y, WIDTH - PADDING * 2, ROW_HEIGHT, 20);
  ctx.fill();
}

export async function renderSettlementImage(data: SettlementImageData): Promise<Blob> {
  await document.fonts.ready;

  const sections = (data.transfers.length > 0 ? 1 : 0) + 1;
  const rows = data.transfers.length + data.results.length;
  const height =
    240 +
    sections * 84 +
    RESULT_HEADER_HEIGHT +
    rows * (ROW_HEIGHT + ROW_GAP) +
    data.notes.length * NOTE_HEIGHT +
    PADDING -
    ROW_GAP;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create canvas");
  const ctx = context;
  const family = getComputedStyle(document.body).fontFamily;
  const font = (size: number, weight = 500) => `${weight} ${size}px ${family}`;

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "middle";

  ctx.fillStyle = COLOR.gold;
  ctx.fillRect(0, 0, WIDTH, 12);

  ctx.fillStyle = COLOR.text;
  ctx.font = font(64, 700);
  ctx.fillText(data.title, PADDING, 120);
  ctx.fillStyle = COLOR.muted;
  ctx.font = font(36);
  ctx.fillText(data.subtitle, PADDING, 192);

  let y = 240;

  function heading(text: string) {
    y += 40;
    ctx.fillStyle = COLOR.text;
    ctx.font = font(40, 600);
    ctx.fillText(text, PADDING, y);
    y += 44;
  }

  function amountAtRight(text: string, rowCenter: number, color: string) {
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = font(44, 700);
    ctx.fillText(text, WIDTH - PADDING - 36, rowCenter);
    ctx.textAlign = "left";
  }

  function cellAtRight(text: string, right: number, center: number, color: string, style: string) {
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = style;
    ctx.fillText(text, right, center);
    ctx.textAlign = "left";
  }

  heading(t.lib.settlementImage.result);
  ctx.font = font(30);
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(t.common.player, PADDING + 36, y + 12);
  for (const [label, right] of [
    [t.lib.settlementImage.buyIns, COLUMN.hands],
    [t.common.chips, COLUMN.chips],
    [t.lib.settlementImage.net, COLUMN.net],
    [t.common.amount, COLUMN.amount],
  ] as const) {
    cellAtRight(label, right, y + 12, COLOR.muted, font(30));
  }
  y += RESULT_HEADER_HEIGHT;

  for (const { name, hands, chips, net, amount, outcome } of data.results) {
    roundedRow(ctx, y);
    const center = y + ROW_HEIGHT / 2;
    const color = outcome > 0 ? COLOR.win : outcome < 0 ? COLOR.loss : COLOR.text;
    ctx.font = font(36);
    ctx.fillStyle = COLOR.text;
    ctx.fillText(truncate(ctx, name, RESULT_NAME_MAX_WIDTH), PADDING + 36, center);
    cellAtRight(hands, COLUMN.hands, center, COLOR.text, font(36));
    cellAtRight(chips, COLUMN.chips, center, COLOR.text, font(36));
    cellAtRight(net, COLUMN.net, center, color, font(36));
    cellAtRight(amount, COLUMN.amount, center, color, font(38, 700));
    y += ROW_HEIGHT + ROW_GAP;
  }

  for (const note of data.notes) {
    ctx.font = font(32);
    ctx.fillStyle = COLOR.gold;
    ctx.fillText(truncate(ctx, note, WIDTH - PADDING * 2), PADDING, y + 16);
    y += NOTE_HEIGHT;
  }

  if (data.transfers.length > 0) {
    heading(data.transferTitle);
    for (const { from, to, amount } of data.transfers) {
      roundedRow(ctx, y);
      const center = y + ROW_HEIGHT / 2;
      ctx.font = font(40);
      ctx.fillStyle = COLOR.text;
      const fromText = truncate(ctx, from, TRANSFER_NAME_MAX_WIDTH);
      const toText = truncate(ctx, to, TRANSFER_NAME_MAX_WIDTH);
      let x = PADDING + 36;
      ctx.fillText(fromText, x, center);
      x += ctx.measureText(fromText).width + 20;
      ctx.fillStyle = COLOR.muted;
      ctx.fillText("→", x, center);
      x += ctx.measureText("→").width + 20;
      ctx.fillStyle = COLOR.text;
      ctx.fillText(toText, x, center);
      amountAtRight(amount, center, COLOR.gold);
      y += ROW_HEIGHT + ROW_GAP;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not generate image"))));
  });
}
