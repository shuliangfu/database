/**
 * 软删除过滤的共享骨架。SQL / Mongo 方言条件仍由调用方套用。
 */

export type SoftDeleteScope = "all" | "only-trashed" | "exclude-trashed";

export function resolveSoftDeleteScope(
  softDelete: boolean,
  includeTrashed: boolean,
  onlyTrashed: boolean,
): SoftDeleteScope {
  if (!softDelete) {
    return "all";
  }
  if (onlyTrashed) {
    return "only-trashed";
  }
  if (includeTrashed) {
    return "all";
  }
  return "exclude-trashed";
}

/**
 * 向 SQL 条件数组追加软删除谓词（IS NULL / IS NOT NULL）。
 */
export function appendSqlSoftDeleteCondition(
  conditions: string[],
  escapedDeletedAtField: string,
  softDelete: boolean,
  includeTrashed: boolean,
  onlyTrashed: boolean,
): void {
  const scope = resolveSoftDeleteScope(softDelete, includeTrashed, onlyTrashed);
  if (scope === "only-trashed") {
    conditions.push(`${escapedDeletedAtField} IS NOT NULL`);
  } else if (scope === "exclude-trashed") {
    conditions.push(`${escapedDeletedAtField} IS NULL`);
  }
}

/**
 * 为 Mongo 查询过滤器追加软删除条件。
 */
export function applyMongoSoftDeleteFilter(
  filter: Record<string, any>,
  deletedAtField: string,
  softDelete: boolean,
  includeTrashed: boolean = false,
  onlyTrashed: boolean = false,
): Record<string, any> {
  if (!softDelete || includeTrashed) {
    return filter;
  }
  if (onlyTrashed) {
    return {
      ...filter,
      [deletedAtField]: { $exists: true, $ne: null },
    };
  }
  const notDeleted = {
    $or: [
      { [deletedAtField]: { $exists: false } },
      { [deletedAtField]: null },
    ],
  };
  // 用户条件已有 $or / $and 时不能覆盖，改为 $and 组合软删谓词
  if (filter.$or !== undefined || filter.$and !== undefined) {
    return { $and: [filter, notDeleted] };
  }
  return {
    ...filter,
    ...notDeleted,
  };
}
