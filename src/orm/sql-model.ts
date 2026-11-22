/**
 * SQL 模型基类
 * 提供 ORM 功能，支持对象条件查询和字段选择
 */

import type { CacheAdapter } from "../cache/mod.ts";
import type { DatabaseAdapter } from "../types.ts";
import type {
  ReturningOperation,
  SqlAdapter,
} from "../adapters/sql-dialect.ts";
import {
  assertSafeSqlIdentifier,
  formatSqlDateTime,
  isSqlAdapter,
} from "../adapters/sql-dialect.ts";
import type { IndexDefinitions } from "../types/indexes.ts";
import type { Locale } from "../i18n.ts";
import { $tr, setDatabaseLocale } from "../i18n.ts";

import type {
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  PreloadRelations,
  ValidationHost,
} from "./shared/mod.ts";
import type {
  CacheQueryOptions,
  SqlAggregates,
  SqlHaving,
} from "./shared/mod.ts";
import {
  appendGroupByHaving,
  appendSqlSoftDeleteCondition,
  applyCreateTimestamps,
  applyPreloads,
  applyUpdateTimestamp,
  applyVirtuals as applyVirtualsShared,
  asModelId,
  assignData,
  assignHookChangesIfChanged,
  belongsToManyRelated,
  belongsToRelated,
  clearModelCache,
  formatAggregateSelect,
  generateModelCacheKey,
  getRecordValue,
  getSchemaKeys as getSchemaKeysShared,
  getVirtuals as getVirtualsShared,
  hasManyRelated,
  hasObjectChanged as hasObjectChangedShared,
  hasOneRelated,
  lazyThenable,
  mergeCreateManyHookFields,
  mergePreloadFields,
  mergeUpdateHookFields,
  normalizeGroupBy,
  readAffectedRows,
  readInsertId,
  readResultRows,
  runHookAndMergeIfChanged,
  serializeCacheKeyParams as serializeCacheKeyParamsShared,
  serializePreloadSignature,
  setRecordValue,
  validateFieldAsync as validateFieldAsyncShared,
  validateRecord,
  validateSqlField,
  ValidationError,
} from "./shared/mod.ts";

/**
 * 查询条件类型
 * 支持对象形式的查询条件，包括操作符
 */
export type WhereCondition = {
  [key: string]: unknown | {
    $gt?: unknown;
    $lt?: unknown;
    $gte?: unknown;
    $lte?: unknown;
    $ne?: unknown;
    $in?: unknown[];
    $like?: string;
  };
};

export type CombinedWhere = {
  __combined: Array<{
    type: "where" | "or" | "and";
    condition: WhereCondition | number | string;
  }>;
};

export type FindCondition = WhereCondition | CombinedWhere | number | string;

export { ValidationError } from "./shared/mod.ts";
export type {
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  ValidationRule,
} from "./shared/mod.ts";

/**
 * 生命周期钩子函数类型
 */
/**
 * SQL 查找查询构建器类型（用于打破循环引用）
 */
/**
 * SQL 数组查询构建器类型（返回纯 JSON 对象）
 */
export type SQLArrayQueryBuilder<T extends typeof SQLModel> = {
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => SQLArrayQueryBuilder<T>;
  skip: (n: number) => SQLArrayQueryBuilder<T>;
  limit: (n: number) => SQLArrayQueryBuilder<T>;
  fields: (fields: string[]) => SQLArrayQueryBuilder<T>;
  includeTrashed: () => SQLArrayQueryBuilder<T>;
  onlyTrashed: () => SQLArrayQueryBuilder<T>;
  with: (relations: PreloadRelations) => SQLArrayQueryBuilder<T>;
  preload: (relations: PreloadRelations) => SQLArrayQueryBuilder<T>;
  groupBy: (columns: string | string[]) => SQLArrayQueryBuilder<T>;
  having: (condition: string, params?: unknown[]) => SQLArrayQueryBuilder<T>;
  aggregate: (aggregates: SqlAggregates) => SQLArrayQueryBuilder<T>;
  findAll: () => Promise<Record<string, any>[]>;
  findOne: () => Promise<Record<string, any> | null>;
  one: () => Promise<Record<string, any> | null>;
  all: () => Promise<Record<string, any>[]>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  distinct: (field: string) => Promise<any[]>;
  paginate: (
    page: number,
    pageSize: number,
  ) => Promise<{
    data: Record<string, any>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
};

export type SQLFindQueryBuilder<T extends typeof SQLModel> = {
  orWhere: (
    condition: FindCondition,
  ) => SQLFindQueryBuilder<T>;
  andWhere: (
    condition: FindCondition,
  ) => SQLFindQueryBuilder<T>;
  orLike: (condition: WhereCondition) => SQLFindQueryBuilder<T>;
  andLike: (condition: WhereCondition) => SQLFindQueryBuilder<T>;
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => SQLFindQueryBuilder<T>;
  skip: (n: number) => SQLFindQueryBuilder<T>;
  limit: (n: number) => SQLFindQueryBuilder<T>;
  fields: (fields: string[]) => SQLFindQueryBuilder<T>;
  includeTrashed: () => SQLFindQueryBuilder<T>;
  onlyTrashed: () => SQLFindQueryBuilder<T>;
  with: (relations: PreloadRelations) => SQLFindQueryBuilder<T>;
  preload: (relations: PreloadRelations) => SQLFindQueryBuilder<T>;
  groupBy: (columns: string | string[]) => SQLFindQueryBuilder<T>;
  having: (condition: string, params?: unknown[]) => SQLFindQueryBuilder<T>;
  aggregate: (aggregates: SqlAggregates) => SQLFindQueryBuilder<T>;
  findAll: () => Promise<InstanceType<T>[]>;
  findOne: () => Promise<InstanceType<T> | null>;
  one: () => Promise<InstanceType<T> | null>;
  all: () => Promise<InstanceType<T>[]>;
  asArray: () => SQLArrayQueryBuilder<T>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  distinct: (field: string) => Promise<any[]>;
  paginate: (
    page: number,
    pageSize: number,
  ) => Promise<{
    data: InstanceType<T>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  then: (
    onfulfilled?: (value: InstanceType<T> | null) => any,
    onrejected?: (reason: any) => any,
  ) => Promise<any>;
  catch: (onrejected?: (reason: any) => any) => Promise<any>;
  finally: (onfinally?: () => void) => Promise<any>;
};

/* LifecycleHook 由 ./shared/mod.ts 再导出 */

/**
 * SQL 链式查询构建器类型
 * 使用递归类型定义，避免循环引用
 */
export type SQLQueryBuilder<T extends typeof SQLModel> = {
  where: (
    condition: FindCondition,
  ) => SQLQueryBuilder<T>;
  orWhere: (
    condition: FindCondition,
  ) => SQLQueryBuilder<T>;
  andWhere: (
    condition: FindCondition,
  ) => SQLQueryBuilder<T>;
  like: (condition: WhereCondition) => SQLQueryBuilder<T>;
  orLike: (condition: WhereCondition) => SQLQueryBuilder<T>;
  andLike: (condition: WhereCondition) => SQLQueryBuilder<T>;
  fields: (fields: string[]) => SQLQueryBuilder<T>;
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => SQLQueryBuilder<T>;
  skip: (n: number) => SQLQueryBuilder<T>;
  limit: (n: number) => SQLQueryBuilder<T>;
  includeTrashed: () => SQLQueryBuilder<T>;
  onlyTrashed: () => SQLQueryBuilder<T>;
  with: (relations: PreloadRelations) => SQLQueryBuilder<T>;
  preload: (relations: PreloadRelations) => SQLQueryBuilder<T>;
  groupBy: (columns: string | string[]) => SQLQueryBuilder<T>;
  having: (condition: string, params?: unknown[]) => SQLQueryBuilder<T>;
  aggregate: (aggregates: SqlAggregates) => SQLQueryBuilder<T>;
  findAll: () => Promise<InstanceType<T>[]>;
  findOne: () => Promise<InstanceType<T> | null>;
  one: () => Promise<InstanceType<T> | null>;
  all: () => Promise<InstanceType<T>[]>;
  asArray: () => SQLArrayQueryBuilder<T>;
  findById: (
    id: number | string,
    fields?: string[],
  ) => Promise<InstanceType<T> | null>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  update: (
    data: Record<string, any>,
    returnLatest?: boolean,
  ) => Promise<number | InstanceType<T>>;
  updateById: (
    id: number | string,
    data: Record<string, any>,
  ) => Promise<number>;
  updateMany: (data: Record<string, any>) => Promise<number>;
  increment: (
    field: string,
    amount?: number,
    returnLatest?: boolean,
  ) => Promise<number | InstanceType<T>>;
  decrement: (
    field: string,
    amount?: number,
    returnLatest?: boolean,
  ) => Promise<number | InstanceType<T>>;
  deleteById: (id: number | string) => Promise<number>;
  deleteMany: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  restore: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  restoreById: (id: number | string) => Promise<number>;
  forceDelete: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  forceDeleteById: (id: number | string) => Promise<number>;
  distinct: (field: string) => Promise<any[]>;
  upsert: (
    data: Record<string, any>,
    returnLatest?: boolean,
    resurrect?: boolean,
  ) => Promise<InstanceType<T>>;
  findOrCreate: (
    data: Record<string, any>,
    resurrect?: boolean,
  ) => Promise<InstanceType<T>>;
  findOneAndUpdate: (
    data: Record<string, any>,
  ) => Promise<InstanceType<T> | null>;
  findOneAndDelete: () => Promise<InstanceType<T> | null>;
  paginate: (
    page: number,
    pageSize: number,
  ) => Promise<{
    data: InstanceType<T>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  then: (
    onfulfilled?: (value: InstanceType<T> | null) => any,
    onrejected?: (reason: any) => any,
  ) => Promise<any>;
  catch: (onrejected?: (reason: any) => any) => Promise<any>;
  finally: (onfinally?: () => void) => Promise<any>;
};

/**
 * SQL 模型基类
 * 所有 SQL 数据库模型都应该继承此类
 */
export abstract class SQLModel {
  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   * 设置后，验证错误等用户面向文案将使用该语言
   */
  static lang?: Locale;

  /**
   * 表名（子类必须定义）
   */
  static tableName: string;

  /**
   * 主键字段名（默认为 'id'）
   */
  static primaryKey: string = "id";

  /** 子类可选的字段定义 */
  static schema?: ModelSchema;

  /** 子类可选：create/update 走方言 upsert */
  static useDialectUpsert?: boolean;

  /** 子类可选：方言 upsert 冲突列 */
  static upsertConflictKeys?: string[];

  /**
   * 数据库适配器实例（子类需要设置）
   * 注意：访问此属性时会自动初始化（通过 getter）
   */
  private static _adapter: DatabaseAdapter | null = null;

  /**
   * 数据库适配器实例（自动初始化）
   * 访问此属性前需要先调用 await this.ensureAdapter() 确保初始化
   * 注意：由于 getter 不能是异步的，所以需要在异步方法中先初始化
   */
  static get adapter(): DatabaseAdapter {
    if (!this._adapter) {
      if (this.lang !== undefined) {
        setDatabaseLocale(this.lang);
      }
      throw new Error(
        $tr("model.adapterNotInitialized", {
          table: this.tableName,
        }),
      );
    }
    return this._adapter;
  }

  static set adapter(value: DatabaseAdapter | null) {
    this._adapter = value;
  }

  /** 抽象基类不能直接 new，子类构造器用这一处收窄。 */
  private static createInstance<T extends typeof SQLModel>(
    this: T,
  ): InstanceType<T> {
    const Ctor = this as unknown as { new (): InstanceType<T> };
    return new Ctor();
  }

  private static validationHost(): ValidationHost {
    return this.makeValidationHost(this);
  }

  private static makeValidationHost(model: typeof SQLModel): ValidationHost {
    return {
      dialect: "sql",
      model,
      get storeName() {
        return model.tableName;
      },
      setStoreName: (name: string) => {
        model.tableName = name;
      },
      get primaryKey() {
        return model.primaryKey;
      },
      existsNullKey: "id",
      missingStoreMessageKey: "model.tableNameRequired",
      defaultPrimaryKey: "id",
      ensureAdapter: () => model.ensureAdapter(),
      queryExists: (where: Record<string, any>) =>
        model.query().where(where).exists(),
      queryFindOne: (where: Record<string, any>, fields: string[]) =>
        model.query().where(where).fields(fields).findOne(),
      getSchema: () => model.schema,
      getSchemaKeys: () => model.getSchemaKeys(),
    };
  }

  /**
   * 获取 Schema 键（带缓存）
   * 性能优化：缓存 schema 键，避免重复调用 Object.keys()
   * @returns Schema 字段名数组
   */
  private static getSchemaKeys(): string[] {
    return getSchemaKeysShared(this, this.schema);
  }

  /**
   * 获取虚拟字段定义（带缓存）
   * 性能优化：缓存虚拟字段定义，避免重复调用 Object.entries()
   * @returns 虚拟字段定义数组 [name, getter][]
   */
  private static getVirtuals(): Array<[string, (instance: any) => any]> {
    return getVirtualsShared(this, this.virtuals);
  }

  /**
   * 应用虚拟字段到实例（性能优化：使用缓存的虚拟字段定义）
   * @param instance 模型实例
   */
  private static applyVirtuals(instance: any): void {
    applyVirtualsShared(this, instance, this.virtuals);
  }

  /**
   * 是否启用软删除（默认为 false）
   * 启用后，删除操作会设置 deletedAt 字段而不是真正删除记录
   */
  static softDelete: boolean = false;

  /**
   * 软删除字段名（默认为 'deletedAt'）
   * 可以自定义为 'deleted_at' 等
   */
  static deletedAtField: string = "deletedAt";

  /**
   * 是否自动管理时间戳
   * - false: 不启用时间戳
   * - true: 启用时间戳，使用默认字段名（createdAt, updatedAt）
   * - 对象: 启用时间戳并自定义字段名，例如 { createdAt: 'created_at', updatedAt: 'updated_at' }
   *
   * @example
   * static timestamps = true; // 使用默认字段名
   * static timestamps = { createdAt: 'created_at', updatedAt: 'updated_at' }; // 自定义字段名
   */
  static timestamps: boolean | { createdAt?: string; updatedAt?: string } =
    false;

  /**
   * 生命周期钩子（可选，子类可以重写这些方法）
   *
   * @example
   * static async beforeCreate(instance: User) {
   *   instance.createdAt = new Date();
   * }
   *
   * static async afterCreate(instance: User) {
   *   console.log('User created:', instance);
   * }
   */
  static beforeCreate?: LifecycleHook;
  static afterCreate?: LifecycleHook;
  static beforeUpdate?: LifecycleHook;
  static afterUpdate?: LifecycleHook;
  static beforeDelete?: LifecycleHook;
  static afterDelete?: LifecycleHook;
  static beforeSave?: LifecycleHook;
  static afterSave?: LifecycleHook;
  static beforeValidate?: LifecycleHook;
  static afterValidate?: LifecycleHook;

  /**
   * 查询作用域（可选，子类可以定义常用的查询条件）
   *
   * @example
   * static scopes = {
   *   active: () => ({ status: 'active' }),
   *   published: () => ({ published: true, deletedAt: null }),
   *   recent: () => ({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
   * };
   *
   * // 使用
   * const activeUsers = await User.scope('active').findAll();
   */
  static scopes?: Record<string, () => WhereCondition>;

  /**
   * 虚拟字段（可选，子类可以定义计算属性）
   *
   * @example
   * static virtuals = {
   *   fullName: (instance: User) => `${instance.firstName} ${instance.lastName}`,
   *   isAdult: (instance: User) => instance.age >= 18
   * };
   *
   * // 使用
   * const user = await User.find(1);
   * console.log(user.fullName); // 自动计算
   */
  static virtuals?: Record<string, (instance: any) => any>;

  /**
   * 索引定义（可选，用于定义数据库索引）
   *
   * @example
   * // 单个字段索引
   * static indexes = [
   *   { field: 'email', unique: true },
   *   { field: 'createdAt', direction: -1 }
   * ];
   *
   * // 复合索引
   * static indexes = [
   *   { fields: { userId: 1, createdAt: -1 }, unique: true }
   * ];
   */
  static indexes?: IndexDefinitions;

  /**
   * 实例数据
   */
  [key: string]: any;

  /**
   * 缓存适配器（可选，用于查询结果缓存）
   */
  static cacheAdapter?: CacheAdapter;

  /**
   * 缓存 TTL（秒，默认 3600）
   */
  static cacheTTL: number = 3600;

  /**
   * 生成缓存键（带缓存优化）
   * 性能优化：
   * 1. 条件生成：只在有缓存适配器时才生成缓存键
   * 2. 缓存键缓存：缓存已生成的缓存键，避免重复计算
   * @param condition 查询条件
   * @param fields 字段列表
   * @param options 查询选项
   * @param includeTrashed 是否包含已删除的记录
   * @param onlyTrashed 是否只查询已删除的记录
   * @returns 缓存键（如果无缓存适配器，返回空字符串）
   */
  private static generateCacheKey(
    condition: FindCondition,
    fields?: string[],
    options?: CacheQueryOptions,
    includeTrashed?: boolean,
    onlyTrashed?: boolean,
  ): string {
    return generateModelCacheKey(
      this,
      this.tableName,
      !!this.cacheAdapter,
      condition,
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * 序列化缓存键参数（用于缓存键缓存）
   * @param condition 查询条件
   * @param fields 字段列表
   * @param options 查询选项
   * @param includeTrashed 是否包含已删除的记录
   * @param onlyTrashed 是否只查询已删除的记录
   * @returns 序列化的参数键
   */
  private static serializeCacheKeyParams(
    condition: FindCondition,
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed?: boolean,
    onlyTrashed?: boolean,
  ): string {
    return serializeCacheKeyParamsShared(
      condition,
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * 清除模型相关缓存
   * @returns Promise<void>
   */
  private static async clearCache(): Promise<void> {
    await clearModelCache(this.cacheAdapter, this.tableName);
  }

  /**
   * 设置数据库适配器
   * @param adapter 数据库适配器实例
   */
  static setAdapter(adapter: DatabaseAdapter): void {
    this._adapter = adapter;
  }

  /**
   * 初始化模型
   * 设置数据库适配器（SQL 模型通常不需要创建索引，索引通过迁移管理）
   * 这个方法从已初始化的数据库连接中获取适配器
   * 注意：此方法只负责设置适配器，不负责连接数据库
   * 请先使用 initDatabase() 或 initDatabaseFromConfig() 初始化数据库连接
   *
   * @param connectionName 连接名称（默认为 'default'）
   * @returns Promise<void>
   *
   * @example
   * // 先初始化数据库连接
   * await initDatabase({
   *   type: 'sqlite',
   *   connection: { filename: ':memory:' }
   * });
   *
   * // 然后初始化模型（设置适配器）
   * await User.init();
   *
   * // 或使用指定连接名称
   * await User.init('secondary');
   */
  static async init(
    connectionName: string = "default",
  ): Promise<void> {
    // 动态导入以避免循环依赖
    const { getDatabaseAsync } = await import("../access.ts");

    try {
      // 从已初始化的数据库连接中获取适配器
      // 如果数据库未初始化，getDatabaseAsync 会抛出错误
      const adapter = await getDatabaseAsync(connectionName);

      // 设置适配器
      this.setAdapter(adapter);
      // 注意：SQL 模型的索引通常通过迁移管理，不在这里创建
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.initFailed", {
          table: this.tableName,
          error: message,
        }),
      );
    }
  }

  /**
   * 确保模型已初始化（懒加载）
   * 如果适配器未设置，自动尝试初始化
   * @param connectionName 连接名称（默认为 'default'）
   */
  private static async ensureInitialized(
    connectionName: string = "default",
  ): Promise<void> {
    if (!this._adapter) {
      await this.init(connectionName);
    }
  }

  /**
   * 确保模型已初始化并检查适配器
   * 这是一个辅助方法，用于在方法开始时自动初始化和验证适配器
   * @param connectionName 连接名称（默认为 'default'）
   * @throws {Error} 如果适配器未设置
   */
  private static async ensureAdapter(
    connectionName: string = "default",
  ): Promise<void> {
    if (this.lang !== undefined) {
      setDatabaseLocale(this.lang);
    }
    if (this._adapter) return;
    await this.ensureInitialized(connectionName);
    if (!this.adapter) {
      throw new Error($tr("model.adapterNotSet"));
    }
  }

  /**
   * 将查询条件对象转换为 SQL WHERE 子句
   * @param condition 查询条件对象，支持组合条件（包含 __combined 属性）
   * @returns SQL WHERE 子句和参数数组
   */
  private static buildWhereClause(
    condition: FindCondition,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): { where: string; params: any[] } {
    // 处理组合条件（来自链式查询构建器）
    if (
      condition &&
      typeof condition === "object" &&
      !Array.isArray(condition) &&
      condition.__combined
    ) {
      const combinedConditions = condition.__combined as Array<{
        type: "where" | "or" | "and";
        condition: WhereCondition | number | string;
      }>;

      // 使用 OR 分支数组来正确组织条件
      // 每个 OR 分支包含一个 AND 条件数组
      const orBranches: Array<{ conditions: string[]; params: any[] }> = [];
      let currentOrBranch: { conditions: string[]; params: any[] } | null =
        null;
      let hasOrCondition = false;

      for (const item of combinedConditions) {
        const { where: whereClause, params } = this.buildWhereClause(
          item.condition,
          false,
          false,
        );

        if (item.type === "where") {
          // where 开始新的查询组
          // 如果之前有 OR 分支，先保存它
          if (currentOrBranch && currentOrBranch.conditions.length > 0) {
            orBranches.push(currentOrBranch);
            currentOrBranch = null;
          }
          // 开始新的 OR 分支
          currentOrBranch = {
            conditions: [whereClause],
            params: [...params],
          };
          hasOrCondition = false;
        } else if (item.type === "and") {
          // andWhere 添加到当前 OR 分支
          if (!currentOrBranch) {
            // 如果没有当前分支，创建一个新的
            currentOrBranch = {
              conditions: [whereClause],
              params: [...params],
            };
          } else {
            currentOrBranch.conditions.push(whereClause);
            currentOrBranch.params.push(...params);
          }
        } else if (item.type === "or") {
          // orWhere 标记有 OR 条件，并开始新的 OR 分支
          hasOrCondition = true;
          // 如果当前有 OR 分支，先保存它
          if (currentOrBranch && currentOrBranch.conditions.length > 0) {
            orBranches.push(currentOrBranch);
          }
          // 开始新的 OR 分支
          currentOrBranch = {
            conditions: [whereClause],
            params: [...params],
          };
        }
      }

      // 处理最后一个 OR 分支
      if (currentOrBranch && currentOrBranch.conditions.length > 0) {
        orBranches.push(currentOrBranch);
      }

      // 合并所有条件
      if (hasOrCondition && orBranches.length > 0) {
        // 有 OR 条件，将所有 OR 分支组合
        const allOrGroups: string[] = [];
        const allParams: any[] = [];

        for (const branch of orBranches) {
          if (branch.conditions.length === 1) {
            allOrGroups.push(branch.conditions[0]);
          } else {
            allOrGroups.push(`(${branch.conditions.join(" AND ")})`);
          }
          allParams.push(...branch.params);
        }

        const conditions: string[] = [
          `(${allOrGroups.join(" OR ")})`,
        ];

        // 处理软删除
        if (this.softDelete) {
          const adapter = this._adapter as
            | DatabaseAdapter
            | null
            | undefined;
          const escapedDeletedAtField = SQLModel.escapeFieldName.call(
            this,
            this.deletedAtField,
            adapter,
          );
          appendSqlSoftDeleteCondition(
            conditions,
            escapedDeletedAtField,
            this.softDelete,
            includeTrashed,
            onlyTrashed,
          );
        }

        return {
          where: conditions.join(" AND "),
          params: allParams,
        };
      } else if (orBranches.length > 0) {
        // 只有 AND 条件（没有 OR）
        const branch = orBranches[0];
        const conditions: string[] = [];

        if (branch.conditions.length === 1) {
          conditions.push(branch.conditions[0]);
        } else {
          conditions.push(`(${branch.conditions.join(" AND ")})`);
        }

        // 处理软删除
        if (this.softDelete) {
          const adapter = this._adapter as
            | DatabaseAdapter
            | null
            | undefined;
          const escapedDeletedAtField = SQLModel.escapeFieldName.call(
            this,
            this.deletedAtField,
            adapter,
          );
          appendSqlSoftDeleteCondition(
            conditions,
            escapedDeletedAtField,
            this.softDelete,
            includeTrashed,
            onlyTrashed,
          );
        }

        return {
          where: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
          params: branch.params,
        };
      } else {
        // 没有条件
        const conditions: string[] = [];

        // 处理软删除
        if (this.softDelete) {
          const adapter = this._adapter as
            | DatabaseAdapter
            | null
            | undefined;
          const escapedDeletedAtField = SQLModel.escapeFieldName.call(
            this,
            this.deletedAtField,
            adapter,
          );
          appendSqlSoftDeleteCondition(
            conditions,
            escapedDeletedAtField,
            this.softDelete,
            includeTrashed,
            onlyTrashed,
          );
        }

        return {
          where: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
          params: [],
        };
      }
    }

    // 原有的单个条件处理逻辑
    // 如果是数字或字符串，作为主键查询
    if (typeof condition === "number" || typeof condition === "string") {
      const adapter = this._adapter as
        | DatabaseAdapter
        | null
        | undefined;
      const escapedPrimaryKey = SQLModel.escapeFieldName.call(
        this,
        this.primaryKey,
        adapter,
      );
      const conditions: string[] = [`${escapedPrimaryKey} = ?`];
      const params: any[] = [condition];

      // 处理软删除
      if (this.softDelete) {
        const escapedDeletedAtField = SQLModel.escapeFieldName.call(
          this,
          this.deletedAtField,
          adapter,
        );
        appendSqlSoftDeleteCondition(
          conditions,
          escapedDeletedAtField,
          this.softDelete,
          includeTrashed,
          onlyTrashed,
        );
      }

      return {
        where: conditions.join(" AND "),
        params,
      };
    }

    // 如果是对象，构建 WHERE 子句
    if (
      !condition || typeof condition !== "object" || Array.isArray(condition)
    ) {
      // 如果 condition 不是有效对象，返回空条件
      return {
        where: "1=1",
        params: [],
      };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    const adapter = this._adapter as DatabaseAdapter | null | undefined;
    for (const [key, value] of Object.entries(condition)) {
      const escapedKey = SQLModel.escapeFieldName.call(this, key, adapter);
      if (value === null || value === undefined) {
        conditions.push(`${escapedKey} IS NULL`);
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // 处理操作符
        const opValue = value as {
          $gt?: any;
          $lt?: any;
          $gte?: any;
          $lte?: any;
          $ne?: any;
          $in?: any[];
          $like?: string;
        };
        if (opValue.$gt !== undefined) {
          conditions.push(`${escapedKey} > ?`);
          params.push(opValue.$gt);
        }
        if (opValue.$lt !== undefined) {
          conditions.push(`${escapedKey} < ?`);
          params.push(opValue.$lt);
        }
        if (opValue.$gte !== undefined) {
          conditions.push(`${escapedKey} >= ?`);
          params.push(opValue.$gte);
        }
        if (opValue.$lte !== undefined) {
          conditions.push(`${escapedKey} <= ?`);
          params.push(opValue.$lte);
        }
        if (opValue.$ne !== undefined) {
          conditions.push(`${escapedKey} != ?`);
          params.push(opValue.$ne);
        }
        if (opValue.$in !== undefined) {
          const inArray = opValue.$in;
          if (Array.isArray(inArray) && inArray.length > 0) {
            const placeholders = inArray.map(() => "?").join(", ");
            conditions.push(`${escapedKey} IN (${placeholders})`);
            params.push(...inArray);
          }
        }
        if (opValue.$like !== undefined) {
          // SQLite 的 LIKE 默认是大小写不敏感的（对于 ASCII 字符）
          // 但为了确保跨数据库兼容性，使用 LOWER() 函数
          conditions.push(`LOWER(${escapedKey}) LIKE LOWER(?)`);
          params.push(opValue.$like);
        }
      } else {
        // 普通等值条件
        conditions.push(`${escapedKey} = ?`);
        params.push(value);
      }
    }

    // 处理软删除
    if (this.softDelete) {
      const escapedDeletedAtField = SQLModel.escapeFieldName.call(
        this,
        this.deletedAtField,
        adapter,
      );
      appendSqlSoftDeleteCondition(
        conditions,
        escapedDeletedAtField,
        this.softDelete,
        includeTrashed,
        onlyTrashed,
      );
    }

    return {
      where: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
      params,
    };
  }

  /**
   * 规范化排序参数（支持字符串 asc/desc）
   */
  private static normalizeSort(
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ): Record<string, "ASC" | "DESC"> | undefined {
    if (!sort) return undefined;
    if (typeof sort === "string") {
      const dir = sort.toLowerCase() === "desc" ? "DESC" : "ASC";
      return { [this.primaryKey]: dir };
    }
    const normalized: Record<string, "ASC" | "DESC"> = {};
    for (const [field, dir] of Object.entries(sort)) {
      if (typeof dir === "string") {
        normalized[field] = dir.toLowerCase() === "desc" ? "DESC" : "ASC";
      } else {
        normalized[field] = dir === -1 ? "DESC" : "ASC";
      }
    }
    return normalized;
  }

  /**
   * 构建 ORDER BY 子句内容（不包含关键字）
   */
  private static buildOrderByClause(
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ): string | undefined {
    const normalized = this.normalizeSort(sort);
    if (!normalized) return undefined;
    const adapter = this._adapter as DatabaseAdapter | null | undefined;
    const parts: string[] = [];
    for (const [field, dir] of Object.entries(normalized)) {
      const escapedField = SQLModel.escapeFieldName.call(this, field, adapter);
      parts.push(`${escapedField} ${dir}`);
    }
    return parts.join(", ");
  }

  /**
   * 处理字段（应用默认值、类型转换、验证）
   *
   * @param data 原始数据
   * @param options
   * - `applyDefaults`：**插入（create / createMany 中带 processFields 的路径、方言 upsert 的 INSERT 侧）应为 `true`**（可省略，默认即 true）；
   *   **更新（update）必须为 `false`**，否则局部 UPDATE 会把未传列写成 default。
   * - 省略 `options` 时等同 `{ applyDefaults: true }`（`options?.applyDefaults !== false`）。
   */
  private static processFields(
    data: Record<string, any>,
    options?: { applyDefaults?: boolean },
  ): Record<string, any> {
    const schema = this.schema;
    if (!schema) {
      return data;
    }

    const applyDefaults = options?.applyDefaults !== false;

    const processed: Record<string, any> = assignData({}, data);

    // 遍历 schema 中定义的字段（使用缓存的键，减少 Object.entries() 开销）
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const field = schema[fieldName] as FieldDefinition;
      if (!applyDefaults && !(fieldName in data)) {
        continue;
      }

      let value = processed[fieldName];

      // 应用默认值（仅创建/全量写入路径；局部 update 勿填充未传字段）
      if (applyDefaults && value === undefined && field.default !== undefined) {
        processed[fieldName] = typeof field.default === "function"
          ? field.default()
          : field.default;
        value = processed[fieldName];
      }

      // 类型转换
      if (processed[fieldName] !== undefined) {
        processed[fieldName] = this.convertType(
          processed[fieldName],
          field.type,
          field.enum,
        );
      }

      // Setter
      if (field.set && processed[fieldName] !== undefined) {
        processed[fieldName] = field.set(processed[fieldName]);
      }
    }

    // 注意：验证已移到 create 和 update 方法中，因为需要异步验证（数据库查询）
    // 这里只进行字段处理，不进行验证

    return processed;
  }

  /**
   * 检测对象是否有变化（浅比较，用于优化钩子合并）
   * 性能优化：只在钩子实际修改数据时才合并，避免不必要的对象复制
   * @param before 钩子执行前的对象快照
   * @param after 钩子执行后的对象
   * @returns 是否有变化
   */
  private static hasObjectChanged(
    before: Record<string, any>,
    after: Record<string, any>,
  ): boolean {
    return hasObjectChangedShared(before, after);
  }

  /**
   * 转义字段名（PostgreSQL 需要为驼峰命名的字段加双引号）
   * @param fieldName 字段名
   * @param adapter 数据库适配器（可选，用于检测数据库类型）
   * @returns 转义后的字段名
   */
  private static escapeFieldName(
    fieldName: string,
    adapter?: DatabaseAdapter | null,
  ): string {
    if (isSqlAdapter(adapter)) {
      return adapter.quoteIdentifier(fieldName);
    }
    return assertSafeSqlIdentifier(fieldName);
  }

  /** 拼进 SQL 的表名（校验并按方言引用） */
  private static quotedTable(): string {
    return this.escapeFieldName(this.tableName, this._adapter);
  }

  private static buildSelectColumnList(state: {
    _fields?: string[];
    _aggregates?: SqlAggregates;
    _groupBy?: string[];
    _with?: PreloadRelations;
  }): string {
    const escape = (name: string) => this.escapeFieldName(name, this._adapter);
    const grouped = !!(state._groupBy?.length ||
      (state._aggregates && Object.keys(state._aggregates).length > 0));
    const fields = grouped
      ? state._fields
      : mergePreloadFields(state._fields, this.primaryKey, state._with);
    const parts: string[] = [];
    if (fields && fields.length > 0) {
      parts.push(fields.map(escape).join(", "));
    } else if (state._groupBy && state._groupBy.length > 0) {
      parts.push(state._groupBy.map(escape).join(", "));
    } else if (
      !state._aggregates || Object.keys(state._aggregates).length === 0
    ) {
      parts.push("*");
    }
    if (state._aggregates && Object.keys(state._aggregates).length > 0) {
      parts.push(formatAggregateSelect(state._aggregates, escape));
    }
    return parts.filter(Boolean).join(", ") || "*";
  }

  private static applyGroupHaving(
    sql: string,
    params: unknown[],
    state: { _groupBy?: string[]; _having?: SqlHaving },
  ): { sql: string; params: unknown[] } {
    return appendGroupByHaving(
      sql,
      params,
      state._groupBy,
      state._having,
      (name) => this.escapeFieldName(name, this._adapter),
    );
  }

  private static isAggregateQuery(state: {
    _groupBy?: string[];
    _aggregates?: SqlAggregates;
    _having?: SqlHaving;
  }): boolean {
    return !!(state._groupBy?.length ||
      (state._aggregates && Object.keys(state._aggregates).length > 0));
  }

  private static async countFromState(
    state: {
      _groupBy?: string[];
      _aggregates?: SqlAggregates;
      _having?: SqlHaving;
    },
    where: string,
    params: unknown[],
  ): Promise<number> {
    if (this.isAggregateQuery(state) || state._having) {
      const grouped = this.applyGroupHaving(
        `SELECT 1 FROM ${this.quotedTable()} WHERE ${where}`,
        params,
        state,
      );
      const sql = `SELECT COUNT(*) as count FROM (${grouped.sql}) AS _grp`;
      const results = await this.adapter.query(sql, grouped.params);
      return results.length > 0
        ? (parseInt(String(results[0].count), 10) || 0)
        : 0;
    }
    const sql =
      `SELECT COUNT(*) as count FROM ${this.quotedTable()} WHERE ${where}`;
    const results = await this.adapter.query(sql, params);
    return results.length > 0
      ? (parseInt(String(results[0].count), 10) || 0)
      : 0;
  }

  private static asSqlAdapter(
    adapter?: DatabaseAdapter | null,
  ): SqlAdapter | null {
    const a = adapter ?? this.adapter;
    return isSqlAdapter(a) ? a : null;
  }

  private static applyReturning(
    sql: string,
    adapter: DatabaseAdapter | null | undefined,
    operation: ReturningOperation,
    returning: string,
    options?: { returnLatest?: boolean },
  ): string {
    if (
      isSqlAdapter(adapter) && adapter.shouldUseReturning(operation, options)
    ) {
      return adapter.appendReturning(sql, returning);
    }
    return sql;
  }

  /**
   * 格式化日期为数据库兼容的字符串格式
   * MySQL/MariaDB 需要 YYYY-MM-DD HH:MM:SS 格式（不支持毫秒，除非使用 DATETIME(3) 等）
   * PostgreSQL 和 SQLite 也可以接受此格式
   * @param date Date 对象
   * @param adapter 数据库适配器（可选，用于检测数据库类型）
   * @returns 格式化后的日期字符串
   */
  private static formatDateForDatabase(
    date: Date,
    adapter?: DatabaseAdapter | null,
  ): string {
    if (isSqlAdapter(adapter)) {
      return adapter.formatDateForDatabase(date);
    }
    return formatSqlDateTime(date);
  }

  /**
   * 处理并序列化字段（合并 processFields 和 serializeFields，减少遍历次数）
   * 应用默认值、类型转换、序列化数组/对象/Date/Boolean
   * @param data 原始数据
   * @param skipProcessing 是否跳过处理（仅序列化），用于钩子执行后的序列化
   * @returns 处理并序列化后的数据
   */
  private static processAndSerializeFields(
    data: Record<string, any>,
    skipProcessing: boolean = false,
  ): Record<string, any> {
    const schema = this.schema;
    const processed: Record<string, any> = assignData({}, data);

    // 获取适配器以确定数据库类型
    const adapter = this._adapter as DatabaseAdapter | null | undefined;

    // 如果没有 schema，只序列化 Date 对象
    if (!schema) {
      for (const fieldName in processed) {
        if (
          Object.prototype.hasOwnProperty.call(processed, fieldName) &&
          processed[fieldName] instanceof Date
        ) {
          processed[fieldName] = this.formatDateForDatabase(
            processed[fieldName],
            adapter,
          );
        }
      }
      return processed;
    }

    // 一次遍历完成字段处理和序列化（使用缓存的键，减少 Object.entries() 开销）
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const field = schema[fieldName] as FieldDefinition;
      let value = processed[fieldName];

      // 处理阶段（如果未跳过）
      if (!skipProcessing) {
        // 应用默认值
        if (value === undefined && field.default !== undefined) {
          value = typeof field.default === "function"
            ? field.default()
            : field.default;
          processed[fieldName] = value;
        }

        // 类型转换
        if (value !== undefined) {
          value = this.convertType(value, field.type, field.enum);
          processed[fieldName] = value;
        }

        // Setter
        if (field.set && value !== undefined) {
          value = field.set(value);
          processed[fieldName] = value;
        }
      }

      // 序列化阶段（在一次遍历中完成）
      if (value !== undefined && value !== null) {
        // Date 对象需要转换为数据库兼容的字符串格式（优先处理，因为 Date 也是 object）
        if (value instanceof Date) {
          processed[fieldName] = this.formatDateForDatabase(value, adapter);
        } // 数组类型需要序列化为 JSON 字符串
        else if (field.type === "array" && Array.isArray(value)) {
          processed[fieldName] = JSON.stringify(value);
        } // 对象类型需要序列化为 JSON 字符串
        else if (
          (field.type === "object" || field.type === "json") &&
          typeof value === "object" && !Array.isArray(value)
        ) {
          processed[fieldName] = JSON.stringify(value);
        } // Boolean 类型在 SQLite 中需要转换为 0 或 1
        else if (field.type === "boolean" && typeof value === "boolean") {
          processed[fieldName] = value ? 1 : 0;
        }
      }
    }

    // 处理不在 schema 中的 Date 对象（如时间戳字段）
    // 无论是否跳过处理，都需要序列化所有 Date 对象
    // 注意：必须遍历所有字段，而不仅仅是 schema 中的字段
    for (const fieldName in processed) {
      if (Object.prototype.hasOwnProperty.call(processed, fieldName)) {
        const value = processed[fieldName];
        if (
          value instanceof Date &&
          (!schema || !(fieldName in schema))
        ) {
          processed[fieldName] = this.formatDateForDatabase(value, adapter);
        }
      }
    }

    return processed;
  }

  /**
   * 序列化数据字段（将数组和对象转换为 JSON 字符串，Date 转换为 ISO 字符串）
   * 用于 SQLite 等不支持复杂类型的数据库
   * @deprecated 建议使用 processAndSerializeFields 合并处理
   */
  static serializeFields(
    data: Record<string, any>,
  ): Record<string, any> {
    const schema = this.schema;
    const serialized = { ...data };

    // 先处理 schema 中定义的字段（使用缓存的键，减少 Object.entries() 开销）
    if (schema) {
      const schemaKeys = this.getSchemaKeys();
      for (const fieldName of schemaKeys) {
        const field = schema[fieldName] as FieldDefinition;
        const value = serialized[fieldName];
        if (value !== undefined && value !== null) {
          // 数组类型需要序列化为 JSON 字符串
          if (field.type === "array" && Array.isArray(value)) {
            serialized[fieldName] = JSON.stringify(value);
          } // 对象类型需要序列化为 JSON 字符串
          else if (
            (field.type === "object" || field.type === "json") &&
            typeof value === "object" && !Array.isArray(value) &&
            !(value instanceof Date)
          ) {
            serialized[fieldName] = JSON.stringify(value);
          } // Date 对象需要转换为数据库兼容的字符串格式
          else if (value instanceof Date) {
            const adapter = this._adapter as
              | DatabaseAdapter
              | null
              | undefined;
            serialized[fieldName] = this.formatDateForDatabase(value, adapter);
          } // Boolean 类型在 SQLite 中需要转换为 0 或 1
          else if (field.type === "boolean" && typeof value === "boolean") {
            serialized[fieldName] = value ? 1 : 0;
          }
        }
      }
    }

    // 处理不在 schema 中的 Date 对象（如时间戳字段）
    const adapter = this._adapter as DatabaseAdapter | null | undefined;
    for (const [fieldName, value] of Object.entries(serialized)) {
      if (value instanceof Date) {
        serialized[fieldName] = this.formatDateForDatabase(value, adapter);
      }
    }

    return serialized;
  }

  /**
   * 验证数据
   * @param data 要验证的数据
   * @param instanceId 实例 ID（用于唯一性验证时排除当前记录）
   * @param groups 验证组（可选，只验证指定组的字段）
   * @throws ValidationError 验证失败时抛出
   */
  static async validate(
    data: Record<string, any>,
    instanceId?: any,
    groups?: string[],
  ): Promise<void> {
    await validateRecord(this.validationHost(), data, instanceId, groups);
  }

  /**
   * 验证单个字段（同步验证）
   */
  private static validateField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition,
    allValues: Record<string, any>,
  ): void {
    validateSqlField(fieldName, value, fieldDef, allValues);
  }

  /**
   * 验证单个字段（异步验证，用于数据库查询）
   */
  private static async validateFieldAsync(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition,
    allValues: Record<string, any>,
    instanceId?: any,
  ): Promise<void> {
    await validateFieldAsyncShared(
      this.validationHost(),
      fieldName,
      value,
      fieldDef,
      allValues,
      instanceId,
    );
  }

  /**
   * 类型转换
   */
  private static convertType(
    value: any,
    type: FieldType,
    enumValues?: any[],
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case "string": {
        return String(value);
      }
      case "number": {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      case "boolean": {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          return value.toLowerCase() === "true" || value === "1";
        }
        return Boolean(value);
      }
      case "date": {
        if (value instanceof Date) return value;
        if (typeof value === "string" || typeof value === "number") {
          return new Date(value);
        }
        return value;
      }
      case "array": {
        return Array.isArray(value) ? value : [value];
      }
      case "object": {
        return typeof value === "object" ? value : JSON.parse(String(value));
      }
      case "enum": {
        if (enumValues && enumValues.includes(value)) {
          return value;
        }
        throw new ValidationError(
          "enum",
          `值必须是以下之一: ${enumValues?.join(", ")}`,
        );
      }
      case "bigint": {
        return BigInt(value);
      }
      case "decimal": {
        return parseFloat(String(value));
      }
      case "timestamp": {
        if (value instanceof Date) return value;
        if (typeof value === "string" || typeof value === "number") {
          return new Date(value);
        }
        return value;
      }
      case "uuid": {
        return String(value);
      }
      case "text": {
        return String(value);
      }
      case "binary": {
        return value;
      }
      case "json": {
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return typeof value === "object" ? value : value;
      }
      case "any": {
        return value;
      }
      default: {
        return value;
      }
    }
  }

  /**
   * 创建数组查询构建器（返回纯 JSON 对象）
   * 私有辅助方法，用于消除代码重复
   * @param getState 获取查询状态的函数（通过闭包访问局部变量）
   * @returns 数组查询构建器
   */
  private static createArrayQueryBuilder<T extends typeof SQLModel>(
    this: T,
    getState: () => {
      _conditions?: Array<{
        type: "where" | "or" | "and";
        condition: WhereCondition | number | string;
      }>;
      _condition?: WhereCondition | number | string; // 向后兼容 find() 方法
      _fields: string[] | undefined;
      _sort:
        | Record<string, 1 | -1 | "asc" | "desc">
        | "asc"
        | "desc"
        | undefined;
      _skip: number | undefined;
      _limit: number | undefined;
      _includeTrashed: boolean;
      _onlyTrashed: boolean;
      _with?: PreloadRelations;
      _groupBy?: string[];
      _having?: SqlHaving;
      _aggregates?: SqlAggregates;
    },
  ): SQLArrayQueryBuilder<T> {
    /**
     * 构建最终的查询条件（与 query() 方法中的逻辑一致）
     */
    const buildFinalCondition = (): WhereCondition | number | string => {
      const state = getState();
      // 如果使用新的 _conditions 结构
      if (state._conditions && state._conditions.length > 0) {
        if (
          state._conditions.length === 1 &&
          state._conditions[0].type === "where"
        ) {
          return state._conditions[0].condition;
        }
        // 对于多个条件，返回组合对象
        return {
          __combined: state._conditions.map((item) => ({
            type: item.type,
            condition: item.condition,
          })),
        };
      }
      // 向后兼容：使用旧的 _condition
      return state._condition || {};
    };
    const arrayBuilder: SQLArrayQueryBuilder<T> = {
      sort: (
        sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
      ) => {
        const state = getState();
        state._sort = sort;
        return arrayBuilder;
      },
      skip: (n: number) => {
        const state = getState();
        state._skip = Math.max(0, Math.floor(n));
        return arrayBuilder;
      },
      limit: (n: number) => {
        const state = getState();
        state._limit = Math.max(1, Math.floor(n));
        return arrayBuilder;
      },
      fields: (fields: string[]) => {
        const state = getState();
        state._fields = fields;
        return arrayBuilder;
      },
      includeTrashed: () => {
        const state = getState();
        state._includeTrashed = true;
        state._onlyTrashed = false;
        return arrayBuilder;
      },
      onlyTrashed: () => {
        const state = getState();
        state._onlyTrashed = true;
        state._includeTrashed = false;
        return arrayBuilder;
      },
      with: (relations: PreloadRelations) => {
        const state = getState();
        state._with = { ...(state._with || {}), ...relations };
        return arrayBuilder;
      },
      preload: (relations: PreloadRelations) => {
        return arrayBuilder.with(relations);
      },
      groupBy: (columns: string | string[]) => {
        const state = getState();
        state._groupBy = normalizeGroupBy(columns);
        return arrayBuilder;
      },
      having: (condition: string, params?: unknown[]) => {
        const state = getState();
        state._having = { sql: condition, params: params ?? [] };
        return arrayBuilder;
      },
      aggregate: (aggregates: SqlAggregates) => {
        const state = getState();
        state._aggregates = aggregates;
        return arrayBuilder;
      },
      findAll: async (): Promise<Record<string, any>[]> => {
        await this.ensureAdapter();
        const state = getState();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = this.buildSelectColumnList(state);
        const orderBy = this.buildOrderByClause(state._sort);
        const useLimit = typeof state._limit === "number";
        const useSkip = typeof state._skip === "number";
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        const grouped = this.applyGroupHaving(sql, params, state);
        sql = grouped.sql;
        const queryParams = grouped.params;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        const extraParams: any[] = [];
        if (useLimit) {
          sql = `${sql} LIMIT ?`;
          extraParams.push(Math.max(1, Math.floor(state._limit!)));
        }
        if (useLimit && useSkip) {
          sql = `${sql} OFFSET ?`;
          extraParams.push(Math.max(0, Math.floor(state._skip!)));
        }
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, [
          ...queryParams,
          ...extraParams,
        ]);
        // 返回纯 JSON 对象数组，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        const rows = results.map((row) => assignData({}, row));
        if (!this.isAggregateQuery(getState())) {
          await applyPreloads(rows, this.primaryKey, getState()._with);
        }
        return rows;
      },
      findOne: async (): Promise<Record<string, any> | null> => {
        await this.ensureAdapter();
        const state = getState();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = this.buildSelectColumnList(state);
        const orderBy = this.buildOrderByClause(state._sort);
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        const grouped = this.applyGroupHaving(sql, params, state);
        sql = grouped.sql;
        const queryParams = grouped.params;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        sql = `${sql} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, queryParams);
        if (results.length === 0) {
          return null;
        }
        // 返回纯 JSON 对象，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        const row = assignData({}, results[0]);
        if (!this.isAggregateQuery(getState())) {
          await applyPreloads(row, this.primaryKey, getState()._with);
        }
        return row;
      },
      one: async (): Promise<Record<string, any> | null> => {
        return await arrayBuilder.findOne();
      },
      all: async (): Promise<Record<string, any>[]> => {
        return await arrayBuilder.findAll();
      },
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const state = getState();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        return await this.countFromState(state, where, params);
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        const state = getState();
        const finalCondition = buildFinalCondition();
        return await this.exists(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const state = getState();
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "number" ||
            typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      paginate: async (
        page: number,
        pageSize: number,
      ): Promise<{
        data: Record<string, any>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }> => {
        const state = getState();
        const finalCondition = buildFinalCondition();
        // 使用链式查询构建器中已有的条件、排序、字段等设置
        const paginateResult = await this.paginate(
          finalCondition,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          mergePreloadFields(
            state._fields,
            this.primaryKey,
            getState()._with,
          ),
          state._includeTrashed,
          state._onlyTrashed,
        );
        // 将数据转换为纯 JSON 对象数组
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        const data = paginateResult.data.map((item) => assignData({}, item));
        await applyPreloads(data, this.primaryKey, getState()._with);
        return {
          ...paginateResult,
          data,
        };
      },
    };
    return arrayBuilder;
  }

  /**
   * 查询构建器（支持链式调用，可查找单条或多条记录）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fields 要查询的字段数组（可选，用于字段投影）
   * @returns 查询构建器（支持链式调用，也可以直接 await）
   *
   * @example
   * // 直接查询单条记录（向后兼容）
   * const user = await User.find(1);
   * const user = await User.find({ email: 'user@example.com' });
   *
   * // 链式调用查找单条记录
   * const user = await User.find({ status: 'active' }).sort({ createdAt: -1 });
   *
   * // 链式调用查找多条记录
   * const users = await User.find({ status: 'active' }).sort({ createdAt: -1 }).findAll();
   * const users = await User.find({ status: 'active' }).sort({ sort: -1 }).limit(10).findAll();
   */
  static find<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    },
  ): SQLFindQueryBuilder<T> {
    // 创建共享状态对象，确保 asArray() 中的修改能够持久化
    // 支持新的 _conditions 数组（用于链式查询条件）和旧的 _condition（向后兼容）
    const state = {
      _conditions: [
        {
          type: "where" as const,
          condition: condition as WhereCondition | number | string,
        },
      ] as Array<
        {
          type: "where" | "or" | "and";
          condition: WhereCondition | number | string;
        }
      >,
      _condition: condition as WhereCondition | number | string, // 向后兼容
      _fields: fields,
      _sort: options?.sort as
        | Record<string, 1 | -1 | "asc" | "desc">
        | "asc"
        | "desc"
        | undefined,
      _skip: undefined as number | undefined,
      _limit: undefined as number | undefined,
      _includeTrashed: includeTrashed,
      _onlyTrashed: onlyTrashed,
      _with: undefined as PreloadRelations | undefined,
      _groupBy: undefined as string[] | undefined,
      _having: undefined as SqlHaving | undefined,
      _aggregates: undefined as SqlAggregates | undefined,
    };

    /**
     * 构建最终查询条件
     * 如果使用新的 _conditions 结构，返回组合对象；否则返回单个条件（向后兼容）
     */
    const buildFinalCondition = (): WhereCondition | number | string => {
      // 如果使用新的 _conditions 结构
      if (state._conditions && state._conditions.length > 0) {
        // 如果只有一个 where 条件，直接返回
        if (
          state._conditions.length === 1 &&
          state._conditions[0].type === "where"
        ) {
          return state._conditions[0].condition;
        }
        // 对于多个条件，返回组合对象
        return {
          __combined: state._conditions.map((item) => ({
            type: item.type,
            condition: item.condition,
          })),
        };
      }
      // 向后兼容：使用旧的 _condition
      return state._condition || {};
    };

    /**
     * 将条件对象中的字符串值转换为 LIKE 查询条件
     * 支持嵌套对象和 JSON 对象查询
     * @param condition 查询条件对象
     * @returns 转换后的查询条件对象
     */
    const convertToLikeCondition = (
      condition: WhereCondition,
    ): WhereCondition => {
      if (
        !condition || typeof condition !== "object" || Array.isArray(condition)
      ) {
        return condition;
      }

      const result: WhereCondition = {};

      for (const [key, value] of Object.entries(condition)) {
        if (value === null || value === undefined) {
          result[key] = value;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          // 检查是否是操作符对象（如 { $gt: 10 }）
          const opValue = value as {
            $gt?: any;
            $lt?: any;
            $gte?: any;
            $lte?: any;
            $ne?: any;
            $in?: any[];
            $like?: string;
            [key: string]: any;
          };

          // 如果已经包含 $like 操作符，保留原样
          if (opValue.$like !== undefined) {
            result[key] = value;
          } else if (
            opValue.$gt !== undefined ||
            opValue.$lt !== undefined ||
            opValue.$gte !== undefined ||
            opValue.$lte !== undefined ||
            opValue.$ne !== undefined ||
            opValue.$in !== undefined
          ) {
            // 如果包含其他操作符，保留原样
            result[key] = value;
          } else {
            // 递归处理嵌套对象
            result[key] = convertToLikeCondition(value as WhereCondition);
          }
        } else if (typeof value === "string") {
          // 字符串值转换为 LIKE 查询
          // 如果字符串中没有 % 或 _，自动添加 % 通配符
          let likePattern = value;
          if (!likePattern.includes("%") && !likePattern.includes("_")) {
            likePattern = `%${likePattern}%`;
          }
          result[key] = { $like: likePattern };
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    const resolveFields = (): string[] | undefined =>
      mergePreloadFields(state._fields, this.primaryKey, state._with);

    // 执行查询单条记录的函数
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      // 自动初始化（如果未初始化）
      await this.ensureAdapter();

      const finalCondition = buildFinalCondition();

      // 生成缓存键（条件生成：只在有缓存适配器时才生成）
      const cacheKey = this.generateCacheKey(
        finalCondition,
        resolveFields(),
        {
          sort: state._sort,
          skip: state._skip,
          limit: state._limit,
          with: serializePreloadSignature(state._with),
        },
        state._includeTrashed,
        state._onlyTrashed,
      );

      // 尝试从缓存获取
      if (cacheKey && this.cacheAdapter) {
        const cached = this.cacheAdapter.get(cacheKey);
        const cachedValue = cached instanceof Promise ? await cached : cached;
        if (cachedValue !== undefined) {
          const instance = this.createInstance();
          assignData(instance, cachedValue);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          await applyPreloads(instance, this.primaryKey, state._with);
          return instance as InstanceType<T>;
        }
      }

      const { where, params } = this.buildWhereClause(
        finalCondition,
        state._includeTrashed,
        state._onlyTrashed,
      );
      const columns = this.buildSelectColumnList(state);
      const orderBy = this.buildOrderByClause(state._sort);
      let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
      const grouped = this.applyGroupHaving(sql, params, state);
      sql = grouped.sql;
      const queryParams = grouped.params;
      if (orderBy) {
        sql = `${sql} ORDER BY ${orderBy}`;
      }
      const extraParams: any[] = [];
      if (typeof state._limit === "number") {
        sql = `${sql} LIMIT ?`;
        extraParams.push(Math.max(1, Math.floor(state._limit)));
      } else {
        sql = `${sql} LIMIT 1`;
      }
      if (typeof state._limit === "number" && typeof state._skip === "number") {
        sql = `${sql} OFFSET ?`;
        extraParams.push(Math.max(0, Math.floor(state._skip)));
      }
      // ensureAdapter() 已确保 adapter 不为 null
      const results = await this.adapter.query(sql, [
        ...queryParams,
        ...extraParams,
      ]);

      if (results.length === 0) {
        return null;
      }

      const instance = this.createInstance();
      assignData(instance, results[0]);

      // 应用虚拟字段
      this.applyVirtuals(instance);

      // 将结果存入缓存
      if (cacheKey && this.cacheAdapter) {
        const setResult = this.cacheAdapter.set(
          cacheKey,
          results[0],
          this.cacheTTL,
          [`model:${this.tableName}`],
        );
        if (setResult instanceof Promise) {
          await setResult;
        }
      }

      if (!this.isAggregateQuery(state)) {
        await applyPreloads(instance, this.primaryKey, state._with);
      }
      return instance as InstanceType<T>;
    };

    // 执行查询多条的函数
    const executeFindAll = async (): Promise<InstanceType<T>[]> => {
      await this.ensureAdapter();

      const finalCondition = buildFinalCondition();

      // 生成缓存键（条件生成：只在有缓存适配器时才生成）
      const cacheKey = this.generateCacheKey(
        finalCondition,
        resolveFields(),
        {
          sort: state._sort,
          skip: state._skip,
          limit: state._limit,
          with: serializePreloadSignature(state._with),
        },
        state._includeTrashed,
        state._onlyTrashed,
      );

      // 尝试从缓存获取
      if (cacheKey && this.cacheAdapter) {
        const cached = this.cacheAdapter.get(cacheKey);
        const cachedValue = cached instanceof Promise ? await cached : cached;
        if (cachedValue !== undefined && Array.isArray(cachedValue)) {
          const instances = cachedValue.map((row: any) => {
            const instance = this.createInstance();
            assignData(instance, row);
            // 应用虚拟字段
            this.applyVirtuals(instance);
            return instance as InstanceType<T>;
          });
          await applyPreloads(instances, this.primaryKey, state._with);
          return instances;
        }
      }

      const { where, params } = this.buildWhereClause(
        finalCondition,
        state._includeTrashed,
        state._onlyTrashed,
      );
      const columns = this.buildSelectColumnList(state);
      const orderBy = this.buildOrderByClause(state._sort);
      const useLimit = typeof state._limit === "number";
      const useSkip = typeof state._skip === "number";
      let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
      const grouped = this.applyGroupHaving(sql, params, state);
      sql = grouped.sql;
      const queryParams = grouped.params;
      if (orderBy) {
        sql = `${sql} ORDER BY ${orderBy}`;
      }
      const extraParams: any[] = [];
      if (useLimit) {
        sql = `${sql} LIMIT ?`;
        extraParams.push(Math.max(1, Math.floor(state._limit!)));
      }
      if (useLimit && useSkip) {
        sql = `${sql} OFFSET ?`;
        extraParams.push(Math.max(0, Math.floor(state._skip!)));
      }
      // ensureAdapter() 已确保 adapter 不为 null
      const results = await this.adapter.query(sql, [
        ...queryParams,
        ...extraParams,
      ]);

      const instances = results.map((row: any) => {
        const instance = this.createInstance();
        assignData(instance, row);
        // 应用虚拟字段
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      });

      // 将结果存入缓存
      if (cacheKey && this.cacheAdapter) {
        const setResult = this.cacheAdapter.set(
          cacheKey,
          results,
          this.cacheTTL,
          [`model:${this.tableName}`],
        );
        if (setResult instanceof Promise) {
          await setResult;
        }
      }

      if (!this.isAggregateQuery(state)) {
        await applyPreloads(instances, this.primaryKey, state._with);
      }
      return instances;
    };

    // 仅在 then/catch/finally（如直接 await 构建器）时才执行 findOne
    const queryPromise = lazyThenable(() => executeFindOne());

    // 构建查询构建器对象
    const builder: SQLFindQueryBuilder<T> = {
      /**
       * 添加 OR 查询条件
       * @param condition 查询条件
       * @returns 查询构建器
       */
      orWhere: (
        condition: FindCondition,
      ) => {
        state._conditions.push({ type: "or", condition });
        return builder;
      },
      /**
       * 添加 AND 查询条件
       * @param condition 查询条件
       * @returns 查询构建器
       */
      andWhere: (
        condition: FindCondition,
      ) => {
        state._conditions.push({ type: "and", condition });
        return builder;
      },
      /**
       * 添加 OR LIKE 查询条件
       * @param condition 查询条件对象
       * @returns 查询构建器
       */
      orLike: (condition: WhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "or", condition: likeCondition });
        return builder;
      },
      /**
       * 添加 AND LIKE 查询条件
       * @param condition 查询条件对象
       * @returns 查询构建器
       */
      andLike: (condition: WhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "and", condition: likeCondition });
        return builder;
      },
      sort: (
        sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
      ) => {
        state._sort = sort;
        return builder;
      },
      skip: (n: number) => {
        state._skip = Math.max(0, Math.floor(n));
        return builder;
      },
      limit: (n: number) => {
        state._limit = Math.max(1, Math.floor(n));
        return builder;
      },
      fields: (fields: string[]) => {
        state._fields = fields;
        return builder;
      },
      includeTrashed: () => {
        state._includeTrashed = true;
        state._onlyTrashed = false;
        return builder;
      },
      onlyTrashed: () => {
        state._onlyTrashed = true;
        state._includeTrashed = false;
        return builder;
      },
      with: (relations: PreloadRelations) => {
        state._with = { ...(state._with || {}), ...relations };
        return builder;
      },
      preload: (relations: PreloadRelations) => {
        return builder.with(relations);
      },
      groupBy: (columns: string | string[]) => {
        state._groupBy = normalizeGroupBy(columns);
        return builder;
      },
      having: (condition: string, params?: unknown[]) => {
        state._having = { sql: condition, params: params ?? [] };
        return builder;
      },
      aggregate: (aggregates: SqlAggregates) => {
        state._aggregates = aggregates;
        return builder;
      },
      findAll: () => executeFindAll(),
      findOne: () => executeFindOne(),
      one: () => executeFindOne(),
      all: () => executeFindAll(),
      /**
       * 将查询结果转换为纯 JSON 对象数组格式
       * 返回一个可以继续链式调用的构建器，最终返回纯 JSON 对象数组（不是模型实例）
       * @returns 返回数组查询构建器
       * @example
       * const users = await User.find({ status: 'active' }).asArray().findAll();
       * const user = await User.find(123).asArray().findOne(); // 返回纯 JSON 对象或 null
       */
      asArray: (): SQLArrayQueryBuilder<T> => {
        // 返回共享状态对象的引用，确保 asArray() 中的修改能够持久化
        // state 已经包含 _conditions 和 _condition，可以直接传递给 createArrayQueryBuilder
        return this.createArrayQueryBuilder(() => state);
      },
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        return await this.countFromState(state, where, params);
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        return await this.exists(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "number" ||
            typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      paginate: async (
        page: number,
        pageSize: number,
      ): Promise<{
        data: InstanceType<T>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }> => {
        const finalCondition = buildFinalCondition();
        // 使用链式查询构建器中已有的条件、排序、字段等设置
        const result = await this.paginate(
          finalCondition,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          resolveFields(),
          state._includeTrashed,
          state._onlyTrashed,
        );
        await applyPreloads(result.data, this.primaryKey, state._with);
        return result;
      },
      // Promise 接口方法（用于直接 await）
      then: (
        onfulfilled?: (value: InstanceType<T> | null) => any,
        onrejected?: (reason: any) => any,
      ) => queryPromise.then(onfulfilled, onrejected),
      catch: (onrejected?: (reason: any) => any) =>
        queryPromise.catch(onrejected),
      finally: (onfinally?: () => void) => queryPromise.finally(onfinally),
    };

    return builder;
  }

  /**
   * 查找多条记录
   * @param condition 查询条件对象（可选，不提供则查询所有）
   * @param fields 要查询的字段数组（可选）
   * @returns 模型实例数组
   *
   * @example
   * const users = await User.findAll();
   * const users = await User.findAll({ age: 25 });
   * const users = await User.findAll({ age: { $gt: 18 } });
   * const users = await User.findAll({}, ['id', 'name', 'email']);
   */
  static async findAll<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition = {},
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T>[]> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 生成缓存键
    const cacheKey = this.generateCacheKey(
      condition,
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );

    // 尝试从缓存获取
    if (cacheKey && this.cacheAdapter) {
      const cached = this.cacheAdapter.get(cacheKey);
      const cachedValue = cached instanceof Promise ? await cached : cached;
      if (cachedValue !== undefined && Array.isArray(cachedValue)) {
        return cachedValue.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, row);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        });
      }
    }

    const { where, params } = this.buildWhereClause(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    const columns = fields && fields.length > 0 ? fields.join(", ") : "*";

    const orderBy = this.buildOrderByClause(options?.sort);
    const useLimit = typeof options?.limit === "number";
    const useSkip = typeof options?.skip === "number";
    let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
    if (orderBy) {
      sql = `${sql} ORDER BY ${orderBy}`;
    }
    if (useLimit) {
      sql = `${sql} LIMIT ?`;
    }
    if (useLimit && useSkip) {
      sql = `${sql} OFFSET ?`;
    }
    const extraParams: any[] = [];
    if (useLimit) extraParams.push(Math.max(1, Math.floor(options!.limit!)));
    if (useLimit && useSkip) {
      extraParams.push(Math.max(0, Math.floor(options!.skip!)));
    }
    // ensureAdapter() 已确保 adapter 不为 null
    const results = await this.adapter.query(sql, [...params, ...extraParams]);

    const instances = results.map((row: any) => {
      const instance = this.createInstance();
      assignData(instance, row);
      // 应用虚拟字段
      this.applyVirtuals(instance);
      return instance as InstanceType<T>;
    });

    // 将结果存入缓存
    if (this.cacheAdapter) {
      const setResult = this.cacheAdapter.set(
        cacheKey,
        results,
        this.cacheTTL,
        [`model:${this.tableName}`],
      );
      if (setResult instanceof Promise) {
        await setResult;
      }
    }

    return instances;
  }

  /**
   * 应用查询作用域
   * @param scopeName 作用域名称
   * @returns 查询构建器（链式调用）
   *
   * @example
   * const activeUsers = await User.scope('active').findAll();
   */
  static scope(scopeName: string): {
    findAll: <T extends typeof SQLModel>(
      condition?: WhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
      includeTrashed?: boolean,
      onlyTrashed?: boolean,
    ) => Promise<InstanceType<T>[]>;
    find: <T extends typeof SQLModel>(
      condition?: WhereCondition | number | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: WhereCondition) => Promise<number>;
  } {
    if (!this.scopes || !this.scopes[scopeName]) {
      throw new Error(
        $tr("model.scopeNotDefined", { scope: scopeName }),
      );
    }

    // 在闭包中捕获 this（SQLModel 类），这样返回的方法可以直接调用，不需要 .call()
    const Model = this as typeof SQLModel;
    const scopeCondition = this.scopes[scopeName]();

    return {
      findAll: async <T extends typeof SQLModel>(
        condition: WhereCondition = {},
        fields?: string[],
        options?: {
          sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
          skip?: number;
          limit?: number;
        },
        includeTrashed: boolean = false,
        onlyTrashed: boolean = false,
      ): Promise<InstanceType<T>[]> => {
        return await Model.findAll(
          { ...scopeCondition, ...condition },
          fields,
          options,
          includeTrashed,
          onlyTrashed,
        ) as InstanceType<T>[];
      },
      find: async <T extends typeof SQLModel>(
        condition: WhereCondition | number | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        if (typeof condition === "number" || typeof condition === "string") {
          return await Model.find(condition, fields) as InstanceType<T> | null;
        }
        return await Model.find({ ...scopeCondition, ...condition }, fields) as
          | InstanceType<T>
          | null;
      },
      count: async (condition: WhereCondition = {}): Promise<number> => {
        return await Model.count({ ...scopeCondition, ...condition });
      },
    };
  }

  /**
   * 创建新记录
   * @param data 要插入的数据对象
   * @returns 创建的模型实例
   *
   * @example
   * const user = await User.create({ name: 'John', email: 'john@example.com' });
   */
  static async create<T extends typeof SQLModel>(
    this: T,
    data: Record<string, any>,
  ): Promise<InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 插入路径：允许未传字段套用 schema default（update 使用 applyDefaults: false）
    // 注意：这里先不序列化，因为钩子可能需要访问原始对象/数组
    const processedData = this.processFields(data, { applyDefaults: true });

    // 自动时间戳
    if (this.timestamps) {
      applyCreateTimestamps(processedData, this.timestamps);

      // 将 Date 对象转换为 ISO 字符串（SQLite 需要字符串格式）
      // 注意：这里先不转换，让 serializeFields 统一处理
    }

    // 创建临时实例用于钩子
    const tempInstance = this.createInstance();
    assignData(tempInstance, processedData);

    // beforeValidate 钩子
    if (this.beforeValidate) {
      await assignHookChangesIfChanged(
        this.beforeValidate,
        tempInstance,
        processedData,
      );
    }

    // 验证数据（包括跨字段验证和数据库查询验证）
    await SQLModel.validate.call(this, processedData);

    // afterValidate 钩子
    if (this.afterValidate) {
      await assignHookChangesIfChanged(
        this.afterValidate,
        tempInstance,
        processedData,
      );
    }

    // beforeCreate 钩子
    if (this.beforeCreate) {
      await assignHookChangesIfChanged(
        this.beforeCreate,
        tempInstance,
        processedData,
      );
    }

    // beforeSave 钩子
    if (this.beforeSave) {
      await assignHookChangesIfChanged(
        this.beforeSave,
        tempInstance,
        processedData,
      );
    }

    // 序列化数组和对象字段为 JSON 字符串（SQLite 需要）
    // 在钩子执行后序列化，确保钩子可以访问原始对象/数组
    // 使用 processAndSerializeFields 仅序列化（skipProcessing=true），利用缓存的键优化性能
    const serializedData = SQLModel.processAndSerializeFields.call(
      this,
      processedData,
      true, // 跳过处理，仅序列化
    );

    const keys = Object.keys(serializedData);
    const values = Object.values(serializedData);
    const placeholders = keys.map(() => "?").join(", ");
    const escapedKeys = keys.map((key) =>
      SQLModel.escapeFieldName.call(this, key, this.adapter)
    );

    let sql = `INSERT INTO ${this.quotedTable()} (${
      escapedKeys.join(", ")
    }) VALUES (${placeholders})`;
    const escapedPrimaryKey = SQLModel.escapeFieldName.call(
      this,
      this.primaryKey,
      this.adapter,
    );
    sql = this.applyReturning(sql, this.adapter, "insert", escapedPrimaryKey);
    // ensureAdapter() 已确保 adapter 不为 null
    const execResult = await this.adapter.execute(sql, values);

    let insertedId: any = null;
    if (
      execResult && typeof execResult === "object" && "insertId" in execResult
    ) {
      insertedId = readInsertId(execResult);
    }
    if (
      !insertedId && execResult && typeof execResult === "object" &&
      "rows" in execResult
    ) {
      const rows = readResultRows(execResult);
      if (Array.isArray(rows) && rows.length > 0) {
        insertedId = rows[0]?.[this.primaryKey] ?? rows[0]?.id ?? null;
      }
    }
    if (!insertedId) {
      try {
        // ensureAdapter() 已确保 adapter 不为 null
        const result = await this.adapter.query(
          `SELECT last_insert_rowid() as id`,
          [],
        );
        if (result.length > 0) {
          insertedId = result[0].id;
        }
      } catch {
        void 0;
      }
    }

    // 如果插入成功且有 ID，直接使用插入的数据构建实例
    // 不重新查询，避免软删除过滤导致的问题
    const instance = this.createInstance();
    assignData(instance, processedData);
    if (insertedId) {
      setRecordValue(instance, this.primaryKey, insertedId);
    }

    // 应用虚拟字段（使用缓存的虚拟字段定义）
    this.applyVirtuals(instance);

    // afterCreate 钩子
    if (this.afterCreate) {
      await this.afterCreate(instance);
    }

    // afterSave 钩子
    if (this.afterSave) {
      await this.afterSave(instance);
    }

    // 清除相关缓存
    await this.clearCache();

    return instance;
  }

  /**
   * 更新记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param data 要更新的数据对象
   * @param returnLatest 是否返回更新后的记录（默认 false，返回更新的记录数）
   * @param options 可选配置（性能优化：skipPreQuery 可跳过预查询，但需要确保没有钩子和验证）
   * @returns 更新的记录数或更新后的模型实例
   *
   * @example
   * await User.update(1, { name: 'lisi' });
   * await User.update({ id: 1 }, { name: 'lisi' });
   * await User.update({ email: 'user@example.com' }, { name: 'lisi' });
   * // 返回更新后的记录
   * const updated = await User.update(1, { name: 'lisi' }, true);
   * // 性能优化：跳过预查询（仅当没有钩子和验证时使用）
   * await User.update(1, { name: 'lisi' }, false, { skipPreQuery: true });
   */
  static async update<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    data: Record<string, any>,
    returnLatest?: false,
    options?: {
      skipPreQuery?: boolean;
      enableHooks?: boolean;
      enableValidation?: boolean;
      useUpdateMany?: boolean; // 统一接口：与 MongoModel 保持一致（SQL 中此选项通常无效，但保留以统一接口）
    },
  ): Promise<number>;
  static async update<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    data: Record<string, any>,
    returnLatest: true,
    options?: {
      skipPreQuery?: boolean;
      enableHooks?: boolean;
      enableValidation?: boolean;
      useUpdateMany?: boolean; // 统一接口：与 MongoModel 保持一致（SQL 中此选项通常无效，但保留以统一接口）
    },
  ): Promise<InstanceType<T>>;
  static async update<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    data: Record<string, any>,
    returnLatest: boolean = false,
    options?: {
      skipPreQuery?: boolean;
      enableHooks?: boolean;
      enableValidation?: boolean;
      useUpdateMany?: boolean; // 统一接口：与 MongoModel 保持一致（SQL 中此选项通常无效，但保留以统一接口）
    },
  ): Promise<number | InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 检查是否可以跳过预查询（性能优化）
    const skipPreQuery = options?.skipPreQuery === true;
    // 如果 options.enableHooks 是 undefined，默认启用钩子（保持向后兼容）
    // 如果 options.enableHooks 明确设置为 false，则禁用钩子
    const enableHooks = options?.enableHooks === undefined
      ? true
      : options.enableHooks;
    // 如果 options.enableValidation 是 undefined，默认启用验证（保持向后兼容）
    // 如果 options.enableValidation 明确设置为 false，则禁用验证
    const enableValidation = options?.enableValidation === undefined
      ? true
      : options.enableValidation;
    const hasHooks = !!(
      this.beforeValidate ||
      this.afterValidate ||
      this.beforeUpdate ||
      this.beforeSave ||
      this.afterUpdate ||
      this.afterSave
    );
    // 只有在启用钩子或验证时才需要预查询
    // 如果类定义了钩子方法且启用了钩子，或者启用了验证，则需要预查询
    const needsPreQuery = (enableHooks && hasHooks) || enableValidation;

    // 先查找要更新的记录（如果不需要钩子且明确指定跳过，可以跳过）
    let existingInstance: InstanceType<typeof SQLModel> | null = null;
    if (!skipPreQuery && needsPreQuery) {
      // 需要预查询：有钩子或未明确指定跳过
      if (typeof condition === "number" || typeof condition === "string") {
        existingInstance = await this.find(condition);
      } else {
        const results = await this.findAll(condition);
        existingInstance = results[0] || null;
      }

      if (!existingInstance) {
        return 0;
      }
    } else {
      // 跳过预查询：检查记录是否存在（仅检查存在性，不获取完整记录）
      const { where, params: whereParams } = this.buildWhereClause(
        condition,
        false,
        false,
      );
      const checkSql =
        `SELECT 1 FROM ${this.quotedTable()} WHERE ${where} LIMIT 1`;
      const checkResult = await this.adapter.query(checkSql, whereParams);
      if (
        !checkResult || (Array.isArray(checkResult) && checkResult.length === 0)
      ) {
        return 0;
      }
    }

    /**
     * 仅 update 路径：`applyDefaults: false`，与 create 的 `applyDefaults: true` 区分。
     */
    const processedData = this.processFields(data, { applyDefaults: false });

    // 自动时间戳
    if (this.timestamps) {
      applyUpdateTimestamp(processedData, this.timestamps);
    }

    // 创建临时实例用于钩子（直接合并，避免额外的展开操作）
    const tempInstance = this.createInstance();
    if (existingInstance) {
      assignData(tempInstance, existingInstance);
    }
    assignData(tempInstance, processedData);

    // 钩子和验证处理（如果启用）
    // 注意：只有当 enableHooks 或 enableValidation 为 true 时才进入此块
    if (enableHooks || enableValidation) {
      // beforeValidate 钩子（只有启用钩子时才执行）
      if (enableHooks && this.beforeValidate) {
        const primaryKey = this.primaryKey || "id";
        await runHookAndMergeIfChanged(
          this.beforeValidate,
          tempInstance,
          (beforeSnapshot) => {
            mergeUpdateHookFields(
              processedData,
              tempInstance,
              beforeSnapshot,
              existingInstance,
              primaryKey,
            );
          },
        );
      }

      // 验证数据（包括跨字段验证和数据库查询验证）
      // 传递当前记录的 ID，用于唯一性验证时排除当前记录
      if (enableValidation) {
        const primaryKey = this.primaryKey || "id";
        const instanceId = existingInstance
          ? getRecordValue(existingInstance, primaryKey)
          : undefined;
        // 如果跳过预查询，instanceId 为 undefined，唯一性验证可能不准确
        // 因此建议在跳过预查询时确保没有唯一性验证
        await SQLModel.validate.call(this, processedData, instanceId);
      }

      // afterValidate 钩子
      if (enableHooks && this.afterValidate) {
        const primaryKey = this.primaryKey || "id";
        await runHookAndMergeIfChanged(
          this.afterValidate,
          tempInstance,
          (beforeSnapshot) => {
            mergeUpdateHookFields(
              processedData,
              tempInstance,
              beforeSnapshot,
              existingInstance,
              primaryKey,
            );
          },
        );
      }

      // beforeUpdate 钩子
      if (enableHooks && this.beforeUpdate) {
        const primaryKey = this.primaryKey || "id";
        await runHookAndMergeIfChanged(
          this.beforeUpdate,
          tempInstance,
          (beforeSnapshot) => {
            mergeUpdateHookFields(
              processedData,
              tempInstance,
              beforeSnapshot,
              existingInstance,
              primaryKey,
            );
          },
        );
      }

      // beforeSave 钩子
      if (enableHooks && this.beforeSave) {
        const primaryKey = this.primaryKey || "id";
        await runHookAndMergeIfChanged(
          this.beforeSave,
          tempInstance,
          (beforeSnapshot) => {
            mergeUpdateHookFields(
              processedData,
              tempInstance,
              beforeSnapshot,
              existingInstance,
              primaryKey,
            );
          },
        );
      }
    }

    const { where, params: whereParams } = this.buildWhereClause(
      condition,
      false,
      false,
    );

    // 序列化数组和对象字段为 JSON 字符串（SQLite 需要）
    // 使用 processAndSerializeFields 仅序列化（skipProcessing=true），利用缓存的键优化性能
    const serializedData = SQLModel.processAndSerializeFields.call(
      this,
      processedData,
      true, // 跳过处理，仅序列化
    );

    const keys = Object.keys(serializedData);
    const values = Object.values(serializedData);
    const setClause = keys.map((key) =>
      `${SQLModel.escapeFieldName.call(this, key, this.adapter)} = ?`
    ).join(", ");

    let sql = `UPDATE ${this.quotedTable()} SET ${setClause} WHERE ${where}`;
    const sqlAdapter = this.asSqlAdapter(this.adapter);
    sql = this.applyReturning(sql, this.adapter, "update", "*", {
      returnLatest,
    });
    // ensureAdapter() 已确保 adapter 不为 null
    let result: any;
    try {
      result = await this.adapter.execute(sql, [
        ...values,
        ...whereParams,
      ]);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 MySQL/SQLite），回退到不使用 RETURNING
      if (sqlAdapter?.shouldRetryWithoutReturning("update")) {
        sql = `UPDATE ${this.quotedTable()} SET ${setClause} WHERE ${where}`;
        result = await this.adapter.execute(sql, [
          ...values,
          ...whereParams,
        ]);
      } else {
        throw error;
      }
    }

    // 返回影响的行数（如果适配器支持）
    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? readAffectedRows(result)
        : 0);

    if (affectedRows > 0) {
      let updatedInstance: any | null = null;
      if (
        sqlAdapter?.sqlDialect === "postgresql" &&
        result && typeof result === "object" && "rows" in result
      ) {
        // PostgreSQL 使用 RETURNING 返回的行
        const rows = readResultRows(result);
        if (Array.isArray(rows) && rows.length > 0) {
          const instance = this.createInstance();
          assignData(instance, rows[0]);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          updatedInstance = instance;
        }
      } else if (returnLatest) {
        // MySQL/SQLite 可能不支持 RETURNING 或返回格式不同，需要重新查询
        // 从条件中获取主键值
        const primaryKey = this.primaryKey || "id";
        let primaryKeyValue: any;
        if (typeof condition === "number" || typeof condition === "string") {
          primaryKeyValue = condition;
        } else if (condition && typeof condition === "object") {
          primaryKeyValue = getRecordValue(condition as object, primaryKey);
        }

        if (primaryKeyValue) {
          // 重新查询数据库获取最新数据
          const latest = await this.find(primaryKeyValue);
          if (latest) {
            updatedInstance = latest;
          } else {
            // 如果查询失败，使用合并后的数据
            const instance = this.createInstance();
            if (existingInstance) {
              assignData(instance, existingInstance, processedData);
            } else {
              assignData(instance, processedData);
            }
            // 应用虚拟字段
            this.applyVirtuals(instance);
            updatedInstance = instance;
          }
        } else {
          // 无法获取主键值，使用合并后的数据
          const instance = this.createInstance();
          if (existingInstance) {
            assignData(instance, existingInstance, processedData);
          } else {
            assignData(instance, processedData);
          }
          // 应用虚拟字段
          this.applyVirtuals(instance);
          updatedInstance = instance;
        }
      } else {
        // 不需要返回实例，但需要创建实例用于钩子
        const instance = this.createInstance();
        if (existingInstance) {
          assignData(instance, existingInstance, processedData);
        } else {
          assignData(instance, processedData);
        }
        // 应用虚拟字段
        this.applyVirtuals(instance);
        updatedInstance = instance;
      }

      if (updatedInstance && enableHooks) {
        if (this.afterUpdate) {
          await this.afterUpdate(updatedInstance);
        }
        if (this.afterSave) {
          await this.afterSave(updatedInstance);
        }
      }

      // 清除相关缓存
      await this.clearCache();

      // 如果 returnLatest 为 true，返回更新后的实例
      if (returnLatest && updatedInstance) {
        return updatedInstance as InstanceType<T>;
      }
    }

    return affectedRows;
  }

  /**
   * 删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.delete(1);
   * await User.delete({ id: 1 });
   * await User.delete({ email: 'user@example.com' });
   */
  static async delete(
    condition: FindCondition,
  ): Promise<number> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 先查找要删除的记录（用于钩子）
    let instancesToDelete: InstanceType<typeof SQLModel>[] = [];
    if (typeof condition === "number" || typeof condition === "string") {
      const instance = await this.find(condition);
      if (instance) {
        instancesToDelete = [instance];
      }
    } else {
      instancesToDelete = await this.findAll(condition);
    }

    if (instancesToDelete.length === 0) {
      return 0;
    }

    // beforeDelete 钩子（对所有要删除的记录执行）
    if (this.beforeDelete) {
      for (const instance of instancesToDelete) {
        await this.beforeDelete(instance);
      }
    }

    // 软删除：设置 deletedAt 字段（排除已删除的记录，避免重复删除）
    if (this.softDelete) {
      // 排除已软删除的记录，避免重复删除
      const { where, params } = this.buildWhereClause(condition, false, false);
      // 将 Date 对象转换为数据库兼容的字符串格式
      const deletedAtValue = SQLModel.formatDateForDatabase(
        new Date(),
        this.adapter,
      );
      const escapedDeletedAtField = SQLModel.escapeFieldName.call(
        this,
        this.deletedAtField,
        this.adapter,
      );
      const sql =
        `UPDATE ${this.quotedTable()} SET ${escapedDeletedAtField} = ? WHERE ${where}`;
      // ensureAdapter() 已确保 adapter 不为 null
      const result = await this.adapter.execute(sql, [
        deletedAtValue,
        ...params,
      ]);
      const affectedRows = (typeof result === "number")
        ? result
        : ((result && typeof result === "object" && "affectedRows" in result)
          ? readAffectedRows(result)
          : 0);

      if (affectedRows > 0 && this.afterDelete) {
        // afterDelete 钩子（对所有已删除的记录执行）
        for (const instance of instancesToDelete) {
          await this.afterDelete(instance);
        }
      }
      return affectedRows;
    }

    // 硬删除：真正删除记录（包含已软删除的记录）
    const { where, params } = this.buildWhereClause(condition, true, false);
    const sql = `DELETE FROM ${this.quotedTable()} WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, params);

    // 返回影响的行数（如果适配器支持）
    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? readAffectedRows(result)
        : 0);

    if (affectedRows > 0) {
      if (this.afterDelete) {
        // afterDelete 钩子（对所有已删除的记录执行）
        for (const instance of instancesToDelete) {
          await this.afterDelete(instance);
        }
      }

      // 清除相关缓存
      await this.clearCache();
    }

    return affectedRows;
  }

  /**
   * 保存当前实例（插入或更新）
   * @returns 保存后的实例
   */
  async save<T extends SQLModel>(this: T): Promise<T> {
    const Model = this.constructor as typeof SQLModel;
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "id";
    const id = asModelId(getRecordValue(this, primaryKey));

    if (id) {
      // 更新现有记录
      // 将实例对象转换为普通数据对象，排除主键字段
      const data: Record<string, any> = {};
      // 使用 Object.keys 避免 hasOwnProperty 的问题
      const keys = Object.keys(this);
      for (const key of keys) {
        if (key !== primaryKey) {
          const value = getRecordValue(this, key);
          // 只包含数据属性，排除方法
          if (typeof value !== "function") {
            data[key] = value;
          }
        }
      }
      // 使用 returnLatest 选项直接获取更新后的数据，避免额外的查询
      const updated = await Model.update(id, data, true);
      if (!updated) {
        throw new Error(
          $tr(
            "log.model.updateNotFound",
            {
              id: String(id),
            },
          ),
        );
      }
      assignData(this, updated);
      return this;
    } else {
      // 插入新记录
      const instance = await Model.create(this);
      assignData(this, instance);
      return this;
    }
  }

  /**
   * 更新当前实例
   * @param data 要更新的数据对象
   * @returns 更新后的实例
   *
   * @example
   * const user = await User.find(1);
   * await user.update({ age: 26 });
   */
  async update<T extends SQLModel>(
    this: T,
    data: Record<string, any>,
  ): Promise<T> {
    const Model = this.constructor as typeof SQLModel;
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "id";
    const id = asModelId(getRecordValue(this, primaryKey));

    if (!id) {
      throw new Error(
        $tr("model.cannotUpdateWithoutPrimaryKey"),
      );
    }

    // 使用 returnLatest 选项直接获取更新后的数据，避免额外的查询
    const updated = await Model.update(id, data, true);
    if (!updated) {
      throw new Error(
        $tr(
          "log.model.updateNotFoundWithId",
          { id: String(id) },
        ),
      );
    }
    assignData(this, updated);
    return this;
  }

  /**
   * 删除当前实例
   * @returns 是否删除成功
   */
  async delete<T extends SQLModel>(this: T): Promise<boolean> {
    const Model = this.constructor as typeof SQLModel;
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "id";
    const id = asModelId(getRecordValue(this, primaryKey));

    if (!id) {
      throw new Error(
        $tr("model.cannotDeleteWithoutPrimaryKey"),
      );
    }

    const deleted = await Model.delete(id);
    return deleted > 0;
  }

  /**
   * 查找单条记录（find 的别名，更符合常见习惯）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fields 要查询的字段数组（可选）
   * @returns 模型实例或 null
   *
   * @example
   * const user = await User.findOne(1);
   * const user = await User.findOne({ email: 'user@example.com' });
   */
  static async findOne<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    },
  ): Promise<InstanceType<T> | null> {
    return await this.find(
      condition,
      fields,
      includeTrashed,
      onlyTrashed,
      options,
    );
  }

  /**
   * 通过主键 ID 查找记录
   * @param id 主键值
   * @param fields 要查询的字段数组（可选）
   * @returns 模型实例或 null
   *
   * @example
   * const user = await User.findById(1);
   * const user = await User.findById(1, ['id', 'name', 'email']);
   */
  static async findById<T extends typeof SQLModel>(
    this: T,
    id: number | string,
    fields?: string[],
  ): Promise<InstanceType<T> | null> {
    return await this.find(id, fields);
  }

  /**
   * 通过主键 ID 更新记录
   * @param id 主键值
   * @param data 要更新的数据对象
   * @returns 更新的记录数
   *
   * @example
   * await User.updateById(1, { name: 'lisi' });
   */
  static async updateById(
    id: number | string,
    data: Record<string, any>,
  ): Promise<number> {
    return await this.update(id, data);
  }

  /**
   * 通过主键 ID 删除记录
   * @param id 主键值
   * @returns 删除的记录数
   *
   * @example
   * await User.deleteById(1);
   */
  static async deleteById(
    id: number | string,
  ): Promise<number> {
    return await this.delete(id);
  }

  /**
   * 批量更新记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param data 要更新的数据对象
   * @param options 可选配置
   *   - enableHooks: 是否启用钩子（默认 false，批量操作通常不需要钩子以提升性能）
   *   - enableValidation: 是否启用验证（默认 false，批量操作通常不需要验证以提升性能）
   * @returns 更新的记录数
   *
   * @example
   * await User.updateMany({ status: 'active' }, { lastLogin: new Date() });
   * await User.updateMany({ age: { $lt: 18 } }, { isMinor: true });
   *
   * // 启用钩子和验证（性能较慢，但功能完整）
   * await User.updateMany({ status: 'active' }, { lastLogin: new Date() }, { enableHooks: true, enableValidation: true });
   */
  static async updateMany(
    condition: FindCondition,
    data: Record<string, any>,
    options?: { enableHooks?: boolean; enableValidation?: boolean },
  ): Promise<number> {
    // updateMany 和 update 在 SQL 中逻辑相同，都是 UPDATE ... WHERE
    // 默认不启用钩子和验证，以提升批量操作性能
    // 注意：必须明确传递 false，因为 update() 方法默认启用钩子和验证
    const enableHooksValue = options?.enableHooks === true ? true : false;
    const enableValidationValue = options?.enableValidation === true
      ? true
      : false;
    return await this.update(condition, data, false, {
      enableHooks: enableHooksValue,
      enableValidation: enableValidationValue,
    });
  }

  /**
   * 批量删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.deleteMany({ status: 'deleted' });
   * await User.deleteMany({ age: { $lt: 18 } });
   */
  static async deleteMany(
    condition: FindCondition,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 如果需要返回 ID，先查询符合条件的记录
    if (options?.returnIds) {
      const conditionObj =
        typeof condition === "number" || typeof condition === "string"
          ? { [this.primaryKey]: condition }
          : condition;
      const records = await this.findAll(conditionObj);
      const primaryKey = this.primaryKey || "id";
      const ids = records.map((record) => getRecordValue(record, primaryKey));
      // 执行删除
      const count = await this.delete(condition);
      return { count, ids };
    }
    // deleteMany 和 delete 在 SQL 中逻辑相同，都是 DELETE ... WHERE
    return await this.delete(condition);
  }

  /**
   * 统计符合条件的记录数量
   * @param condition 查询条件（可选，不提供则统计所有记录）
   * @returns 记录数量
   *
   * @example
   * const total = await User.count();
   * const activeUsers = await User.count({ status: 'active' });
   * const adults = await User.count({ age: { $gte: 18 } });
   */
  static async count(
    condition: FindCondition = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<number> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    const sql =
      `SELECT COUNT(*) as count FROM ${this.quotedTable()} WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const results = await this.adapter.query(sql, params);

    if (results.length > 0) {
      return parseInt(results[0].count) || 0;
    }
    return 0;
  }

  /**
   * 检查记录是否存在
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 是否存在
   *
   * @example
   * const exists = await User.exists(1);
   * const exists = await User.exists({ email: 'user@example.com' });
   */
  static async exists(
    condition: FindCondition,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<boolean> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    // SQLite 中 'exists' 是保留字，使用其他别名
    const sql =
      `SELECT EXISTS(SELECT 1 FROM ${this.quotedTable()} WHERE ${where}) as result`;
    // ensureAdapter() 已确保 adapter 不为 null
    const results = await this.adapter.query(sql, params);

    if (results.length > 0) {
      // 不同数据库可能返回不同的布尔值表示方式
      const exists = results[0].result;
      return exists === true || exists === 1 || exists === "1" ||
        exists === "t";
    }
    return false;
  }

  /**
   * 批量创建记录
   * @param dataArray 要插入的数据对象数组
   * @param options 可选配置
   *   - enableHooks: 是否启用钩子（默认 false，批量操作通常不需要钩子以提升性能）
   *   - enableValidation: 是否启用验证（默认 false，批量操作通常不需要验证以提升性能）
   * @returns 创建的模型实例数组
   *
   * @example
   * const users = await User.createMany([
   *   { name: 'John', email: 'john@example.com' },
   *   { name: 'Jane', email: 'jane@example.com' }
   * ]);
   *
   * // 启用钩子和验证（性能较慢，但功能完整）
   * const users = await User.createMany([...], { enableHooks: true, enableValidation: true });
   */
  static async createMany<T extends typeof SQLModel>(
    this: T,
    dataArray: Record<string, any>[],
    options?: { enableHooks?: boolean; enableValidation?: boolean },
  ): Promise<InstanceType<T>[]> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    if (dataArray.length === 0) {
      return [];
    }

    const enableHooks = options?.enableHooks === true;
    const enableValidation = options?.enableValidation === true;

    // 处理每个数据项（如果启用了钩子或验证）
    const processedArray: Record<string, any>[] = [];
    for (const data of dataArray) {
      let processedData = data;

      // 字段处理（应用默认值、类型转换）
      if (enableHooks || enableValidation) {
        processedData = this.processFields(data, { applyDefaults: true });

        // 自动时间戳
        if (this.timestamps) {
          applyCreateTimestamps(processedData, this.timestamps);
        }

        // 钩子处理（如果启用）
        if (enableHooks) {
          const tempInstance = this.createInstance();
          assignData(tempInstance, processedData);
          const originalKeys = new Set(Object.keys(processedData));
          const schemaKeys = this.schema ? this.getSchemaKeys() : undefined;
          for (
            const hook of [
              this.beforeValidate,
              this.afterValidate,
              this.beforeCreate,
              this.beforeSave,
            ]
          ) {
            if (hook) {
              await hook(tempInstance);
              mergeCreateManyHookFields(
                processedData,
                tempInstance,
                originalKeys,
                schemaKeys,
              );
            }
          }
        }

        // 验证（如果启用）
        if (enableValidation) {
          await SQLModel.validate.call(this, processedData);
        }

        // 序列化数组和对象字段
        processedData = SQLModel.serializeFields.call(this, processedData);
      } else {
        // 未启用钩子和验证时，只序列化字段（批量操作通常用于性能优化）
        processedData = SQLModel.serializeFields.call(this, data);
      }

      processedArray.push(processedData);
    }

    // 获取所有数据的键（假设所有对象有相同的键）
    const keys = Object.keys(processedArray[0]);
    const placeholders = keys.map(() => "?").join(", ");

    // 构建批量插入 SQL
    const valuesList = processedArray.map(() => `(${placeholders})`).join(", ");
    const allValues = processedArray.flatMap((data) =>
      keys.map((key) => data[key])
    );

    const escapedKeys = keys.map((key) =>
      SQLModel.escapeFieldName.call(this, key, this.adapter)
    );
    const escapedPrimaryKey = SQLModel.escapeFieldName.call(
      this,
      this.primaryKey,
      this.adapter,
    );

    let sql = `INSERT INTO ${this.quotedTable()} (${
      escapedKeys.join(", ")
    }) VALUES ${valuesList}`;
    const sqlAdapter = this.asSqlAdapter(this.adapter);
    // 尝试使用 RETURNING 子句获取插入的 ID（MySQL 8.0+ 和 SQLite 3.35.0+ 支持）
    sql = this.applyReturning(
      sql,
      this.adapter,
      "insertMany",
      escapedPrimaryKey,
    );
    // ensureAdapter() 已确保 adapter 不为 null
    let execResult: any;
    try {
      execResult = await this.adapter.execute(sql, allValues);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 MySQL/SQLite），回退到不使用 RETURNING
      if (sqlAdapter?.shouldRetryWithoutReturning("insertMany")) {
        sql = `INSERT INTO ${this.quotedTable()} (${
          escapedKeys.join(", ")
        }) VALUES ${valuesList}`;
        execResult = await this.adapter.execute(sql, allValues);
      } else {
        throw error;
      }
    }

    // 尝试获取插入的 ID
    const instances: InstanceType<T>[] = [];
    if (
      execResult && typeof execResult === "object" && "rows" in execResult
    ) {
      // PostgreSQL/MySQL/SQLite 使用 RETURNING 返回的行
      const rows = readResultRows(execResult);
      if (Array.isArray(rows) && rows.length === processedArray.length) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = this.createInstance();
          assignData(instance, processedArray[idx]);
          const idVal = rows[idx]?.[this.primaryKey] ?? rows[idx]?.id ?? null;
          if (idVal != null) {
            setRecordValue(instance, this.primaryKey, idVal);
          }
          // 应用虚拟字段
          this.applyVirtuals(instance);
          instances.push(instance as InstanceType<T>);
        }
      }
    } else if (
      execResult && typeof execResult === "object" && "insertId" in execResult
    ) {
      // MySQL 批量插入时只返回第一个 insertId，需要计算后续的 ID
      // 注意：这假设主键是自增的，且批量插入是连续的
      const firstInsertId = readInsertId(execResult);
      if (firstInsertId != null) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = this.createInstance();
          assignData(instance, processedArray[idx]);
          setRecordValue(
            instance,
            this.primaryKey,
            Number(firstInsertId) + idx,
          );
          // 应用虚拟字段
          this.applyVirtuals(instance);
          instances.push(instance as InstanceType<T>);
        }
      }
    } else if (
      execResult && typeof execResult === "object" &&
      "lastInsertRowid" in execResult
    ) {
      // SQLite 批量插入时只返回最后一个 lastInsertRowid，需要计算前面的 ID
      // 注意：这假设主键是自增的，且批量插入是连续的
      const lastInsertRowid = readInsertId(execResult);
      if (lastInsertRowid != null) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = this.createInstance();
          assignData(instance, processedArray[idx]);
          setRecordValue(
            instance,
            this.primaryKey,
            Number(lastInsertRowid) -
              (processedArray.length - 1 - idx),
          );
          // 应用虚拟字段
          this.applyVirtuals(instance);
          instances.push(instance as InstanceType<T>);
        }
      }
    }

    // 如果无法获取 ID，直接使用处理后的数据创建实例
    if (instances.length === 0) {
      for (const data of processedArray) {
        const instance = this.createInstance();
        assignData(instance, data);
        // 应用虚拟字段
        this.applyVirtuals(instance);
        instances.push(instance as InstanceType<T>);
      }
    }

    // 执行 afterCreate 和 afterSave 钩子（如果启用）
    if (enableHooks) {
      for (const instance of instances) {
        if (this.afterCreate) {
          await this.afterCreate(instance);
        }
        if (this.afterSave) {
          await this.afterSave(instance);
        }
      }
    }

    // 清除相关缓存
    await this.clearCache();

    return instances;
  }

  /**
   * 分页查询
   * @param condition 查询条件（可选）
   * @param page 页码（从 1 开始）
   * @param pageSize 每页数量
   * @param sort 排序规则（可选，默认为按 createdAt 降序）
   * @param fields 要查询的字段数组（可选）
   * @param includeTrashed 是否包含已删除的记录（默认 false）
   * @param onlyTrashed 是否只查询已删除的记录（默认 false）
   * @returns 分页结果对象，包含 data（数据数组）、total（总记录数）、page、pageSize、totalPages
   *
   * @example
   * const result = await User.paginate({ status: 'active' }, 1, 10);
   * console.log(result.data); // 数据数组
   * console.log(result.total); // 总记录数
   * console.log(result.totalPages); // 总页数
   *
   * // 使用自定义排序
   * const result = await User.paginate({ status: 'active' }, 1, 10, { age: 'desc' });
   */
  static async paginate<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition = {},
    page: number = 1,
    pageSize: number = 10,
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<{
    data: InstanceType<T>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 确保页码和每页数量有效
    page = Math.max(1, Math.floor(page));
    pageSize = Math.max(1, Math.floor(pageSize));

    // 如果没有提供排序，使用主键降序
    if (!sort) {
      sort = { [this.primaryKey]: -1 };
    }

    // 计算偏移量
    const offset = (page - 1) * pageSize;

    // 统计总数
    const total = await this.count(condition, includeTrashed, onlyTrashed);

    // 构建查询 SQL
    const { where, params } = this.buildWhereClause(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    const columns = fields && fields.length > 0 ? fields.join(", ") : "*";

    // 构建排序子句
    const orderBy = this.buildOrderByClause(sort);

    let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
    if (orderBy) {
      sql = `${sql} ORDER BY ${orderBy}`;
    }
    sql = `${sql} LIMIT ? OFFSET ?`;

    // ensureAdapter() 已确保 adapter 不为 null
    const results = await this.adapter.query(sql, [
      ...params,
      pageSize,
      offset,
    ]);

    const data = results.map((row: any) => {
      const instance = this.createInstance();
      assignData(instance, row);
      return instance as InstanceType<T>;
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 增加字段值
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 要增加的字段名或字段-增量映射对象
   * @param amountOrReturnLatest 增加的数量（当提供单个字段名时生效，默认为 1）或 returnLatest 标志
   * @param returnLatest 是否返回更新后的记录（默认 false）
   * @returns 更新的记录数或更新后的模型实例
   *
   * @example
   * // 单个字段
   * await User.increment(1, 'views', 1);
   * await User.increment({ status: 'active' }, 'score', 10);
   * // 对象格式（批量自增）
   * await User.increment(1, { views: 1, likes: 2 });
   * await User.increment({ status: 'active' }, { score: 10, level: 1 }, true);
   * // 获取更新后的记录
   * const user = await User.increment(1, 'views', 1, true);
   */
  static async increment<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    fieldOrMap: string | Record<string, number>,
    amountOrReturnLatest?: number | boolean,
    returnLatest?: boolean,
  ): Promise<number | InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, false, false);

    // 处理参数：支持两种调用方式
    // 1. increment(condition, field, amount, returnLatest)
    // 2. increment(condition, fields, returnLatest)
    let incSpec: Record<string, number>;
    let shouldReturnLatest: boolean = false;

    if (typeof fieldOrMap === "string") {
      // 单个字段格式：increment(condition, field, amount?, returnLatest?)
      const amount = typeof amountOrReturnLatest === "number"
        ? amountOrReturnLatest
        : 1;
      shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      incSpec = { [fieldOrMap]: amount };
    } else {
      // 对象格式：increment(condition, fields, returnLatest?)
      shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      incSpec = fieldOrMap;
    }

    // 构建 SET 子句
    const setParts: string[] = [];
    const setParams: any[] = [];
    for (const [field, amount] of Object.entries(incSpec)) {
      const escapedField = SQLModel.escapeFieldName.call(
        this,
        field,
        this.adapter,
      );
      setParts.push(`${escapedField} = ${escapedField} + ?`);
      setParams.push(amount);
    }
    const setClause = setParts.join(", ");

    let sql = `UPDATE ${this.quotedTable()} SET ${setClause} WHERE ${where}`;
    const sqlAdapter = this.asSqlAdapter(this.adapter);
    // MySQL 8.0.19+ 支持 RETURNING，但适配器需要特殊处理，所以 increment 路径不使用
    sql = this.applyReturning(sql, this.adapter, "increment", "*", {
      returnLatest: shouldReturnLatest,
    });
    // ensureAdapter() 已确保 adapter 不为 null
    let result: any;
    try {
      result = await this.adapter.execute(sql, [...setParams, ...params]);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 SQLite），回退到不使用 RETURNING
      if (
        shouldReturnLatest &&
        sqlAdapter?.shouldRetryWithoutReturning("increment")
      ) {
        sql = `UPDATE ${this.quotedTable()} SET ${setClause} WHERE ${where}`;
        result = await this.adapter.execute(sql, [...setParams, ...params]);
      } else {
        throw error;
      }
    }

    if (!shouldReturnLatest) {
      if (typeof result === "number") {
        return result;
      }
      if (result && typeof result === "object" && "affectedRows" in result) {
        return readAffectedRows(result);
      }
      return 0;
    }

    let instance: any | null = null;
    // 检查是否有 RETURNING 返回的数据
    const rows = result && typeof result === "object" && "rows" in result
      ? readResultRows(result)
      : null;

    if (rows && Array.isArray(rows) && rows.length > 0) {
      // PostgreSQL/SQLite 使用 RETURNING 返回的行
      instance = this.createInstance();
      assignData(instance, rows[0]);
      // 应用虚拟字段
      this.applyVirtuals(instance);
    } else {
      // 不支持 RETURNING 或 RETURNING 失败（如 MySQL），使用 SELECT 查询获取更新后的值
      // 查询完整的记录以确保包含所有字段
      const selectSql =
        `SELECT * FROM ${this.quotedTable()} WHERE ${where} LIMIT 1`;
      const selectResult = await this.adapter.query(selectSql, params);
      if (selectResult && selectResult.length > 0) {
        instance = this.createInstance();
        assignData(instance, selectResult[0]);
        // 应用虚拟字段
        this.applyVirtuals(instance);
      }
    }

    if (!instance) {
      throw new Error(
        $tr("log.model.cannotGetUpdatedRecord"),
      );
    }

    return instance as InstanceType<T>;
  }

  /**
   * 减少字段值
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 要减少的字段名或字段-减量映射对象
   * @param amountOrReturnLatest 减少的数量（当提供单个字段名时生效，默认为 1）或 returnLatest 标志
   * @param returnLatest 是否返回更新后的记录（默认 false）
   * @returns 更新的记录数或更新后的模型实例
   *
   * @example
   * // 单个字段
   * await User.decrement(1, 'views', 1);
   * await User.decrement({ status: 'active' }, 'score', 10);
   * // 对象格式（批量自减）
   * await User.decrement(1, { views: 1, likes: 2 });
   * await User.decrement({ status: 'active' }, { score: 10, level: 1 }, true);
   */
  static async decrement<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    fieldOrMap: string | Record<string, number>,
    amountOrReturnLatest?: number | boolean,
    returnLatest?: boolean,
  ): Promise<number | InstanceType<T>> {
    // 如果是对象格式，将所有的值取反
    if (typeof fieldOrMap === "object" && !Array.isArray(fieldOrMap)) {
      const negatedMap: Record<string, number> = {};
      for (const [key, value] of Object.entries(fieldOrMap)) {
        negatedMap[key] = -value;
      }
      // 对象格式：decrement(condition, fields, returnLatest?)
      const shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      return await this.increment(
        condition,
        negatedMap,
        shouldReturnLatest,
      );
    } else {
      // 单个字段格式：decrement(condition, field, amount?, returnLatest?)
      const amount = typeof amountOrReturnLatest === "number"
        ? -amountOrReturnLatest
        : -1;
      const shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      return await this.increment(
        condition,
        fieldOrMap,
        amount,
        shouldReturnLatest,
      );
    }
  }

  /**
   * 批量自增字段
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 字段名或字段-增量映射
   * @param amount 增量（当提供单个字段名时生效）
   * @returns 更新的记录数
   *
   * @example
   * await User.incrementMany({ status: 'active' }, 'views', 1);
   * await User.incrementMany({ status: 'active' }, { views: 1, likes: 2 });
   */
  static async incrementMany(
    condition: FindCondition,
    fieldOrMap: string | Record<string, number>,
    amount: number = 1,
  ): Promise<number> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, false, false);

    // 构建更新字段和值
    const incSpec: Record<string, number> = typeof fieldOrMap === "string"
      ? { [fieldOrMap]: amount }
      : fieldOrMap;

    // 构建 SET 子句
    const setClauses: string[] = [];
    const setValues: any[] = [];

    for (const [field, incAmount] of Object.entries(incSpec)) {
      const escapedField = SQLModel.escapeFieldName.call(
        this,
        field,
        this.adapter,
      );
      setClauses.push(`${escapedField} = ${escapedField} + ?`);
      setValues.push(incAmount);
    }

    // 处理时间戳
    if (this.timestamps) {
      const updatedAtField = typeof this.timestamps === "object"
        ? (this.timestamps.updatedAt || "updatedAt")
        : "updatedAt";
      const escapedUpdatedAt = SQLModel.escapeFieldName.call(
        this,
        updatedAtField,
        this.adapter,
      );
      setClauses.push(`${escapedUpdatedAt} = ?`);
      setValues.push(new Date());
    }

    const sql = `UPDATE ${this.quotedTable()} SET ${
      setClauses.join(", ")
    } WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, [...setValues, ...params]);

    // 获取受影响的行数
    let affectedRows = 0;
    if (result && typeof result === "object") {
      if ("affectedRows" in result) {
        affectedRows = readAffectedRows(result);
      } else if ("rowCount" in result) {
        affectedRows = readAffectedRows(result);
      } else if ("changes" in result) {
        affectedRows = readAffectedRows(result);
      }
    } else if (typeof result === "number") {
      affectedRows = result;
    }

    // 清除相关缓存（批量自增后需要清除缓存）
    if (affectedRows > 0) {
      await this.clearCache();
    }

    return affectedRows;
  }

  /**
   * 批量自减字段
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 字段名或字段-减量映射
   * @param amount 减量（当提供单个字段名时生效）
   * @returns 更新的记录数
   *
   * @example
   * await User.decrementMany({ status: 'active' }, 'views', 1);
   * await User.decrementMany({ status: 'active' }, { views: 1, likes: 2 });
   */
  static async decrementMany(
    condition: FindCondition,
    fieldOrMap: string | Record<string, number>,
    amount: number = 1,
  ): Promise<number> {
    if (typeof fieldOrMap === "string") {
      return await this.incrementMany(condition, fieldOrMap, -amount);
    }
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(fieldOrMap)) {
      map[k] = -Math.abs(v);
    }
    return await this.incrementMany(condition, map);
  }

  /**
   * 更新或插入记录（如果不存在则插入，存在则更新）
   * 注意：不同数据库的语法不同，这里使用通用方式实现
   * PostgreSQL: INSERT ... ON CONFLICT ... DO UPDATE
   * MySQL: INSERT ... ON DUPLICATE KEY UPDATE
   * SQLite: INSERT ... ON CONFLICT ... DO UPDATE
   *
   * @param condition 查询条件（用于判断是否存在，通常包含唯一键）
   * @param data 要更新或插入的数据对象
   * @returns 更新后的模型实例
   *
   * @example
   * const user = await User.upsert(
   *   { email: 'user@example.com' },
   *   { name: 'John', email: 'user@example.com', age: 25 }
   * );
   */
  static async upsert<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    data: Record<string, any>,
    returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
    resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致（SQL 中此选项通常无效，但保留以统一接口）
    options?: { useDialectUpsert?: boolean; conflictKeys?: string[] },
  ): Promise<InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const useDialect = options?.useDialectUpsert ??
      (this.useDialectUpsert === true);
    const sqlAdapter = this.asSqlAdapter(this.adapter);
    const conflictKeys = options?.conflictKeys ??
      this.upsertConflictKeys ??
      (typeof condition === "object" && !Array.isArray(condition)
        ? Object.keys(condition)
        : []);

    if (
      useDialect && sqlAdapter?.sqlDialect === "postgresql" &&
      sqlAdapter.supportsDialectUpsert(conflictKeys)
    ) {
      try {
        // 如果 resurrect 为 true，先检查并恢复已软删除的记录
        if (resurrect && this.softDelete) {
          const existing = await this.withTrashed().find(condition);
          if (existing) {
            const id = asModelId(getRecordValue(existing, this.primaryKey));
            const deletedAtField = this.deletedAtField || "deletedAt";
            if (id && getRecordValue(existing, deletedAtField)) {
              await this.restore(id);
            }
          }
        }
        // 方言 upsert：同一 payload 参与 INSERT 与 DO UPDATE，沿用插入语义（applyDefaults: true）
        const processedData = this.processFields(data, { applyDefaults: true });
        if (this.timestamps) {
          applyUpdateTimestamp(processedData, this.timestamps);
        }
        if (typeof condition === "object" && condition) {
          for (const k of conflictKeys) {
            if (
              processedData[k] === undefined &&
              getRecordValue(condition as object, k) !== undefined
            ) {
              const v = getRecordValue(condition as object, k);
              processedData[k] = (v && typeof v === "object") ? undefined : v;
            }
          }
        }
        // 序列化数组和对象字段
        const serializedData = SQLModel.serializeFields.call(
          this,
          processedData,
        );
        const keys = Object.keys(serializedData).filter((k) =>
          k !== this.primaryKey
        );
        const values = keys.map((k) => serializedData[k]);
        const sql = sqlAdapter.buildUpsertSql(
          this.tableName,
          keys,
          conflictKeys,
        );
        // ensureAdapter() 已确保 adapter 不为 null
        const result = await this.adapter.execute(sql, values);
        if (result && typeof result === "object" && "rows" in result) {
          const rows = readResultRows(result);
          if (Array.isArray(rows) && rows.length > 0) {
            const instance = this.createInstance();
            assignData(instance, rows[0]);
            // 应用虚拟字段
            this.applyVirtuals(instance);
            return instance as InstanceType<T>;
          }
        }
        // 如果 PostgreSQL upsert 成功但没有返回行，回退到通用方式
      } catch (_error) {
        // PostgreSQL 方言 upsert 失败，记录错误并回退到通用方式
        // 注意：这里不抛出错误，而是回退到通用的 find + update/create 方式
        // 如果需要在失败时抛出错误，可以取消注释下面的代码
        // throw new Error(`PostgreSQL upsert failed: ${_error instanceof Error ? _error.message : String(_error)}`);
      }
    }

    if (useDialect && sqlAdapter?.sqlDialect === "mysql") {
      // 如果 resurrect 为 true，先检查并恢复已软删除的记录
      if (resurrect && this.softDelete) {
        const existing = await this.withTrashed().find(condition);
        if (existing) {
          const id = asModelId(getRecordValue(existing, this.primaryKey));
          const deletedAtField = this.deletedAtField || "deletedAt";
          if (id && getRecordValue(existing, deletedAtField)) {
            await this.restore(id);
          }
        }
      }
      const processedData = this.processFields(data, { applyDefaults: true });
      if (this.timestamps) {
        applyUpdateTimestamp(processedData, this.timestamps);
      }
      // 序列化数组和对象字段
      const serializedData = SQLModel.serializeFields.call(
        this,
        processedData,
      );
      const keys = Object.keys(serializedData).filter((k) =>
        k !== this.primaryKey
      );
      const values = keys.map((k) => serializedData[k]);
      const sql = sqlAdapter.buildUpsertSql(
        this.tableName,
        keys,
        conflictKeys,
      );
      // ensureAdapter() 已确保 adapter 不为 null
      const result = await this.adapter.execute(sql, values);
      const instance = this.createInstance();
      assignData(instance, processedData);
      if (result && typeof result === "object" && "insertId" in result) {
        const insertedId = readInsertId(result);
        if (insertedId != null) {
          setRecordValue(instance, this.primaryKey, insertedId);
        }
      }
      return instance as InstanceType<T>;
    }

    // 查找记录（如果 resurrect 为 true，包含软删除的记录）
    const existing = resurrect
      ? await this.withTrashed().find(condition)
      : await this.find(condition);
    if (existing) {
      // 如果 resurrect 为 true 且记录已被软删除，先恢复它
      if (resurrect && this.softDelete) {
        const id = asModelId(getRecordValue(existing, this.primaryKey));
        if (id) {
          const deletedAtField = this.deletedAtField || "deletedAt";
          if (getRecordValue(existing, deletedAtField)) {
            await this.restore(id);
          }
        }
      }
      // 更新记录
      if (returnLatest) {
        // 如果需要返回最新记录，使用 update 的 returnLatest 选项
        const result = await this.update(condition, data, true);
        if (typeof result === "number") {
          // 如果返回数字，说明更新失败，重新查询
          const updated = await this.find(condition);
          if (updated) {
            return updated as InstanceType<T>;
          }
        } else {
          return result as InstanceType<T>;
        }
      } else {
        // 如果不需要返回最新记录，只执行更新
        await this.update(condition, data, false);
        // 仍然返回现有记录（因为这是 upsert 的语义）
        return existing as InstanceType<T>;
      }
    }
    // 如果不存在，创建新记录
    return await this.create(data);
  }

  /**
   * 获取字段的唯一值列表
   * @param field 字段名
   * @param condition 查询条件（可选）
   * @returns 唯一值数组
   *
   * @example
   * const statuses = await User.distinct('status');
   * const emails = await User.distinct('email', { age: { $gte: 18 } });
   */
  static async distinct(
    field: string,
    condition: FindCondition = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<any[]> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    const sql =
      `SELECT DISTINCT ${field} FROM ${this.quotedTable()} WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const results = await this.adapter.query(sql, params);

    return results.map((row: any) => row[field]).filter((value: any) =>
      value !== null && value !== undefined
    );
  }

  /**
   * 查询时包含已软删除的记录
   * @returns 查询构建器（链式调用）
   *
   * @example
   * const allUsers = await User.withTrashed().findAll();
   * const user = await User.withTrashed().find(1);
   */
  static withTrashed<T extends typeof SQLModel>(this: T): {
    findAll: (
      condition?: WhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
    ) => Promise<InstanceType<T>[]>;
    find: (
      condition?: WhereCondition | number | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: WhereCondition) => Promise<number>;
  } {
    return {
      findAll: async (
        condition: FindCondition = {},
        fields?: string[],
        options?: {
          sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
          skip?: number;
          limit?: number;
        },
      ): Promise<InstanceType<T>[]> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, true, false);
        const columns = fields && fields.length > 0 ? fields.join(", ") : "*";
        const orderBy = this.buildOrderByClause(options?.sort);
        const useLimit = typeof options?.limit === "number";
        const useSkip = typeof options?.skip === "number";
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        if (useLimit) {
          sql = `${sql} LIMIT ?`;
        }
        if (useLimit && useSkip) {
          sql = `${sql} OFFSET ?`;
        }
        const extraParams: any[] = [];
        if (useLimit) {
          extraParams.push(Math.max(1, Math.floor(options!.limit!)));
        }
        if (useLimit && useSkip) {
          extraParams.push(Math.max(0, Math.floor(options!.skip!)));
        }
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, [
          ...params,
          ...extraParams,
        ]);
        return results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, row);
          return instance as InstanceType<T>;
        });
      },
      find: async (
        condition: WhereCondition | number | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, true, false);
        const columns = fields && fields.length > 0 ? fields.join(", ") : "*";
        const sql =
          `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, results[0]);
        return instance as InstanceType<T>;
      },
      count: async (condition: WhereCondition = {}): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, true, false);
        const sql =
          `SELECT COUNT(*) as count FROM ${this.quotedTable()} WHERE ${where}`;
        const results = await this.adapter.query(sql, params);
        if (results.length > 0) {
          return parseInt(String(results[0].count), 10) || 0;
        }
        return 0;
      },
    };
  }

  /**
   * 只查询已软删除的记录
   * @returns 查询构建器（链式调用）
   *
   * @example
   * const deletedUsers = await User.onlyTrashed().findAll();
   * const user = await User.onlyTrashed().find(1);
   */
  static onlyTrashed<T extends typeof SQLModel>(this: T): {
    findAll: (
      condition?: WhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
    ) => Promise<InstanceType<T>[]>;
    find: (
      condition?: WhereCondition | number | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: WhereCondition) => Promise<number>;
  } {
    return {
      findAll: async (
        condition: FindCondition = {},
        fields?: string[],
        options?: {
          sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
          skip?: number;
          limit?: number;
        },
      ): Promise<InstanceType<T>[]> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, false, true);
        const columns = fields && fields.length > 0 ? fields.join(", ") : "*";
        const orderBy = this.buildOrderByClause(options?.sort);
        const useLimit = typeof options?.limit === "number";
        const useSkip = typeof options?.skip === "number";
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        if (useLimit) {
          sql = `${sql} LIMIT ?`;
        }
        if (useLimit && useSkip) {
          sql = `${sql} OFFSET ?`;
        }
        const extraParams: any[] = [];
        if (useLimit) {
          extraParams.push(Math.max(1, Math.floor(options!.limit!)));
        }
        if (useLimit && useSkip) {
          extraParams.push(Math.max(0, Math.floor(options!.skip!)));
        }
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, [
          ...params,
          ...extraParams,
        ]);
        return results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, row);
          return instance as InstanceType<T>;
        });
      },
      find: async (
        condition: WhereCondition | number | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, false, true);
        const columns = fields && fields.length > 0 ? fields.join(", ") : "*";
        const sql =
          `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, results[0]);
        return instance as InstanceType<T>;
      },
      count: async (condition: WhereCondition = {}): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, false, true);
        const sql =
          `SELECT COUNT(*) as count FROM ${this.quotedTable()} WHERE ${where}`;
        const results = await this.adapter.query(sql, params);
        if (results.length > 0) {
          return parseInt(String(results[0].count), 10) || 0;
        }
        return 0;
      },
    };
  }

  /**
   * 链式查询构建器
   */
  static query<T extends typeof SQLModel>(this: T): SQLQueryBuilder<T> {
    // 创建共享状态对象，确保 asArray() 中的修改能够持久化
    // 使用数组结构支持多个条件的 OR/AND 组合
    const state = {
      _conditions: [] as Array<{
        type: "where" | "or" | "and";
        condition: WhereCondition | number | string;
      }>,
      _fields: undefined as string[] | undefined,
      _sort: undefined as
        | Record<string, 1 | -1 | "asc" | "desc">
        | "asc"
        | "desc"
        | undefined,
      _skip: undefined as number | undefined,
      _limit: undefined as number | undefined,
      _includeTrashed: false,
      _onlyTrashed: false,
      _with: undefined as PreloadRelations | undefined,
      _groupBy: undefined as string[] | undefined,
      _having: undefined as SqlHaving | undefined,
      _aggregates: undefined as SqlAggregates | undefined,
    };

    const resolveFields = (): string[] | undefined =>
      mergePreloadFields(state._fields, this.primaryKey, state._with);

    /**
     * 构建最终的查询条件
     * 将多个条件合并为 SQL WHERE 子句
     */
    const buildFinalCondition = (): WhereCondition | number | string => {
      if (state._conditions.length === 0) {
        return {};
      }

      // 如果只有一个 where 条件，直接返回
      if (
        state._conditions.length === 1 && state._conditions[0].type === "where"
      ) {
        return state._conditions[0].condition;
      }

      // 对于多个条件，返回一个特殊的组合对象，由 buildWhereClause 处理
      // 这里返回一个包含所有条件的数组结构
      return {
        __combined: state._conditions.map((item) => ({
          type: item.type,
          condition: item.condition,
        })),
      };
    };

    /**
     * 将条件对象中的字符串值转换为 LIKE 查询条件
     * 支持嵌套对象和 JSON 对象查询
     * @param condition 查询条件对象
     * @returns 转换后的查询条件对象
     */
    const convertToLikeCondition = (
      condition: WhereCondition,
    ): WhereCondition => {
      const result: WhereCondition = {};

      for (const [key, value] of Object.entries(condition)) {
        // 跳过 SQL 操作符（以 $ 开头）
        if (key.startsWith("$")) {
          result[key] = value;
          continue;
        }

        // 处理嵌套对象（支持 JSON 对象查询）
        if (
          typeof value === "object" && value !== null && !Array.isArray(value)
        ) {
          // 检查是否是操作符对象（包含 $gt, $lt, $like 等）
          const isOperatorObject = Object.keys(value).some((k) =>
            k.startsWith("$")
          );

          if (isOperatorObject) {
            // 如果已经是操作符对象，保持原样
            result[key] = value;
          } else {
            // 递归处理嵌套对象
            result[key] = convertToLikeCondition(value as WhereCondition);
          }
        } else if (typeof value === "string") {
          // 将字符串值转换为 LIKE 查询条件
          // 如果字符串不包含通配符，自动添加 % 通配符（前后都加）
          let likeValue = value;
          if (!likeValue.includes("%") && !likeValue.includes("_")) {
            likeValue = `%${likeValue}%`;
          }
          result[key] = { $like: likeValue };
        } else {
          // 其他类型（数字、布尔值等）保持原样
          result[key] = value;
        }
      }

      return result;
    };

    // 执行查询单条记录的函数（用于直接 await）
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      await this.ensureAdapter();
      const finalCondition = buildFinalCondition();
      const { where, params } = this.buildWhereClause(
        finalCondition,
        state._includeTrashed,
        state._onlyTrashed,
      );
      const columns = this.buildSelectColumnList(state);
      const orderBy = this.buildOrderByClause(state._sort);
      let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
      const grouped = this.applyGroupHaving(sql, params, state);
      sql = grouped.sql;
      const queryParams = grouped.params;
      if (orderBy) {
        sql = `${sql} ORDER BY ${orderBy}`;
      }
      sql = `${sql} LIMIT 1`;
      // ensureAdapter() 已确保 adapter 不为 null
      const results = await this.adapter.query(sql, queryParams);
      if (results.length === 0) {
        return null;
      }
      const instance = this.createInstance();
      assignData(instance, results[0]);
      if (!this.isAggregateQuery(state)) {
        await applyPreloads(instance, this.primaryKey, state._with);
      }
      return instance as InstanceType<T>;
    };

    // 仅在 then/catch/finally（如直接 await 构建器）时才执行 findOne
    const queryPromise = lazyThenable(() => executeFindOne());

    const builder = {
      /**
       * 设置查询条件（会重置之前的所有条件）
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      where: (condition: WhereCondition | number | string) => {
        state._conditions = [{ type: "where", condition }];
        return builder;
      },
      /**
       * 添加 OR 查询条件
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      orWhere: (condition: WhereCondition | number | string) => {
        state._conditions.push({ type: "or", condition });
        return builder;
      },
      /**
       * 添加 AND 查询条件
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      andWhere: (condition: WhereCondition | number | string) => {
        state._conditions.push({ type: "and", condition });
        return builder;
      },
      /**
       * 添加 LIKE 查询条件
       * 支持 WhereCondition 类型和 JSON 对象条件查询
       * @param condition 查询条件对象，字符串值会被转换为 LIKE 查询（支持 % 通配符）
       * @returns 查询构建器实例
       * @example
       * User.query().like({ name: "%shu%" }) // 匹配包含 "shu" 的 name 字段
       * User.query().like({ "user.name": "%shu%" }) // 支持点号路径
       * User.query().like({ user: { name: "%shu%" } }) // 支持嵌套对象
       */
      like: (condition: WhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        if (state._conditions.length === 0) {
          state._conditions.push({ type: "where", condition: likeCondition });
        } else {
          state._conditions.push({ type: "and", condition: likeCondition });
        }
        return builder;
      },
      /**
       * 添加 OR LIKE 查询条件
       * @param condition 查询条件对象，字符串值会被转换为 LIKE 查询（支持 % 通配符）
       * @returns 查询构建器实例
       */
      orLike: (condition: WhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "or", condition: likeCondition });
        return builder;
      },
      /**
       * 添加 AND LIKE 查询条件
       * @param condition 查询条件对象，字符串值会被转换为 LIKE 查询（支持 % 通配符）
       * @returns 查询构建器实例
       */
      andLike: (condition: WhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "and", condition: likeCondition });
        return builder;
      },
      fields: (fields: string[]) => {
        state._fields = fields;
        return builder;
      },
      sort: (
        sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
      ) => {
        state._sort = sort;
        return builder;
      },
      skip: (n: number) => {
        state._skip = Math.max(0, Math.floor(n));
        return builder;
      },
      limit: (n: number) => {
        state._limit = Math.max(1, Math.floor(n));
        return builder;
      },
      includeTrashed: () => {
        state._includeTrashed = true;
        state._onlyTrashed = false;
        return builder;
      },
      onlyTrashed: () => {
        state._onlyTrashed = true;
        state._includeTrashed = false;
        return builder;
      },
      with: (relations: PreloadRelations) => {
        state._with = { ...(state._with || {}), ...relations };
        return builder;
      },
      preload: (relations: PreloadRelations) => {
        return builder.with(relations);
      },
      groupBy: (columns: string | string[]) => {
        state._groupBy = normalizeGroupBy(columns);
        return builder;
      },
      having: (condition: string, params?: unknown[]) => {
        state._having = { sql: condition, params: params ?? [] };
        return builder;
      },
      aggregate: (aggregates: SqlAggregates) => {
        state._aggregates = aggregates;
        return builder;
      },
      findAll: async (): Promise<InstanceType<T>[]> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = this.buildSelectColumnList(state);
        const orderBy = this.buildOrderByClause(state._sort);
        const useLimit = typeof state._limit === "number";
        const useSkip = typeof state._skip === "number";
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        const grouped = this.applyGroupHaving(sql, params, state);
        sql = grouped.sql;
        const queryParams = grouped.params;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        const extraParams: any[] = [];
        if (useLimit) {
          sql = `${sql} LIMIT ?`;
          extraParams.push(Math.max(1, Math.floor(state._limit!)));
        }
        if (useLimit && useSkip) {
          sql = `${sql} OFFSET ?`;
          extraParams.push(Math.max(0, Math.floor(state._skip!)));
        }
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, [
          ...queryParams,
          ...extraParams,
        ]);
        const instances = results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, row);
          return instance as InstanceType<T>;
        });
        if (!this.isAggregateQuery(state)) {
          await applyPreloads(instances, this.primaryKey, state._with);
        }
        return instances;
      },
      findOne: async (): Promise<InstanceType<T> | null> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = this.buildSelectColumnList(state);
        const orderBy = this.buildOrderByClause(state._sort);
        let sql = `SELECT ${columns} FROM ${this.quotedTable()} WHERE ${where}`;
        const grouped = this.applyGroupHaving(sql, params, state);
        sql = grouped.sql;
        const queryParams = grouped.params;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        sql = `${sql} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, queryParams);
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, results[0]);
        if (!this.isAggregateQuery(state)) {
          await applyPreloads(instance, this.primaryKey, state._with);
        }
        return instance as InstanceType<T>;
      },
      one: async (): Promise<InstanceType<T> | null> => {
        return await builder.findOne();
      },
      all: async (): Promise<InstanceType<T>[]> => {
        return await builder.findAll();
      },
      /**
       * 将查询结果转换为纯 JSON 对象数组格式
       * 返回一个可以继续链式调用的构建器，最终返回纯 JSON 对象数组（不是模型实例）
       * @returns 返回数组查询构建器
       * @example
       * const users = await User.query().where({ status: 'active' }).asArray().findAll();
       * const user = await User.query().where({ id: 123 }).asArray().findOne(); // 返回纯 JSON 对象或 null
       */
      asArray: (): SQLArrayQueryBuilder<T> => {
        // 返回共享状态对象的引用，确保 asArray() 中的修改能够持久化
        return this.createArrayQueryBuilder(() => state);
      },
      findById: async (
        id: number | string,
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        await this.ensureAdapter();
        const row = await this.findById(
          id,
          mergePreloadFields(
            fields ?? state._fields,
            this.primaryKey,
            state._with,
          ),
        );
        await applyPreloads(row, this.primaryKey, state._with);
        return row;
      },
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        const { where, params } = this.buildWhereClause(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        return await this.countFromState(state, where, params);
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        const finalCondition = buildFinalCondition();
        return await this.exists(
          finalCondition,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      update: async (
        data: Record<string, any>,
        returnLatest: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        if (returnLatest) {
          return await this.update(
            finalCondition,
            data,
            true,
          ) as InstanceType<T>;
        }
        return await this.update(
          finalCondition,
          data,
          false,
        ) as number;
      },
      updateById: async (
        id: number | string,
        data: Record<string, any>,
      ): Promise<number> => {
        await this.ensureAdapter();
        return await this.updateById(id, data);
      },
      updateMany: async (data: Record<string, any>): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.updateMany(finalCondition, data);
      },
      increment: async (
        field: string,
        amount: number = 1,
        returnLatest: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        return await this.increment(
          finalCondition,
          field,
          amount,
          returnLatest,
        );
      },
      decrement: async (
        field: string,
        amount: number = 1,
        returnLatest: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        return await this.decrement(
          finalCondition,
          field,
          amount,
          returnLatest,
        );
      },
      deleteById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.deleteById(id);
      },
      deleteMany: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.deleteMany(finalCondition, options);
      },
      restore: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.restore(finalCondition, options);
      },
      restoreById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.restoreById(id);
      },
      forceDelete: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.forceDelete(finalCondition, options);
      },
      forceDeleteById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.forceDeleteById(id);
      },
      distinct: async (field: string): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "number" ||
            typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      upsert: async (
        data: Record<string, any>,
        returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
        resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        return await this.upsert(
          finalCondition,
          data,
          returnLatest,
          resurrect,
        );
      },
      findOrCreate: async (
        data: Record<string, any>,
        resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "number" ||
            typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.findOrCreate(cond, data, resurrect);
      },
      findOneAndUpdate: async (
        data: Record<string, any>,
        options?: { returnDocument?: "before" | "after" }, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndUpdate(
          finalCondition,
          data,
          options ?? { returnDocument: "after" },
        );
      },
      findOneAndDelete: async (): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        const existing = await this.find(
          finalCondition,
          state._fields,
          state._includeTrashed,
          state._onlyTrashed,
        );
        if (!existing) return null;
        const deleted = await this.delete(finalCondition);
        return deleted > 0 ? existing as InstanceType<T> : null;
      },
      findOneAndReplace: async (
        replacement: Record<string, any>,
        returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await (this as typeof SQLModel).findOneAndReplace(
          finalCondition,
          replacement,
          returnLatest,
        ) as InstanceType<T> | null;
      },
      incrementMany: async (
        fieldOrMap: string | Record<string, number>,
        amount: number = 1,
      ): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.incrementMany(
          finalCondition,
          fieldOrMap,
          amount,
        );
      },
      decrementMany: async (
        fieldOrMap: string | Record<string, number>,
        amount: number = 1,
      ): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.decrementMany(
          finalCondition,
          fieldOrMap,
          amount,
        );
      },
      paginate: async (
        page: number,
        pageSize: number,
      ): Promise<{
        data: InstanceType<T>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }> => {
        // 使用链式查询构建器中已有的条件、排序、字段等设置
        const finalCondition = buildFinalCondition();
        const result = await this.paginate(
          finalCondition,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          resolveFields(),
          state._includeTrashed,
          state._onlyTrashed,
        );
        await applyPreloads(result.data, this.primaryKey, state._with);
        return result;
      },
      // Promise 接口方法（用于直接 await）
      then: (
        onfulfilled?: (value: InstanceType<T> | null) => any,
        onrejected?: (reason: any) => any,
      ) => queryPromise.then(onfulfilled, onrejected),
      catch: (onrejected?: (reason: any) => any) =>
        queryPromise.catch(onrejected),
      finally: (onfinally?: () => void) => queryPromise.finally(onfinally),
    };

    return builder;
  }

  /**
   * 恢复软删除的记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 恢复的记录数
   *
   * @example
   * await User.restore(1);
   * await User.restore({ email: 'user@example.com' });
   */
  static async restore(
    condition: FindCondition,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    if (!this.softDelete) {
      throw new Error(
        $tr("model.softDeleteNotEnabled"),
      );
    }
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, true, true);

    let ids: any[] = [];
    if (options?.returnIds) {
      // ensureAdapter() 已确保 adapter 不为 null
      const rows = await this.adapter.query(
        `SELECT ${
          this.escapeFieldName(this.primaryKey, this._adapter)
        } FROM ${this.quotedTable()} WHERE ${where}`,
        params,
      );
      ids = rows.map((r: any) => r[this.primaryKey]).filter((v: any) =>
        v !== null && v !== undefined
      );
    }

    // ensureAdapter() 已确保 adapter 不为 null
    const escapedDeletedAtField = SQLModel.escapeFieldName.call(
      this,
      this.deletedAtField,
      this.adapter,
    );
    const result = await this.adapter.execute(
      `UPDATE ${this.quotedTable()} SET ${escapedDeletedAtField} = NULL WHERE ${where}`,
      params,
    );

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? readAffectedRows(result)
        : 0);

    if (options?.returnIds) {
      return { count: affectedRows, ids };
    }
    return affectedRows;
  }

  /**
   * 强制删除记录（忽略软删除，真正删除）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.forceDelete(1);
   * await User.forceDelete({ email: 'user@example.com' });
   */
  static async forceDelete(
    condition: FindCondition,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, true, false);

    let ids: any[] = [];
    if (options?.returnIds) {
      // ensureAdapter() 已确保 adapter 不为 null
      const rows = await this.adapter.query(
        `SELECT ${
          this.escapeFieldName(this.primaryKey, this._adapter)
        } FROM ${this.quotedTable()} WHERE ${where}`,
        params,
      );
      ids = rows.map((r: any) => r[this.primaryKey]).filter((v: any) =>
        v !== null && v !== undefined
      );
    }

    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(
      `DELETE FROM ${this.quotedTable()} WHERE ${where}`,
      params,
    );

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? readAffectedRows(result)
        : 0);

    if (options?.returnIds) {
      return { count: affectedRows, ids };
    }
    return affectedRows;
  }

  /**
   * 通过主键 ID 恢复软删除的记录
   * @param id 主键值
   * @returns 恢复的记录数
   *
   * @example
   * await User.restoreById(1);
   */
  static async restoreById(
    id: number | string,
  ): Promise<number> {
    const result = await this.restore(id);
    return typeof result === "number" ? result : result.count;
  }

  /**
   * 通过主键 ID 强制删除记录（忽略软删除，真正删除）
   * @param id 主键值
   * @returns 删除的记录数
   *
   * @example
   * await User.forceDeleteById(1);
   */
  static async forceDeleteById(
    id: number | string,
  ): Promise<number> {
    const result = await this.forceDelete(id);
    return typeof result === "number" ? result : result.count;
  }

  /**
   * 查找或创建记录（如果不存在则创建）
   * @param condition 查询条件（用于判断是否存在）
   * @param data 要创建的数据对象（如果不存在）
   * @param resurrect 是否恢复已软删除的记录（默认 false，统一接口：与 MongoModel 保持一致）
   * @returns 找到或创建的模型实例
   *
   * @example
   * const user = await User.findOrCreate(
   *   { email: 'user@example.com' },
   *   { name: 'John', email: 'user@example.com', age: 25 }
   * );
   */
  static async findOrCreate<T extends typeof SQLModel>(
    this: T,
    condition: WhereCondition,
    data: Record<string, any>,
    resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致
  ): Promise<InstanceType<T>> {
    await this.ensureAdapter();

    // 先尝试查找（包含软删除的记录）
    const existing = await this.withTrashed().find(condition);
    if (existing) {
      if (resurrect && this.softDelete) {
        const id = asModelId(getRecordValue(existing, this.primaryKey));
        if (id) {
          await this.restore(id);
          const latest = await this.find(id);
          if (latest) {
            return latest as InstanceType<T>;
          }
        }
      }
      return existing as InstanceType<T>;
    }

    // 如果不存在，创建新记录
    return await this.create(data);
  }

  /**
   * 查找并更新记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param data 要更新的数据对象
   * @param options 更新选项（可选，如 { returnDocument: 'after' }，统一接口：与 MongoModel 保持一致）
   * @returns 更新后的模型实例或 null
   *
   * @example
   * const user = await User.findOneAndUpdate(
   *   1,
   *   { name: 'lisi' },
   *   { returnDocument: 'after' }
   * );
   */
  static async findOneAndUpdate<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    data: Record<string, any>,
    options: { returnDocument?: "before" | "after" } = {
      returnDocument: "after",
    },
  ): Promise<InstanceType<T> | null> {
    await this.ensureAdapter();

    // 如果 returnDocument 是 'before'，先查找记录
    if (options.returnDocument === "before") {
      const existing = await this.find(condition);
      if (!existing) {
        return null;
      }
      // 执行更新
      const updated = await this.update(condition, data);
      if (updated > 0) {
        return existing as InstanceType<T>;
      }
      return null;
    }

    // 如果 returnDocument 是 'after'（默认），使用 update 的 returnLatest 选项
    const result = await this.update(condition, data, true);
    if (typeof result === "number") {
      // 如果返回的是数字，说明更新失败或没有找到记录
      return null;
    }
    return result as InstanceType<T>;
  }

  /**
   * 查找并删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的模型实例或 null
   *
   * @example
   * const user = await User.findOneAndDelete(1);
   * const user = await User.findOneAndDelete({ email: 'user@example.com' });
   */
  static async findOneAndDelete<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
  ): Promise<InstanceType<T> | null> {
    await this.ensureAdapter();

    // 先查找记录
    const existing = await this.find(condition);
    if (!existing) {
      return null;
    }

    // 执行删除
    const deleted = await this.delete(condition);
    return deleted > 0 ? existing as InstanceType<T> : null;
  }

  /**
   * 查找并替换记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param replacement 替换的数据对象
   * @param returnLatest 是否返回替换后的记录（默认 true，统一接口：与 MongoModel 保持一致）
   * @returns 替换后的模型实例或 null
   *
   * @example
   * const user = await User.findOneAndReplace(1, { name: 'John', age: 25 });
   */
  static async findOneAndReplace<T extends typeof SQLModel>(
    this: T,
    condition: FindCondition,
    replacement: Record<string, any>,
    returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
  ): Promise<InstanceType<T> | null> {
    await this.ensureAdapter();

    // 先查找记录
    const existing = await this.find(condition);
    if (!existing) {
      return null;
    }

    // 如果 returnLatest 为 false，先保存现有记录
    let beforeRecord: InstanceType<T> | null = null;
    if (!returnLatest) {
      beforeRecord = existing as InstanceType<T>;
    }

    // 执行更新（替换所有字段）
    if (returnLatest) {
      const updated = await this.update(condition, replacement, true);
      if (typeof updated === "number") {
        // 如果返回数字，说明更新失败或没有找到记录
        return null;
      }
      return updated as InstanceType<T>;
    } else {
      const updated = await this.update(condition, replacement, false);
      if (typeof updated === "number" && updated > 0) {
        // 更新成功，返回更新前的记录
        return beforeRecord;
      }
      return null;
    }
  }

  /**
   * 清空表（删除所有记录）
   * @returns 删除的记录数
   *
   * @example
   * await User.truncate();
   */
  static async truncate(): Promise<number> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const sqlAdapter = this.asSqlAdapter(this.adapter);
    const statements = sqlAdapter
      ? sqlAdapter.buildTruncateStatements(this.tableName)
      : [{ sql: `TRUNCATE TABLE ${this.quotedTable()}` }];

    // ensureAdapter() 已确保 adapter 不为 null
    const primary = statements[0];
    const result = await this.adapter.execute(
      primary.sql,
      primary.params ?? [],
    );

    for (const extra of statements.slice(1)) {
      try {
        await this.adapter.execute(extra.sql, extra.params ?? []);
      } catch {
        if (!extra.ignoreError) {
          throw new Error("truncate follow-up statement failed");
        }
      }
    }

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? readAffectedRows(result)
        : 0);

    return affectedRows;
  }

  /**
   * 对已查出的实例批量预加载关联，避免 N+1。
   * 每条关联定义对应一次 findAll。
   */
  static async preload<T extends typeof SQLModel>(
    this: T,
    instances: InstanceType<T>[] | InstanceType<T> | null,
    relations: PreloadRelations,
  ): Promise<InstanceType<T>[] | InstanceType<T> | null> {
    return await applyPreloads(
      instances,
      this.primaryKey,
      relations,
    );
  }

  /**
   * 关联查询：属于（多对一关系）
   * 例如：Post belongsTo User（一个帖子属于一个用户）
   * @param RelatedModel 关联的模型类
   * @param foreignKey 外键字段名（当前模型中的字段）
   * @param localKey 关联模型的主键字段名（默认为关联模型的 primaryKey）
   * @returns 关联的模型实例或 null
   *
   * @example
   * class Post extends SQLModel {
   *   static tableName = 'posts';
   *   async user() {
   *     return await this.belongsTo(User, 'user_id', 'id');
   *   }
   * }
   * const post = await Post.find(1);
   * const user = await post.user();
   */
  async belongsTo<T extends typeof SQLModel>(
    RelatedModel: T,
    foreignKey: string,
    localKey?: string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T> | null> {
    const Model = this.constructor as typeof SQLModel;
    await Model.ensureAdapter();
    return await belongsToRelated(
      this,
      RelatedModel,
      foreignKey,
      localKey,
      fields,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * 关联查询：有一个（一对一关系）
   * 例如：User hasOne Profile（一个用户有一个资料）
   * @param RelatedModel 关联的模型类
   * @param foreignKey 外键字段名（关联模型中的字段）
   * @param localKey 当前模型的主键字段名（默认为当前模型的 primaryKey）
   * @returns 关联的模型实例或 null
   *
   * @example
   * class User extends SQLModel {
   *   static tableName = 'users';
   *   async profile() {
   *     return await this.hasOne(Profile, 'user_id', 'id');
   *   }
   * }
   * const user = await User.find(1);
   * const profile = await user.profile();
   */
  async hasOne<T extends typeof SQLModel>(
    RelatedModel: T,
    foreignKey: string,
    localKey?: string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T> | null> {
    const Model = this.constructor as typeof SQLModel;
    await Model.ensureAdapter();
    return await hasOneRelated(
      this,
      Model.primaryKey,
      RelatedModel,
      foreignKey,
      localKey,
      fields,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * 关联查询：有多个（一对多关系）
   * 例如：User hasMany Posts（一个用户有多个帖子）
   * @param RelatedModel 关联的模型类
   * @param foreignKey 外键字段名（关联模型中的字段）
   * @param localKey 当前模型的主键字段名（默认为当前模型的 primaryKey）
   * @returns 关联的模型实例数组
   *
   * @example
   * class User extends SQLModel {
   *   static tableName = 'users';
   *   async posts() {
   *     return await this.hasMany(Post, 'user_id', 'id');
   *   }
   * }
   * const user = await User.find(1);
   * const posts = await user.posts();
   */
  async hasMany<T extends typeof SQLModel>(
    RelatedModel: T,
    foreignKey: string,
    localKey?: string,
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed: boolean = false, // 统一接口：与 MongoModel 保持一致
    onlyTrashed: boolean = false, // 统一接口：与 MongoModel 保持一致
  ): Promise<InstanceType<T>[]> {
    const Model = this.constructor as typeof SQLModel;
    await Model.ensureAdapter();
    return await hasManyRelated(
      this,
      Model.primaryKey,
      RelatedModel,
      foreignKey,
      localKey,
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * 关联查询：多对多。
   * 例如：User belongsToMany Role，中间表 UserRole（user_id / role_id）。
   */
  async belongsToMany<T extends typeof SQLModel, P extends typeof SQLModel>(
    RelatedModel: T,
    options: {
      pivot: P;
      foreignKey: string;
      otherKey: string;
      localKey?: string;
      relatedKey?: string;
      fields?: string[];
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
      includeTrashed?: boolean;
      onlyTrashed?: boolean;
    },
  ): Promise<InstanceType<T>[]> {
    const Model = this.constructor as typeof SQLModel;
    await Model.ensureAdapter();
    await (RelatedModel as typeof SQLModel).ensureAdapter();
    await (options.pivot as typeof SQLModel).ensureAdapter();
    return await belongsToManyRelated(
      this as unknown as Record<string, unknown>,
      Model.primaryKey,
      RelatedModel,
      options.pivot,
      options.foreignKey,
      options.otherKey,
      options.localKey,
      options.relatedKey,
      options.fields,
      {
        sort: options.sort,
        skip: options.skip,
        limit: options.limit,
      },
      options.includeTrashed ?? false,
      options.onlyTrashed ?? false,
    ) as InstanceType<T>[];
  }
}
