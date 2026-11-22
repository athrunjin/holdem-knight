import type { Currency } from "@holdem-knight/core";
import { ArrowRight, Calculator, Check, HandCoins, LogIn, LogOut, X } from "lucide-react";
import { createElement, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { t } from "@/i18n";
import type { Tone } from "@/lib/tone";

/**
 * Draws a settlement as a PNG laid out like the settlement page: the game's header, its totals,
 * then the result cards and the transfers. It draws on a canvas instead of taking a picture of
 * the page, because the libraries that do that tend to lose fonts and images on iOS
 * Safari. Sizes below are the page's own, in CSS pixels at a phone's width, and scaled up at the end.
 */

/** A word or a figure in the color it has on the page. */
export interface ImageText {
  readonly text: string;
  readonly tone: Tone;
}

/** The top of the page: the title lines, whose game it is, and the three boxes. */
export interface ImageHeader {
  /** The blinds in chips. */
  readonly title: string;
  readonly currency: Currency;
  /** What the blinds are worth, after the currency's mark. */
  readonly blindsCash: string;
  /** The Buy-in in big blinds, where the game counts Buy-ins. */
  readonly buyIn?: string | undefined;
  /** Every option in the page's order; those the game does not use are struck through. */
  readonly options: readonly {
    readonly label: string;
    readonly tone: Tone;
    readonly on: boolean;
  }[];
  readonly host: string;
  readonly start: string;
  /** How a chip difference was handled, when there is one. */
  readonly handling?: string | undefined;
  readonly buyInLabel: string;
  readonly buyInTotal: string;
  readonly lengthLabel: string;
  readonly length: string;
  /** Balanced: one line in green. Out: a label over how far and which way, in red. */
  readonly balance:
    | { readonly balanced: true; readonly text: string }
    | { readonly balanced: false; readonly label: string; readonly figure: string };
}

/** The insurance or the rake seat on the organizer's card. */
export interface ImageSeat {
  readonly kind: "insurance" | "rake";
  readonly name: string;
  readonly hands: string;
  readonly chips: string;
  readonly net: ImageText;
  readonly amount: ImageText;
}

export interface ImageRecordRow {
  /** The day, where it differs from the row before. */
  readonly day: string;
  readonly time: string;
  readonly action: ImageText;
  readonly moved?: string | undefined;
  readonly total?: string | undefined;
  /** Only what was taken out has chips and cash. */
  readonly chips?: string | undefined;
  readonly cash?: string | undefined;
}

export interface ImageRecord {
  readonly times: string;
  readonly boughtIn: string;
  readonly hands: string;
  readonly chips: string;
  readonly cash: string;
  readonly rows: readonly ImageRecordRow[];
}

export interface ImageLine {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
  readonly struck: boolean;
  /** Text only, with no amount. */
  readonly note: boolean;
  /** A line that can be waived has a box: ticked while it counts. */
  readonly ticked?: boolean | undefined;
}

export interface ImageCard {
  readonly name: string;
  readonly hands: string;
  readonly chips: string;
  readonly net: ImageText;
  readonly amount: ImageText;
  readonly seats: readonly ImageSeat[];
  /** The folded card's line of group totals. Missing where the page shows none. */
  readonly summary?: readonly ImageText[] | undefined;
  readonly record?: ImageRecord | undefined;
  readonly lines: readonly ImageLine[];
  readonly total: ImageText;
}

export interface SettlementImageData {
  readonly header: ImageHeader;
  /** A title over the cards. */
  readonly heading?: string | undefined;
  readonly groups: readonly { readonly title: string; readonly cards: readonly ImageCard[] }[];
  /** Cards open, with the Buy-in record and every line, or folded to a row and a summary. */
  readonly expanded: boolean;
  readonly transfers?:
    | {
        readonly title: string;
        readonly rows: readonly {
          readonly from: string;
          readonly to: string;
          readonly amount: string;
        }[];
      }
    | undefined;
}

// The page's tokens, from styles.css. Dark is the only mode
const COLOR = {
  bg: "#0e1b16",
  surface: "#13241e",
  line: "#26413a",
  accent: "#3f9a78",
  white: "#ffffff",
  text: "#e7ede9",
  muted: "#93a59d",
  highlight: "#d6b04c",
  win: "#5cc79f",
  loss: "#ef8a7f",
} as const;

const WIDTH = 432;
const SCALE = 2.5;
const PAD = 16;
const RIGHT = WIDTH - PAD;
/** The card's columns, as `columnsClass` lays them out in a card this wide. */
const COL = { name: PAD + 8, nameWidth: 118, hands: 164, chips: 222, net: 309, amount: RIGHT - 8 };
/** Where a line's text starts: past the box of a line that can be waived. */
const LINE_TEXT = COL.name + 24;
const EMBLEM = { src: "/emblem-on-dark.svg", width: 304, height: 288 };

const ICONS = {
  calculator: [Calculator, COLOR.highlight],
  handCoins: [HandCoins, COLOR.win],
  logIn: [LogIn, COLOR.win],
  logOut: [LogOut, COLOR.highlight],
  balanced: [Check, COLOR.win],
  unbalanced: [X, COLOR.loss],
  arrow: [ArrowRight, COLOR.muted],
  tick: [Check, COLOR.bg],
} as const;
type IconName = keyof typeof ICONS | "currency";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}

/** An icon of the page as an image a canvas can draw: its own SVG, in one color. */
function iconImage(element: ReactElement, color: string) {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const svg = host.querySelector("svg");
  if (!svg) throw new Error("Icon did not render");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // A size of its own, large enough to stay sharp: some browsers draw an SVG without one at 0
  svg.setAttribute("width", "96");
  svg.setAttribute("height", "96");
  const markup = new XMLSerializer().serializeToString(svg).replaceAll("currentColor", color);
  root.unmount();
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
}

async function loadIcons(currency: Currency) {
  const names = Object.keys(ICONS) as (keyof typeof ICONS)[];
  const [emblem, mark, ...rest] = await Promise.all([
    loadImage(EMBLEM.src),
    iconImage(createElement(CurrencyIcon, { currency }), COLOR.muted),
    ...names.map((name) => iconImage(createElement(ICONS[name][0]), ICONS[name][1])),
  ]);
  const icons = new Map<IconName, HTMLImageElement>([["currency", mark]]);
  names.forEach((name, index) => {
    const image = rest[index];
    if (image) icons.set(name, image);
  });
  return { emblem, icons };
}

interface TextStyle {
  size?: number;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  /** Cut short with an ellipsis past this width. */
  maxWidth?: number;
  strike?: boolean;
}

type Draw = (ctx: CanvasRenderingContext2D) => void;

export async function renderSettlementImage(data: SettlementImageData): Promise<Blob> {
  await document.fonts.ready;
  const { emblem, icons } = await loadIcons(data.header.currency);
  const family = getComputedStyle(document.body).fontFamily;
  const fontOf = (size: number, weight: number) => `${weight} ${size}px ${family}`;

  // Laid out once against a canvas that is only measured with, then drawn: what sits behind first
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Could not create canvas");
  const boxes: Draw[] = [];
  const behind: Draw[] = [];
  const front: Draw[] = [];

  function widthOf(text: string, size: number, weight = 400) {
    if (!measure) return 0;
    measure.font = fontOf(size, weight);
    return measure.measureText(text).width;
  }

  function cutShort(text: string, size: number, weight: number, maxWidth: number | undefined) {
    if (maxWidth === undefined || widthOf(text, size, weight) <= maxWidth) return text;
    const chars = [...text];
    while (chars.length > 0 && widthOf(`${chars.join("")}…`, size, weight) > maxWidth) chars.pop();
    return `${chars.join("")}…`;
  }

  /** Text centered on `y`. Returns its width, so the next piece can follow it. */
  function write(text: string, x: number, y: number, style: TextStyle = {}) {
    const { size = 14, weight = 400, color = COLOR.text, align = "left", strike = false } = style;
    const shown = cutShort(text, size, weight, style.maxWidth);
    const width = widthOf(shown, size, weight);
    front.push((ctx) => {
      ctx.font = fontOf(size, weight);
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(shown, x, y);
      if (strike) {
        const left = align === "left" ? x : align === "right" ? x - width : x - width / 2;
        ctx.fillRect(left, y, width, 1);
      }
    });
    return width;
  }

  const toned = ({ text, tone }: ImageText, x: number, y: number, style: TextStyle = {}) =>
    write(text, x, y, { ...style, color: COLOR[tone] });

  function icon(name: IconName, x: number, y: number, size: number) {
    const image = icons.get(name);
    if (image) front.push((ctx) => ctx.drawImage(image, x, y - size / 2, size, size));
  }

  function rule(y: number, color: string = COLOR.line, left = PAD, right = RIGHT) {
    behind.push((ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(left, y, right - left, 1);
    });
  }

  /** A box of the page: the surface color with a line around it. */
  function box(x: number, y: number, width: number, height: number) {
    boxes.push((ctx) => {
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, width - 1, height - 1, 12);
      ctx.fillStyle = COLOR.surface;
      ctx.fill();
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  /** A figure picked out on a tint of its own color, ending at `right`. */
  function chip({ text, tone }: ImageText, right: number, y: number) {
    const width = widthOf(text, 14, 600) + 8;
    front.push((ctx) => {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = COLOR[tone];
      ctx.beginPath();
      ctx.roundRect(right - width, y - 12, width, 24, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    write(text, right - 4, y, { weight: 600, color: COLOR[tone], align: "right" });
    return width;
  }

  /** Chips or cash with the mark of what went in or came out just left of them. */
  function marked(text: string, x: number, y: number, align: "center" | "right", out: boolean) {
    const width = write(text, x, y, { size: 12, align, color: out ? COLOR.text : COLOR.muted });
    const left = align === "right" ? x - width : x - width / 2;
    icon(out ? "logOut" : "logIn", left - 14, y, 12);
  }

  const { header } = data;
  let y = 0;

  // The title, the blinds in cash beside it, the options under it and the emblem at the right
  {
    const titleWidth = write(header.title, PAD, 33, { size: 24, weight: 600 });
    const noteX = PAD + titleWidth + 8;
    icon("currency", noteX, 35, 18);
    write(header.blindsCash, noteX + 22, 36, { color: COLOR.muted });
    let x = PAD;
    if (header.buyIn) x += write(header.buyIn, x, 58, { size: 12, weight: 600 }) + 4;
    for (const { label, tone, on } of header.options) {
      const style: TextStyle = on
        ? { size: 12, weight: 500, color: COLOR[tone] }
        : { size: 12, color: COLOR.muted, strike: true };
      x += write(label, x, 58, style) + 4;
    }
    const emblemWidth = (48 * EMBLEM.width) / EMBLEM.height;
    front.push((ctx) => ctx.drawImage(emblem, RIGHT - emblemWidth, 18, emblemWidth, 48));
    y = 84;
  }

  // Whose game it is and when it started, then how a difference was handled
  {
    const center = y + 13;
    const handlingWidth = header.handling
      ? write(header.handling, RIGHT, center + 2, {
          size: 12,
          color: COLOR.highlight,
          align: "right",
          maxWidth: 170,
        })
      : 0;
    const start = `· ${header.start}`;
    const room = RIGHT - PAD - handlingWidth - widthOf(start, 14) - 16;
    const nameWidth = write(header.host, PAD, center, {
      size: 18,
      weight: 600,
      color: COLOR.white,
      maxWidth: room,
    });
    write(start, PAD + nameWidth + 6, center + 1, { color: COLOR.muted });
    y += 36;
  }

  // The three boxes: everything bought in, how long the game ran, and whether the chips add up
  {
    const unit = (WIDTH - PAD * 2 - 16) / 3.2;
    const tiles = [
      { x: PAD, width: unit },
      { x: PAD + unit + 8, width: unit },
      { x: PAD + unit * 2 + 16, width: unit * 1.2 },
    ] as const;
    for (const { x, width } of tiles) box(x, y, width, 54);
    /** A figure that always fits its box on one line, in smaller type the longer it is. */
    const figure = (text: string, tile: (typeof tiles)[number], color: string) => {
      const size = Math.min(16, (16 * (tile.width - 12)) / widthOf(text, 16, 600));
      write(text, tile.x + tile.width / 2, y + 36, { size, weight: 600, color, align: "center" });
    };
    const label = (text: string, tile: (typeof tiles)[number], color: string = COLOR.muted) =>
      write(text, tile.x + tile.width / 2, y + 16, { size: 12, color, align: "center" });
    const corner = (tile: (typeof tiles)[number]) =>
      icon("currency", tile.x + tile.width - 16, y + 10, 12);

    label(header.buyInLabel, tiles[0], COLOR.muted);
    figure(header.buyInTotal, tiles[0], COLOR.text);
    corner(tiles[0]);
    label(header.lengthLabel, tiles[1], COLOR.muted);
    figure(header.length, tiles[1], COLOR.text);
    const last = tiles[2];
    if (header.balance.balanced) {
      const width = widthOf(header.balance.text, 16, 600);
      const left = last.x + (last.width - width - 20) / 2;
      write(header.balance.text, left, y + 28, { size: 16, weight: 600, color: COLOR.win });
      icon("balanced", left + width + 4, y + 27, 16);
    } else {
      const width = label(header.balance.label, last, COLOR.loss);
      icon("unbalanced", last.x + last.width / 2 + width / 2 + 2, y + 16, 14);
      figure(header.balance.figure, last, COLOR.loss);
      corner(last);
    }
    y += 54;
  }

  function heading(text: string) {
    write(text, PAD, y + 34, { size: 16, weight: 600 });
    y += 56;
  }

  function columnTitles(first: string) {
    const style = { size: 12, color: COLOR.muted };
    const center = y + 8;
    write(first, COL.name, center, style);
    write("Buy-in", COL.hands, center, { ...style, align: "center" });
    write(t.common.chips, COL.chips, center, { ...style, align: "center" });
    write(t.game.resultCards.net, COL.net, center, { ...style, align: "right" });
    write(t.common.amount, COL.amount, center, { ...style, align: "right" });
    y += 24;
  }

  function record({ times, boughtIn, hands, chips, cash, rows }: ImageRecord) {
    const small = { size: 12, color: COLOR.muted };
    let center = y + 14;
    write(times, LINE_TEXT, center, small);
    write(boughtIn, LINE_TEXT + 38, center, { size: 12, weight: 500, color: COLOR.win });
    write(hands, COL.hands, center, { ...small, align: "center" });
    marked(chips, COL.chips, center, "center", false);
    marked(cash, COL.amount, center, "right", false);
    y += 28;
    for (const row of rows) {
      center = y + 12;
      write(row.day, COL.name, center, { size: 10, color: COLOR.muted });
      write(row.time, LINE_TEXT, center, small);
      const actionWidth = toned(row.action, LINE_TEXT + 38, center, { size: 12, weight: 500 });
      if (row.moved) write(row.moved, LINE_TEXT + 42 + actionWidth, center, { size: 12 });
      if (row.total) write(row.total, COL.hands, center, { size: 12, align: "center" });
      if (row.chips) marked(row.chips, COL.chips, center, "center", true);
      if (row.cash) marked(row.cash, COL.amount, center, "right", true);
      y += 24;
    }
    y += 4;
  }

  function seat({ kind, name, hands, chips, net, amount }: ImageSeat) {
    const center = y + 22;
    const color = kind === "insurance" ? COLOR.highlight : COLOR.win;
    icon(kind === "insurance" ? "calculator" : "handCoins", COL.name + 12, center, 16);
    write(name, COL.name + 30, center, { size: 12, color });
    write(hands, COL.hands, center, { size: 12, align: "center" });
    write(chips, COL.chips, center, { size: 12, align: "center" });
    toned(net, COL.net, center, { size: 12, align: "right" });
    toned(amount, COL.amount, center, { size: 12, align: "right" });
    y += 44;
  }

  function line({ label, value, tone, struck, note, ticked }: ImageLine) {
    const center = y + 12;
    const style = { size: 12, color: COLOR[tone], strike: struck };
    if (ticked !== undefined) {
      const top = center - 8;
      behind.push((ctx) => {
        ctx.beginPath();
        ctx.roundRect(COL.name + 0.5, top + 0.5, 15, 15, 3);
        if (ticked) {
          ctx.fillStyle = COLOR.accent;
          ctx.fill();
        } else {
          ctx.strokeStyle = COLOR.muted;
          ctx.stroke();
        }
      });
      if (ticked) icon("tick", COL.name + 2, center, 12);
    }
    const valueWidth = note ? 0 : write(value, COL.amount, center, { ...style, align: "right" });
    write(label, LINE_TEXT, center, {
      ...style,
      maxWidth: COL.amount - LINE_TEXT - valueWidth - 8,
    });
    y += 24;
  }

  function card(person: ImageCard) {
    const top = y;
    const center = y + 18;
    write(person.name, COL.name, center, { weight: 500, maxWidth: COL.nameWidth });
    write(person.hands, COL.hands, center, { align: "center" });
    write(person.chips, COL.chips, center, { align: "center" });
    toned(person.net, COL.net, center, { align: "right" });
    toned(person.amount, COL.amount, center, { align: "right" });
    y += 36;

    const open = data.expanded && (person.lines.length > 0 || person.record !== undefined);
    if (open && person.record) record(person.record);
    if (person.seats.length > 0) {
      if (open && person.record) rule(y, COLOR.line, COL.name, COL.amount);
      for (const one of person.seats) seat(one);
    }
    if (!open && person.summary) {
      if (person.seats.length > 0) {
        rule(y, COLOR.line, COL.name, COL.amount);
        y += 4;
      }
      const center = y + 14;
      const total = chip(person.total, COL.amount, center);
      const totalLabel = t.game.resultCards.total;
      write(totalLabel, COL.amount - total - 4, center, { color: COLOR.muted, align: "right" });
      let x = COL.name;
      const room = COL.amount - total - widthOf(totalLabel, 14) - 16;
      for (const item of person.summary) {
        const width = widthOf(item.text, 12);
        if (x > COL.name && x + width > room) break;
        toned(item, x, center, { size: 12, maxWidth: room - x });
        x += width + 12;
      }
      y += 32;
    }
    if (open) {
      if ((person.record || person.seats.length > 0) && person.lines.length > 0) {
        rule(y, COLOR.line, COL.name, COL.amount);
      }
      for (const one of person.lines) line(one);
      rule(y, COLOR.accent, COL.name, COL.amount);
      write(t.game.resultCards.total, COL.name, y + 22, { weight: 600 });
      chip(person.total, COL.amount, y + 22);
      y += 44;
    }

    const height = y - top;
    box(PAD, top, WIDTH - PAD * 2, height);
    // The first row is tinted, inside the card's rounded corners
    behind.push((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(PAD + 1, top + 1, WIDTH - PAD * 2 - 2, height - 2, 11);
      ctx.clip();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = COLOR.accent;
      ctx.fillRect(PAD, top, WIDTH - PAD * 2, 36);
      ctx.restore();
    });
    y += 8;
  }

  if (data.heading) heading(data.heading);
  else y += 16;
  for (const group of data.groups) {
    columnTitles(group.title);
    for (const person of group.cards) card(person);
  }

  if (data.transfers && data.transfers.rows.length > 0) {
    y -= 8;
    heading(data.transfers.title);
    y -= 8;
    rule(y);
    for (const { from, to, amount } of data.transfers.rows) {
      const center = y + 22;
      const amountWidth = write(amount, RIGHT, center, {
        weight: 600,
        color: COLOR.highlight,
        align: "right",
      });
      const nameWidth = (RIGHT - PAD - amountWidth - 40) / 2;
      let x = PAD + 2;
      x += write(from, x, center, { weight: 500, maxWidth: nameWidth }) + 6;
      icon("arrow", x, center, 14);
      write(to, x + 20, center, { weight: 500, maxWidth: nameWidth });
      y += 44;
    }
    rule(y);
    y += 8;
  }

  y += 8;
  write("Hold’em Knight", WIDTH / 2, y + 8, { size: 11, color: COLOR.muted, align: "center" });
  y += 16 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(y * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, WIDTH, y);
  ctx.textBaseline = "middle";
  for (const draw of [...boxes, ...behind]) draw(ctx);
  for (const draw of front) draw(ctx);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not generate image"))));
  });
}
