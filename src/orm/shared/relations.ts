/**
 * belongsTo / hasOne / hasMany 的共用骨架。
 * 调用方负责 ensureAdapter；查找实现仍走各模型的 find / findAll。
 *
 * find / findAll 在模型上有重载（无参时返回查询构建器），这里用宽松签名
 * 只描述关联骨架实际使用的调用形态。
 */

export type QueryRecord = Record<string, unknown>;

/**
 * find / findAll 有重载（无参时返回构建器）。
 * 使用方法签名（双变）以便 SQLModel / MongoModel 子类可以赋给此类型。
 */
/** 方法比较走双变，以便抽象 Model 的静态 find / findAll（返回 thenable 构建器）可赋给关联预加载接口。 */
type BivariantCallback<T extends (...args: never[]) => unknown> = {
  bivarianceHack(...args: Parameters<T>): ReturnType<T>;
}["bivarianceHack"];

export interface RelatedFindModel {
  primaryKey: string;
  tableName?: string;
  collectionName?: string;
  find: BivariantCallback<
    (
      condition?: unknown,
      fields?: string[],
      includeTrashed?: boolean,
      onlyTrashed?: boolean,
    ) => unknown
  >;
}

export interface RelatedFindAllModel extends RelatedFindModel {
  findAll: BivariantCallback<
    (
      condition?: unknown,
      fields?: string[],
      options?: unknown,
      includeTrashed?: boolean,
      onlyTrashed?: boolean,
    ) => unknown
  >;
}

function asRecords(value: unknown): QueryRecord[] {
  if (!Array.isArray(value)) return [];
  return value as QueryRecord[];
}

function asRecord(value: unknown): QueryRecord | null {
  if (value == null || typeof value !== "object") return null;
  return value as QueryRecord;
}

export async function belongsToRelated(
  instance: QueryRecord,
  RelatedModel: RelatedFindModel,
  foreignKey: string,
  localKey?: string,
  fields?: string[],
  includeTrashed: boolean = false,
  onlyTrashed: boolean = false,
): Promise<any> {
  const relatedKey = localKey || RelatedModel.primaryKey;
  const foreignValue = instance[foreignKey];
  if (!foreignValue) {
    return null;
  }
  return asRecord(
    await RelatedModel.find(
      { [relatedKey]: foreignValue },
      fields,
      includeTrashed,
      onlyTrashed,
    ),
  );
}

export async function hasOneRelated(
  instance: QueryRecord,
  ownerPrimaryKey: string,
  RelatedModel: RelatedFindModel,
  foreignKey: string,
  localKey?: string,
  fields?: string[],
  includeTrashed: boolean = false,
  onlyTrashed: boolean = false,
): Promise<any> {
  const localKeyValue = localKey || ownerPrimaryKey;
  const localValue = instance[localKeyValue];
  if (!localValue) {
    return null;
  }
  return asRecord(
    await RelatedModel.find(
      { [foreignKey]: localValue },
      fields,
      includeTrashed,
      onlyTrashed,
    ),
  );
}

export async function hasManyRelated(
  instance: QueryRecord,
  ownerPrimaryKey: string,
  RelatedModel: RelatedFindAllModel,
  foreignKey: string,
  localKey?: string,
  fields?: string[],
  options?: {
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    skip?: number;
    limit?: number;
  },
  includeTrashed: boolean = false,
  onlyTrashed: boolean = false,
): Promise<any[]> {
  const localKeyValue = localKey || ownerPrimaryKey;
  const localValue = instance[localKeyValue];
  if (!localValue) {
    return [];
  }
  return asRecords(
    await RelatedModel.findAll(
      { [foreignKey]: localValue },
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    ),
  );
}

export async function belongsToManyRelated(
  instance: Record<string, unknown>,
  ownerPrimaryKey: string,
  RelatedModel: RelatedFindAllModel,
  PivotModel: RelatedFindAllModel,
  foreignKey: string,
  otherKey: string,
  localKey?: string,
  relatedKey?: string,
  fields?: string[],
  options?: {
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    skip?: number;
    limit?: number;
  },
  includeTrashed: boolean = false,
  onlyTrashed: boolean = false,
): Promise<QueryRecord[]> {
  const ownerKey = localKey || ownerPrimaryKey;
  const ownerValue = instance[ownerKey];
  if (ownerValue == null || ownerValue === "") {
    return [];
  }
  const pivots = asRecords(
    await PivotModel.findAll(
      { [foreignKey]: ownerValue },
      [foreignKey, otherKey],
      undefined,
      includeTrashed,
      onlyTrashed,
    ),
  );
  const relatedIds = uniqueValues(pivots.map((row) => row[otherKey]));
  if (relatedIds.length === 0) {
    return [];
  }
  const rk = relatedKey || RelatedModel.primaryKey;
  const related = asRecords(
    await RelatedModel.findAll(
      { [rk]: { $in: relatedIds } },
      mergeJoinFields(fields, rk),
      options?.sort ? { sort: options.sort } : undefined,
      includeTrashed,
      onlyTrashed,
    ),
  );
  const map = new Map<string, QueryRecord>();
  for (const item of related) {
    map.set(String(item[rk]), item);
  }
  const ordered: QueryRecord[] = [];
  for (const pivot of pivots) {
    const item = map.get(String(pivot[otherKey]));
    if (item) ordered.push(item);
  }
  return sliceGroup(ordered, options?.skip, options?.limit);
}

/** 预加载关联定义（含 belongsToMany） */
export type PreloadRelationType =
  | "belongsTo"
  | "hasOne"
  | "hasMany"
  | "belongsToMany";

export interface PreloadSpec {
  type: PreloadRelationType;
  /** belongsTo / hasOne / hasMany / belongsToMany 的目标模型 */
  model: RelatedFindAllModel;
  /**
   * belongsTo：本表外键；
   * hasOne / hasMany：关联表外键；
   * belongsToMany：中间表指向本表的外键。
   */
  foreignKey: string;
  /**
   * belongsTo：关联表主键，默认 RelatedModel.primaryKey；
   * hasOne / hasMany / belongsToMany：本表主键，由调用方在未指定时填入。
   */
  localKey?: string;
  /** belongsToMany：中间表指向目标模型的外键 */
  otherKey?: string;
  /** belongsToMany：目标模型主键，默认 model.primaryKey */
  relatedKey?: string;
  /** belongsToMany：中间表模型（与 model 一样走 findAll） */
  pivot?: RelatedFindAllModel;
  fields?: string[];
  /** 挂到实例上的属性名，默认使用 with() 的键名 */
  as?: string;
  includeTrashed?: boolean;
  onlyTrashed?: boolean;
  sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
  skip?: number;
  limit?: number;
}

export type PreloadRelations = Record<string, PreloadSpec>;

/** 缓存键用的稳定预加载签名 */
export function serializePreloadSignature(
  relations?: PreloadRelations,
): string | undefined {
  if (!relations) return undefined;
  const names = Object.keys(relations).sort();
  if (names.length === 0) return undefined;
  return names.map((name) => {
    const spec = relations[name];
    const modelName = spec.model.tableName || spec.model.collectionName || "";
    const fields = spec.fields ? [...spec.fields].sort().join(",") : "";
    const sortSpec = spec.sort;
    const sort = !sortSpec
      ? ""
      : typeof sortSpec === "string"
      ? sortSpec
      : Object.entries(sortSpec).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`).join(",");
    return [
      name,
      spec.type,
      spec.as ?? "",
      spec.foreignKey,
      spec.otherKey ?? "",
      spec.localKey ?? "",
      spec.relatedKey ?? "",
      modelName,
      spec.pivot
        ? (spec.pivot.tableName || spec.pivot.collectionName || "")
        : "",
      fields,
      spec.includeTrashed ? "1" : "0",
      spec.onlyTrashed ? "1" : "0",
      sort,
      spec.skip ?? "",
      spec.limit ?? "",
    ].join("/");
  }).join(";");
}

/** 预加载时父行必须带上的本表字段（避免 fields() 裁掉关联键） */
export function preloadParentKeys(
  ownerPrimaryKey: string,
  relations: PreloadRelations,
): string[] {
  const keys = new Set<string>();
  for (const spec of Object.values(relations)) {
    if (spec.type === "belongsTo") {
      keys.add(spec.foreignKey);
    } else {
      // hasOne / hasMany / belongsToMany 都需要本表主键（或 localKey）
      keys.add(spec.localKey || ownerPrimaryKey);
    }
  }
  return [...keys];
}

/** 若父查询做了字段裁剪，把关联所需的键合并进去；未裁剪则保持原样 */
export function mergePreloadFields(
  fields: string[] | undefined,
  ownerPrimaryKey: string,
  relations: PreloadRelations | undefined,
): string[] | undefined {
  if (
    !fields || fields.length === 0 || !relations ||
    Object.keys(relations).length === 0
  ) {
    return fields;
  }
  const merged = new Set(fields);
  for (const key of preloadParentKeys(ownerPrimaryKey, relations)) {
    merged.add(key);
  }
  return [...merged];
}

function mergeJoinFields(
  fields: string[] | undefined,
  joinKey: string,
): string[] | undefined {
  if (!fields || fields.length === 0) return fields;
  if (fields.includes(joinKey)) return fields;
  return [...fields, joinKey];
}

function uniqueValues(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function groupByKey(
  rows: QueryRecord[],
  key: string,
): Map<string, QueryRecord[]> {
  const map = new Map<string, QueryRecord[]>();
  for (const row of rows) {
    const raw = row?.[key];
    if (raw === null || raw === undefined) continue;
    const id = String(raw);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

function sliceGroup(
  rows: QueryRecord[],
  skip?: number,
  limit?: number,
): QueryRecord[] {
  const start = typeof skip === "number" ? Math.max(0, skip) : 0;
  if (typeof limit === "number") {
    return rows.slice(start, start + Math.max(1, limit));
  }
  return start > 0 ? rows.slice(start) : rows;
}

/**
 * 按关联定义批量挂载 belongsTo / hasOne / hasMany，避免 N+1。
 * 每条关联最多一次 findAll；hasMany 的 skip/limit 在分组后按父记录切片，以对齐懒加载语义。
 * 软删与字段裁剪由各 PreloadSpec 显式控制，不继承父查询的 includeTrashed。
 */
export async function preloadRelations(
  instances: QueryRecord[],
  ownerPrimaryKey: string,
  relations: PreloadRelations,
): Promise<void> {
  if (!instances.length || !relations || Object.keys(relations).length === 0) {
    return;
  }

  for (const [name, spec] of Object.entries(relations)) {
    const attr = spec.as || name;
    const includeTrashed = spec.includeTrashed ?? false;
    const onlyTrashed = spec.onlyTrashed ?? false;

    if (spec.type === "belongsTo") {
      const relatedKey = spec.localKey || spec.model.primaryKey;
      const values = uniqueValues(
        instances.map((row) => row[spec.foreignKey]),
      );
      if (values.length === 0) {
        for (const row of instances) row[attr] = null;
        continue;
      }
      const related = asRecords(
        await spec.model.findAll(
          { [relatedKey]: { $in: values } },
          mergeJoinFields(spec.fields, relatedKey),
          undefined,
          includeTrashed,
          onlyTrashed,
        ),
      );
      const map = new Map<string, QueryRecord>();
      for (const item of related) {
        map.set(String(item[relatedKey]), item);
      }
      for (const row of instances) {
        const key = row[spec.foreignKey];
        row[attr] = key == null ? null : (map.get(String(key)) ?? null);
      }
      continue;
    }

    if (spec.type === "belongsToMany") {
      const otherKey = spec.otherKey;
      const pivot = spec.pivot;
      if (!otherKey || !pivot) {
        throw new Error(
          "belongsToMany requires pivot and otherKey",
        );
      }
      const localKey = spec.localKey || ownerPrimaryKey;
      const relatedKey = spec.relatedKey || spec.model.primaryKey;
      const ownerIds = uniqueValues(instances.map((row) => row[localKey]));
      if (ownerIds.length === 0) {
        for (const row of instances) row[attr] = [];
        continue;
      }
      const pivots = asRecords(
        await pivot.findAll(
          { [spec.foreignKey]: { $in: ownerIds } },
          [spec.foreignKey, otherKey],
          undefined,
          includeTrashed,
          onlyTrashed,
        ),
      );
      const relatedIds = uniqueValues(pivots.map((row) => row[otherKey]));
      if (relatedIds.length === 0) {
        for (const row of instances) row[attr] = [];
        continue;
      }
      const related = asRecords(
        await spec.model.findAll(
          { [relatedKey]: { $in: relatedIds } },
          mergeJoinFields(spec.fields, relatedKey),
          spec.sort ? { sort: spec.sort } : undefined,
          includeTrashed,
          onlyTrashed,
        ),
      );
      const relatedMap = new Map<string, QueryRecord>();
      for (const item of related) {
        relatedMap.set(String(item[relatedKey]), item);
      }
      const pivotsByOwner = groupByKey(pivots, spec.foreignKey);
      for (const row of instances) {
        const ownerPivots = pivotsByOwner.get(String(row[localKey])) || [];
        const items: QueryRecord[] = [];
        for (const pivotRow of ownerPivots) {
          const item = relatedMap.get(String(pivotRow[otherKey]));
          if (item) items.push(item);
        }
        row[attr] = sliceGroup(items, spec.skip, spec.limit);
      }
      continue;
    }

    const localKey = spec.localKey || ownerPrimaryKey;
    const values = uniqueValues(instances.map((row) => row[localKey]));
    if (values.length === 0) {
      for (const row of instances) {
        row[attr] = spec.type === "hasMany" ? [] : null;
      }
      continue;
    }

    const options = spec.sort ? { sort: spec.sort } : undefined;
    const related = asRecords(
      await spec.model.findAll(
        { [spec.foreignKey]: { $in: values } },
        mergeJoinFields(spec.fields, spec.foreignKey),
        options,
        includeTrashed,
        onlyTrashed,
      ),
    );
    const grouped = groupByKey(related, spec.foreignKey);

    if (spec.type === "hasOne") {
      for (const row of instances) {
        const group = grouped.get(String(row[localKey])) || [];
        row[attr] = group[0] ?? null;
      }
    } else {
      for (const row of instances) {
        const group = grouped.get(String(row[localKey])) || [];
        row[attr] = sliceGroup(group, spec.skip, spec.limit);
      }
    }
  }
}

export async function applyPreloads<T>(
  result: T[] | T | null,
  ownerPrimaryKey: string,
  relations: PreloadRelations | undefined,
): Promise<T[] | T | null> {
  if (!relations || Object.keys(relations).length === 0 || result == null) {
    return result;
  }
  const list = Array.isArray(result) ? result : [result];
  await preloadRelations(
    list as QueryRecord[],
    ownerPrimaryKey,
    relations,
  );
  return result;
}
