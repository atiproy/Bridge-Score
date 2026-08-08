/**
 * Domain types for Contract Bridge scoring.
 *
 * Design rule: a `Deal` records only what the players actually observed at the
 * table (the contract and the trick count). Everything derivable — vulnerability
 * in Rubber/Chicago, game wins, rubber bonuses — is computed by walking the deal
 * list. That keeps undo/edit/delete correct: change deal 3 and deals 4..n
 * re-derive their vulnerability automatically.
 */

export type TeamId = 'A' | 'B';

/** Denomination of the contract. */
export type Strain = 'C' | 'D' | 'H' | 'S' | 'NT';

/** Contract level: odd tricks bid, over the book of 6. */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Doubling state of the contract. */
export type Risk = 'none' | 'doubled' | 'redoubled';

export type ScoringMode = 'rubber' | 'duplicate' | 'chicago';

/**
 * Toggleable rules. Every "full" rule can be switched off so a table that just
 * wants a quick scorer is never forced through vulnerability or doubling.
 */
export interface RuleSet {
  mode: ScoringMode;
  /** When false, both sides are treated as never vulnerable. */
  vulnerability: boolean;
  /** When false, the double / redouble controls are hidden and ignored. */
  doubles: boolean;
  /** Rubber only. Trump-honour and four-ace bonuses. */
  honours: boolean;
  /** Small/grand slam bonuses. */
  slamBonuses: boolean;
  /** The 50/100 "insult" bonus for fulfilling a doubled contract. */
  insultBonus: boolean;
}

export interface RulePreset {
  id: string;
  name: string;
  tagline: string;
  detail: string;
  rules: RuleSet;
}

/** Honour bonus claimed on a deal (Rubber only). */
export interface HonoursClaim {
  team: TeamId;
  /** 100 = four trump honours; 150 = five trump honours, or four aces at NT. */
  value: 100 | 150;
}

export interface Deal {
  id: string;
  /** True when all four players passed; scores nothing, but is a real record. */
  passedOut: boolean;
  /** The side that bought the contract. */
  declarer: TeamId;
  /** Optional individual declarer, when player names were supplied. */
  declarerPlayer?: string;
  level: Level;
  strain: Strain;
  risk: Risk;
  /** Total tricks taken by the declaring side, 0-13. */
  tricksWon: number;
  honours?: HonoursClaim | null;
  /**
   * Duplicate mode only: manual vulnerability for this board. Rubber and
   * Chicago always derive it, so this is ignored there.
   */
  vulnerabilityOverride?: TeamVulnerability;
  createdAt: number;
  note?: string;
}

export interface TeamVulnerability {
  A: boolean;
  B: boolean;
}

/** One line of the point-by-point explanation shown to the user. */
export interface ExplainLine {
  label: string;
  /** The arithmetic, e.g. "4 x 30 = 120, doubled x2". */
  formula?: string;
  points: number;
  team: TeamId;
  /** Rubber only: below the line counts toward game. */
  line: 'below' | 'above';
  /** Highlights the single most important line in the breakdown. */
  emphasis?: boolean;
}

export interface SideScore {
  below: number;
  above: number;
  total: number;
}

export interface DealScore {
  A: SideScore;
  B: SideScore;
  /** Human summary, e.g. "4♥ doubled by Sharks — made 5". */
  headline: string;
  outcome: 'made' | 'set' | 'passed';
  /** Tricks the contract required, i.e. level + 6. */
  contractTricks: number;
  overtricks: number;
  undertricks: number;
  lines: ExplainLine[];
  /** Non-fatal problems, e.g. honours claimed with rules that ignore them. */
  warnings: string[];
}

/** Something noteworthy that happened after a deal was scored. */
export interface GameEvent {
  kind: 'game-won' | 'rubber-won' | 'slam' | 'grand-slam' | 'set';
  team: TeamId;
  message: string;
}

export interface ScoredDeal {
  deal: Deal;
  score: DealScore;
  /** Vulnerability actually in force for this deal. */
  vulnerability: TeamVulnerability;
  /** 0-based index of the rubber this deal belongs to (Rubber mode). */
  rubberIndex: number;
  /** 1-based position shown on the scorecard. */
  displayNumber: number;
  events: GameEvent[];
  /** Running match totals immediately after this deal. */
  runningTotals: { A: number; B: number };
}

export interface RubberRecord {
  index: number;
  gamesWon: { A: number; B: number };
  complete: boolean;
  winner?: TeamId;
  /** Bonus awarded on completion (700 / 500), or the unfinished-rubber value. */
  bonus: number;
  bonusTeam?: TeamId;
}

export interface GameState {
  deals: ScoredDeal[];
  totals: { A: number; B: number };
  /** Rubber mode: games won in the current rubber. */
  gamesWon: { A: number; B: number };
  /** Rubber mode: below-the-line points toward the current game. */
  currentLeg: { A: number; B: number };
  /** Vulnerability that will apply to the NEXT deal entered. */
  vulnerability: TeamVulnerability;
  rubbers: RubberRecord[];
  /** True when the current rubber is finished and a new one should start. */
  rubberComplete: boolean;
  /** Every event across the match, newest last. */
  events: GameEvent[];
}

export interface Team {
  id: TeamId;
  name: string;
  players: string[];
}

export interface MatchSetup {
  teams: { A: Team; B: Team };
  rules: RuleSet;
  presetId: string;
  createdAt: number;
}
