/**
 * Randomization (Phase 3a).
 *
 * THIS MODULE CONTAINS NO ALLOCATION LOGIC AND NEVER WILL.
 *
 * The application does not randomize anyone. An approved mechanism outside this
 * system produces an allocation; staff record its outcome and a reference to it.
 * The provider interface below exists so an approved mechanism could be plugged
 * in later, but the only implementation is manual entry (D-018). A demo or
 * fixture provider was considered and rejected: no code capable of producing an
 * allocation belongs in this repository, because an absolute guarantee is much
 * easier to audit than a guarded one.
 *
 * If you are about to add `Math.random`, a shuffle, a block/stratified
 * allocator, or anything that *chooses* an arm — stop. That is a protocol
 * decision made elsewhere (docs/research-data-boundaries.md).
 */

/** How an allocation reached this system. */
export const ALLOCATION_METHODS = ["MANUAL_ENTRY"] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

export interface Allocation {
  /** The arm the external mechanism allocated. */
  armId: string;
  /** When the allocation was made (not when it was typed in). */
  allocatedAt: Date;
  /** Reference to the record in the approved system. An identifier, not a note. */
  externalRecordId: string | null;
  method: AllocationMethod;
}

/**
 * Contract for supplying an allocation.
 *
 * Deliberately shaped as "hand me what was already decided", not "decide". An
 * implementation that generated an arm would violate the non-negotiables even
 * though it would satisfy this type.
 */
export interface RandomizationProvider {
  readonly method: AllocationMethod;
  /** Returns the allocation to record. Must not choose one. */
  resolve(input: { armId: string; allocatedAt: Date; externalRecordId: string | null }): Allocation;
}

/**
 * The only implementation: passes through exactly what staff typed in, having
 * read it from the approved system. It makes no decision of any kind.
 */
export const manualEntryProvider: RandomizationProvider = {
  method: "MANUAL_ENTRY",
  resolve({ armId, allocatedAt, externalRecordId }) {
    return { armId, allocatedAt, externalRecordId, method: "MANUAL_ENTRY" };
  },
};

/** Arm code, e.g. "A" or "CONTROL". Configuration per study. */
export const ARM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
export const ARM_NAME_MAX_LENGTH = 120;
