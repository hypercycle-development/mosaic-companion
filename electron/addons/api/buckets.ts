/**
 * `addonAPI.buckets` — single-writer feeds an addon can share with another.
 *
 * `write`/`clear` need `buckets:publish` and act only on the caller's *own*
 * declared buckets: the owner is `ctx.addonId`, never an argument, so there is
 * no shape of call that writes as someone else.
 *
 * `list`/`read` need no permission, and that is not a gap. Access is a grant
 * the user made against one named bucket, checked main-side on every call
 * (`canRead`). An install-time permission would be a blanket, permanent yes
 * across every bucket — weaker than the grant, and it would look like the
 * protection while the grant did the work.
 *
 * Everything here is thin: argument validation, then the store. The decisions
 * live in `../buckets.ts`, which is also where the rule that these stay
 * synchronous is explained.
 */

import {
  MAX_BUCKET_ITEMS,
  ITEM_ID_PATTERN,
  writeItems,
  clearItems,
  listFor,
  readFor,
  emitBucketChanged,
  ownBucketSpec,
  type BucketItemInput,
} from "../buckets";
import { assertString, ApiValidationError, type ApiNamespace } from "./types";

const ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;

/**
 * Resolve a bucket the caller is allowed to write. The declaration is
 * refreshed on every activation, so a bucket removed by an upgrade stops being
 * writable at the same moment it stops being declared.
 */
function ownBucket(addonId: string, bucketIdArg: unknown): { bucket: string; kind: string } {
  const bucket = assertString(bucketIdArg, "bucketId");
  const spec = ownBucketSpec(addonId, bucket);
  if (!spec) {
    throw new ApiValidationError(`Bucket "${bucket}" is not declared in this addon's manifest`);
  }
  return { bucket, kind: spec.kind };
}

/**
 * Validate the whole `items` argument before anything is read from disk, so a
 * malformed call never touches the store.
 */
function assertItems(value: unknown): BucketItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiValidationError("items must be a non-empty array");
  }
  if (value.length > MAX_BUCKET_ITEMS) {
    throw new ApiValidationError(`items exceeds the ${MAX_BUCKET_ITEMS}-item per-bucket cap`);
  }
  const seen = new Set<string>();
  return value.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ApiValidationError(`items[${i}] must be an object`);
    }
    const item = entry as Record<string, unknown>;
    const id = item.id;
    if (typeof id !== "string" || !ITEM_ID_PATTERN.test(id)) {
      throw new ApiValidationError(`items[${i}].id must match ${ITEM_ID_PATTERN}`);
    }
    if (seen.has(id)) {
      throw new ApiValidationError(`items contains duplicate id "${id}"`);
    }
    seen.add(id);
    // `undefined` is not a JSON value, and JSON.stringify silently drops it
    // rather than failing — so an item that looks written would come back
    // without its data. Refuse instead. A circular structure throws here too.
    if (item.data === undefined) {
      throw new ApiValidationError(`items[${i}].data must be a JSON value`);
    }
    try {
      if (JSON.stringify(item.data) === undefined) {
        throw new ApiValidationError(`items[${i}].data must be a JSON value`);
      }
    } catch (error) {
      if (error instanceof ApiValidationError) throw error;
      throw new ApiValidationError(`items[${i}].data must be a JSON value`);
    }
    return { id, data: item.data };
  });
}

function assertIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiValidationError("ids must be a non-empty array if present");
  }
  if (value.length > MAX_BUCKET_ITEMS) {
    throw new ApiValidationError(`ids exceeds the ${MAX_BUCKET_ITEMS}-item per-bucket cap`);
  }
  return value.map((id, i) => {
    if (typeof id !== "string" || !ITEM_ID_PATTERN.test(id)) {
      throw new ApiValidationError(`ids[${i}] must match ${ITEM_ID_PATTERN}`);
    }
    return id;
  });
}

/** The store throws RangeError for a cap; that is a caller problem, not a
 * host failure, so it becomes BAD_ARGS rather than HANDLER_ERROR. */
function asValidationError(error: unknown): never {
  if (error instanceof RangeError) throw new ApiValidationError(error.message);
  throw error;
}

export const methods: ApiNamespace = {
  write: {
    permission: "buckets:publish",
    handler: (ctx, bucketIdArg, itemsArg) => {
      const { bucket, kind } = ownBucket(ctx.addonId, bucketIdArg);
      const items = assertItems(itemsArg);
      let stats;
      try {
        stats = writeItems(ctx.addonId, bucket, kind, items);
      } catch (error) {
        asValidationError(error);
      }
      emitBucketChanged({
        owner: ctx.addonId,
        bucket,
        kind,
        change: "write",
        itemIds: items.map((i) => i.id),
        itemCount: stats.itemCount,
      });
      return stats;
    },
  },

  clear: {
    permission: "buckets:publish",
    handler: (ctx, bucketIdArg, idsArg) => {
      const { bucket, kind } = ownBucket(ctx.addonId, bucketIdArg);
      const ids = assertIds(idsArg);
      const stats = clearItems(ctx.addonId, bucket, kind, ids);
      emitBucketChanged({
        owner: ctx.addonId,
        bucket,
        kind,
        change: "clear",
        ...(ids ? { itemIds: ids } : {}),
        itemCount: stats.itemCount,
      });
      return stats;
    },
  },

  list: {
    handler: (ctx) => listFor(ctx.addonId),
  },

  read: {
    handler: (ctx, ownerArg, bucketArg) => {
      // Both patterns are checked before any lookup, so a rejection here can
      // only be caused by input that could never name a bucket — it reveals
      // nothing about what exists.
      const owner = assertString(ownerArg, "ownerId");
      const bucket = assertString(bucketArg, "bucketId");
      if (!ID_PATTERN.test(owner)) throw new ApiValidationError(`ownerId must match ${ID_PATTERN}`);
      if (!ID_PATTERN.test(bucket)) throw new ApiValidationError(`bucketId must match ${ID_PATTERN}`);
      // From here every refusal is the same `null`. See readFor.
      return readFor(ctx.addonId, owner, bucket);
    },
  },
};
