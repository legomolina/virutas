/**
 * The Cut Optimizer engine: turns Stock, a Cut List and job settings into a Cutting Plan.
 * Pure (no Angular, no DOM); every length is in millimetres.
 */

export interface StockEntry {
  readonly lengthMillimetres: number;
}

export interface CutListEntry {
  readonly name?: string;
  readonly lengthMillimetres: number;
  /** A positive integer: how many Parts of this length are needed. */
  readonly quantity: number;
}

export interface JobSettings {
  readonly kerfMillimetres: number;
  /** Removed at each end of every Stock, including the Kerf of the Cut that removes it. */
  readonly trimMillimetres: number;
  readonly minimumOffcutLengthMillimetres: number;
}

export interface CutOptimizerInput {
  readonly stock: readonly StockEntry[];
  readonly cutList: readonly CutListEntry[];
  readonly settings: JobSettings;
}

export interface PlacedPart {
  readonly name?: string;
  readonly lengthMillimetres: number;
  /** Distance from the start of the Stock (so after the Trim) to the start of the Part. */
  readonly startMillimetres: number;
}

export interface Leftover {
  /** `none`: nothing left, so no Cut; `offcut`: at least the minimum Offcut length; else `waste`. */
  readonly kind: 'none' | 'offcut' | 'waste';
  readonly lengthMillimetres: number;
}

export interface StockLayout {
  readonly stockLengthMillimetres: number;
  readonly parts: readonly PlacedPart[];
  /** Cuts between Parts plus the one after the last Part when something is left; Trim Cuts are not counted. */
  readonly cuts: number;
  readonly leftover: Leftover;
}

export interface UnplacedPart {
  readonly name?: string;
  readonly lengthMillimetres: number;
  /** Longer than the usable length of every Stock entry. */
  readonly reason: 'too-long';
}

export interface CuttingPlan {
  readonly layouts: readonly StockLayout[];
  readonly unplacedParts: readonly UnplacedPart[];
}

/** Trim is taken from both ends of every Stock. */
const TRIMMED_ENDS = 2;

/** Absorbs floating-point noise (`0.1 + 0.2`) when comparing lengths in millimetres. */
const EPSILON_MILLIMETRES = 1e-9;

interface Part {
  readonly name?: string;
  readonly lengthMillimetres: number;
}

interface OpenStock {
  readonly stockLengthMillimetres: number;
  readonly usableMillimetres: number;
  readonly parts: PlacedPart[];
  /** Length taken from the usable length by Parts and the Kerfs between them. */
  usedMillimetres: number;
}

/** One Kerf separates a Part from the one before it; the first Part has none. */
function kerfBefore(stock: OpenStock, kerfMillimetres: number): number {
  return stock.parts.length > 0 ? kerfMillimetres : 0;
}

function fits(part: Part, stock: OpenStock, kerfMillimetres: number): boolean {
  const room = stock.usableMillimetres - stock.usedMillimetres - kerfBefore(stock, kerfMillimetres);
  return part.lengthMillimetres <= room + EPSILON_MILLIMETRES;
}

function layout(stock: OpenStock, cuts: number, leftover: Leftover): StockLayout {
  return {
    stockLengthMillimetres: stock.stockLengthMillimetres,
    parts: stock.parts,
    cuts,
    leftover,
  };
}

function toLayout(stock: OpenStock, settings: JobSettings): StockLayout {
  const cutsBetweenParts = stock.parts.length - 1;
  const remaining = stock.usableMillimetres - stock.usedMillimetres;
  if (remaining <= EPSILON_MILLIMETRES) {
    return layout(stock, cutsBetweenParts, { kind: 'none', lengthMillimetres: 0 });
  }
  if (remaining <= settings.kerfMillimetres + EPSILON_MILLIMETRES) {
    return layout(stock, cutsBetweenParts + 1, { kind: 'waste', lengthMillimetres: remaining });
  }
  const left = remaining - settings.kerfMillimetres;
  const kind =
    left >= settings.minimumOffcutLengthMillimetres - EPSILON_MILLIMETRES ? 'offcut' : 'waste';
  return layout(stock, cutsBetweenParts + 1, { kind, lengthMillimetres: left });
}

/** Adds `name` only when there is one, so unnamed Parts have no `name` key. */
function withName<T extends object>(
  value: T,
  name: string | undefined,
): T & { readonly name?: string } {
  return name === undefined ? value : { name, ...value };
}

/**
 * Builds a Cutting Plan for Stock of unlimited quantity, placing Parts first-fit decreasing: the
 * longest Parts first, each into the first open Stock it fits, else into a new Stock of the
 * shortest entry that can hold it. Deterministic.
 */
export function planCuts(input: CutOptimizerInput): CuttingPlan {
  const { kerfMillimetres, trimMillimetres } = input.settings;
  const entries = input.stock
    .map((entry) => ({
      stockLengthMillimetres: entry.lengthMillimetres,
      usableMillimetres: entry.lengthMillimetres - TRIMMED_ENDS * trimMillimetres,
    }))
    .sort((a, b) => a.usableMillimetres - b.usableMillimetres);
  const parts = input.cutList.flatMap((entry) =>
    Array.from({ length: entry.quantity }, (): Part => ({
      name: entry.name,
      lengthMillimetres: entry.lengthMillimetres,
    })),
  );

  const open: OpenStock[] = [];
  const unplaced = new Set<Part>();
  for (const part of [...parts].sort((a, b) => b.lengthMillimetres - a.lengthMillimetres)) {
    let target = open.find((stock) => fits(part, stock, kerfMillimetres));
    if (target === undefined) {
      const entry = entries.find(
        (candidate) => part.lengthMillimetres <= candidate.usableMillimetres + EPSILON_MILLIMETRES,
      );
      if (entry === undefined) {
        unplaced.add(part);
        continue;
      }
      target = { ...entry, parts: [], usedMillimetres: 0 };
      open.push(target);
    }
    const start = target.usedMillimetres + kerfBefore(target, kerfMillimetres);
    target.parts.push(
      withName(
        { lengthMillimetres: part.lengthMillimetres, startMillimetres: trimMillimetres + start },
        part.name,
      ),
    );
    target.usedMillimetres = start + part.lengthMillimetres;
  }

  return {
    layouts: open.map((stock) => toLayout(stock, input.settings)),
    unplacedParts: parts
      .filter((part) => unplaced.has(part))
      .map((part) =>
        withName(
          { lengthMillimetres: part.lengthMillimetres, reason: 'too-long' as const },
          part.name,
        ),
      ),
  };
}
