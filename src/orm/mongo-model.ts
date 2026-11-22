/**
 * MongoDB 模型基类
 * 提供 ODM 功能，支持对象条件查询和字段投影
 */

import { ObjectId } from "mongodb";
import type { MongoDBAdapter } from "../adapters/mongodb.ts";
import type { CacheAdapter } from "../cache/mod.ts";
import type { DatabaseAdapter } from "../types.ts";
import type { Locale } from "../i18n.ts";
import { $tr, setDatabaseLocale } from "../i18n.ts";
import type {
  CompoundIndex,
  GeospatialIndex,
  IndexDefinitions,
  IndexDirection,
  SingleFieldIndex,
  TextIndex,
} from "../types/indexes.ts";

import type {
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  PreloadRelations,
  ValidationHost,
} from "./shared/mod.ts";
import type { CacheQueryOptions } from "./shared/mod.ts";
import {
  applyCreateTimestamps,
  applyMongoSoftDeleteFilter,
  applyPreloads,
  applyUpdateTimestamp,
  applyVirtuals as applyVirtualsShared,
  asModelId,
  assertSafeMongoValue,
  assignData,
  assignHookChangesIfChanged,
  belongsToManyRelated,
  belongsToRelated,
  checkType as checkTypeShared,
  clearModelCache,
  generateModelCacheKey,
  getRecordValue,
  getSchemaKeys as getSchemaKeysShared,
  getVirtuals as getVirtualsShared,
  hasManyRelated,
  hasObjectChanged as hasObjectChangedShared,
  hasOneRelated,
  lazyThenable,
  mergePreloadFields,
  mergeUpdateHookFields,
  readInsertedIdAt,
  readInsertId,
  readNumericField,
  runHookAndMergeIfChanged,
  serializeCacheKeyParams as serializeCacheKeyParamsShared,
  serializePreloadSignature,
  setRecordValue,
  validateFieldAsync as validateFieldAsyncShared,
  validateMongoField,
  validateRecord,
} from "./shared/mod.ts";

/**
 * 查询条件类型
 * 支持对象形式的查询条件，包括 MongoDB 操作符
 */
export type MongoWhereCondition = {
  [key: string]: any | {
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $ne?: any;
    $in?: any[];
    $nin?: any[];
    $exists?: boolean;
    $regex?: string | RegExp;
    $options?: string;
  };
};

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
/* LifecycleHook 由 ./shared/mod.ts 再导出 */

/**
 * MongoDB 链式查询构建器类型
 * 使用递归类型定义，避免循环引用
 */
/**
 * MongoDB 数组查询构建器类型（返回纯 JSON 对象）
 */
export type MongoArrayQueryBuilder<T extends typeof MongoModel> = {
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => MongoArrayQueryBuilder<T>;
  skip: (n: number) => MongoArrayQueryBuilder<T>;
  limit: (n: number) => MongoArrayQueryBuilder<T>;
  fields: (fields: string[]) => MongoArrayQueryBuilder<T>;
  includeTrashed: () => MongoArrayQueryBuilder<T>;
  onlyTrashed: () => MongoArrayQueryBuilder<T>;
  with: (relations: PreloadRelations) => MongoArrayQueryBuilder<T>;
  preload: (relations: PreloadRelations) => MongoArrayQueryBuilder<T>;
  findAll: () => Promise<Record<string, any>[]>;
  findOne: () => Promise<Record<string, any> | null>;
  one: () => Promise<Record<string, any> | null>;
  all: () => Promise<Record<string, any>[]>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  distinct: (field: string) => Promise<any[]>;
  aggregate: (pipeline: any[]) => Promise<any[]>;
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

/**
 * 查找查询构建器类型（用于打破循环引用）
 */
export type MongoFindQueryBuilder<T extends typeof MongoModel> = {
  orWhere: (
    condition: MongoWhereCondition | string,
  ) => MongoFindQueryBuilder<T>;
  andWhere: (
    condition: MongoWhereCondition | string,
  ) => MongoFindQueryBuilder<T>;
  orLike: (condition: MongoWhereCondition) => MongoFindQueryBuilder<T>;
  andLike: (condition: MongoWhereCondition) => MongoFindQueryBuilder<T>;
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => MongoFindQueryBuilder<T>;
  skip: (n: number) => MongoFindQueryBuilder<T>;
  limit: (n: number) => MongoFindQueryBuilder<T>;
  fields: (fields: string[]) => MongoFindQueryBuilder<T>;
  includeTrashed: () => MongoFindQueryBuilder<T>;
  onlyTrashed: () => MongoFindQueryBuilder<T>;
  with: (relations: PreloadRelations) => MongoFindQueryBuilder<T>;
  preload: (relations: PreloadRelations) => MongoFindQueryBuilder<T>;
  findAll: () => Promise<InstanceType<T>[]>;
  findOne: () => Promise<InstanceType<T> | null>;
  one: () => Promise<InstanceType<T> | null>;
  all: () => Promise<InstanceType<T>[]>;
  asArray: () => MongoArrayQueryBuilder<T>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  distinct: (field: string) => Promise<any[]>;
  aggregate: (pipeline: any[]) => Promise<any[]>;
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

export type MongoQueryBuilder<T extends typeof MongoModel> = {
  where: (condition: MongoWhereCondition | string) => MongoQueryBuilder<T>;
  orWhere: (condition: MongoWhereCondition | string) => MongoQueryBuilder<T>;
  andWhere: (condition: MongoWhereCondition | string) => MongoQueryBuilder<T>;
  like: (condition: MongoWhereCondition) => MongoQueryBuilder<T>;
  orLike: (condition: MongoWhereCondition) => MongoQueryBuilder<T>;
  andLike: (condition: MongoWhereCondition) => MongoQueryBuilder<T>;
  fields: (fields: string[]) => MongoQueryBuilder<T>;
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => MongoQueryBuilder<T>;
  skip: (n: number) => MongoQueryBuilder<T>;
  limit: (n: number) => MongoQueryBuilder<T>;
  includeTrashed: () => MongoQueryBuilder<T>;
  onlyTrashed: () => MongoQueryBuilder<T>;
  with: (relations: PreloadRelations) => MongoQueryBuilder<T>;
  preload: (relations: PreloadRelations) => MongoQueryBuilder<T>;
  findAll: () => Promise<InstanceType<T>[]>;
  findOne: () => Promise<InstanceType<T> | null>;
  one: () => Promise<InstanceType<T> | null>;
  all: () => Promise<InstanceType<T>[]>;
  asArray: () => MongoArrayQueryBuilder<T>;
  findById: (id: string, fields?: string[]) => Promise<InstanceType<T> | null>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  update: (
    data: Record<string, any>,
    returnLatest?: boolean,
  ) => Promise<number | InstanceType<T>>;
  updateById: (id: string, data: Record<string, any>) => Promise<number>;
  updateMany: (data: Record<string, any>) => Promise<number>;
  deleteById: (id: string) => Promise<number>;
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
  deleteMany: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  restore: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  restoreById: (id: string) => Promise<number>;
  forceDelete: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  forceDeleteById: (id: string) => Promise<number>;
  distinct: (field: string) => Promise<any[]>;
  aggregate: (pipeline: any[]) => Promise<any[]>;
  findOneAndUpdate: (
    data: Record<string, any>,
    options?: { returnDocument?: "before" | "after" },
  ) => Promise<InstanceType<T> | null>;
  findOneAndDelete: () => Promise<InstanceType<T> | null>;
  findOneAndReplace: (
    replacement: Record<string, any>,
    returnLatest?: boolean,
  ) => Promise<InstanceType<T> | null>;
  upsert: (
    data: Record<string, any>,
    returnLatest?: boolean,
    resurrect?: boolean,
  ) => Promise<InstanceType<T>>;
  findOrCreate: (
    data: Record<string, any>,
    resurrect?: boolean,
  ) => Promise<InstanceType<T>>;
  incrementMany: (
    fieldOrMap: string | Record<string, number>,
    amount?: number,
  ) => Promise<number>;
  decrementMany: (
    fieldOrMap: string | Record<string, number>,
    amount?: number,
  ) => Promise<number>;
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
 * MongoDB 模型基类
 * 所有 MongoDB 模型都应该继承此类
 */
export abstract class MongoModel {
  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   * 设置后，验证错误等用户面向文案将使用该语言
   */
  static lang?: Locale;

  /**
   * 集合名称（子类必须定义）
   */
  static collectionName: string;

  /**
   * 主键字段名（默认为 '_id'）
   */
  static primaryKey: string = "_id";

  /**
   * 数据库适配器实例（子类需要设置，必须是 MongoDBAdapter）
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
        $tr("model.adapterNotInitialized", { table: this.collectionName }),
      );
    }
    return this._adapter;
  }

  static set adapter(value: DatabaseAdapter | null) {
    this._adapter = value;
  }

  /** 抽象基类不能直接 new，子类构造器用这一处收窄。 */
  private static createInstance<T extends typeof MongoModel>(
    this: T,
  ): InstanceType<T> {
    const Ctor = this as unknown as { new (): InstanceType<T> };
    return new Ctor();
  }

  /** 已初始化后的适配器即 Mongo 适配器（公开 API 都经 Model 走此类）。 */
  private static mongoAdapter(): MongoDBAdapter {
    return this.adapter as MongoDBAdapter;
  }

  /**
   * 获取当前连接配置的展示时区（来自 mongoOptions.timezone）
   * 用于 processFields 中将 date 字段格式化为该时区的本地时间字符串；未配置或适配器未就绪时返回 undefined
   * @returns IANA 时区名（如 "Asia/Shanghai"、PRC）或 undefined
   */
  private static getTimezoneOption(): string | undefined {
    const a = this._adapter;
    if (!a) return undefined;
    return (a as { getTimezone?: () => string }).getTimezone?.();
  }

  /**
   * 处理单条查询结果（类型转换 + 若配置了 timezone 则将 date 格式化为该时区字符串）
   * 仅用于从 adapter.query / findOneAndUpdate 等得到的文档构建实例时调用，不应用默认值
   */
  private static processQueryResultRow(
    row: Record<string, any>,
  ): Record<string, any> {
    return this.processFields(row, {
      formatDateToTimezone: true,
      applyDefaults: false,
    });
  }

  /**
   * 获取 Schema 键（带缓存）
   * 性能优化：缓存 schema 键，避免重复调用 Object.keys()
   * @returns Schema 字段名数组
   */

  private static validationHost(): ValidationHost {
    return this.makeValidationHost(this);
  }

  private static makeValidationHost(model: typeof MongoModel): ValidationHost {
    return {
      dialect: "mongo",
      model,
      get storeName() {
        return model.collectionName;
      },
      setStoreName: (name: string) => {
        model.collectionName = name;
      },
      get primaryKey() {
        return model.primaryKey;
      },
      existsNullKey: "_id",
      missingStoreMessageKey: "model.collectionNameRequired",
      defaultPrimaryKey: "_id",
      ensureAdapter: () => model.ensureAdapter(),
      queryExists: (where: Record<string, any>) =>
        model.query().where(where).exists(),
      queryFindOne: (where: Record<string, any>, fields: string[]) =>
        model.query().where(where).fields(fields).findOne(),
      getSchema: () => model.schema,
      getSchemaKeys: () => model.getSchemaKeys(),
    };
  }

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
   * 字段定义（可选，用于定义字段类型、默认值和验证规则）
   *
   * @example
   * static schema: ModelSchema = {
   *   name: {
   *     type: 'string',
   *     validate: { required: true, min: 2, max: 50 }
   *   },
   *   email: {
   *     type: 'string',
   *     validate: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
   *   },
   *   age: {
   *     type: 'number',
   *     validate: { min: 0, max: 150 }
   *   }
   * };
   */
  static schema?: ModelSchema;

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
   *
   * // 文本索引
   * static indexes = [
   *   { fields: { title: 10, content: 5 }, type: 'text' }
   * ];
   *
   * // 地理空间索引
   * static indexes = [
   *   { field: 'location', type: '2dsphere' }
   * ];
   */
  static indexes?: IndexDefinitions;

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
   *   published: () => ({ published: true, deletedAt: { $exists: false } }),
   *   recent: () => ({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
   * };
   *
   * // 使用
   * const activeUsers = await User.scope('active').findAll();
   */
  static scopes?: Record<string, () => MongoWhereCondition>;

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
    condition: MongoWhereCondition | string,
    fields?: string[],
    options?: CacheQueryOptions,
    includeTrashed?: boolean,
    onlyTrashed?: boolean,
  ): string {
    return generateModelCacheKey(
      this,
      this.collectionName,
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
    condition: MongoWhereCondition | string,
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
    await clearModelCache(this.cacheAdapter, this.collectionName);
  }

  /**
   * 设置数据库适配器
   * @param adapter 数据库适配器实例（必须是 MongoDBAdapter）
   */
  static setAdapter(adapter: DatabaseAdapter): void {
    this._adapter = adapter;
  }

  /**
   * 初始化模型
   * 设置数据库适配器并创建索引（如果定义了索引）
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
   *   type: 'mongodb',
   *   connection: { host: 'localhost', port: 27017, database: 'mydb' }
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
      // 创建索引（如果定义了索引）
      if (this.indexes && this.indexes.length > 0) {
        await this.createIndexes();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize model ${this.collectionName}: ${message}. Please ensure the database connection is initialized first using initDatabase() or initDatabaseFromConfig().`,
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
   * 验证字段值
   * @param fieldName 字段名
   * @param value 字段值
   * @param fieldDef 字段定义
   * @param allValues 所有字段的值（用于跨字段验证）
   * @throws ValidationError 验证失败时抛出
   */
  private static validateField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition,
    allValues: Record<string, any> = {},
  ): void {
    validateMongoField(fieldName, value, fieldDef, allValues);
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
   * 检查值是否符合指定类型
   */
  private static checkType(value: any, type: FieldType): boolean {
    return checkTypeShared(value, type);
  }

  /**
   * 处理字段值（应用默认值、类型转换、getter/setter，以及可选的查询结果时区格式化）
   *
   * @param data 原始数据
   * @param options
   * - `applyDefaults`：**插入（create/createMany）应为 `true`（可省略，默认即 true）**，未传字段填 schema default；
   *   **更新（update）必须为 `false`**，否则局部 patch 会把未传字段写成 default 覆盖库里已有值。
   * - `formatDateToTimezone`：为 true 时将 date 按 mongoOptions.timezone 格式化（用于查询结果等）。
   * @returns 处理后的数据
   */
  private static processFields(
    data: Record<string, any>,
    options?: {
      formatDateToTimezone?: boolean;
      applyDefaults?: boolean;
    },
  ): Record<string, any> {
    const schema = this.schema;
    if (!schema) {
      return data;
    }

    const applyDefaults = options?.applyDefaults !== false;
    const formatDateToTimezone = options?.formatDateToTimezone === true;

    const processed: Record<string, any> = {};

    // 处理已定义的字段（使用缓存的键，减少 Object.entries() 开销）
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const fieldDef = schema[fieldName];
      let value = data[fieldName];

      // 应用默认值（写入路径使用；查询结果路径可关闭）
      if (
        applyDefaults &&
        (value === null || value === undefined) &&
        fieldDef.default !== undefined
      ) {
        value = typeof fieldDef.default === "function"
          ? fieldDef.default()
          : fieldDef.default;
      }

      // 应用 setter
      if (value !== undefined && fieldDef.set) {
        value = fieldDef.set(value);
      }

      // 类型转换（枚举类型不需要转换）
      if (value !== undefined && fieldDef.type && fieldDef.type !== "enum") {
        value = this.convertType(value, fieldDef.type);
      }

      // 仅当「来自查询结果」且配置了 mongoOptions.timezone 时，将 date 格式化为该时区的本地时间字符串
      if (
        formatDateToTimezone &&
        fieldDef.type === "date" &&
        value instanceof Date
      ) {
        const tz = this.getTimezoneOption();
        if (tz) {
          value = value.toLocaleString(undefined, {
            timeZone: tz,
            hour12: false,
          });
        }
      }

      // 注意：验证已移到 create 和 update 方法中，因为需要异步验证（数据库查询）
      // 这里只进行字段处理，不进行验证

      processed[fieldName] = value;
    }

    // 保留未定义的字段（如果存在）
    for (const [key, value] of Object.entries(data)) {
      if (!(key in processed)) {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * 类型转换
   */
  private static convertType(value: any, type: FieldType): any {
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
          return value === "true" || value === "1";
        }
        return Boolean(value);
      }
      case "date": {
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      }
      case "array": {
        return Array.isArray(value) ? value : [value];
      }
      case "object": {
        if (typeof value === "object" && !Array.isArray(value)) return value;
        try {
          return typeof value === "string" ? JSON.parse(value) : value;
        } catch {
          return value;
        }
      }
      case "json": {
        if (typeof value === "object" && value !== null) return value;
        try {
          return typeof value === "string" ? JSON.parse(value) : value;
        } catch {
          return value;
        }
      }
      case "enum": {
        // 枚举类型不需要转换，直接返回
        return value;
      }
      case "uuid": {
        // UUID 保持字符串格式
        return String(value);
      }
      case "text": {
        return String(value);
      }
      case "bigint": {
        if (typeof value === "bigint") return value;
        if (typeof value === "number" && Number.isInteger(value)) {
          return BigInt(value);
        }
        if (typeof value === "string") {
          const num = parseInt(value, 10);
          return !isNaN(num) ? BigInt(num) : value;
        }
        return value;
      }
      case "decimal": {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      case "timestamp": {
        if (typeof value === "number") return value;
        if (value instanceof Date) return value.getTime();
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.getTime();
      }
      case "binary": {
        if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
          return value;
        }
        if (typeof value === "string") {
          // 尝试将字符串转换为 Uint8Array
          try {
            return new TextEncoder().encode(value);
          } catch {
            return value;
          }
        }
        return value;
      }
      default: {
        return value;
      }
    }
  }

  /**
   * 验证数据
   * @param data 要验证的数据
   * @param instanceId 实例 ID（用于唯一性验证时排除当前记录）
   * @param groups 验证组（可选，只验证指定组的字段）
   * @param onlyValidateProvidedFields 是否只验证 data 中提供的字段（用于更新操作）
   * @param providedFields 提供的字段集合（当 onlyValidateProvidedFields 为 true 时使用）
   * @throws ValidationError 验证失败时抛出
   */
  static async validate(
    data: Record<string, any>,
    instanceId?: any,
    groups?: string[],
    onlyValidateProvidedFields?: boolean,
    providedFields?: Set<string>,
  ): Promise<void> {
    await validateRecord(
      this.validationHost(),
      data,
      instanceId,
      groups,
      onlyValidateProvidedFields,
      providedFields,
    );
  }

  /**
   * 构建字段投影对象（用于 MongoDB 的字段选择）
   * @param fields 要查询的字段数组
   * @returns MongoDB 投影对象
   */
  /**
   * 将字符串 ID 转换为 ObjectId（如果是有效的 ObjectId 格式）
   * 注意：MongoDB 总是使用 _id 字段作为主键（ObjectId 类型），无论 primaryKey 是什么
   * @param id 字符串 ID 或 ObjectId 对象
   * @returns ObjectId 对象
   * @throws {Error} 如果 id 不是有效的 ObjectId 格式
   */
  private static normalizeId(id: string | any): any {
    // 如果已经是 ObjectId 对象，直接返回
    if (id instanceof ObjectId) {
      return id;
    }

    // 如果是字符串，检查是否为有效的 ObjectId 格式
    if (typeof id === "string") {
      if (ObjectId.isValid(id)) {
        return new ObjectId(id);
      }
      // 如果不是有效的 ObjectId 格式，抛出异常
      // 因为 MongoDB 的 _id 字段必须是 ObjectId 类型，无效的 ID 会导致查询失败
      throw new Error(
        `Invalid ObjectId format: "${id}". MongoDB _id field requires a valid ObjectId.`,
      );
    }

    // 其他类型（如数字等）直接返回，让 MongoDB 处理
    return id;
  }

  /**
   * 规范化查询条件，将条件对象中的主键字段（如果是字符串）转换为 ObjectId
   * 注意：MongoDB 总是使用 _id 字段作为主键（ObjectId 类型），即使自定义了 primaryKey
   * 如果 primaryKey !== "_id"，需要将查询条件中的 primaryKey 映射到 _id 字段
   * @param condition 查询条件对象
   * @returns 规范化后的查询条件
   */
  /** 把 SQL 风格的 % / _ 通配符转成正则。 */
  private static sqlLikeToRegex(pattern: string): string {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.replace(/%/g, ".*").replace(/_/g, ".");
  }

  /**
   * 将条件里的 `$like` 转成 Mongo 的 `$regex`（大小写不敏感）。
   * 共享测试与 SQL 模型都使用 `{ field: { $like: "%x%" } }`。
   */
  private static convertLikeOperators(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.convertLikeOperators(item));
    }
    if (
      value == null ||
      typeof value !== "object" ||
      value instanceof Date ||
      value instanceof ObjectId
    ) {
      return value;
    }
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(rec)) {
      if (
        child &&
        typeof child === "object" &&
        !Array.isArray(child) &&
        !(child instanceof Date) &&
        !(child instanceof ObjectId) &&
        "$like" in (child as object)
      ) {
        const op = { ...(child as Record<string, unknown>) };
        const likeVal = op.$like;
        delete op.$like;
        if (typeof likeVal === "string") {
          out[key] = {
            ...op,
            $regex: this.sqlLikeToRegex(likeVal),
            $options: op.$options ?? "i",
          };
        } else {
          out[key] = child;
        }
      } else {
        out[key] = this.convertLikeOperators(child);
      }
    }
    return out;
  }

  private static normalizeCondition(condition: MongoWhereCondition): any {
    if (
      !condition || typeof condition !== "object" || Array.isArray(condition)
    ) {
      return condition;
    }

    assertSafeMongoValue(condition);

    const withLike = this.convertLikeOperators(
      condition,
    ) as MongoWhereCondition;
    const normalized: any = { ...withLike };

    const normalizeIdFilterValue = (idValue: unknown): unknown => {
      if (typeof idValue === "string") {
        return this.normalizeId(idValue);
      }
      if (
        idValue &&
        typeof idValue === "object" &&
        !Array.isArray(idValue) &&
        !(idValue instanceof ObjectId) &&
        !(idValue instanceof Date)
      ) {
        const rec = { ...(idValue as Record<string, unknown>) };
        for (const op of ["$in", "$nin", "$eq", "$ne"]) {
          if (!(op in rec)) continue;
          const v = rec[op];
          if (Array.isArray(v)) {
            rec[op] = v.map((item) =>
              typeof item === "string" && ObjectId.isValid(item)
                ? new ObjectId(item)
                : item
            );
          } else if (typeof v === "string" && ObjectId.isValid(v)) {
            rec[op] = new ObjectId(v);
          }
        }
        return rec;
      }
      return idValue;
    };

    // 如果条件中包含主键字段
    if (normalized[this.primaryKey] !== undefined) {
      const converted = normalizeIdFilterValue(normalized[this.primaryKey]);
      if (
        this.primaryKey !== "_id" && converted !== normalized[this.primaryKey]
      ) {
        delete normalized[this.primaryKey];
        normalized._id = converted;
      } else {
        normalized[this.primaryKey] = converted;
      }
    }

    // 如果条件中直接包含 _id 字段（即使 primaryKey 不是 "_id"）
    if (normalized._id !== undefined) {
      normalized._id = normalizeIdFilterValue(normalized._id);
    }

    // 递归处理嵌套对象（如 $in, $nin, $or, $and 等操作符）
    for (const [key, value] of Object.entries(normalized)) {
      // 跳过已经处理过的主键字段
      if (key === this.primaryKey || key === "_id") {
        continue;
      }

      // 处理 $or 和 $and 操作符，递归规范化每个条件
      if ((key === "$or" || key === "$and") && Array.isArray(value)) {
        normalized[key] = value.map((item: any) => {
          if (
            typeof item === "object" && item !== null && !Array.isArray(item)
          ) {
            return this.normalizeCondition(item);
          }
          return item;
        });
      } // 处理 $in 和 $nin 操作符中的数组
      else if ((key === "$in" || key === "$nin") && Array.isArray(value)) {
        normalized[key] = value.map((item: any) => {
          // 如果数组项是字符串且是有效的 ObjectId 格式，转换为 ObjectId
          // 注意：这里只处理主键相关的查询，所以需要检查是否是主键字段的 $in/$nin
          if (typeof item === "string" && ObjectId.isValid(item)) {
            return new ObjectId(item);
          }
          return item;
        });
      }
    }

    return normalized;
  }

  private static buildProjection(fields?: string[]): any {
    if (!fields || fields.length === 0) {
      return {};
    }

    const projection: any = {};
    for (const field of fields) {
      projection[field] = 1;
    }
    return projection;
  }

  /**
   * 应用软删除过滤（内部辅助）
   * @param filter 原始查询条件
   * @param includeTrashed 是否包含软删除
   * @param onlyTrashed 是否仅软删除
   */
  private static applySoftDeleteFilter(
    filter: MongoWhereCondition | string,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Record<string, any> {
    const normalized: Record<string, any> = typeof filter === "string"
      ? { _id: this.normalizeId(filter) }
      : this.normalizeCondition(filter);
    return applyMongoSoftDeleteFilter(
      normalized,
      this.deletedAtField,
      this.softDelete,
      includeTrashed,
      onlyTrashed,
    );
  }

  /**
   * MongoDB Node 驱动 4+ 起 `findOneAndUpdate` / 部分 modify 类 API 返回 `{ value: Document | null }`，
   * 旧逻辑若把返回值整体当文档，会误判「未匹配」或把 `{ value, ok }` 错赋给模型实例。
   *
   * @param raw 驱动原始返回值。
   * @returns 文档对象；未匹配或 `value` 为 null 时返回 null。
   */
  private static unwrapModifyResult(raw: unknown): unknown {
    if (raw == null) {
      return null;
    }
    if (typeof raw === "object" && raw !== null && "value" in raw) {
      return (raw as { value: unknown }).value ?? null;
    }
    return raw;
  }

  /**
   * 规范化排序参数（支持字符串 asc/desc）
   */
  private static normalizeSort(
    sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ): Record<string, 1 | -1> | undefined {
    if (!sort) return undefined;
    if (typeof sort === "string") {
      const dir = sort.toLowerCase() === "desc" ? -1 : 1;
      return { [this.primaryKey]: dir };
    }
    const normalized: Record<string, 1 | -1> = {};
    for (const [field, dir] of Object.entries(sort)) {
      if (typeof dir === "string") {
        normalized[field] = dir.toLowerCase() === "desc" ? -1 : 1;
      } else {
        normalized[field] = dir;
      }
    }
    return normalized;
  }

  /**
   * 创建数组查询构建器（返回纯 JSON 对象）
   * 私有辅助方法，用于消除代码重复
   * @param getState 获取查询状态的函数（通过闭包访问局部变量）
   * @returns 数组查询构建器
   */
  private static createArrayQueryBuilder<T extends typeof MongoModel>(
    this: T,
    getState: () => {
      _conditions?: Array<{
        type: "where" | "or" | "and";
        condition: MongoWhereCondition | string;
      }>;
      _condition?: MongoWhereCondition | string; // 向后兼容 find() 方法
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
    },
  ): MongoArrayQueryBuilder<T> {
    /**
     * 构建最终的查询条件（与 query() 方法中的逻辑一致）
     */
    const buildFinalCondition = (): MongoWhereCondition | string => {
      const state = getState();
      // 如果使用新的 _conditions 结构
      if (state._conditions && state._conditions.length > 0) {
        // 如果只有一个 where 条件，直接返回
        if (
          state._conditions.length === 1 &&
          state._conditions[0].type === "where"
        ) {
          const condition = state._conditions[0].condition;
          // 如果是字符串，需要转换为对象
          if (typeof condition === "string") {
            return { [this.primaryKey]: condition };
          }
          return condition;
        }

        // 检查是否有 OR 条件
        const hasOrCondition = state._conditions.some((item) =>
          item.type === "or"
        );

        if (hasOrCondition) {
          // 如果有 OR 条件，将所有条件组合成 $or 数组
          const orGroups: any[] = [];
          let currentGroup: any[] = [];

          for (const item of state._conditions!) {
            const normalized = typeof item.condition === "string"
              ? { [this.primaryKey]: item.condition }
              : item.condition;

            if (item.type === "where") {
              // where 开始新的组
              if (currentGroup.length > 0) {
                // 将当前组作为一个 OR 分支
                if (currentGroup.length === 1) {
                  orGroups.push(currentGroup[0]);
                } else {
                  orGroups.push({ $and: currentGroup });
                }
                currentGroup = [];
              }
              currentGroup.push(normalized);
            } else if (item.type === "and") {
              // andWhere 添加到当前组
              currentGroup.push(normalized);
            } else if (item.type === "or") {
              // orWhere 将当前组作为一个 OR 分支，然后开始新组
              if (currentGroup.length > 0) {
                if (currentGroup.length === 1) {
                  orGroups.push(currentGroup[0]);
                } else {
                  orGroups.push({ $and: currentGroup });
                }
                currentGroup = [];
              }
              // orWhere 的条件作为新的 OR 分支
              orGroups.push(normalized);
            }
          }

          // 处理剩余的组
          if (currentGroup.length > 0) {
            if (currentGroup.length === 1) {
              orGroups.push(currentGroup[0]);
            } else {
              orGroups.push({ $and: currentGroup });
            }
          }

          // 返回 $or 查询
          if (orGroups.length === 1) {
            return orGroups[0];
          }
          return { $or: orGroups };
        } else {
          // 只有 AND 条件，组合成 $and 或直接合并
          const andConditions: any[] = [];

          for (const item of state._conditions!) {
            const normalized = typeof item.condition === "string"
              ? { [this.primaryKey]: item.condition }
              : item.condition;
            andConditions.push(normalized);
          }

          if (andConditions.length === 1) {
            return andConditions[0];
          }

          // 合并所有 AND 条件
          const result: any = {};
          for (const condition of andConditions) {
            assignData(result, condition);
          }

          // 如果有冲突的键，需要使用 $and
          if (
            Object.keys(result).length <
              andConditions.reduce((sum, c) => sum + Object.keys(c).length, 0)
          ) {
            return { $and: andConditions };
          }

          return result;
        }
      }
      // 向后兼容：使用旧的 _condition
      if (state._condition) {
        if (typeof state._condition === "string") {
          return { [this.primaryKey]: state._condition };
        }
        return state._condition;
      }
      return {};
    };
    const arrayBuilder: MongoArrayQueryBuilder<T> = {
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
      findAll: async (): Promise<Record<string, any>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const state = getState();
        const projection = this.buildProjection(
          mergePreloadFields(state._fields, this.primaryKey, state._with),
        );
        const queryOptions: any = {};
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(state._sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }
        if (typeof state._skip === "number") {
          queryOptions.skip = state._skip;
        }
        if (typeof state._limit === "number") {
          queryOptions.limit = state._limit;
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          filter._id = this.normalizeId(finalCondition);
        } else if (finalCondition instanceof ObjectId) {
          filter._id = finalCondition;
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );

        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );

        // 返回纯 JSON 对象数组，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        const rows = results.map((row) => assignData({}, row));
        await applyPreloads(rows, this.primaryKey, getState()._with);
        return rows;
      },
      findOne: async (): Promise<Record<string, any> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const state = getState();
        const projection = this.buildProjection(
          mergePreloadFields(state._fields, this.primaryKey, state._with),
        );
        const queryOptions: any = { limit: 1 };
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(state._sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }
        if (typeof state._skip === "number") {
          queryOptions.skip = state._skip;
        }
        if (typeof state._limit === "number") {
          queryOptions.limit = state._limit;
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          filter._id = this.normalizeId(finalCondition);
        } else if (finalCondition instanceof ObjectId) {
          filter._id = finalCondition;
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );

        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );
        if (results.length === 0) {
          return null;
        }
        // 返回纯 JSON 对象，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        const row = assignData({}, results[0]);
        await applyPreloads(row, this.primaryKey, getState()._with);
        return row;
      },
      one: async (): Promise<Record<string, any> | null> => {
        return await arrayBuilder.findOne();
      },
      all: async (): Promise<Record<string, any>[]> => {
        return await arrayBuilder.findAll();
      },
      count: async (): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const state = getState();
        const db = this.mongoAdapter().getDatabase();
        if (!db) {
          throw new Error(
            $tr("model.databaseNotConnected"),
          );
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          // 字符串 ID 需要转换为 ObjectId
          if (finalCondition) {
            filter._id = this.normalizeId(finalCondition);
          } else {
            filter = {};
          }
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const count = await db.collection(this.collectionName)
          .countDocuments(
            queryFilter,
          );
        return count;
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
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      aggregate: async (pipeline: any[]): Promise<any[]> => {
        const state = getState();
        const finalCondition = buildFinalCondition();
        let match: any = {};
        if (typeof finalCondition === "string") {
          match[this.primaryKey] = finalCondition;
        } else if (
          finalCondition && Object.keys(finalCondition).length > 0
        ) {
          match = this.normalizeCondition(finalCondition);
        }
        const effective = Object.keys(match).length > 0
          ? [{ $match: match }, ...pipeline]
          : pipeline;
        return await this.aggregate(
          effective,
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
   * const user = await User.find('507f1f77bcf86cd799439011');
   * const user = await User.find({ email: 'user@example.com' });
   *
   * // 链式调用查找单条记录
   * const user = await User.find({ status: 'active' }).sort({ createdAt: -1 });
   *
   * // 链式调用查找多条记录
   * const users = await User.find({ status: 'active' }).sort({ createdAt: -1 }).findAll();
   * const users = await User.find({ status: 'active' }).sort({ sort: -1 }).limit(10).findAll();
   */
  static find<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    },
  ): MongoFindQueryBuilder<T> {
    // 创建共享状态对象，确保 asArray() 中的修改能够持久化
    // 支持新的 _conditions 数组（用于链式查询条件）和旧的 _condition（向后兼容）
    const state = {
      _conditions: [
        {
          type: "where" as const,
          condition: condition as MongoWhereCondition | string,
        },
      ] as Array<
        {
          type: "where" | "or" | "and";
          condition: MongoWhereCondition | string;
        }
      >,
      _condition: condition as MongoWhereCondition | string, // 向后兼容
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
    };

    /**
     * 构建最终查询条件
     * 如果使用新的 _conditions 结构，返回组合对象；否则返回单个条件（向后兼容）
     */
    const buildFinalCondition = (): MongoWhereCondition | string => {
      // 如果使用新的 _conditions 结构
      if (state._conditions && state._conditions.length > 0) {
        // 如果只有一个 where 条件，直接返回
        if (
          state._conditions.length === 1 &&
          state._conditions[0].type === "where"
        ) {
          const condition = state._conditions[0].condition;
          // 如果是字符串，需要转换为对象
          if (typeof condition === "string") {
            return { [this.primaryKey]: condition };
          }
          return condition;
        }

        // 检查是否有 OR 条件
        const hasOrCondition = state._conditions.some((item) =>
          item.type === "or"
        );

        if (hasOrCondition) {
          // 如果有 OR 条件，将所有条件组合成 $or 数组
          const orGroups: any[] = [];
          let currentGroup: any[] = [];

          for (const item of state._conditions) {
            const normalized = typeof item.condition === "string"
              ? { [this.primaryKey]: item.condition }
              : item.condition;

            if (item.type === "where") {
              // where 开始新的组
              if (currentGroup.length > 0) {
                // 将当前组作为一个 OR 分支
                if (currentGroup.length === 1) {
                  orGroups.push(currentGroup[0]);
                } else {
                  orGroups.push({ $and: currentGroup });
                }
                currentGroup = [];
              }
              currentGroup.push(normalized);
            } else if (item.type === "and") {
              // andWhere 添加到当前组
              currentGroup.push(normalized);
            } else if (item.type === "or") {
              // orWhere 结束当前组，开始新的 OR 分支
              if (currentGroup.length > 0) {
                if (currentGroup.length === 1) {
                  orGroups.push(currentGroup[0]);
                } else {
                  orGroups.push({ $and: currentGroup });
                }
                currentGroup = [];
              }
              orGroups.push(normalized);
            }
          }

          // 处理剩余的组
          if (currentGroup.length > 0) {
            if (currentGroup.length === 1) {
              orGroups.push(currentGroup[0]);
            } else {
              orGroups.push({ $and: currentGroup });
            }
          }

          return { $or: orGroups };
        } else {
          // 只有 AND 条件，合并所有条件
          const andConditions: any[] = [];
          for (const item of state._conditions) {
            const normalized = typeof item.condition === "string"
              ? { [this.primaryKey]: item.condition }
              : item.condition;
            andConditions.push(normalized);
          }

          if (andConditions.length === 1) {
            return andConditions[0];
          } else {
            return { $and: andConditions };
          }
        }
      }
      // 向后兼容：使用旧的 _condition
      if (typeof state._condition === "string") {
        return { [this.primaryKey]: state._condition };
      }
      return state._condition || {};
    };

    /**
     * 将条件对象中的字符串值转换为 MongoDB $regex 查询条件
     * 支持嵌套对象和 JSON 对象查询
     * @param condition 查询条件对象
     * @returns 转换后的查询条件对象
     */
    const convertToLikeCondition = (
      condition: MongoWhereCondition,
    ): MongoWhereCondition => {
      if (
        !condition || typeof condition !== "object" || Array.isArray(condition)
      ) {
        return condition;
      }

      const result: MongoWhereCondition = {};

      for (const [key, value] of Object.entries(condition)) {
        if (value === null || value === undefined) {
          result[key] = value;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          // 检查是否是操作符对象（如 { $gt: 10 }, { $regex: ... }）
          const opValue = value as {
            $gt?: any;
            $lt?: any;
            $gte?: any;
            $lte?: any;
            $ne?: any;
            $in?: any[];
            $regex?: string | RegExp;
            $options?: string;
            [key: string]: any;
          };

          // 如果已经包含 $regex 操作符，保留原样
          if (opValue.$regex !== undefined) {
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
            result[key] = convertToLikeCondition(value as MongoWhereCondition);
          }
        } else if (typeof value === "string") {
          // 字符串值转换为 $regex 查询（大小写不敏感）
          result[key] = {
            $regex: value,
            $options: "i",
          };
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    // 执行查询单条记录的函数
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      // 自动初始化（懒加载）
      await this.ensureAdapter();

      const finalCondition = buildFinalCondition();

      // 生成缓存键
      const cacheKey = this.generateCacheKey(
        finalCondition,
        mergePreloadFields(state._fields, this.primaryKey, state._with),
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
          // 如果缓存值是空对象 {}，不应该返回，应该查询数据库
          // 因为空对象可能是之前缓存的数据，但数据已经被删除或软删除
          if (
            cachedValue === null ||
            (typeof cachedValue === "object" &&
              Object.keys(cachedValue).length === 0)
          ) {
            // 空对象或 null，不返回，继续查询数据库
          } else {
            const instance = this.createInstance();
            assignData(instance, cachedValue);

            // 应用虚拟字段
            // 应用虚拟字段（使用缓存的虚拟字段定义）
            this.applyVirtuals(instance);
            await applyPreloads(instance, this.primaryKey, state._with);
            return instance as InstanceType<T>;
          }
        }
      }

      let filter: any = {};

      // 使用 buildFinalCondition 的结果
      if (typeof finalCondition === "string") {
        // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
        // 所以查询时应该使用 _id 字段
        filter._id = this.normalizeId(finalCondition);
      } else if (finalCondition instanceof ObjectId) {
        // 如果传入的是 ObjectId 对象，直接使用
        filter._id = finalCondition;
      } else {
        // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
        // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
        filter = this.normalizeCondition(finalCondition);
      }

      const projection = this.buildProjection(
        mergePreloadFields(state._fields, this.primaryKey, state._with),
      );
      const queryOptions: any = { limit: 1 };
      if (Object.keys(projection).length > 0) {
        queryOptions.projection = projection;
      }
      const normalizedSort = this.normalizeSort(state._sort);
      if (normalizedSort) {
        queryOptions.sort = normalizedSort;
      }
      if (typeof state._skip === "number") {
        queryOptions.skip = state._skip;
      }
      if (typeof state._limit === "number") {
        queryOptions.limit = state._limit;
      }

      // 软删除：自动过滤已删除的记录（默认排除软删除）
      const queryFilter = this.applySoftDeleteFilter(
        filter,
        state._includeTrashed,
        state._onlyTrashed,
      );

      const results = await this.adapter.query(
        this.collectionName,
        queryFilter,
        queryOptions,
      );

      if (results.length === 0) {
        return null;
      }

      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(results[0]));

      // 应用虚拟字段
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 将结果存入缓存
      if (cacheKey && this.cacheAdapter) {
        const tag = `model:${this.collectionName}`;
        const setResult = this.cacheAdapter.set(
          cacheKey,
          results[0],
          this.cacheTTL,
          [tag],
        );
        if (setResult instanceof Promise) {
          await setResult;
        }
      }

      await applyPreloads(instance, this.primaryKey, state._with);
      return instance as InstanceType<T>;
    };

    // 执行查询多条的函数
    const executeFindAll = async (): Promise<InstanceType<T>[]> => {
      // 自动初始化（懒加载）
      await this.ensureAdapter();

      const finalCondition = buildFinalCondition();

      const projection = this.buildProjection(
        mergePreloadFields(state._fields, this.primaryKey, state._with),
      );
      const queryOptions: any = {};
      if (Object.keys(projection).length > 0) {
        queryOptions.projection = projection;
      }
      const normalizedSort = this.normalizeSort(state._sort);
      if (normalizedSort) {
        queryOptions.sort = normalizedSort;
      }
      if (typeof state._skip === "number") {
        queryOptions.skip = state._skip;
      }
      if (typeof state._limit === "number") {
        queryOptions.limit = state._limit;
      }

      let filter: any = {};
      if (typeof finalCondition === "string") {
        // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
        filter._id = this.normalizeId(finalCondition);
      } else {
        // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
        // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
        filter = this.normalizeCondition(finalCondition);
      }
      const queryFilter = this.applySoftDeleteFilter(
        filter,
        state._includeTrashed,
        state._onlyTrashed,
      );

      const results = await this.adapter.query(
        this.collectionName,
        queryFilter,
        queryOptions,
      );

      const instances = results.map((row: any) => {
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(row));
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      });
      await applyPreloads(instances, this.primaryKey, state._with);
      return instances;
    };

    // 仅在 then/catch/finally（如直接 await 构建器）时才执行 findOne
    const queryPromise = lazyThenable(() => executeFindOne());

    // 构建查询构建器对象
    const builder: MongoFindQueryBuilder<T> = {
      /**
       * 添加 OR 查询条件
       * @param condition 查询条件
       * @returns 查询构建器
       */
      orWhere: (condition: MongoWhereCondition | string) => {
        state._conditions.push({ type: "or", condition });
        return builder;
      },
      /**
       * 添加 AND 查询条件
       * @param condition 查询条件
       * @returns 查询构建器
       */
      andWhere: (condition: MongoWhereCondition | string) => {
        state._conditions.push({ type: "and", condition });
        return builder;
      },
      /**
       * 添加 OR LIKE 查询条件
       * @param condition 查询条件对象
       * @returns 查询构建器
       */
      orLike: (condition: MongoWhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "or", condition: likeCondition });
        return builder;
      },
      /**
       * 添加 AND LIKE 查询条件
       * @param condition 查询条件对象
       * @returns 查询构建器
       */
      andLike: (condition: MongoWhereCondition) => {
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
       * const user = await User.find('123').asArray().findOne(); // 返回纯 JSON 对象或 null
       */
      asArray: (): MongoArrayQueryBuilder<T> => {
        // 返回共享状态对象的引用，确保 asArray() 中的修改与预加载规格能够持久化
        return this.createArrayQueryBuilder(() => state);
      },
      count: async (): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = this.mongoAdapter().getDatabase();
        if (!db) {
          throw new Error(
            $tr("model.databaseNotConnected"),
          );
        }

        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          filter[this.primaryKey] = finalCondition;
        } else {
          filter = finalCondition;
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const count = await db.collection(this.collectionName).countDocuments(
          queryFilter,
        );
        return count;
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
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      aggregate: async (pipeline: any[]): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        let match: any = {};
        if (typeof finalCondition === "string") {
          match[this.primaryKey] = finalCondition;
        } else if (
          finalCondition && typeof finalCondition === "object" &&
          Object.keys(finalCondition).length > 0
        ) {
          match = finalCondition;
        }
        const effective = Object.keys(match).length > 0
          ? [{ $match: match }, ...pipeline]
          : pipeline;
        return await this.aggregate(
          effective,
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
          mergePreloadFields(state._fields, this.primaryKey, state._with),
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
   * @param fields 要查询的字段数组（可选，用于字段投影）
   * @returns 模型实例数组
   *
   * @example
   * const users = await User.findAll();
   * const users = await User.findAll({ age: 25 });
   * const users = await User.findAll({ age: { $gt: 18 } });
   * const users = await User.findAll({}, ['_id', 'name', 'email']);
   */
  static async findAll<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string = {},
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T>[]> {
    // 自动初始化（懒加载）
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
          assignData(instance, this.processQueryResultRow(row));

          // 应用虚拟字段
          // 应用虚拟字段（使用缓存的虚拟字段定义）
          this.applyVirtuals(instance);

          return instance as InstanceType<T>;
        });
      }
    }

    const projection = this.buildProjection(fields);
    const queryOptions: any = {};
    if (Object.keys(projection).length > 0) {
      queryOptions.projection = projection;
    }
    const normalizedSort = this.normalizeSort(options?.sort);
    if (normalizedSort) {
      queryOptions.sort = normalizedSort;
    }
    if (typeof options?.skip === "number") {
      queryOptions.skip = options.skip;
    }
    if (typeof options?.limit === "number") {
      queryOptions.limit = options.limit;
    }

    /** 与链式 `executeFindAll` 一致：对象条件需 `normalizeCondition`，否则 `{ _id: 字符串 }` 无法匹配库内 ObjectId。 */
    let filter: Record<string, any> = {};
    if (typeof condition === "string") {
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      filter._id = condition;
    } else {
      filter = this.normalizeCondition(condition);
    }

    const queryFilter = this.applySoftDeleteFilter(
      filter,
      includeTrashed,
      onlyTrashed,
    );

    const results = await this.adapter.query(
      this.collectionName,
      queryFilter,
      queryOptions,
    );

    const instances = results.map((row: any) => {
      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(row));

      // 应用虚拟字段
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      return instance as InstanceType<T>;
    });

    // 将结果存入缓存
    if (cacheKey && this.cacheAdapter) {
      const setResult = this.cacheAdapter.set(
        cacheKey,
        results,
        this.cacheTTL,
        [`model:${this.collectionName}`],
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
    findAll: <T extends typeof MongoModel>(
      condition?: MongoWhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
      includeTrashed?: boolean,
      onlyTrashed?: boolean,
    ) => Promise<InstanceType<T>[]>;
    find: <T extends typeof MongoModel>(
      condition?: MongoWhereCondition | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: MongoWhereCondition) => Promise<number>;
  } {
    if (!this.scopes || !this.scopes[scopeName]) {
      throw new Error(
        $tr("model.scopeNotDefined", { scope: scopeName }),
      );
    }

    // 在闭包中捕获 this（MongoModel 类），这样返回的方法可以直接调用，不需要 .call()
    // 使用类型断言避免 linter 警告
    const Model = this as typeof MongoModel;
    const scopeCondition = this.scopes[scopeName]();

    return {
      findAll: async <T extends typeof MongoModel>(
        condition: MongoWhereCondition = {},
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
      find: async <T extends typeof MongoModel>(
        condition: MongoWhereCondition | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        if (typeof condition === "string") {
          return await Model.find(condition, fields) as InstanceType<T> | null;
        }
        return await Model.find({ ...scopeCondition, ...condition }, fields) as
          | InstanceType<T>
          | null;
      },
      count: async (condition: MongoWhereCondition = {}): Promise<number> => {
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
  static async create<T extends typeof MongoModel>(
    this: T,
    data: Record<string, any>,
  ): Promise<InstanceType<T>> {
    // 插入路径：允许未传字段套用 schema default（update 使用 applyDefaults: false）
    const processedData = this.processFields(data, { applyDefaults: true });

    // 自动时间戳
    if (this.timestamps) {
      applyCreateTimestamps(processedData, this.timestamps);
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
    await this.validate(processedData);

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

    // 如果提供了 _id 字段且是字符串，需要转换为 ObjectId
    // MongoDB 的 _id 字段必须是 ObjectId 类型
    if (
      processedData._id !== undefined && typeof processedData._id === "string"
    ) {
      processedData._id = this.normalizeId(processedData._id);
    }

    // 自动初始化（懒加载）- 在需要使用 adapter 时才初始化
    await this.ensureAdapter();
    const result = await this.adapter.execute(
      "insert",
      this.collectionName,
      processedData,
    );

    // MongoDB insert 返回结果包含 insertedId
    let insertedId: any = null;
    if (result && typeof result === "object") {
      if ("insertedId" in result) {
        insertedId = readInsertId(result);
      } else if ("_id" in processedData) {
        insertedId = processedData._id;
      }
    }

    const instance = this.createInstance();
    assignData(instance, processedData);
    if (insertedId != null) {
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
   * @param returnLatest 返回最新记录（true）或选项对象（性能优化：skipPreQuery 可跳过预查询）
   * @param fields 返回的字段（当 returnLatest 为 true 时）
   * @returns 更新的记录数或更新后的记录
   *
   * @example
   * await User.update('507f1f77bcf86cd799439011', { name: 'lisi' });
   * await User.update({ _id: '507f1f77bcf86cd799439011' }, { name: 'lisi' });
   * await User.update({ email: 'user@example.com' }, { name: 'lisi' });
   * // 性能优化：跳过预查询（仅当没有钩子和验证时使用，需要类型断言）
   * await User.update(1, { name: 'lisi' }, { skipPreQuery: true });
   */
  static async update<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
  ): Promise<number>;
  static async update<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    returnLatest: true,
  ): Promise<InstanceType<T>>;
  static async update<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    returnLatest: boolean,
    options?: {
      skipPreQuery?: boolean; // 统一接口：与 SQLModel 保持一致
      enableHooks?: boolean;
      enableValidation?: boolean;
      useUpdateMany?: boolean;
    },
  ): Promise<number | InstanceType<T>>;
  static async update<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    returnLatest: boolean = false,
    options?: {
      skipPreQuery?: boolean; // 统一接口：与 SQLModel 保持一致
      enableHooks?: boolean;
      enableValidation?: boolean;
      useUpdateMany?: boolean;
    },
  ): Promise<number | InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 解析参数（保持向后兼容）
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
    const useUpdateMany = options?.useUpdateMany === true;
    const hasHooks = !!(
      this.beforeValidate ||
      this.afterValidate ||
      this.beforeUpdate ||
      this.beforeSave ||
      this.afterUpdate ||
      this.afterSave
    );
    // 检查是否可以跳过预查询（性能优化）
    const skipPreQuery = options?.skipPreQuery === true;
    // 只有在启用钩子或验证时才需要预查询
    const needsPreQuery = (enableHooks && hasHooks) || enableValidation;

    // 先查找要更新的记录（如果不需要钩子且不需要验证，可以跳过）
    let existingInstance: InstanceType<typeof MongoModel> | null = null;
    if (!skipPreQuery && (needsPreQuery || returnLatest)) {
      // 需要预查询：有钩子、需要验证、需要返回最新记录
      if (typeof condition === "string") {
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
      const filter = typeof condition === "string"
        ? { _id: this.normalizeId(condition) }
        : this.normalizeCondition(condition);
      const appliedFilter = this.applySoftDeleteFilter(filter);
      const db = this.mongoAdapter().getDatabase();
      if (!db) {
        throw new Error(
          $tr("model.databaseNotConnected"),
        );
      }
      const checkResult = await db.collection(this.collectionName)
        .countDocuments(
          appliedFilter,
          { limit: 1 },
        );
      if (checkResult === 0) {
        return 0;
      }
    }

    /**
     * 仅 update 路径：`applyDefaults: false`，与 create 的 `applyDefaults: true` 区分。
     */
    const processedData = this.processFields(data, { applyDefaults: false });
    /** 仅保留调用方传入的键：`processFields` 会为全部 schema 字段占位，`Object.assign` 会用 undefined 覆盖已有实例。 */
    const providedKeys = new Set(Object.keys(data));
    for (const key of Object.keys(processedData)) {
      if (!providedKeys.has(key)) {
        delete processedData[key];
      }
    }

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
        const primaryKey = this.primaryKey || "_id";
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

      // 验证数据（如果启用）
      // 传递当前记录的 ID，用于唯一性验证时排除当前记录
      if (enableValidation) {
        const primaryKey = this.primaryKey || "_id";
        const instanceId = existingInstance
          ? getRecordValue(existingInstance, primaryKey)
          : undefined;
        // 如果跳过预查询，instanceId 为 undefined，唯一性验证可能不准确
        // 因此建议在跳过预查询时确保没有唯一性验证
        // 在更新操作中，只验证被更新的字段（原始 data 中的字段）
        // 对于不在原始 data 中的字段，使用现有值（从 existingInstance 获取）
        // 构建完整的验证数据：合并 existingInstance 和 processedData
        const validationData: Record<string, any> = {};
        if (existingInstance) {
          // 先复制现有实例的所有字段（包括所有属性，不仅仅是数据库字段）
          for (const key in existingInstance) {
            validationData[key] = getRecordValue(existingInstance, key);
          }
        }
        // 然后用 processedData 覆盖（只覆盖被更新的字段）
        assignData(validationData, processedData);
        // 只验证原始 data 中提供的字段（更新操作）
        // 注意：使用原始 data 的键来判断哪些字段需要验证
        // 因为 processFields 会将所有 schema 字段添加到 processedData 中（即使值为 undefined）
        const originalDataKeys = new Set(Object.keys(data));
        await this.validate(
          validationData,
          instanceId,
          undefined,
          true,
          originalDataKeys,
        );
      }

      // afterValidate 钩子
      if (enableHooks && this.afterValidate) {
        const primaryKey = this.primaryKey || "_id";
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
        const primaryKey = this.primaryKey || "_id";
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
        const primaryKey = this.primaryKey || "_id";
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

    let filter: any = {};

    // 如果是字符串，作为主键查询
    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      // 如果传入的是 ObjectId 对象，直接使用
      filter._id = condition;
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    // 应用软删除过滤（如果启用）
    filter = this.applySoftDeleteFilter(filter);

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }
    if (returnLatest) {
      const opts: any = { returnDocument: "after" };
      // 排除 _id 字段和主键字段，MongoDB 不允许更新 _id
      // 注意：MongoDB 内部使用 _id 作为主键，但用户可能定义 primaryKey 为其他字段名
      // 同时排除 undefined 值，避免将未提供的字段设置为 undefined
      const updateData: Record<string, any> = {};
      const primaryKeyField = this.primaryKey || "_id";
      for (const key in processedData) {
        // 排除 MongoDB 系统字段 _id 和用户定义的主键字段
        // 同时排除 undefined 值（这些是 processFields 添加的未提供字段）
        if (
          key !== "_id" &&
          key !== primaryKeyField &&
          processedData[key] !== undefined
        ) {
          updateData[key] = processedData[key];
        }
      }
      const raw = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        { $set: updateData },
        opts,
      );
      const result = this.unwrapModifyResult(raw);
      if (result == null || typeof result !== "object") {
        return 0;
      }
      const updatedInstance = this.createInstance();
      assignData(updatedInstance, result);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(updatedInstance);
      if (this.afterUpdate) {
        await this.afterUpdate(updatedInstance);
      }
      if (this.afterSave) {
        await this.afterSave(updatedInstance);
      }

      // 清除相关缓存
      await this.clearCache();

      return updatedInstance as InstanceType<T>;
    } else {
      // 排除 _id 字段和主键字段，MongoDB 不允许更新 _id
      // 注意：MongoDB 内部使用 _id 作为主键，但用户可能定义 primaryKey 为其他字段名
      // 同时排除 undefined 值，避免将未提供的字段设置为 undefined
      const updateData: Record<string, any> = {};
      const primaryKeyField = this.primaryKey || "_id";
      for (const key in processedData) {
        // 排除 MongoDB 系统字段 _id 和用户定义的主键字段
        // 同时排除 undefined 值（这些是 processFields 添加的未提供字段）
        if (
          key !== "_id" &&
          key !== primaryKeyField &&
          processedData[key] !== undefined
        ) {
          updateData[key] = processedData[key];
        }
      }
      // 根据 useUpdateMany 选项决定使用 updateOne 还是 updateMany
      const result = useUpdateMany
        ? await db.collection(this.collectionName).updateMany(
          filter,
          { $set: updateData },
        )
        : await db.collection(this.collectionName).updateOne(
          filter,
          { $set: updateData },
        );
      const modifiedCount = result.modifiedCount || 0;

      // 清除相关缓存（更新后需要清除缓存，确保后续查询获取最新数据）
      // 注意：只有实际修改了数据（modifiedCount > 0）才需要清除缓存
      // 如果 modifiedCount = 0，说明数据没有变化，缓存中的数据是正确的，不需要清除
      if (modifiedCount > 0) {
        await this.clearCache();

        // 重新查询数据库获取最新数据，确保 afterUpdate 钩子接收到的是实际保存的数据
        if (!existingInstance) {
          // 如果跳过预查询，需要从条件中获取主键值
          const primaryKey = this.primaryKey || "_id";
          let primaryKeyValue: any;
          if (typeof condition === "string") {
            primaryKeyValue = condition;
          } else if (condition instanceof ObjectId) {
            primaryKeyValue = condition;
          } else if (condition && typeof condition === "object") {
            primaryKeyValue = getRecordValue(condition as object, primaryKey) ||
              getRecordValue(condition as object, "_id");
          }
          if (!primaryKeyValue) {
            // 如果无法获取主键值（例如 updateMany 使用复杂条件），跳过 afterUpdate 和 afterSave 钩子
            // 这是正常的，因为 updateMany 不返回实例
            return modifiedCount;
          }
          // 查询最新数据（缓存已清除，会从数据库查询）
          const latest = await this.find(primaryKeyValue);
          const updatedInstance = latest || this.createInstance();
          if (!latest) {
            // 如果查询失败，使用更新后的数据
            assignData(updatedInstance, updateData);
          }
          if (enableHooks) {
            if (this.afterUpdate) {
              await this.afterUpdate(updatedInstance);
            }
            if (this.afterSave) {
              await this.afterSave(updatedInstance);
            }
          }
        } else {
          const primaryKeyValue = existingInstance[this.primaryKey || "_id"];
          // 查询最新数据（缓存已清除，会从数据库查询）
          const latest = await this.find(primaryKeyValue);
          const updatedInstance = latest || this.createInstance();
          if (!latest) {
            // 如果查询失败，使用合并后的数据
            assignData(updatedInstance, {
              ...existingInstance,
              ...updateData,
            });
          }
          if (enableHooks) {
            if (this.afterUpdate) {
              await this.afterUpdate(updatedInstance);
            }
            if (this.afterSave) {
              await this.afterSave(updatedInstance);
            }
          }
        }

        // 在钩子执行后再次清除缓存（因为 find() 会重新缓存数据，需要清除以确保后续查询获取最新数据）
        await this.clearCache();
      }
      return modifiedCount;
    }
  }

  /**
   * 删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.delete('507f1f77bcf86cd799439011');
   * await User.delete({ _id: '507f1f77bcf86cd799439011' });
   * await User.delete({ email: 'user@example.com' });
   */
  static async delete(
    condition: MongoWhereCondition | string,
  ): Promise<number> {
    // 自动初始化（通过 ensureAdapter）
    await this.ensureAdapter();

    // 先查找要删除的记录（用于 beforeDelete 钩子）
    // 注意：使用 withTrashed() 来查找，因为要删除的记录可能已经被软删除过了
    let instanceToDelete: InstanceType<typeof MongoModel> | null = null;
    // 支持字符串ID、ObjectId对象或条件对象
    if (typeof condition === "string" || condition instanceof ObjectId) {
      // 将 ObjectId 转换为字符串以便查找
      const idStr = condition instanceof ObjectId
        ? condition.toString()
        : condition;
      const withTrashedBuilder = this.withTrashed();
      instanceToDelete = await withTrashedBuilder.find(idStr);
    } else {
      const results = await this.withTrashed().findAll(condition);
      instanceToDelete = results[0] || null;
    }

    if (!instanceToDelete) {
      return 0;
    }

    // beforeDelete 钩子
    if (this.beforeDelete) {
      await this.beforeDelete(instanceToDelete);
    }

    let filter: any = {};

    // 如果是字符串，作为主键查询
    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      // 如果传入的是 ObjectId 对象，直接使用
      filter._id = condition;
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    // 软删除：设置 deletedAt 字段（排除已删除的记录，避免重复删除）
    if (this.softDelete) {
      // 排除已软删除的记录，避免重复删除
      filter = {
        ...filter,
        $or: [
          { [this.deletedAtField]: { $exists: false } },
          { [this.deletedAtField]: null },
        ],
      };
      const result = await this.adapter.execute(
        "update",
        this.collectionName,
        {
          filter,
          update: { $set: { [this.deletedAtField]: new Date() } },
        },
      );

      // 获取修改数量
      const modifiedCount =
        (result && typeof result === "object" && "modifiedCount" in result)
          ? readNumericField(result, "modifiedCount")
          : 0;

      // 执行 afterDelete 钩子（如果找到了要删除的记录）
      // 注意：即使 modifiedCount = 0（记录已经被软删除过了），也应该执行钩子
      // 因为钩子是用来处理删除操作的，不管最终是否实际修改了数据
      if (instanceToDelete && this.afterDelete) {
        await this.afterDelete(instanceToDelete);
      }

      // 清除相关缓存（软删除后需要清除缓存）
      // 注意：对于软删除，即使 modifiedCount = 0（记录已经被软删除过了），也应该清除缓存
      // 因为软删除改变了数据的状态（从存在变为软删除），查询结果会改变（find() 会返回 null）
      // 如果 instanceToDelete 存在，说明找到了要删除的记录，应该清除缓存
      if (modifiedCount > 0 || instanceToDelete) {
        await this.clearCache();
      }
      return modifiedCount;
    }

    // 硬删除：真正删除记录
    const result = await this.adapter.execute(
      "delete",
      this.collectionName,
      {
        filter,
      },
    );

    // MongoDB delete 返回结果包含 deletedCount
    const deletedCount =
      (result && typeof result === "object" && "deletedCount" in result)
        ? readNumericField(result, "deletedCount")
        : 0;

    if (deletedCount > 0) {
      if (this.afterDelete) {
        await this.afterDelete(instanceToDelete);
      }

      // 清除相关缓存
      await this.clearCache();
    }

    return deletedCount;
  }

  /**
   * 保存当前实例（插入或更新）
   * @returns 保存后的实例
   */
  async save<T extends MongoModel>(this: T): Promise<T> {
    const Model = this.constructor as typeof MongoModel;
    // 自动初始化（懒加载）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "_id";
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
      // 检查更新是否成功（受影响的行数 > 0）
      // 确保 id 是字符串格式
      const affectedRows = await Model.update(String(id), data);
      if (affectedRows === 0) {
        throw new Error(
          $tr(
            "log.model.updateNotFound",
            {
              id: String(id),
            },
          ),
        );
      }
      // 重新查询更新后的数据，确保获取最新状态
      // 确保 id 是字符串格式
      const updated = await Model.find(String(id));
      if (!updated) {
        throw new Error(
          $tr(
            "log.model.updateNotFoundAfter",
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
   * const user = await User.find('507f1f77bcf86cd799439011');
   * await user.update({ age: 26 });
   */
  async update<T extends MongoModel>(
    this: T,
    data: Record<string, any>,
  ): Promise<T> {
    const Model = this.constructor as typeof MongoModel;
    // 自动初始化（懒加载）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "_id";
    const id = asModelId(getRecordValue(this, primaryKey));

    if (!id) {
      throw new Error(
        $tr("model.cannotUpdateWithoutPrimaryKey"),
      );
    }

    // 使用 returnLatest: true 获取更新后的实例
    // 确保 id 是字符串格式
    const updated = await Model.update(
      String(id),
      data,
      true,
    );
    if (!updated) {
      // 如果返回 null 或 0，表示更新失败
      throw new Error(
        $tr(
          "log.model.updateNotFound",
          {
            id: String(id),
          },
        ),
      );
    }
    // 更新成功，同步实例数据
    assignData(this, updated);
    return this;
  }

  /**
   * 删除当前实例
   * @returns 是否删除成功
   */
  async delete<T extends MongoModel>(this: T): Promise<boolean> {
    const Model = this.constructor as typeof MongoModel;
    // 自动初始化（懒加载）
    await Model.ensureAdapter();

    const primaryKey = Model.primaryKey || "_id";
    const id = asModelId(getRecordValue(this, primaryKey));

    if (!id) {
      throw new Error(
        $tr("model.cannotDeleteWithoutPrimaryKey"),
      );
    }

    const deleted = await Model.delete(
      typeof id === "number" ? String(id) : id,
    );
    return deleted > 0;
  }

  /**
   * 查找单条记录（find 的别名，更符合常见习惯）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fields 要查询的字段数组（可选，用于字段投影）
   * @returns 模型实例或 null
   *
   * @example
   * const user = await User.findOne('507f1f77bcf86cd799439011');
   * const user = await User.findOne({ email: 'user@example.com' });
   */
  static async findOne<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    fields?: string[],
  ): Promise<InstanceType<T> | null> {
    return await this.find(condition, fields);
  }

  /**
   * 通过主键 ID 查找记录
   * @param id 主键值
   * @param fields 要查询的字段数组（可选，用于字段投影）
   * @returns 模型实例或 null
   *
   * @example
   * const user = await User.findById('507f1f77bcf86cd799439011');
   * const user = await User.findById('507f1f77bcf86cd799439011', ['_id', 'name', 'email']);
   */
  static async findById<T extends typeof MongoModel>(
    this: T,
    id: string,
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
   * await User.updateById('507f1f77bcf86cd799439011', { name: 'lisi' });
   */
  static async updateById(
    id: string,
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
   * await User.deleteById('507f1f77bcf86cd799439011');
   */
  static async deleteById(
    id: string,
  ): Promise<number> {
    return await this.delete(id);
  }

  static async restoreById(id: string): Promise<number> {
    return await this.restore(id) as number;
  }

  static async forceDeleteById(id: string): Promise<number> {
    return await this.forceDelete(id) as number;
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
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    options?: { enableHooks?: boolean; enableValidation?: boolean },
  ): Promise<number> {
    // updateMany 和 update 在 MongoDB 中逻辑相同，都是 updateMany/updateOne ... WHERE
    // 默认不启用钩子和验证，以提升批量操作性能
    // 注意：必须明确传递 false，因为 update() 方法默认启用钩子和验证
    const enableHooksValue = options?.enableHooks === true ? true : false;
    const enableValidationValue = options?.enableValidation === true
      ? true
      : false;
    const result = await this.update(condition, data, false, {
      enableHooks: enableHooksValue,
      enableValidation: enableValidationValue,
      useUpdateMany: true,
    });
    return typeof result === "number" ? result : 0;
  }

  /**
   * 批量自增字段
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 字段名或字段-增量映射
   * @param amount 增量（当提供单个字段名时生效）
   */
  static async incrementMany(
    condition: MongoWhereCondition | string,
    fieldOrMap: string | Record<string, number>,
    amount: number = 1,
  ): Promise<number> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }
    let filter: any = {};
    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }
    // incrementMany 不应该应用软删除过滤器，因为可能需要更新已软删除的记录
    // filter = this.applySoftDeleteFilter(filter);
    const incSpec: Record<string, number> = typeof fieldOrMap === "string"
      ? { [fieldOrMap]: amount }
      : fieldOrMap;
    const update: any = { $inc: incSpec };
    if (this.timestamps) {
      const updatedAtField = typeof this.timestamps === "object"
        ? (this.timestamps.updatedAt || "updatedAt")
        : "updatedAt";
      update.$set = { [updatedAtField]: new Date() };
    }
    const result = await db.collection(this.collectionName).updateMany(
      filter,
      update,
    );
    const modifiedCount = result.modifiedCount || 0;

    // 清除相关缓存（批量自增后需要清除缓存）
    // 注意：只有实际修改了数据（modifiedCount > 0）才需要清除缓存
    if (modifiedCount > 0) {
      await this.clearCache();
    }

    return modifiedCount;
  }

  /**
   * 批量自减字段
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 字段名或字段-减量映射
   * @param amount 减量（当提供单个字段名时生效）
   */
  static async decrementMany(
    condition: MongoWhereCondition | string,
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
   * 批量删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.deleteMany({ status: 'deleted' });
   * await User.deleteMany({ age: { $lt: 18 } });
   */
  static async deleteMany(
    condition: MongoWhereCondition | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    // 如果是字符串，作为主键查询
    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    // 软删除：批量设置 deletedAt 字段；否则执行物理删除
    if (this.softDelete) {
      const db = this.mongoAdapter().getDatabase();
      if (!db) {
        throw new Error(
          $tr("model.databaseNotConnected"),
        );
      }
      // 排除已软删除的记录，避免重复删除
      filter = {
        ...filter,
        $or: [
          { [this.deletedAtField]: { $exists: false } },
          { [this.deletedAtField]: null },
        ],
      };
      let ids: any[] = [];
      if (options?.returnIds) {
        ids = await db.collection(this.collectionName)
          .find(filter, { projection: { [this.primaryKey]: 1 } })
          .map((doc: any) => doc[this.primaryKey])
          .toArray();
      }
      const result = await db.collection(this.collectionName).updateMany(
        filter,
        { $set: { [this.deletedAtField]: new Date() } },
      );
      const modifiedCount = result.modifiedCount || 0;

      // 清除相关缓存（批量软删除后需要清除缓存）
      // 注意：只有实际修改了数据（modifiedCount > 0）才需要清除缓存
      if (modifiedCount > 0) {
        await this.clearCache();
      }

      if (options?.returnIds) {
        return { count: modifiedCount, ids };
      }
      return modifiedCount;
    }

    let preIds: any[] = [];
    if (options?.returnIds) {
      const db = this.mongoAdapter().getDatabase();
      if (!db) {
        throw new Error(
          $tr("model.databaseNotConnected"),
        );
      }
      preIds = await db.collection(this.collectionName)
        .find(filter, { projection: { [this.primaryKey]: 1 } })
        .map((doc: any) => doc[this.primaryKey])
        .toArray();
    }
    const result = await this.adapter.execute(
      "deleteMany",
      this.collectionName,
      { filter },
    );

    // MongoDB deleteMany 返回结果包含 deletedCount
    const deletedCount =
      (result && typeof result === "object" && "deletedCount" in result)
        ? readNumericField(result, "deletedCount")
        : 0;

    // 清除相关缓存（批量删除后需要清除缓存）
    if (deletedCount > 0) {
      await this.clearCache();
    }

    if (options?.returnIds) {
      return { count: deletedCount, ids: preIds };
    }
    return deletedCount;
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
    condition: MongoWhereCondition | string = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<number> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();

    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const queryFilter = this.applySoftDeleteFilter(
        condition,
        includeTrashed,
        onlyTrashed,
      );
      const count = await db.collection(this.collectionName).countDocuments(
        queryFilter,
      );
      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoCountError", { message }),
      );
    }
  }

  /**
   * 检查记录是否存在
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 是否存在
   *
   * @example
   * const exists = await User.exists('507f1f77bcf86cd799439011');
   * const exists = await User.exists({ email: 'user@example.com' });
   */
  static async exists(
    condition: MongoWhereCondition | string,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<boolean> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    // 如果是字符串，作为主键查询
    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    filter = this.applySoftDeleteFilter(filter, includeTrashed, onlyTrashed);

    const db = this.mongoAdapter().getDatabase();

    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const count = await db.collection(this.collectionName).countDocuments(
        filter,
        { limit: 1 },
      );
      return count > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoExistsError", { message }),
      );
    }
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
  static async createMany<T extends typeof MongoModel>(
    this: T,
    dataArray: Record<string, any>[],
    options?: { enableHooks?: boolean; enableValidation?: boolean },
  ): Promise<InstanceType<T>[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();

    const enableHooks = options?.enableHooks === true;
    const enableValidation = options?.enableValidation === true;

    // 处理每个数据项（应用默认值、类型转换、验证、时间戳与钩子）
    const processedArray: Record<string, any>[] = [];
    for (const data of dataArray) {
      const item = this.processFields(data, { applyDefaults: true });
      if (this.timestamps) {
        applyCreateTimestamps(item, this.timestamps);
      }

      // 钩子和验证处理（如果启用）
      if (enableHooks || enableValidation) {
        const tempInstance = this.createInstance();
        assignData(tempInstance, item);

        // beforeValidate 钩子
        if (enableHooks && this.beforeValidate) {
          // 性能优化：检测钩子是否修改了数据，只在有变化时合并
          await assignHookChangesIfChanged(
            this.beforeValidate,
            tempInstance,
            item,
          );
        }

        // 验证数据（如果启用）
        if (enableValidation) {
          await this.validate.call(this, item);
        }

        // afterValidate 钩子
        if (enableHooks && this.afterValidate) {
          // 性能优化：检测钩子是否修改了数据，只在有变化时合并
          await assignHookChangesIfChanged(
            this.afterValidate,
            tempInstance,
            item,
          );
        }

        // 钩子处理（如果启用）
        if (enableHooks) {
          if (this.beforeCreate) {
            await assignHookChangesIfChanged(
              this.beforeCreate,
              tempInstance,
              item,
            );
          }
          if (this.beforeSave) {
            await assignHookChangesIfChanged(
              this.beforeSave,
              tempInstance,
              item,
            );
          }
        }
      }

      // 如果提供了 _id 字段且是字符串，需要转换为 ObjectId
      // MongoDB 的 _id 字段必须是 ObjectId 类型
      if (item._id !== undefined && typeof item._id === "string") {
        item._id = this.normalizeId(item._id);
      }
      processedArray.push(item);
    }

    // 执行批量插入
    const result = await this.adapter.execute(
      "insertMany",
      this.collectionName,
      processedArray,
    );

    // 构造实例并应用 insertedIds
    const instances: InstanceType<T>[] = [];
    for (let i = 0; i < processedArray.length; i++) {
      const instance = this.createInstance();
      const item = { ...processedArray[i] };
      const insertedId = readInsertedIdAt(result, i);
      if (insertedId != null) {
        setRecordValue(item, this.primaryKey, insertedId);
      }
      assignData(instance, item);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);
      // 执行 afterCreate 和 afterSave 钩子（如果启用）
      if (enableHooks) {
        if (this.afterCreate) {
          await this.afterCreate(instance);
        }
        if (this.afterSave) {
          await this.afterSave(instance);
        }
      }
      instances.push(instance as InstanceType<T>);
    }

    // 清除相关缓存（批量创建后需要清除缓存）
    await this.clearCache();

    return instances;
  }

  /**
   * 分页查询
   * @param condition 查询条件（可选）
   * @param page 页码（从 1 开始）
   * @param pageSize 每页数量
   * @param sort 排序规则（可选，默认为按 createdAt 降序）
   * @param fields 要查询的字段数组（可选，用于字段投影）
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
  static async paginate<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string = {},
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
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();

    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    // 确保页码和每页数量有效
    page = Math.max(1, Math.floor(page));
    pageSize = Math.max(1, Math.floor(pageSize));

    // 如果没有提供排序，使用主键降序
    if (!sort) {
      sort = { [this.primaryKey]: -1 };
    }

    // 计算跳过数量
    const skip = (page - 1) * pageSize;

    // 统计总数
    const total = await this.count(condition, includeTrashed, onlyTrashed);

    // 构建查询选项
    const projection = this.buildProjection(fields);
    const options: any = {
      skip,
      limit: pageSize,
    };
    if (Object.keys(projection).length > 0) {
      options.projection = projection;
    }

    // 应用排序
    const normalizedSort = this.normalizeSort(sort);
    if (normalizedSort) {
      options.sort = normalizedSort;
    }

    // 查询数据
    const queryFilter = this.applySoftDeleteFilter(
      condition,
      includeTrashed,
      onlyTrashed,
    );
    const results = await this.adapter.query(
      this.collectionName,
      queryFilter,
      options,
    );

    const data = results.map((row: any) => {
      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(row));
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
   * await User.increment('507f1f77bcf86cd799439011', 'views', 1);
   * await User.increment({ status: 'active' }, 'score', 10);
   * // 对象格式（批量自增）
   * await User.increment('507f1f77bcf86cd799439011', { views: 1, likes: 2 });
   * await User.increment({ status: 'active' }, { score: 10, level: 1 }, true);
   */
  static async increment<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    fieldOrMap: string | Record<string, number>,
    amountOrReturnLatest?: number | boolean,
    returnLatest?: boolean,
  ): Promise<number | InstanceType<T>> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      // 如果传入的是 ObjectId 对象，直接使用
      filter._id = condition;
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    filter = this.applySoftDeleteFilter(filter);

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    // 处理参数：支持两种调用方式
    // 1. increment(condition, field, amount, returnLatest)
    // 2. increment(condition, fields, returnLatest)
    let incUpdate: Record<string, number>;
    let shouldReturnLatest: boolean = false;

    if (typeof fieldOrMap === "string") {
      // 单个字段格式：increment(condition, field, amount?, returnLatest?)
      const amount = typeof amountOrReturnLatest === "number"
        ? amountOrReturnLatest
        : 1;
      shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      incUpdate = { [fieldOrMap]: amount };
    } else {
      // 对象格式：increment(condition, fields, returnLatest?)
      shouldReturnLatest = typeof amountOrReturnLatest === "boolean"
        ? amountOrReturnLatest
        : (returnLatest === true);
      incUpdate = fieldOrMap;
    }

    try {
      if (shouldReturnLatest) {
        const opts: any = { returnDocument: "after" };
        const raw = await db.collection(this.collectionName)
          .findOneAndUpdate(
            filter,
            { $inc: incUpdate },
            opts,
          );
        const result = this.unwrapModifyResult(raw);
        if (result == null || typeof result !== "object") {
          return 0;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(result));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);

        // 清除相关缓存（自增后需要清除缓存）
        await this.clearCache();

        return instance as InstanceType<T>;
      } else {
        const result = await db.collection(this.collectionName).updateOne(
          filter,
          { $inc: incUpdate },
        );
        const modifiedCount = result.modifiedCount || 0;

        // 清除相关缓存（自增后需要清除缓存）
        // 注意：只有实际修改了数据（modifiedCount > 0）才需要清除缓存
        if (modifiedCount > 0) {
          await this.clearCache();
        }

        return modifiedCount;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoIncrementError", { message }),
      );
    }
  }

  /**
   * 减少字段值
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param fieldOrMap 要减少的字段名或字段-减量映射对象
   * @param amount 减少的数量（当提供单个字段名时生效，默认为 1）
   * @param returnLatest 是否返回更新后的记录（默认 false）
   * @returns 更新的记录数或更新后的模型实例
   *
   * @example
   * // 单个字段
   * await User.decrement('507f1f77bcf86cd799439011', 'views', 1);
   * await User.decrement({ status: 'active' }, 'score', 10);
   * // 对象格式（批量自减）
   * await User.decrement('507f1f77bcf86cd799439011', { views: 1, likes: 2 });
   * await User.decrement({ status: 'active' }, { score: 10, level: 1 });
   */
  static async decrement<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
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
   * 查找并更新记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param data 要更新的数据对象
   * @param options 更新选项（可选，如 { returnDocument: 'after' }）
   * @returns 更新后的模型实例或 null
   *
   * @example
   * const user = await User.findOneAndUpdate(
   *   '507f1f77bcf86cd799439011',
   *   { name: 'lisi' },
   *   { returnDocument: 'after' }
   * );
   */
  static async findOneAndUpdate<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    options: { returnDocument?: "before" | "after" } = {
      returnDocument: "after",
    },
    fields?: string[],
  ): Promise<InstanceType<T> | null> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    filter = this.applySoftDeleteFilter(filter);

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      if (this.timestamps) {
        const updatedAtField = typeof this.timestamps === "object"
          ? (this.timestamps.updatedAt || "updatedAt")
          : "updatedAt";
        data = { ...data, [updatedAtField]: new Date() };
      }
      const projection = this.buildProjection(fields);
      const opts: any = { returnDocument: options.returnDocument || "after" };
      if (Object.keys(projection).length > 0) {
        opts.projection = projection;
      }
      const raw = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        { $set: data },
        opts,
      );

      const result = this.unwrapModifyResult(raw);
      if (result == null || typeof result !== "object") {
        return null;
      }

      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(result));
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（findOneAndUpdate 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoFindOneAndUpdateError", { message }),
      );
    }
  }

  /**
   * 查找并删除记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的模型实例或 null
   *
   * @example
   * const user = await User.findOneAndDelete('507f1f77bcf86cd799439011');
   * const user = await User.findOneAndDelete({ email: 'user@example.com' });
   */
  static async findOneAndDelete<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    fields?: string[],
  ): Promise<InstanceType<T> | null> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const projection = this.buildProjection(fields);
      const optsUpdate: any = { returnDocument: "after" };
      const optsDelete: any = {};
      if (Object.keys(projection).length > 0) {
        optsUpdate.projection = projection;
        optsDelete.projection = projection;
      }
      if (this.softDelete) {
        const raw = await db.collection(this.collectionName)
          .findOneAndUpdate(
            filter,
            { $set: { [this.deletedAtField]: new Date() } },
            optsUpdate,
          );
        const result = this.unwrapModifyResult(raw);
        if (result == null || typeof result !== "object") {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(result));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);

        // 清除相关缓存（findOneAndDelete 后需要清除缓存）
        await this.clearCache();

        return instance as InstanceType<T>;
      } else {
        const raw = await db.collection(this.collectionName)
          .findOneAndDelete(
            filter,
            optsDelete,
          );
        const result = this.unwrapModifyResult(raw);
        if (result == null || typeof result !== "object") {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(result));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);

        // 清除相关缓存（findOneAndDelete 后需要清除缓存）
        await this.clearCache();

        return instance as InstanceType<T>;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoFindOneAndDeleteError", { message }),
      );
    }
  }

  /**
   * 更新或插入记录（如果不存在则插入，存在则更新）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param data 要更新或插入的数据对象
   * @returns 更新后的模型实例
   *
   * @example
   * const user = await User.upsert(
   *   { email: 'user@example.com' },
   *   { name: 'John', email: 'user@example.com', age: 25 }
   * );
   */
  static async upsert<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    data: Record<string, any>,
    returnLatest: boolean = true,
    resurrect: boolean = false,
  ): Promise<InstanceType<T>> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    if (!resurrect) {
      filter = this.applySoftDeleteFilter(filter);
    }

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const opts: any = {
        upsert: true,
        returnDocument: returnLatest ? "after" : "before",
      };
      const raw = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        {
          $set: {
            ...data,
            ...(resurrect && this.softDelete
              ? { [this.deletedAtField]: null }
              : {}),
          },
        },
        opts,
      );

      const result = this.unwrapModifyResult(raw);
      if (result == null || typeof result !== "object") {
        throw new Error(
          $tr("model.mongoUpsertError", { message: "empty_result" }),
        );
      }

      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(result));
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（upsert 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoUpsertError", { message }),
      );
    }
  }

  static async findOneAndReplace<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition | string,
    replacement: Record<string, any>,
    returnLatest: boolean = true,
    fields?: string[],
  ): Promise<InstanceType<T> | null> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    filter = this.applySoftDeleteFilter(filter);

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      if (this.timestamps) {
        const updatedAtField = typeof this.timestamps === "object"
          ? (this.timestamps.updatedAt || "updatedAt")
          : "updatedAt";
        replacement = { ...replacement, [updatedAtField]: new Date() };
      }
      const projection = this.buildProjection(fields);
      const opts: any = { returnDocument: returnLatest ? "after" : "before" };
      if (Object.keys(projection).length > 0) {
        opts.projection = projection;
      }
      const result = await db.collection(this.collectionName).findOneAndReplace(
        filter,
        replacement,
        opts,
      );
      if (!result) {
        return null;
      }
      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(result));
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（findOneAndReplace 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoFindOneAndReplaceError", { message }),
      );
    }
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
    condition: MongoWhereCondition | string = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<any[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();

    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const queryFilter = this.applySoftDeleteFilter(
        condition,
        includeTrashed,
        onlyTrashed,
      );
      const values = await db.collection(this.collectionName).distinct(
        field,
        queryFilter,
      );
      return values;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoDistinctError", { message }),
      );
    }
  }

  /**
   * 聚合查询
   * @param pipeline 聚合管道数组
   * @returns 聚合结果数组
   *
   * @example
   * const result = await User.aggregate([
   *   { $match: { status: 'active' } },
   *   { $group: { _id: '$department', count: { $sum: 1 } } }
   * ]);
   */
  static async aggregate(
    pipeline: any[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<any[]> {
    assertSafeMongoValue(pipeline);

    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();

    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      let effectivePipeline = pipeline;
      if (this.softDelete && !includeTrashed) {
        const match = onlyTrashed
          ? { [this.deletedAtField]: { $exists: true, $ne: null } }
          : {
            $or: [
              { [this.deletedAtField]: { $exists: false } },
              { [this.deletedAtField]: null },
            ],
          };
        effectivePipeline = [{ $match: match }, ...pipeline];
      }
      const results = await db.collection(this.collectionName).aggregate(
        effectivePipeline,
      ).toArray();
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoAggregateError", { message }),
      );
    }
  }

  /**
   * 只查询已软删除的记录
   * @returns 查询构建器（链式调用）
   *
   * @example
   * const deletedUsers = await User.onlyTrashed().findAll();
   * const user = await User.onlyTrashed().find('507f1f77bcf86cd799439011');
   */
  static onlyTrashed<T extends typeof MongoModel>(this: T): {
    findAll: (
      condition?: MongoWhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
    ) => Promise<InstanceType<T>[]>;
    find: (
      condition?: MongoWhereCondition | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: MongoWhereCondition) => Promise<number>;
  } {
    return {
      findAll: async (
        condition: MongoWhereCondition | string = {},
        fields?: string[],
        options?: {
          sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
          skip?: number;
          limit?: number;
        },
      ): Promise<InstanceType<T>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        // 应用软删除过滤器（onlyTrashed: true）
        const queryFilter = this.applySoftDeleteFilter(condition, false, true);
        const projection = this.buildProjection(fields);
        const queryOptions: any = {};
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(options?.sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }
        if (typeof options?.skip === "number") {
          queryOptions.skip = options.skip;
        }
        if (typeof options?.limit === "number") {
          queryOptions.limit = options.limit;
        }
        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );
        return results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, this.processQueryResultRow(row));
          // 应用虚拟字段（使用缓存的虚拟字段定义）
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        });
      },
      find: async (
        condition: MongoWhereCondition | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        let filter: any = {};
        if (typeof condition === "string") {
          // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
          filter._id = this.normalizeId(condition);
        } else {
          // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
          // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
          filter = this.normalizeCondition(condition);
        }
        // 应用软删除过滤器（onlyTrashed: true，只查询已软删除的记录）
        filter = this.applySoftDeleteFilter(filter, false, true);
        const projection = this.buildProjection(fields);
        const options: any = { limit: 1 };
        if (Object.keys(projection).length > 0) {
          options.projection = projection;
        }
        const results = await this.adapter.query(
          this.collectionName,
          filter,
          options,
        );
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(results[0]));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      },
      count: async (condition: MongoWhereCondition = {}): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        // 应用软删除过滤器（onlyTrashed: true）
        const queryFilter = this.applySoftDeleteFilter(condition, false, true);
        const db = this.mongoAdapter().getDatabase();
        if (!db) {
          throw new Error(
            $tr("model.databaseNotConnected"),
          );
        }
        const count = await db.collection(this.collectionName).countDocuments(
          queryFilter,
        );
        return count;
      },
    };
  }

  /**
   * 查询时包含已软删除的记录（包含所有记录，包括已软删除的）
   * @returns 查询构建器（链式调用）
   *
   * @example
   * const allUsers = await User.withTrashed().findAll();
   * const user = await User.withTrashed().find('507f1f77bcf86cd799439011');
   */
  static withTrashed<T extends typeof MongoModel>(this: T): {
    findAll: (
      condition?: MongoWhereCondition,
      fields?: string[],
      options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
        skip?: number;
        limit?: number;
      },
    ) => Promise<InstanceType<T>[]>;
    find: (
      condition?: MongoWhereCondition | string,
      fields?: string[],
    ) => Promise<InstanceType<T> | null>;
    count: (condition?: MongoWhereCondition) => Promise<number>;
  } {
    return {
      findAll: async (
        condition: MongoWhereCondition | string = {},
        fields?: string[],
        options?: {
          sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
          skip?: number;
          limit?: number;
        },
      ): Promise<InstanceType<T>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const projection = this.buildProjection(fields);
        const queryOptions: any = {};
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(options?.sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }
        if (typeof options?.skip === "number") {
          queryOptions.skip = options.skip;
        }
        if (typeof options?.limit === "number") {
          queryOptions.limit = options.limit;
        }
        // 应用软删除过滤器（includeTrashed: true，包含所有记录，包括已软删除的）
        const queryFilter = this.applySoftDeleteFilter(condition, true, false);
        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );
        return results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, this.processQueryResultRow(row));
          // 应用虚拟字段（使用缓存的虚拟字段定义）
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        });
      },
      find: async (
        condition: MongoWhereCondition | string = {},
        fields?: string[],
      ): Promise<InstanceType<T> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        let filter: any = {};
        if (typeof condition === "string") {
          // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
          filter._id = this.normalizeId(condition);
        } else {
          // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
          // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
          filter = this.normalizeCondition(condition);
        }
        // 应用软删除过滤器（includeTrashed: true，包含所有记录，包括已软删除的）
        filter = this.applySoftDeleteFilter(filter, true, false);
        const projection = this.buildProjection(fields);
        const options: any = { limit: 1 };
        if (Object.keys(projection).length > 0) {
          options.projection = projection;
        }
        const results = await this.adapter.query(
          this.collectionName,
          filter,
          options,
        );
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(results[0]));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      },
      count: async (condition: MongoWhereCondition = {}): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = this.mongoAdapter().getDatabase();
        if (!db) {
          throw new Error(
            $tr("model.databaseNotConnected"),
          );
        }
        // 应用软删除过滤器（includeTrashed: true，包含所有记录，包括已软删除的）
        const queryFilter = this.applySoftDeleteFilter(condition, true, false);
        const count = await db.collection(this.collectionName).countDocuments(
          queryFilter,
        );
        return count;
      },
    };
  }

  /**
   * 恢复软删除的记录
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 恢复的记录数
   *
   * @example
   * await User.restore('507f1f77bcf86cd799439011');
   * await User.restore({ email: 'user@example.com' });
   */
  static async restore(
    condition: MongoWhereCondition | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    if (!this.softDelete) {
      throw new Error(
        $tr("model.softDeleteNotEnabled"),
      );
    }
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      // 如果传入的是 ObjectId 对象，直接使用
      filter._id = condition;
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    // 只恢复已软删除的记录（deletedAt 存在且不为 null）
    filter[this.deletedAtField] = { $exists: true, $ne: null };

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      let ids: any[] = [];
      if (options?.returnIds) {
        ids = await db.collection(this.collectionName)
          .find(filter, { projection: { [this.primaryKey]: 1 } })
          .map((doc: any) => doc[this.primaryKey])
          .toArray();
      }
      const result = await db.collection(this.collectionName).updateMany(
        filter,
        { $set: { [this.deletedAtField]: null } },
      );
      const count = result.modifiedCount || 0;

      // 清除相关缓存（恢复软删除后需要清除缓存）
      // 注意：只有实际修改了数据（count > 0）才需要清除缓存
      if (count > 0) {
        await this.clearCache();
      }
      if (options?.returnIds) {
        return { count, ids };
      }
      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoRestoreError", { message }),
      );
    }
  }

  /**
   * 强制删除记录（忽略软删除，真正删除）
   * @param condition 查询条件（可以是 ID、条件对象）
   * @returns 删除的记录数
   *
   * @example
   * await User.forceDelete('507f1f77bcf86cd799439011');
   * await User.forceDelete({ email: 'user@example.com' });
   */
  static async forceDelete(
    condition: MongoWhereCondition | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    let filter: any = {};

    if (typeof condition === "string") {
      // MongoDB 总是使用 _id 字段作为主键，无论 primaryKey 是什么
      filter._id = this.normalizeId(condition);
    } else if (condition instanceof ObjectId) {
      // 如果传入的是 ObjectId 对象，直接使用
      filter._id = condition;
    } else {
      // 规范化查询条件，将主键字段（如果是字符串）转换为 ObjectId
      // 如果 primaryKey !== "_id"，会自动映射到 _id 字段
      filter = this.normalizeCondition(condition);
    }

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      let ids: any[] = [];
      if (options?.returnIds) {
        ids = await db.collection(this.collectionName)
          .find(filter, { projection: { [this.primaryKey]: 1 } })
          .map((doc: any) => doc[this.primaryKey])
          .toArray();
      }
      const result = await db.collection(this.collectionName).deleteMany(
        filter,
      );
      const count = result.deletedCount || 0;

      // 清除相关缓存（强制删除后需要清除缓存）
      if (count > 0) {
        await this.clearCache();
      }

      if (options?.returnIds) {
        return { count, ids };
      }
      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoForceDeleteError", { message }),
      );
    }
  }

  /**
   * 链式查询构建器
   * @example
   * const rows = await User.query()
   *   .where({ status: 'active' })
   *   .fields(['_id', 'name'])
   *   .sort({ createdAt: 'desc' })
   *   .skip(10)
   *   .limit(20)
   *   .findAll();
   */
  static query<T extends typeof MongoModel>(this: T): MongoQueryBuilder<T> {
    // 创建共享状态对象，确保 asArray() 中的修改能够持久化
    // 使用数组结构支持多个条件的 OR/AND 组合
    const state = {
      _conditions: [] as Array<{
        type: "where" | "or" | "and";
        condition: MongoWhereCondition | string;
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
    };

    const resolveFields = (): string[] | undefined =>
      mergePreloadFields(state._fields, this.primaryKey, state._with);

    /**
     * 构建最终的查询条件
     * 将多个条件合并为 MongoDB 查询对象
     */
    const buildFinalCondition = (): MongoWhereCondition | string => {
      if (state._conditions.length === 0) {
        return {};
      }

      // 如果只有一个 where 条件，直接返回
      if (
        state._conditions.length === 1 && state._conditions[0].type === "where"
      ) {
        const condition = state._conditions[0].condition;
        // 如果是字符串，需要转换为对象
        if (typeof condition === "string") {
          return { [this.primaryKey]: condition };
        }
        return condition;
      }

      // 检查是否有 OR 条件
      const hasOrCondition = state._conditions.some((item) =>
        item.type === "or"
      );

      if (hasOrCondition) {
        // 如果有 OR 条件，将所有条件组合成 $or 数组
        const orGroups: any[] = [];
        let currentGroup: any[] = [];

        for (const item of state._conditions) {
          const normalized = typeof item.condition === "string"
            ? { [this.primaryKey]: item.condition }
            : item.condition;

          if (item.type === "where") {
            // where 开始新的组
            if (currentGroup.length > 0) {
              // 将当前组作为一个 OR 分支
              if (currentGroup.length === 1) {
                orGroups.push(currentGroup[0]);
              } else {
                orGroups.push({ $and: currentGroup });
              }
              currentGroup = [];
            }
            currentGroup.push(normalized);
          } else if (item.type === "and") {
            // andWhere 添加到当前组
            currentGroup.push(normalized);
          } else if (item.type === "or") {
            // orWhere 将当前组作为一个 OR 分支，然后开始新组
            if (currentGroup.length > 0) {
              if (currentGroup.length === 1) {
                orGroups.push(currentGroup[0]);
              } else {
                orGroups.push({ $and: currentGroup });
              }
              currentGroup = [];
            }
            // orWhere 的条件作为新的 OR 分支
            orGroups.push(normalized);
          }
        }

        // 处理剩余的组
        if (currentGroup.length > 0) {
          if (currentGroup.length === 1) {
            orGroups.push(currentGroup[0]);
          } else {
            orGroups.push({ $and: currentGroup });
          }
        }

        // 返回 $or 查询
        if (orGroups.length === 1) {
          return orGroups[0];
        }
        return { $or: orGroups };
      } else {
        // 只有 AND 条件，组合成 $and 或直接合并
        const andConditions: any[] = [];

        for (const item of state._conditions) {
          const normalized = typeof item.condition === "string"
            ? { [this.primaryKey]: item.condition }
            : item.condition;
          andConditions.push(normalized);
        }

        if (andConditions.length === 1) {
          return andConditions[0];
        }

        // 合并所有 AND 条件
        const result: any = {};
        for (const condition of andConditions) {
          assignData(result, condition);
        }

        // 如果有冲突的键，需要使用 $and
        if (
          Object.keys(result).length <
            andConditions.reduce((sum, c) => sum + Object.keys(c).length, 0)
        ) {
          return { $and: andConditions };
        }

        return result;
      }
    };

    /**
     * 将条件对象中的字符串值转换为正则表达式（用于 LIKE 查询）
     * 支持嵌套对象和 JSON 对象查询
     * @param condition 查询条件对象
     * @returns 转换后的查询条件对象
     */
    const convertToLikeCondition = (
      condition: MongoWhereCondition,
    ): MongoWhereCondition => {
      const result: MongoWhereCondition = {};

      for (const [key, value] of Object.entries(condition)) {
        // 跳过 MongoDB 操作符（以 $ 开头）
        if (key.startsWith("$")) {
          result[key] = value;
          continue;
        }

        // 处理嵌套对象（支持 JSON 对象查询，如 { "user.name": "value" } 或 { user: { name: "value" } }）
        if (
          typeof value === "object" && value !== null && !Array.isArray(value)
        ) {
          // 检查是否是 MongoDB 操作符对象（包含 $gt, $lt, $regex 等）
          const isOperatorObject = Object.keys(value).some((k) =>
            k.startsWith("$")
          );

          if (isOperatorObject) {
            // 如果已经是操作符对象，保持原样
            result[key] = value;
          } else {
            // 递归处理嵌套对象
            result[key] = convertToLikeCondition(value as MongoWhereCondition);
          }
        } else if (typeof value === "string") {
          // 将字符串值转换为正则表达式（LIKE 查询）
          // 将 SQL 风格的 % 通配符转换为正则表达式，_ 转换为单个字符匹配
          const regexPattern = value.replace(/%/g, ".*").replace(/_/g, ".");
          result[key] = { $regex: regexPattern, $options: "i" };
        } else {
          // 其他类型（数字、布尔值等）保持原样
          result[key] = value;
        }
      }

      return result;
    };

    // 执行查询单条记录的函数（用于直接 await）
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      // 自动初始化（懒加载）
      await this.ensureAdapter();
      const projection = this.buildProjection(resolveFields());
      const queryOptions: any = { limit: 1 };
      if (Object.keys(projection).length > 0) {
        queryOptions.projection = projection;
      }
      const normalizedSort = this.normalizeSort(state._sort);
      if (normalizedSort) {
        queryOptions.sort = normalizedSort;
      }

      // 构建最终查询条件
      const finalCondition = buildFinalCondition();
      let filter: any = {};
      if (typeof finalCondition === "string") {
        // 字符串 ID 需要转换为 ObjectId
        if (finalCondition) {
          filter._id = this.normalizeId(finalCondition);
        } else {
          filter = {};
        }
      } else {
        filter = this.normalizeCondition(finalCondition);
      }
      const queryFilter = this.applySoftDeleteFilter(
        filter,
        state._includeTrashed,
        state._onlyTrashed,
      );

      const results = await this.adapter.query(
        this.collectionName,
        queryFilter,
        queryOptions,
      );
      if (results.length === 0) {
        return null;
      }
      const instance = this.createInstance();
      assignData(instance, this.processQueryResultRow(results[0]));
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);
      await applyPreloads(instance, this.primaryKey, state._with);
      return instance as InstanceType<T>;
    };

    // 仅在 then/catch/finally（如直接 await 构建器）时才执行 findOne
    const queryPromise = lazyThenable(() => executeFindOne());

    // 使用类型断言确保 builder 的类型是 MongoQueryBuilder<T>
    const builder: MongoQueryBuilder<T> = {
      /**
       * 设置查询条件（会重置之前的所有条件）
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      where: (condition: MongoWhereCondition | string) => {
        state._conditions = [{ type: "where", condition }];
        return builder;
      },
      /**
       * 添加 OR 查询条件
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      orWhere: (condition: MongoWhereCondition | string) => {
        state._conditions.push({ type: "or", condition });
        return builder;
      },
      /**
       * 添加 AND 查询条件
       * @param condition 查询条件对象或主键值
       * @returns 查询构建器实例
       */
      andWhere: (condition: MongoWhereCondition | string) => {
        state._conditions.push({ type: "and", condition });
        return builder;
      },
      /**
       * 添加 LIKE 查询条件（使用正则表达式）
       * 支持 MongoWhereCondition 类型和 JSON 对象条件查询
       * @param condition 查询条件对象，字符串值会被转换为正则表达式（支持 % 通配符）
       * @returns 查询构建器实例
       * @example
       * User.query().like({ name: "%shu%" }) // 匹配包含 "shu" 的 name 字段
       * User.query().like({ "user.name": "%shu%" }) // 支持点号路径
       * User.query().like({ user: { name: "%shu%" } }) // 支持嵌套对象
       * User.query().like({ name: { $regex: "shu", $options: "i" } }) // 支持已有操作符
       */
      like: (condition: MongoWhereCondition) => {
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
       * 支持 MongoWhereCondition 类型和 JSON 对象条件查询
       * @param condition 查询条件对象，字符串值会被转换为正则表达式（支持 % 通配符）
       * @returns 查询构建器实例
       * @example
       * User.query().where({ status: "active" }).orLike({ name: "%shu%" })
       * User.query().orLike({ "user.name": "%shu%", age: 18 }) // 混合条件
       */
      orLike: (condition: MongoWhereCondition) => {
        const likeCondition = convertToLikeCondition(condition);
        state._conditions.push({ type: "or", condition: likeCondition });
        return builder;
      },
      /**
       * 添加 AND LIKE 查询条件
       * 支持 MongoWhereCondition 类型和 JSON 对象条件查询
       * @param condition 查询条件对象，字符串值会被转换为正则表达式（支持 % 通配符）
       * @returns 查询构建器实例
       * @example
       * User.query().where({ status: "active" }).andLike({ name: "%shu%" })
       * User.query().andLike({ user: { name: "%shu%", email: "%test%" } }) // 嵌套对象
       */
      andLike: (condition: MongoWhereCondition) => {
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
      findAll: async (): Promise<InstanceType<T>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const projection = this.buildProjection(resolveFields());
        const queryOptions: any = {};
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(state._sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }
        if (typeof state._skip === "number") {
          queryOptions.skip = state._skip;
        }
        if (typeof state._limit === "number") {
          queryOptions.limit = state._limit;
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          // 字符串 ID 需要转换为 ObjectId
          if (finalCondition) {
            filter._id = this.normalizeId(finalCondition);
          } else {
            filter = {};
          }
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );

        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );

        const instances = results.map((row: any) => {
          const instance = this.createInstance();
          assignData(instance, this.processQueryResultRow(row));
          // 应用虚拟字段（使用缓存的虚拟字段定义）
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        });
        await applyPreloads(instances, this.primaryKey, state._with);
        return instances;
      },
      findOne: async (): Promise<InstanceType<T> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const projection = this.buildProjection(resolveFields());
        const queryOptions: any = { limit: 1 };
        if (Object.keys(projection).length > 0) {
          queryOptions.projection = projection;
        }
        const normalizedSort = this.normalizeSort(state._sort);
        if (normalizedSort) {
          queryOptions.sort = normalizedSort;
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          // 字符串 ID 需要转换为 ObjectId
          if (finalCondition) {
            filter._id = this.normalizeId(finalCondition);
          } else {
            filter = {};
          }
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );

        const results = await this.adapter.query(
          this.collectionName,
          queryFilter,
          queryOptions,
        );
        if (results.length === 0) {
          return null;
        }
        const instance = this.createInstance();
        assignData(instance, this.processQueryResultRow(results[0]));
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
        await applyPreloads(instance, this.primaryKey, state._with);
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
       * const user = await User.find('123').asArray().findOne(); // 返回纯 JSON 对象或 null
       */
      asArray: (): MongoArrayQueryBuilder<T> => {
        // 返回共享状态对象的引用，确保 asArray() 中的修改能够持久化
        return this.createArrayQueryBuilder(() => state);
      },
      findById: async (
        id: string,
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
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = this.mongoAdapter().getDatabase();
        if (!db) {
          throw new Error(
            $tr("model.databaseNotConnected"),
          );
        }

        // 构建最终查询条件
        const finalCondition = buildFinalCondition();
        let filter: any = {};
        if (typeof finalCondition === "string") {
          // 字符串 ID 需要转换为 ObjectId
          if (finalCondition) {
            filter._id = this.normalizeId(finalCondition);
          } else {
            filter = {};
          }
        } else {
          filter = this.normalizeCondition(finalCondition);
        }
        const queryFilter = this.applySoftDeleteFilter(
          filter,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const count = await db.collection(this.collectionName).countDocuments(
          queryFilter,
        );
        return count;
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
      updateById: async (
        id: string,
        data: Record<string, any>,
      ): Promise<number> => {
        await this.ensureAdapter();
        return await this.updateById(id, data);
      },
      update: async (
        data: Record<string, any>,
        returnLatest: boolean = false,
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        if (returnLatest) {
          return await this.update(
            finalCondition,
            data,
            true,
          ) as InstanceType<T>;
        }
        // 与 SQL query().update 一致：更新所有匹配行
        return await this.update(
          finalCondition,
          data,
          false,
          { useUpdateMany: true },
        ) as number;
      },
      updateMany: async (data: Record<string, any>): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.updateMany(finalCondition, data);
      },
      increment: async (
        field: string,
        amount: number = 1,
        returnLatest: boolean = false,
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
        returnLatest: boolean = false,
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        return await this.decrement(
          finalCondition,
          field,
          amount,
          returnLatest,
        );
      },
      deleteById: async (id: string): Promise<number> => {
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
      restoreById: async (id: string): Promise<number> => {
        await this.ensureAdapter();
        return await this.restoreById(id);
      },
      forceDelete: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.forceDelete(finalCondition, options);
      },
      forceDeleteById: async (id: string): Promise<number> => {
        await this.ensureAdapter();
        return await this.forceDeleteById(id);
      },
      distinct: async (field: string): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.distinct(
          field,
          cond,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      aggregate: async (pipeline: any[]): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        let match: any = {};
        if (typeof finalCondition === "string") {
          match[this.primaryKey] = finalCondition;
        } else if (
          finalCondition && Object.keys(finalCondition).length > 0
        ) {
          match = this.normalizeCondition(finalCondition);
        }
        const effective = Object.keys(match).length > 0
          ? [{ $match: match }, ...pipeline]
          : pipeline;
        return await this.aggregate(
          effective,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      findOneAndUpdate: async (
        data: Record<string, any>,
        options?: { returnDocument?: "before" | "after" },
      ): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndUpdate(
          finalCondition,
          data,
          options ?? { returnDocument: "after" },
          state._fields,
        );
      },
      findOneAndDelete: async (): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndDelete(
          finalCondition,
          state._fields,
        );
      },
      findOneAndReplace: async (
        replacement: Record<string, any>,
        returnLatest: boolean = true,
      ): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndReplace(
          finalCondition,
          replacement,
          returnLatest,
          state._fields,
        );
      },
      upsert: async (
        data: Record<string, any>,
        returnLatest: boolean = true,
        resurrect: boolean = false,
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
        resurrect: boolean = false,
      ): Promise<InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : finalCondition;
        return await this.findOrCreate(cond, data, resurrect);
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
   * 查找或创建记录（如果不存在则创建）
   * @param condition 查询条件（用于判断是否存在）
   * @param data 要创建的数据对象（如果不存在）
   * @returns 找到或创建的模型实例
   *
   * @example
   * const user = await User.findOrCreate(
   *   { email: 'user@example.com' },
   *   { name: 'John', email: 'user@example.com', age: 25 }
   * );
   */
  static async findOrCreate<T extends typeof MongoModel>(
    this: T,
    condition: MongoWhereCondition,
    data: Record<string, any>,
    resurrect: boolean = false,
  ): Promise<InstanceType<T>> {
    await this.ensureAdapter();

    // 先尝试查找（包含软删除的记录）
    const existing = await this.withTrashed().find(condition);
    if (existing) {
      if (resurrect && this.softDelete) {
        const id = getRecordValue(existing, this.primaryKey);
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
   * 清空集合（删除所有记录）
   * @returns 删除的记录数
   *
   * @example
   * await User.truncate();
   */
  static async truncate(): Promise<number> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    try {
      const result = await db.collection(this.collectionName).deleteMany({});
      return result.deletedCount || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.mongoTruncateError", { message }),
      );
    }
  }

  /**
   * 在事务中执行一段逻辑（需要 MongoDB 事务支持）
   * @param callback 事务回调，传入当前模型绑定的适配器
   * @returns 回调的返回值
   *
   * @example
   * await User.transaction(async (db) => {
   *   await User.update({ _id: id }, { name: 'tx' });
   *   await Profile.update({ userId: id }, { nickname: 'tx-nick' });
   * });
   */
  static async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    return await this.adapter.transaction(callback);
  }

  /**
   * 对已查出的实例批量预加载关联，避免 N+1。
   * 每条关联定义对应一次 findAll。
   */
  static async preload<T extends typeof MongoModel>(
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
   * class Post extends MongoModel {
   *   static collectionName = 'posts';
   *   async user() {
   *     return await this.belongsTo(User, 'userId', '_id');
   *   }
   * }
   * const post = await Post.find('...');
   * const user = await post.user();
   */
  async belongsTo<T extends typeof MongoModel>(
    RelatedModel: T,
    foreignKey: string,
    localKey?: string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T> | null> {
    const Model = this.constructor as typeof MongoModel;
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
   * class User extends MongoModel {
   *   static collectionName = 'users';
   *   async profile() {
   *     return await this.hasOne(Profile, 'userId', '_id');
   *   }
   * }
   * const user = await User.find('...');
   * const profile = await user.profile();
   */
  async hasOne<T extends typeof MongoModel>(
    RelatedModel: T,
    foreignKey: string,
    localKey?: string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<InstanceType<T> | null> {
    const Model = this.constructor as typeof MongoModel;
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
   * class User extends MongoModel {
   *   static collectionName = 'users';
   *   async posts() {
   *     return await this.hasMany(Post, 'userId', '_id');
   *   }
   * }
   * const user = await User.find('...');
   * const posts = await user.posts();
   */
  async hasMany<T extends typeof MongoModel>(
    RelatedModel: T,
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
  ): Promise<InstanceType<T>[]> {
    const Model = this.constructor as typeof MongoModel;
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
   * 例如：User belongsToMany Role，中间集合 UserRole（user_id / role_id）。
   */
  async belongsToMany<T extends typeof MongoModel, P extends typeof MongoModel>(
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
    const Model = this.constructor as typeof MongoModel;
    await Model.ensureAdapter();
    await (RelatedModel as typeof MongoModel).ensureAdapter();
    await (options.pivot as typeof MongoModel).ensureAdapter();
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

  /**
   * 创建索引（如果未定义则自动创建）
   * @param force 是否强制重新创建（删除后重建）
   * @returns 创建的索引信息数组
   *
   * @example
   * await User.createIndexes(); // 创建所有定义的索引
   * await User.createIndexes(true); // 强制重新创建
   */
  static async createIndexes(force: boolean = false): Promise<string[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();

    if (!this.indexes || this.indexes.length === 0) {
      return [];
    }

    // 确保适配器已连接
    if (!this.adapter) {
      throw new Error($tr("model.adapterNotSet"));
    }

    // 通过执行一个简单的查询来确保连接（这会自动调用 ensureConnection）
    // 如果适配器未连接，query 方法会抛出错误
    try {
      await this.adapter.query(this.collectionName, {}, { limit: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.databaseNotConnectedMessage", { message }),
      );
    }

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    const collection = db.collection(this.collectionName);
    const createdIndexes: string[] = [];

    for (const indexDef of this.indexes) {
      try {
        let indexSpec: any;
        const indexOptions: any = {};

        // 判断索引类型
        if (
          "field" in indexDef &&
          !("type" in indexDef &&
            (indexDef.type === "2d" || indexDef.type === "2dsphere"))
        ) {
          // 单个字段索引
          const singleIndex = indexDef as SingleFieldIndex;
          const direction = this.normalizeDirection(singleIndex.direction || 1);
          indexSpec = { [singleIndex.field]: direction };

          if (singleIndex.unique) {
            indexOptions.unique = true;
          }
          if (singleIndex.sparse) {
            indexOptions.sparse = true;
          }
          if (singleIndex.name) {
            indexOptions.name = singleIndex.name;
          }
        } else if (
          "fields" in indexDef && "type" in indexDef && indexDef.type === "text"
        ) {
          // 文本索引
          const textIndex = indexDef as TextIndex;
          indexSpec = {};
          for (const field of Object.keys(textIndex.fields)) {
            indexSpec[field] = "text";
          }
          indexOptions.weights = textIndex.fields;
          if (textIndex.defaultLanguage) {
            indexOptions.default_language = textIndex.defaultLanguage;
          }
          if (textIndex.languageOverride) {
            indexOptions.language_override = textIndex.languageOverride;
          }
          if (textIndex.name) {
            indexOptions.name = textIndex.name;
          }
        } else if (
          "field" in indexDef && "type" in indexDef &&
          (indexDef.type === "2d" || indexDef.type === "2dsphere")
        ) {
          // 地理空间索引
          const geoIndex = indexDef as GeospatialIndex;
          indexSpec = { [geoIndex.field]: geoIndex.type };
          if (geoIndex.name) {
            indexOptions.name = geoIndex.name;
          }
        } else if ("fields" in indexDef) {
          // 复合索引
          const compoundIndex = indexDef as CompoundIndex;
          indexSpec = {};
          for (
            const [field, direction] of Object.entries(compoundIndex.fields)
          ) {
            indexSpec[field] = this.normalizeDirection(direction);
          }
          if (compoundIndex.unique) {
            indexOptions.unique = true;
          }
          if (compoundIndex.name) {
            indexOptions.name = compoundIndex.name;
          }
        }

        if (force) {
          // 删除现有索引（如果存在）
          try {
            const indexName = indexOptions.name ||
              this.generateIndexName(indexSpec);
            await collection.dropIndex(indexName);
          } catch {
            // 索引不存在，忽略错误
          }
        }

        // 创建索引
        const indexName = await collection.createIndex(indexSpec, indexOptions);
        createdIndexes.push(indexName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          $tr("model.failedToCreateIndex", { message }),
        );
      }
    }

    return createdIndexes;
  }

  /**
   * 删除所有索引（除了 _id 索引）
   * @returns 删除的索引名称数组
   */
  static async dropIndexes(): Promise<string[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    const collection = db.collection(this.collectionName);
    const indexes = await collection.indexes();
    const droppedIndexes: string[] = [];

    for (const index of indexes) {
      // 跳过 _id 索引或没有名称的索引
      if (!index.name || index.name === "_id_") {
        continue;
      }

      try {
        await collection.dropIndex(index.name);
        droppedIndexes.push(index.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          $tr("model.failedToDropIndex", {
            name: index.name,
            message,
          }),
        );
      }
    }

    return droppedIndexes;
  }

  /**
   * 获取所有索引信息
   * @returns 索引信息数组
   */
  static async getIndexes(): Promise<any[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();

    // 确保适配器已连接
    if (!this.adapter) {
      throw new Error($tr("model.adapterNotSet"));
    }

    // 通过执行一个简单的查询来确保连接（这会自动调用 ensureConnection）
    // 如果适配器未连接，query 方法会抛出错误
    try {
      await this.adapter.query(this.collectionName, {}, { limit: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        $tr("model.databaseNotConnectedMessage", { message }),
      );
    }

    const db = this.mongoAdapter().getDatabase();
    if (!db) {
      throw new Error($tr("model.databaseNotConnected"));
    }

    const collection = db.collection(this.collectionName);
    return await collection.indexes();
  }

  /**
   * 规范化索引方向
   */
  private static normalizeDirection(direction: IndexDirection): number {
    if (typeof direction === "number") {
      return direction;
    }
    if (direction === "asc" || direction === "ascending") {
      return 1;
    }
    if (direction === "desc" || direction === "descending") {
      return -1;
    }
    return 1;
  }

  /**
   * 生成索引名称
   */
  private static generateIndexName(indexSpec: any): string {
    const parts: string[] = [];
    for (const [field, direction] of Object.entries(indexSpec)) {
      parts.push(`${field}_${direction}`);
    }
    return parts.join("_");
  }
}
