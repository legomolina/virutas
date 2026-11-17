/**
 * The Cut Optimizer engine: turns Stock, a Cut List and job settings into a Cutting Plan.
 * Pure (no Angular, no DOM); every length is in millimetres.
 */

export interface StockEntry {
  readonly lengthMillimetres: number;
  /** A positive integer: how many of this Stock there are. Absent means unlimited. */
  readonly quantity?: number;
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
  readonly strategy: StrategyId;
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
  /** Position in `CutOptimizerInput.stock` of the Stock entry this Stock comes from. */
  readonly stockEntryIndex: number;
  readonly stockLengthMillimetres: number;
  readonly parts: readonly PlacedPart[];
  /** Cuts between Parts plus the one after the last Part when something is left; Trim Cuts are not counted. */
  readonly cuts: number;
  readonly leftover: Leftover;
}

export interface UnplacedPart {
  readonly name?: string;
  readonly lengthMillimetres: number;
  /**
   * `too-long`: longer than the usable length of every Stock entry; `insufficient-stock`: would fit,
   * but the limited Stock it fits ran out and no unlimited entry fits it.
   */
  readonly reason: 'too-long' | 'insufficient-stock';
}

export interface CuttingPlan {
  readonly layouts: readonly StockLayout[];
  readonly unplacedParts: readonly UnplacedPart[];
}

/** The Strategies a Cutting Plan can be built with. */
export type StrategyId = 'fewest-stock';

/** Turns the input into a Cutting Plan following one optimization criterion. */
export type Strategy = (input: CutOptimizerInput) => CuttingPlan;

/** Trim is taken from both ends of every Stock. */
const TRIMMED_ENDS = 2;

/** Absorbs floating-point noise (`0.1 + 0.2`) when comparing lengths in millimetres. */
const EPSILON_MILLIMETRES = 1e-9;

interface Part {
  readonly name?: string;
  readonly lengthMillimetres: number;
  /** Position in the Cut List, one per unit of quantity; Unplaced Parts are reported in this order. */
  readonly order: number;
  /** Position in the longest-first order; Parts on a Stock are kept in this order. */
  readonly rank: number;
}

interface Entry {
  readonly index: number;
  readonly lengthMillimetres: number;
  readonly usableMillimetres: number;
  /** `Infinity` for unlimited Stock. */
  readonly quantity: number;
}

function isUnlimited(entry: Entry): boolean {
  return entry.quantity === Infinity;
}

/** The Parts cut from one Stock, in rank order (a Stock layout before it has its Stock entry). */
type Bin = readonly Part[];

interface Candidate {
  readonly bins: readonly Bin[];
  /** The Stock entry each Bin is cut from, by position. */
  readonly stock: readonly Entry[];
}

/** Adds `name` only when there is one, so unnamed Parts have no `name` key. */
function withName<T extends object>(
  value: T,
  name: string | undefined,
): T & { readonly name?: string } {
  return name === undefined ? value : { name, ...value };
}

/** Length the Parts take from the usable length: one Kerf between consecutive Parts. */
function needed(bin: Bin, kerfMillimetres: number): number {
  return bin.reduce(
    (total, part, position) =>
      total + part.lengthMillimetres + (position > 0 ? kerfMillimetres : 0),
    0,
  );
}

function holds(usableMillimetres: number, lengthMillimetres: number): boolean {
  return lengthMillimetres <= usableMillimetres + EPSILON_MILLIMETRES;
}

function leftover(remaining: number, settings: JobSettings): Leftover {
  if (remaining <= EPSILON_MILLIMETRES) {
    return { kind: 'none', lengthMillimetres: 0 };
  }
  if (remaining <= settings.kerfMillimetres + EPSILON_MILLIMETRES) {
    return { kind: 'waste', lengthMillimetres: remaining };
  }
  const left = remaining - settings.kerfMillimetres;
  const kind =
    left >= settings.minimumOffcutLengthMillimetres - EPSILON_MILLIMETRES ? 'offcut' : 'waste';
  return { kind, lengthMillimetres: left };
}

function leftoverOf(bin: Bin, entry: Entry, settings: JobSettings): Leftover {
  return leftover(entry.usableMillimetres - needed(bin, settings.kerfMillimetres), settings);
}

function toLayout(bin: Bin, entry: Entry, settings: JobSettings): StockLayout {
  const { kerfMillimetres, trimMillimetres } = settings;
  const end = leftoverOf(bin, entry, settings);
  let start = trimMillimetres;
  const parts = bin.map((part) => {
    const placed = withName(
      { lengthMillimetres: part.lengthMillimetres, startMillimetres: start },
      part.name,
    );
    start += part.lengthMillimetres + kerfMillimetres;
    return placed;
  });
  return {
    stockEntryIndex: entry.index,
    stockLengthMillimetres: entry.lengthMillimetres,
    parts,
    cuts: bin.length - 1 + (end.kind === 'none' ? 0 : 1),
    leftover: end,
  };
}

/**
 * Gives each Bin the shortest Stock entry still available that holds it, limited entries before
 * unlimited ones of the same length; `undefined` when the Stock runs out. Because every entry that
 * holds a Bin also holds the shorter ones, the order the Bins are taken in does not matter.
 */
function assignStock(
  bins: readonly Bin[],
  entries: readonly Entry[],
  kerfMillimetres: number,
): Candidate | undefined {
  const remaining = entries.map((entry) => entry.quantity);
  const stock: Entry[] = [];
  for (const bin of bins) {
    const length = needed(bin, kerfMillimetres);
    const choice = entries.findIndex(
      (entry, index) => remaining[index] > 0 && holds(entry.usableMillimetres, length),
    );
    if (choice < 0) {
      return undefined;
    }
    remaining[choice] -= 1;
    stock.push(entries[choice]);
  }
  return { bins, stock };
}

/**
 * Fewest Stock first, then the least total Stock length, then the longest Offcuts (compared
 * longest to longest, then second to second, …). Negative when `a` is better.
 */
function compare(a: Candidate, b: Candidate, settings: JobSettings): number {
  if (a.bins.length !== b.bins.length) {
    return a.bins.length - b.bins.length;
  }
  const totalLength = (candidate: Candidate): number =>
    candidate.stock.reduce((total, entry) => total + entry.lengthMillimetres, 0);
  const lengthDifference = totalLength(a) - totalLength(b);
  if (Math.abs(lengthDifference) > EPSILON_MILLIMETRES) {
    return lengthDifference;
  }
  const offcuts = (candidate: Candidate): number[] =>
    candidate.bins
      .map((bin, position) => leftoverOf(bin, candidate.stock[position], settings))
      .filter((end) => end.kind === 'offcut')
      .map((end) => end.lengthMillimetres)
      .sort((x, y) => y - x);
  const offcutsA = offcuts(a);
  const offcutsB = offcuts(b);
  for (let position = 0; position < Math.max(offcutsA.length, offcutsB.length); position++) {
    const difference = (offcutsB[position] ?? 0) - (offcutsA[position] ?? 0);
    if (Math.abs(difference) > EPSILON_MILLIMETRES) {
      return difference;
    }
  }
  return 0;
}

/** Moves one Part to Bin `to`, dropping the Bin it leaves when that Bin is left empty. */
function move(bins: readonly Bin[], part: Part, to: number): Bin[] {
  return bins.flatMap((bin, position) => {
    const rest = bin.filter((other) => other !== part);
    const moved = position === to ? [...rest, part].sort((x, y) => x.rank - y.rank) : rest;
    return moved.length > 0 ? [moved] : [];
  });
}

/**
 * Repeatedly moves single Parts to another Stock while that gives a better Cutting Plan by
 * `compare`, until no move does.
 */
function improve(start: Candidate, entries: readonly Entry[], settings: JobSettings): Candidate {
  let best = start;
  let improved = true;
  while (improved) {
    improved = false;
    for (const part of best.bins.flat()) {
      for (let to = 0; to < best.bins.length; to++) {
        const candidate = assignStock(move(best.bins, part, to), entries, settings.kerfMillimetres);
        if (candidate !== undefined && compare(candidate, best, settings) < 0) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** The Stock entries, shortest usable length first, limited before unlimited of the same length. */
function toEntries(stock: readonly StockEntry[], settings: JobSettings): Entry[] {
  return stock
    .map((entry, index) => ({
      index,
      lengthMillimetres: entry.lengthMillimetres,
      usableMillimetres: entry.lengthMillimetres - TRIMMED_ENDS * settings.trimMillimetres,
      quantity: entry.quantity ?? Infinity,
    }))
    .sort(
      (a, b) =>
        a.usableMillimetres - b.usableMillimetres ||
        Number(isUnlimited(a)) - Number(isUnlimited(b)),
    );
}

/** One Part per unit of quantity, longest first, Cut List order between equal lengths. */
function toParts(cutList: readonly CutListEntry[]): Part[] {
  return cutList
    .flatMap((entry) =>
      Array.from({ length: entry.quantity }, () => ({
        name: entry.name,
        lengthMillimetres: entry.lengthMillimetres,
      })),
    )
    .map((part, order) => ({ ...part, order }))
    .sort((a, b) => b.lengthMillimetres - a.lengthMillimetres)
    .map((part, rank) => ({ ...part, rank }));
}

interface FirstFit {
  readonly bins: readonly Bin[];
  /** By Part `order`. */
  readonly unplaced: ReadonlyMap<number, UnplacedPart['reason']>;
}

/**
 * Places each Part, longest first, on the first Stock it fits, else on a new Stock of the longest
 * entry still available that holds it, else reports it as an Unplaced Part.
 */
function firstFitDecreasing(
  parts: readonly Part[],
  entries: readonly Entry[],
  kerfMillimetres: number,
): FirstFit {
  const remaining = entries.map((entry) => entry.quantity);
  const open: { parts: Part[]; entry: Entry }[] = [];
  const unplaced = new Map<number, UnplacedPart['reason']>();
  for (const part of parts) {
    const target = open.find((bin) =>
      holds(bin.entry.usableMillimetres, needed([...bin.parts, part], kerfMillimetres)),
    );
    if (target !== undefined) {
      target.parts.push(part);
      continue;
    }
    // Entries are sorted shortest first, so the last match is the longest.
    const choice = entries.reduce(
      (found, entry, index) =>
        remaining[index] > 0 && holds(entry.usableMillimetres, part.lengthMillimetres)
          ? index
          : found,
      -1,
    );
    if (choice < 0) {
      const fitsAny = entries.some((entry) =>
        holds(entry.usableMillimetres, part.lengthMillimetres),
      );
      unplaced.set(part.order, fitsAny ? 'insufficient-stock' : 'too-long');
      continue;
    }
    remaining[choice] -= 1;
    open.push({ parts: [part], entry: entries[choice] });
  }
  return { bins: open.map((bin) => bin.parts), unplaced };
}

/**
 * The fewest Stock Strategy: first-fit decreasing into the longest Stock still available, then
 * the shortest Stock that holds each layout, then single-Part moves that improve the plan.
 * Deterministic; not guaranteed optimal.
 */
const fewestStock: Strategy = (input) => {
  const { settings } = input;
  const entries = toEntries(input.stock, settings);
  const parts = toParts(input.cutList);
  const { bins, unplaced } = firstFitDecreasing(parts, entries, settings.kerfMillimetres);
  // First-fit reserved a Stock that holds every Bin, so a shortest-first assignment exists.
  const best = improve(assignStock(bins, entries, settings.kerfMillimetres)!, entries, settings);
  return {
    layouts: best.bins.map((bin, position) => toLayout(bin, best.stock[position], settings)),
    unplacedParts: parts
      .filter((part) => unplaced.has(part.order))
      .sort((a, b) => a.order - b.order)
      .map((part) =>
        withName(
          { lengthMillimetres: part.lengthMillimetres, reason: unplaced.get(part.order)! },
          part.name,
        ),
      ),
  };
};

const STRATEGIES: Readonly<Record<StrategyId, Strategy>> = { 'fewest-stock': fewestStock };

/** Builds a Cutting Plan with the Strategy named in the job settings. */
export function planCuts(input: CutOptimizerInput): CuttingPlan {
  return STRATEGIES[input.settings.strategy](input);
}
