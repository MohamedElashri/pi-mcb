/**
 * Pi-vcc compaction details type.
 *
 * Upstream: https://github.com/sting8k/pi-mcb (src/details.ts)
 * Unmodified.
 */
export interface McbCompactionDetails {
  compactor: "mcb";
  version: number;
  sections: string[];
  sourceMessageCount: number;
  previousSummaryUsed: boolean;
}
