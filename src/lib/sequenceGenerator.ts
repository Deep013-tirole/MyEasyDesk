/**
 * EasyDesk Authoritative Sequence Generator & Identity Management Engine
 * 
 * Provides:
 * 1. Strictly sequential, human-readable IDs:
 *    - Customers: CUST-000001, CUST-000002, ...
 *    - Employees: EMP-000001, EMP-000002, ...
 *    - Orders: ORD-000001, ORD-000002, ...
 * 2. Monotonically increasing sequence counters stored persistently in system_settings.entity_sequences
 * 3. Guaranteed non-reuse of deleted record IDs
 * 4. Concurrency lock to prevent race conditions during simultaneous submissions
 * 5. Cold-start and server-restart resilience
 * 6. Canonical customer deduplication and matching
 */

export type SequenceEntityType = 'customer' | 'employee' | 'order';

export interface EntitySequences {
  customer: number;
  employee: number;
  order: number;
  updatedAt?: string;
}

/**
 * Formats a sequential number into the standard human-readable format with 6-digit zero padding.
 */
export function formatSequenceId(type: SequenceEntityType, seq: number): string {
  const padded = String(seq).padStart(6, '0');
  switch (type) {
    case 'customer':
      return `CUST-${padded}`;
    case 'employee':
      return `EMP-${padded}`;
    case 'order':
      return `ORD-${padded}`;
  }
}

/**
 * Extracts the highest numerical suffix from an array of records across specified fields.
 * Gracefully handles prefixes, formatting, and avoids mistaking 13-digit millisecond timestamps for sequence counters.
 */
export function extractMaxNumber(items: any[], fields: string[]): number {
  let max = 0;
  if (!Array.isArray(items)) return max;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const field of fields) {
      const val = item[field];
      if (typeof val === 'string') {
        const matches = val.match(/(\d+)/g);
        if (matches) {
          for (const m of matches) {
            // Avoid interpreting timestamps (e.g. 13-digit Date.now() values like 1788...) as sequence numbers
            if (m.length <= 8) {
              const num = parseInt(m, 10);
              if (!isNaN(num) && num > max) {
                max = num;
              }
            }
          }
        }
      } else if (typeof val === 'number') {
        if (val > max && val < 1000000000) {
          max = val;
        }
      }
    }
  }
  return max;
}

import { getD1Database, allocateNextSequenceInD1, initEntitySequencesInD1 } from './d1Storage.js';

/**
 * Initializes and normalizes sequence counters from storage and existing records.
 * The sequence counter represents the highest issued ID number (high-water mark).
 */
export function initEntitySequences(dbState: any, d1Instance?: any): EntitySequences {
  if (!dbState) {
    return { customer: 0, employee: 0, order: 0, updatedAt: new Date().toISOString() };
  }

  if (!dbState.entity_sequences || typeof dbState.entity_sequences !== 'object') {
    dbState.entity_sequences = {};
  }

  const stored = dbState.entity_sequences;

  const maxCust = extractMaxNumber(dbState.customers || [], ['id', 'code']);
  const maxEmp = extractMaxNumber(dbState.employees || [], ['id', 'code', 'employeeCode']);
  const maxOrd = extractMaxNumber(dbState.orders || [], ['id', 'orderCode']);

  const customerSeq = Math.max(Number(stored.customer) || 0, maxCust);
  const employeeSeq = Math.max(Number(stored.employee) || 0, maxEmp);
  const orderSeq = Math.max(Number(stored.order) || 0, maxOrd);

  dbState.entity_sequences = {
    customer: customerSeq,
    employee: employeeSeq,
    order: orderSeq,
    updatedAt: stored.updatedAt || new Date().toISOString()
  };

  const d1 = d1Instance || getD1Database();
  if (d1) {
    initEntitySequencesInD1({
      customer: customerSeq,
      employee: employeeSeq,
      order: orderSeq
    }, d1).catch((err: any) => {
      console.error('[SEQUENCE] Warning: initEntitySequencesInD1 error:', err);
    });
  }

  return dbState.entity_sequences;
}

/**
 * Checks whether an ID or code already exists in memory.
 */
export function idExistsInDb(type: SequenceEntityType, id: string, dbState: any): boolean {
  if (!dbState) return false;
  const target = id.toLowerCase();
  switch (type) {
    case 'customer':
      return (dbState.customers || []).some((c: any) => 
        (c.id && c.id.toLowerCase() === target) || 
        (c.code && c.code.toLowerCase() === target)
      );
    case 'employee':
      return (dbState.employees || []).some((e: any) => 
        (e.id && e.id.toLowerCase() === target) || 
        (e.code && e.code.toLowerCase() === target) || 
        (e.employeeCode && e.employeeCode.toLowerCase() === target)
      );
    case 'order':
      return (dbState.orders || []).some((o: any) => 
        (o.id && o.id.toLowerCase() === target) || 
        (o.orderCode && o.orderCode.toLowerCase() === target)
      );
  }
}

// In-process lock to prevent race conditions during concurrent sequence generation in local isolate
let sequenceLock: Promise<void> = Promise.resolve();

export async function withSequenceLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const nextLock = new Promise<void>(resolve => {
    release = resolve;
  });
  const currentLock = sequenceLock;
  sequenceLock = nextLock;

  try {
    await currentLock;
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Atomically generates the next sequential ID for an entity type.
 * Cloudflare D1 is the primary authoritative source of truth via atomic SQLite statements.
 * Monotonically increasing: deleting records NEVER decrements or reuses this counter.
 * The in-process mutex is retained as a local serialization optimization, but correctness
 * across distributed isolates comes from D1.
 */
export async function getNextSequence(
  type: SequenceEntityType,
  dbState: any,
  persistFn?: (key: string, id?: string) => Promise<void>,
  d1Instance?: any
): Promise<{ id: string; seq: number }> {
  return withSequenceLock(async () => {
    initEntitySequences(dbState, d1Instance);

    const d1 = d1Instance || getD1Database();
    let allocatedNum: number | null = null;

    if (d1) {
      try {
        allocatedNum = await allocateNextSequenceInD1(type, d1);
      } catch (d1Err) {
        console.error(`[SEQUENCE] D1 allocation error for ${type}, falling back to local allocator:`, d1Err);
      }
    }

    if (allocatedNum === null || isNaN(allocatedNum)) {
      // Local fallback when D1 is offline / unit tests without D1
      let nextNum = (dbState.entity_sequences[type] || 0) + 1;
      let candidateId = formatSequenceId(type, nextNum);

      // Safeguard against collisions with any pre-existing records
      while (idExistsInDb(type, candidateId, dbState)) {
        nextNum++;
        candidateId = formatSequenceId(type, nextNum);
      }
      allocatedNum = nextNum;
    }

    // Ensure allocated number does not collide with historical in-memory records
    let candidateId = formatSequenceId(type, allocatedNum);
    while (idExistsInDb(type, candidateId, dbState)) {
      if (d1) {
        const nextAlloc = await allocateNextSequenceInD1(type, d1);
        if (nextAlloc !== null && !isNaN(nextAlloc)) {
          allocatedNum = nextAlloc;
          candidateId = formatSequenceId(type, allocatedNum);
          continue;
        }
      }
      allocatedNum++;
      candidateId = formatSequenceId(type, allocatedNum);
    }

    // Keep in-memory projection updated
    if (dbState) {
      if (!dbState.entity_sequences || typeof dbState.entity_sequences !== 'object') {
        dbState.entity_sequences = {};
      }
      dbState.entity_sequences[type] = Math.max(dbState.entity_sequences[type] || 0, allocatedNum);
      dbState.entity_sequences.updatedAt = new Date().toISOString();
    }

    if (persistFn) {
      try {
        await persistFn('entity_sequences');
      } catch (err) {
        // Local mirror persistence warning ignored
      }
    }

    return { id: candidateId, seq: allocatedNum };
  });
}

/**
 * Server-side canonical customer matcher and deduplicator.
 * Evaluates non-sensitive canonical signals:
 * 1. Explicit ID / Code / UserID
 * 2. Normalized 10-digit Indian mobile number (e.g. +91 95755 38590 -> 9575538590)
 * 3. Normalized email address (case-insensitive, trimmed)
 */
export function matchExistingCustomer(
  criteria: {
    id?: string | null;
    code?: string | null;
    userId?: string | null;
    mobile?: string | null;
    whatsappMobile?: string | null;
    email?: string | null;
    name?: string | null;
  },
  customers: any[]
): any | undefined {
  if (!Array.isArray(customers) || customers.length === 0) return undefined;

  const targetId = criteria.id?.trim().toLowerCase();
  const targetCode = criteria.code?.trim().toLowerCase();
  const targetUserId = criteria.userId?.trim().toLowerCase();

  // 1. Direct ID / Code / UserID match
  for (const c of customers) {
    if (!c) continue;
    const cId = (c.id || '').toLowerCase();
    const cCode = (c.code || '').toLowerCase();
    const cUserId = (c.userId || '').toLowerCase();

    if (targetId && (cId === targetId || cCode === targetId)) return c;
    if (targetCode && (cCode === targetCode || cId === targetCode)) return c;
    if (targetUserId && (cId === targetUserId || cUserId === targetUserId)) return c;
  }

  // 2. Mobile Number match (10-digit normalized Indian mobile)
  const normMobile = (criteria.mobile || criteria.whatsappMobile || '').replace(/\D/g, '').slice(-10);
  if (normMobile.length === 10) {
    for (const c of customers) {
      if (!c) continue;
      const cMobile = (c.mobile || '').replace(/\D/g, '').slice(-10);
      const cWa = (c.whatsappMobile || '').replace(/\D/g, '').slice(-10);
      if (cMobile === normMobile || cWa === normMobile) {
        return c;
      }
    }
  }

  // 3. Email match (normalized lowercase trimmed, skipping generic placeholders)
  const normEmail = (criteria.email || '').trim().toLowerCase();
  if (normEmail && !normEmail.startsWith('guest@') && !normEmail.startsWith('no-email@')) {
    for (const c of customers) {
      if (!c) continue;
      const cEmail = (c.email || '').trim().toLowerCase();
      if (cEmail === normEmail) {
        return c;
      }
    }
  }

  return undefined;
}
