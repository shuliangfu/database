/**
 * SQL 模型基类
 * 提供 ORM 功能，支持对象条件查询和字段选择
 */

import type { CacheAdapter } from "../cache/cache-adapter.ts";
import type { DatabaseAdapter } from "../types.ts";
import type { IndexDefinitions } from "../types/index.ts";

/**
 * 查询条件类型
 * 支持对象形式的查询条件，包括操作符
 */
export type WhereCondition = {
  [key: string]: any | {
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $ne?: any;
    $in?: any[];
    $like?: string;
  };
};

/**
 * 字段类型
 *
 * - string: 字符串类型
 * - number: 数字类型（整数或浮点数）
 * - bigint: 大整数类型
 * - decimal: 精确小数类型（用于货币等需要精确计算的场景）
 * - boolean: 布尔类型
 * - date: 日期时间类型
 * - timestamp: 时间戳类型（数字）
 * - array: 数组类型
 * - object: 对象类型
 * - json: JSON 类型（与 object 类似，但更明确）
 * - enum: 枚举类型
 * - uuid: UUID 类型
 * - text: 长文本类型
 * - binary: 二进制数据类型
 * - any: 任意类型
 */
export type FieldType =
  | "string"
  | "number"
  | "bigint"
  | "decimal"
  | "boolean"
  | "date"
  | "timestamp"
  | "array"
  | "object"
  | "json"
  | "enum"
  | "uuid"
  | "text"
  | "binary"
  | "any";

/**
 * 验证规则
 */
export interface ValidationRule {
  required?: boolean; // 必填
  type?: FieldType; // 类型
  min?: number; // 最小值（数字）或最小长度（字符串）
  max?: number; // 最大值（数字）或最大长度（字符串）
  length?: number; // 固定长度（字符串）
  pattern?: RegExp | string; // 正则表达式
  enum?: any[]; // 枚举值
  custom?: (value: any) => boolean | string; // 自定义验证函数，返回 true 或错误信息
  message?: string; // 自定义错误信息

  // 跨字段验证
  /** 与另一个字段值相等 */
  equals?: string; // 另一个字段的名称
  /** 与另一个字段值不相等 */
  notEquals?: string; // 另一个字段的名称
  /** 自定义字段比较函数，可以访问所有字段值 */
  compare?: (value: any, allValues: Record<string, any>) => boolean | string; // 返回 true 或错误信息
  /** 跨表/跨字段值比较验证（异步） */
  compareValue?: {
    /** 目标字段名 */
    targetField: string;
    /** 目标模型（可选，不指定则默认当前表） */
    targetModel?: typeof SQLModel;
    /** 比较操作符：'=' | '>' | '<' | '>=' | '<='，默认为 '=' */
    compare?: "=" | ">" | "<" | ">=" | "<=";
    /** 额外的查询条件（可选） */
    where?: Record<string, any>;
  };

  // 数据库查询验证（异步）
  /** 在数据表中唯一（不能重复） */
  unique?: boolean | {
    /** 查询条件（可选，用于排除当前记录） */
    exclude?: Record<string, any>;
    /** 自定义查询条件（可选） */
    where?: Record<string, any>;
  };
  /** 在数据表中存在（必须已存在） */
  exists?: boolean | {
    /** 查询的表名（可选，默认当前表） */
    table?: string;
    /** 查询条件（可选） */
    where?: Record<string, any>;
  };
  /** 在数据表中不存在（必须不存在） */
  notExists?: boolean | {
    /** 查询的表名（可选，默认当前表） */
    table?: string;
    /** 查询条件（可选） */
    where?: Record<string, any>;
  };

  // 高级验证功能
  /** 条件验证 - 根据其他字段值决定是否验证此字段 */
  when?: {
    /** 条件字段名 */
    field: string;
    /** 条件值（如果条件字段等于此值，则验证） */
    is?: any;
    /** 条件值（如果条件字段不等于此值，则验证） */
    isNot?: any;
    /** 条件函数（返回 true 则验证） */
    check?: (value: any, allValues: Record<string, any>) => boolean;
  };
  /** 条件必填 - 根据条件决定字段是否必填 */
  requiredWhen?: {
    /** 条件字段名 */
    field: string;
    /** 条件值（如果条件字段等于此值，则必填） */
    is?: any;
    /** 条件值（如果条件字段不等于此值，则必填） */
    isNot?: any;
    /** 条件函数（返回 true 则必填） */
    check?: (value: any, allValues: Record<string, any>) => boolean;
  };
  /** 异步自定义验证函数 - 可以访问数据库和所有字段值 */
  asyncCustom?: (
    value: any,
    allValues: Record<string, any>,
    context: {
      fieldName: string;
      instanceId?: any;
      model: typeof SQLModel;
    },
  ) => Promise<boolean | string>; // 返回 true 或错误信息
  /** 验证组 - 只在指定组中验证 */
  groups?: string[];
  /** 数组验证 - 验证数组元素 */
  array?: {
    /** 数组元素类型 */
    type?: FieldType;
    /** 最小长度 */
    min?: number;
    /** 最大长度 */
    max?: number;
    /** 固定长度 */
    length?: number;
    /** 元素验证规则 */
    items?: ValidationRule;
    /** 数组元素唯一性 */
    uniqueItems?: boolean;
  };
  /** 内置格式验证器 */
  format?:
    | "email"
    | "url"
    | "ip"
    | "ipv4"
    | "ipv6"
    | "uuid"
    | "date"
    | "datetime"
    | "time";

  // 数值验证增强
  /** 整数验证 */
  integer?: boolean;
  /** 正数验证 */
  positive?: boolean;
  /** 负数验证 */
  negative?: boolean;
  /** 倍数验证 */
  multipleOf?: number;
  /** 范围验证 [min, max] */
  range?: [number, number];

  // 字符串验证增强
  /** 只能包含字母和数字 */
  alphanumeric?: boolean;
  /** 只能包含数字 */
  numeric?: boolean;
  /** 只能包含字母 */
  alpha?: boolean;
  /** 必须是小写 */
  lowercase?: boolean;
  /** 必须是大写 */
  uppercase?: boolean;
  /** 必须以某个字符串开头 */
  startsWith?: string;
  /** 必须以某个字符串结尾 */
  endsWith?: string;
  /** 必须包含某个字符串 */
  contains?: string;
  /** 自动去除首尾空格 */
  trim?: boolean;
  /** 自动转换为小写 */
  toLowerCase?: boolean;
  /** 自动转换为大写 */
  toUpperCase?: boolean;

  // 日期/时间验证增强
  /** 必须早于某个日期 */
  before?: string | Date;
  /** 必须晚于某个日期 */
  after?: string | Date;
  /** 必须早于某个时间 */
  beforeTime?: string;
  /** 必须晚于某个时间 */
  afterTime?: string;
  /** 时区验证 */
  timezone?: string;

  /** 密码强度验证 */
  passwordStrength?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  };
}

/**
 * 字段定义
 */
export interface FieldDefinition {
  type: FieldType;
  enum?: any[]; // 枚举值（当 type 为 'enum' 时使用）
  default?: any; // 默认值
  validate?: ValidationRule; // 验证规则
  get?: (value: any) => any; // Getter 函数
  set?: (value: any) => any; // Setter 函数
}

/**
 * 模型字段定义
 */
export type ModelSchema = {
  [fieldName: string]: FieldDefinition;
};

/**
 * 验证错误
 */
export class ValidationError extends Error {
  field: string;

  constructor(
    field: string,
    message: string,
  ) {
    super(`Validation failed for field "${field}": ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}

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
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => SQLFindQueryBuilder<T>;
  skip: (n: number) => SQLFindQueryBuilder<T>;
  limit: (n: number) => SQLFindQueryBuilder<T>;
  fields: (fields: string[]) => SQLFindQueryBuilder<T>;
  includeTrashed: () => SQLFindQueryBuilder<T>;
  onlyTrashed: () => SQLFindQueryBuilder<T>;
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

export type LifecycleHook<T = any> = (
  instance: T,
  options?: any,
) => Promise<void> | void;

/**
 * SQL 链式查询构建器类型
 * 使用递归类型定义，避免循环引用
 */
export type SQLQueryBuilder<T extends typeof SQLModel> = {
  where: (
    condition: WhereCondition | number | string,
  ) => SQLQueryBuilder<T>;
  fields: (fields: string[]) => SQLQueryBuilder<T>;
  sort: (
    sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
  ) => SQLQueryBuilder<T>;
  skip: (n: number) => SQLQueryBuilder<T>;
  limit: (n: number) => SQLQueryBuilder<T>;
  includeTrashed: () => SQLQueryBuilder<T>;
  onlyTrashed: () => SQLQueryBuilder<T>;
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
};

/**
 * SQL 模型基类
 * 所有 SQL 数据库模型都应该继承此类
 */
export abstract class SQLModel {
  /**
   * 表名（子类必须定义）
   */
  static tableName: string;

  /**
   * 主键字段名（默认为 'id'）
   */
  static primaryKey: string = "id";

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
      throw new Error(
        `Database adapter not initialized for model "${this.tableName}". Please call 'await ${this.tableName}.ensureInitialized()' or 'await ${this.tableName}.init()' before accessing this property.`,
      );
    }
    return this._adapter;
  }

  static set adapter(value: DatabaseAdapter | null) {
    this._adapter = value;
  }

  /**
   * Schema 键缓存（性能优化：减少 Object.entries() 开销）
   * 每个子类独立缓存自己的 schema 键
   */
  private static _schemaKeysCache: Map<typeof SQLModel, string[]> = new Map();

  /**
   * 获取 Schema 键（带缓存）
   * 性能优化：缓存 schema 键，避免重复调用 Object.keys()
   * @returns Schema 字段名数组
   */
  private static getSchemaKeys(): string[] {
    const schema = (this as any).schema;
    if (!schema) {
      return [];
    }

    // 检查缓存
    let keys = this._schemaKeysCache.get(this as typeof SQLModel);
    if (!keys) {
      // 计算并缓存
      keys = Object.keys(schema);
      this._schemaKeysCache.set(this as typeof SQLModel, keys);
    }

    return keys;
  }

  /**
   * 虚拟字段定义缓存（性能优化：避免重复遍历虚拟字段定义）
   * 键：模型类，值：虚拟字段定义数组 [name, getter][]
   */
  private static _virtualsCache = new WeakMap<
    typeof SQLModel,
    Array<[string, (instance: any) => any]>
  >();

  /**
   * 获取虚拟字段定义（带缓存）
   * 性能优化：缓存虚拟字段定义，避免重复调用 Object.entries()
   * @returns 虚拟字段定义数组 [name, getter][]
   */
  private static getVirtuals(): Array<[string, (instance: any) => any]> {
    const virtuals = (this as any).virtuals;
    if (!virtuals) {
      return [];
    }

    // 检查缓存
    let cached = this._virtualsCache.get(this as typeof SQLModel);
    if (!cached) {
      // 计算并缓存
      cached = Object.entries(virtuals) as Array<
        [string, (instance: any) => any]
      >;
      this._virtualsCache.set(this as typeof SQLModel, cached);
    }

    return cached;
  }

  /**
   * 应用虚拟字段到实例（性能优化：使用缓存的虚拟字段定义）
   * @param instance 模型实例
   */
  private static applyVirtuals(instance: any): void {
    const virtuals = this.getVirtuals();
    if (virtuals.length === 0) {
      return;
    }

    // 使用缓存的虚拟字段定义，避免重复 Object.entries()
    for (const [name, getter] of virtuals) {
      Object.defineProperty(instance, name, {
        get: () => getter(instance),
        enumerable: true,
        configurable: true,
      });
    }
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
   * 缓存键缓存（性能优化：避免重复生成相同的缓存键）
   * 键：序列化的参数，值：生成的缓存键
   */
  private static _cacheKeyCache = new WeakMap<
    typeof SQLModel,
    Map<string, string>
  >();

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
    condition: WhereCondition | number | string,
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed?: boolean,
    onlyTrashed?: boolean,
  ): string {
    // 性能优化：条件生成 - 只在有缓存适配器时才生成缓存键
    if (!this.cacheAdapter) {
      return "";
    }

    // 性能优化：缓存键缓存 - 生成参数序列化键用于缓存查找
    const paramKey = this.serializeCacheKeyParams(
      condition,
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );

    // 检查缓存
    let cacheMap = this._cacheKeyCache.get(this as typeof SQLModel);
    if (!cacheMap) {
      cacheMap = new Map();
      this._cacheKeyCache.set(this as typeof SQLModel, cacheMap);
    }

    const cached = cacheMap.get(paramKey);
    if (cached !== undefined) {
      return cached;
    }

    // 快速字符串化条件（避免 JSON.stringify 开销）
    let conditionStr: string;
    if (typeof condition === "number" || typeof condition === "string") {
      conditionStr = String(condition);
    } else if (typeof condition === "object" && condition !== null) {
      // 使用简单的键值对拼接，比 JSON.stringify 快
      const keys = Object.keys(condition).sort();
      conditionStr = keys.map((k) => {
        const v = (condition as any)[k];
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return `${k}:${
            Object.keys(v).sort().map((op) => `${op}:${v[op]}`).join(",")
          }`;
        }
        return `${k}:${v}`;
      }).join("|");
    } else {
      conditionStr = String(condition);
    }

    const parts = [
      this.tableName,
      conditionStr,
      fields ? fields.sort().join(",") : "*",
      options?.sort
        ? (typeof options.sort === "string"
          ? options.sort
          : Object.keys(options.sort as Record<string, 1 | -1 | "asc" | "desc">)
            .sort().map((k) =>
              `${k}:${
                (options.sort as Record<string, 1 | -1 | "asc" | "desc">)[k]
              }`
            ).join(","))
        : "",
      options?.skip !== undefined ? `skip:${options.skip}` : "",
      options?.limit !== undefined ? `limit:${options.limit}` : "",
      includeTrashed ? "includeTrashed" : "",
      onlyTrashed ? "onlyTrashed" : "",
    ];
    const cacheKey = `model:${this.tableName}:query:${parts.join(":")}`;

    // 缓存生成的缓存键（限制缓存大小，避免内存泄漏）
    if (cacheMap.size < 1000) {
      cacheMap.set(paramKey, cacheKey);
    }

    return cacheKey;
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
    condition: WhereCondition | number | string,
    fields?: string[],
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
      skip?: number;
      limit?: number;
    },
    includeTrashed?: boolean,
    onlyTrashed?: boolean,
  ): string {
    // 快速序列化参数（用于缓存键查找）
    const parts: string[] = [];

    // 条件
    if (typeof condition === "number" || typeof condition === "string") {
      parts.push(`c:${condition}`);
    } else if (typeof condition === "object" && condition !== null) {
      const keys = Object.keys(condition).sort();
      parts.push(
        `c:${keys.map((k) => `${k}:${(condition as any)[k]}`).join(",")}`,
      );
    } else {
      parts.push(`c:${String(condition)}`);
    }

    // 字段
    parts.push(`f:${fields ? fields.sort().join(",") : "*"}`);

    // 选项
    if (options) {
      if (options.sort) {
        const sortStr = typeof options.sort === "string"
          ? options.sort
          : Object.keys(options.sort).sort().map((k) =>
            `${k}:${
              (options.sort as Record<string, 1 | -1 | "asc" | "desc">)[k]
            }`
          ).join(",");
        parts.push(`s:${sortStr}`);
      }
      if (options.skip !== undefined) {
        parts.push(`sk:${options.skip}`);
      }
      if (options.limit !== undefined) {
        parts.push(`l:${options.limit}`);
      }
    }

    // 软删除选项
    if (includeTrashed) {
      parts.push("it:1");
    }
    if (onlyTrashed) {
      parts.push("ot:1");
    }

    return parts.join("|");
  }

  /**
   * 清除模型相关缓存
   * @returns Promise<void>
   */
  private static async clearCache(): Promise<void> {
    if (this.cacheAdapter) {
      const result = this.cacheAdapter.deleteByTags([
        `model:${this.tableName}`,
      ]);
      if (result instanceof Promise) {
        await result;
      }
    }
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
        `Failed to initialize model ${this.tableName}: ${message}. Please ensure the database connection is initialized first using initDatabase() or initDatabaseFromConfig().`,
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
    if (this._adapter) return;
    await this.ensureInitialized(connectionName);
    if (!this.adapter) {
      throw new Error(
        "Database adapter not set. Please call Model.setAdapter() or ensure database is initialized.",
      );
    }
  }

  /**
   * 将查询条件对象转换为 SQL WHERE 子句
   * @param condition 查询条件对象
   * @returns SQL WHERE 子句和参数数组
   */
  private static buildWhereClause(
    condition: WhereCondition | number | string,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): { where: string; params: any[] } {
    // 如果是数字或字符串，作为主键查询
    if (typeof condition === "number" || typeof condition === "string") {
      const adapter = (this as any).adapter as
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
        if (onlyTrashed) {
          conditions.push(`${escapedDeletedAtField} IS NOT NULL`);
        } else if (!includeTrashed) {
          conditions.push(`${escapedDeletedAtField} IS NULL`);
        }
      }

      return {
        where: conditions.join(" AND "),
        params,
      };
    }

    // 如果是对象，构建 WHERE 子句
    const conditions: string[] = [];
    const params: any[] = [];

    const adapter = (this as any).adapter as DatabaseAdapter | null | undefined;
    for (const [key, value] of Object.entries(condition)) {
      const escapedKey = SQLModel.escapeFieldName.call(this, key, adapter);
      if (value === null || value === undefined) {
        conditions.push(`${escapedKey} IS NULL`);
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // 处理操作符
        if (value.$gt !== undefined) {
          conditions.push(`${escapedKey} > ?`);
          params.push(value.$gt);
        }
        if (value.$lt !== undefined) {
          conditions.push(`${escapedKey} < ?`);
          params.push(value.$lt);
        }
        if (value.$gte !== undefined) {
          conditions.push(`${escapedKey} >= ?`);
          params.push(value.$gte);
        }
        if (value.$lte !== undefined) {
          conditions.push(`${escapedKey} <= ?`);
          params.push(value.$lte);
        }
        if (value.$ne !== undefined) {
          conditions.push(`${escapedKey} != ?`);
          params.push(value.$ne);
        }
        if (value.$in !== undefined && Array.isArray(value.$in)) {
          const placeholders = value.$in.map(() => "?").join(", ");
          conditions.push(`${escapedKey} IN (${placeholders})`);
          params.push(...value.$in);
        }
        if (value.$like !== undefined) {
          conditions.push(`${escapedKey} LIKE ?`);
          params.push(value.$like);
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
      if (onlyTrashed) {
        conditions.push(`${escapedDeletedAtField} IS NOT NULL`);
      } else if (!includeTrashed) {
        conditions.push(`${escapedDeletedAtField} IS NULL`);
      }
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
    const adapter = (this as any).adapter as DatabaseAdapter | null | undefined;
    const parts: string[] = [];
    for (const [field, dir] of Object.entries(normalized)) {
      const escapedField = SQLModel.escapeFieldName.call(this, field, adapter);
      parts.push(`${escapedField} ${dir}`);
    }
    return parts.join(", ");
  }

  /**
   * 处理字段（应用默认值、类型转换、验证）
   * @param data 原始数据
   * @returns 处理后的数据
   */
  private static processFields(data: Record<string, any>): Record<string, any> {
    const schema = (this as any).schema;
    if (!schema) {
      return data;
    }

    const processed: Record<string, any> = { ...data };

    // 遍历 schema 中定义的字段（使用缓存的键，减少 Object.entries() 开销）
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const field = schema[fieldName] as FieldDefinition;
      const value = processed[fieldName];

      // 应用默认值
      if (value === undefined && field.default !== undefined) {
        processed[fieldName] = typeof field.default === "function"
          ? field.default()
          : field.default;
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
    // 快速检查：键的数量是否变化
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    if (beforeKeys.length !== afterKeys.length) {
      return true;
    }

    // 浅比较：只比较第一层属性（使用引用相等，快速比较）
    // 注意：对于对象和数组，只比较引用，不进行深度比较（性能考虑）
    for (const key of beforeKeys) {
      if (before[key] !== after[key]) {
        return true;
      }
    }

    // 检查是否有新增的键（如果键数量相同，通常不会有新增）
    // 但为了安全起见，仍然检查
    for (const key of afterKeys) {
      if (!(key in before)) {
        return true;
      }
    }

    return false;
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
    const dbType = (adapter as any)?.config?.type;
    // 根据数据库类型转义字段名
    if (dbType === "postgresql" && /[A-Z]/.test(fieldName)) {
      // PostgreSQL 需要为包含大写字母的字段名加双引号
      return `"${fieldName}"`;
    } else if (dbType === "mysql") {
      // MySQL/MariaDB 使用反引号包裹字段名（避免保留字和特殊字符问题）
      return `\`${fieldName}\``;
    }
    return fieldName;
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
    // 检测数据库类型
    const dbType = (adapter as any)?.config?.type;

    // MySQL/MariaDB 的 DATETIME 类型默认不支持毫秒，使用 YYYY-MM-DD HH:MM:SS 格式
    if (dbType === "mysql") {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    // PostgreSQL 和 SQLite 也使用相同格式以保持一致性
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
    const schema = (this as any).schema;
    const processed: Record<string, any> = { ...data };

    // 获取适配器以确定数据库类型
    const adapter = (this as any).adapter as DatabaseAdapter | null | undefined;

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
    const schema = (this as any).schema;
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
            const adapter = (this as any).adapter as
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
    const adapter = (this as any).adapter as DatabaseAdapter | null | undefined;
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
    const schema = (this as any).schema;
    if (!schema) {
      return;
    }

    // 合并验证循环：在一次遍历中完成同步和异步验证
    // 收集异步验证任务，最后并行执行
    const asyncValidations: Promise<void>[] = [];

    // 使用缓存的键，减少 Object.entries() 开销
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const field = schema[fieldName] as FieldDefinition;
      const value = data[fieldName];

      // 检查验证组
      if (groups && field.validate?.groups) {
        const hasGroup = field.validate.groups.some((g) => groups.includes(g));
        if (!hasGroup) {
          continue; // 跳过不在指定组中的字段
        }
      }

      // 同步验证（字段级别的验证）
      SQLModel.validateField.call(this, fieldName, value, field, data);

      // 收集异步验证任务
      if (value !== null && value !== undefined && value !== "") {
        asyncValidations.push(
          SQLModel.validateFieldAsync.call(
            this,
            fieldName,
            value,
            field,
            data,
            instanceId,
          ),
        );
      }
    }

    // 并行执行所有异步验证（如果可能）
    if (asyncValidations.length > 0) {
      await Promise.all(asyncValidations);
    }
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
    const rule = fieldDef.validate;
    if (!rule) {
      return;
    }

    // 条件验证：检查是否应该验证此字段
    if (rule.when) {
      const shouldValidate = this.checkWhenCondition(rule.when, allValues);
      if (!shouldValidate) {
        return; // 条件不满足，跳过验证
      }
    }

    // 条件必填验证
    let isRequired = rule.required || false;
    if (rule.requiredWhen) {
      const shouldBeRequired = this.checkWhenCondition(
        rule.requiredWhen,
        allValues,
      );
      if (shouldBeRequired) {
        isRequired = true;
      }
    }

    // 必填验证
    if (isRequired && (value === null || value === undefined || value === "")) {
      throw new ValidationError(
        fieldName,
        rule.message || `${fieldName} 是必填字段`,
      );
    }

    // 如果值为空且不是必填，跳过其他验证
    if (value === null || value === undefined || value === "") {
      return;
    }

    // 格式验证（内置格式验证器）
    if (rule.format) {
      this.validateFormat(fieldName, value, rule.format, rule.message);
    }

    // 类型验证
    if (rule.type) {
      const expectedType = rule.type;
      const actualType = typeof value;
      if (expectedType === "array" && !Array.isArray(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是数组类型`,
        );
      }
      if (
        expectedType === "object" &&
        (actualType !== "object" || Array.isArray(value) || value === null)
      ) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是对象类型`,
        );
      }
      if (
        expectedType !== "array" && expectedType !== "object" &&
        actualType !== expectedType
      ) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是 ${expectedType} 类型`,
        );
      }
    }

    // 长度验证（字符串或数组）
    if (rule.length !== undefined) {
      const len = Array.isArray(value) ? value.length : String(value).length;
      if (len !== rule.length) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 长度必须是 ${rule.length}`,
        );
      }
    }

    // 最小值/最大长度验证
    if (rule.min !== undefined) {
      if (typeof value === "number") {
        if (value < rule.min) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 必须大于等于 ${rule.min}`,
          );
        }
      } else {
        const len = Array.isArray(value) ? value.length : String(value).length;
        if (len < rule.min) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 长度必须大于等于 ${rule.min}`,
          );
        }
      }
    }

    // 最大值/最大长度验证
    if (rule.max !== undefined) {
      if (typeof value === "number") {
        if (value > rule.max) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 必须小于等于 ${rule.max}`,
          );
        }
      } else {
        const len = Array.isArray(value) ? value.length : String(value).length;
        if (len > rule.max) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 长度必须小于等于 ${rule.max}`,
          );
        }
      }
    }

    // 正则表达式验证
    if (rule.pattern) {
      const regex = rule.pattern instanceof RegExp
        ? rule.pattern
        : new RegExp(rule.pattern);
      if (!regex.test(String(value))) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 格式不正确`,
        );
      }
    }

    // 数值验证增强
    if (typeof value === "number") {
      // 整数验证
      if (rule.integer && !Number.isInteger(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是整数`,
        );
      }

      // 正数验证
      if (rule.positive && value <= 0) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是正数`,
        );
      }

      // 负数验证
      if (rule.negative && value >= 0) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是负数`,
        );
      }

      // 倍数验证
      if (rule.multipleOf !== undefined) {
        if (value % rule.multipleOf !== 0) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 必须是 ${rule.multipleOf} 的倍数`,
          );
        }
      }

      // 范围验证
      if (rule.range) {
        const [min, max] = rule.range;
        if (value < min || value > max) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} 必须在 ${min} 到 ${max} 之间`,
          );
        }
      }
    }

    // 字符串验证增强
    if (typeof value === "string") {
      // 字符类型验证
      if (rule.alphanumeric && !/^[a-zA-Z0-9]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 只能包含字母和数字`,
        );
      }

      if (rule.numeric && !/^[0-9]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 只能包含数字`,
        );
      }

      if (rule.alpha && !/^[a-zA-Z]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 只能包含字母`,
        );
      }

      // 大小写验证
      if (rule.lowercase && value !== value.toLowerCase()) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是小写`,
        );
      }

      if (rule.uppercase && value !== value.toUpperCase()) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须是大写`,
        );
      }

      // 字符串包含验证
      if (rule.startsWith !== undefined && !value.startsWith(rule.startsWith)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须以 "${rule.startsWith}" 开头`,
        );
      }

      if (rule.endsWith !== undefined && !value.endsWith(rule.endsWith)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须以 "${rule.endsWith}" 结尾`,
        );
      }

      if (rule.contains !== undefined && !value.includes(rule.contains)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须包含 "${rule.contains}"`,
        );
      }

      // 字符串处理（自动转换，修改 allValues）
      if (rule.trim) {
        allValues[fieldName] = value.trim();
      }
      if (rule.toLowerCase) {
        allValues[fieldName] = value.toLowerCase();
      }
      if (rule.toUpperCase) {
        allValues[fieldName] = value.toUpperCase();
      }
    }

    // 日期/时间验证增强
    if (value instanceof Date || typeof value === "string") {
      let dateValue: Date | null = null;
      if (value instanceof Date) {
        dateValue = value;
      } else if (typeof value === "string") {
        // 尝试解析日期字符串
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          dateValue = parsed;
        }
      }

      if (dateValue) {
        // 日期比较
        if (rule.before !== undefined) {
          const beforeDate = rule.before instanceof Date
            ? rule.before
            : new Date(rule.before);
          if (dateValue >= beforeDate) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} 必须早于 ${rule.before}`,
            );
          }
        }

        if (rule.after !== undefined) {
          const afterDate = rule.after instanceof Date
            ? rule.after
            : new Date(rule.after);
          if (dateValue <= afterDate) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} 必须晚于 ${rule.after}`,
            );
          }
        }

        // 时间比较（只比较时间部分，忽略日期）
        if (rule.beforeTime !== undefined) {
          const timeValue = dateValue.getHours() * 3600 +
            dateValue.getMinutes() * 60 +
            dateValue.getSeconds();
          const [hours, minutes, seconds] = rule.beforeTime.split(":").map(
            Number,
          );
          const beforeTimeValue = (hours || 0) * 3600 + (minutes || 0) * 60 +
            (seconds || 0);
          if (timeValue >= beforeTimeValue) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} 必须早于 ${rule.beforeTime}`,
            );
          }
        }

        if (rule.afterTime !== undefined) {
          const timeValue = dateValue.getHours() * 3600 +
            dateValue.getMinutes() * 60 +
            dateValue.getSeconds();
          const [hours, minutes, seconds] = rule.afterTime.split(":").map(
            Number,
          );
          const afterTimeValue = (hours || 0) * 3600 + (minutes || 0) * 60 +
            (seconds || 0);
          if (timeValue <= afterTimeValue) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} 必须晚于 ${rule.afterTime}`,
            );
          }
        }
      }
    }

    // 密码强度验证
    if (rule.passwordStrength && typeof value === "string") {
      const options = rule.passwordStrength;
      if (options.minLength && value.length < options.minLength) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} 长度必须至少 ${options.minLength} 个字符`,
        );
      }
      if (options.requireUppercase && !/[A-Z]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须包含至少一个大写字母`,
        );
      }
      if (options.requireLowercase && !/[a-z]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须包含至少一个小写字母`,
        );
      }
      if (options.requireNumbers && !/[0-9]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须包含至少一个数字`,
        );
      }
      if (options.requireSymbols && !/[^a-zA-Z0-9]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} 必须包含至少一个特殊字符`,
        );
      }
    }

    // 枚举验证
    if (rule.enum && !rule.enum.includes(value)) {
      throw new ValidationError(
        fieldName,
        rule.message || `${fieldName} 必须是以下之一: ${rule.enum.join(", ")}`,
      );
    }

    // 数组验证
    if (rule.array) {
      this.validateArray(fieldName, value, rule.array, allValues);
    }

    // 跨字段验证：equals（与另一个字段值相等）
    if (rule.equals) {
      const otherValue = allValues[rule.equals];
      if (value !== otherValue) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} 必须与 ${rule.equals} 相等`,
        );
      }
    }

    // 跨字段验证：notEquals（与另一个字段值不相等）
    if (rule.notEquals) {
      const otherValue = allValues[rule.notEquals];
      if (value === otherValue) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} 不能与 ${rule.notEquals} 相等`,
        );
      }
    }

    // 跨字段验证：compare（自定义比较函数）
    if (rule.compare) {
      const result = rule.compare(value, allValues);
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string" ? result : `${fieldName} 验证失败`),
        );
      }
    }

    // 自定义验证
    if (rule.custom) {
      const result = rule.custom(value);
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string" ? result : `${fieldName} 验证失败`),
        );
      }
    }
  }

  /**
   * 验证单个字段（异步验证，用于数据库查询）
   */
  private static async validateFieldAsync(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition,
    _allValues: Record<string, any>,
    instanceId?: any,
  ): Promise<void> {
    const rule = fieldDef.validate;
    if (!rule) {
      return;
    }

    // 如果值为空，跳过数据库查询验证
    if (value === null || value === undefined || value === "") {
      return;
    }

    // 唯一性验证（unique）
    if (rule.unique) {
      await this.validateUnique(
        fieldName,
        value,
        rule.unique === true ? {} : rule.unique,
        instanceId,
      );
    }

    // 存在性验证（exists）
    if (rule.exists) {
      await this.validateExists(
        fieldName,
        value,
        rule.exists === true ? {} : rule.exists,
      );
    }

    // 不存在性验证（notExists）
    if (rule.notExists) {
      await this.validateNotExists(
        fieldName,
        value,
        rule.notExists === true ? {} : rule.notExists,
      );
    }

    // 跨表/跨字段值比较验证（compareValue）
    if (rule.compareValue) {
      await this.validateCompareValue(
        fieldName,
        value,
        rule.compareValue,
        instanceId,
        _allValues,
      );
    }

    // 异步自定义验证
    if (rule.asyncCustom) {
      const result = await rule.asyncCustom(value, _allValues, {
        fieldName,
        instanceId,
        model: this as typeof SQLModel,
      });
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string" ? result : `${fieldName} 验证失败`),
        );
      }
    }
  }

  /**
   * 检查条件验证条件
   */
  private static checkWhenCondition(
    when: {
      field: string;
      is?: any;
      isNot?: any;
      check?: (value: any, allValues: Record<string, any>) => boolean;
    },
    allValues: Record<string, any>,
  ): boolean {
    const conditionValue = allValues[when.field];

    if (when.check) {
      return when.check(conditionValue, allValues);
    }

    if (when.is !== undefined) {
      return conditionValue === when.is;
    }

    if (when.isNot !== undefined) {
      return conditionValue !== when.isNot;
    }

    return false;
  }

  /**
   * 验证格式
   */
  private static validateFormat(
    fieldName: string,
    value: any,
    format:
      | "email"
      | "url"
      | "ip"
      | "ipv4"
      | "ipv6"
      | "uuid"
      | "date"
      | "datetime"
      | "time",
    message?: string,
  ): void {
    const strValue = String(value);
    let isValid = false;

    switch (format) {
      case "email":
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue);
        break;
      case "url":
        try {
          new URL(strValue);
          isValid = true;
        } catch {
          isValid = false;
        }
        break;
      case "ip":
      case "ipv4":
        isValid = /^(\d{1,3}\.){3}\d{1,3}$/.test(strValue) &&
          strValue.split(".").every((n) => {
            const num = parseInt(n, 10);
            return num >= 0 && num <= 255;
          });
        break;
      case "ipv6":
        isValid = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(strValue) ||
          /^::1$/.test(strValue) ||
          /^::$/.test(strValue);
        break;
      case "uuid":
        isValid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(strValue);
        break;
      case "date":
        isValid = !isNaN(Date.parse(strValue));
        break;
      case "datetime":
        isValid = !isNaN(Date.parse(strValue));
        break;
      case "time":
        isValid = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(strValue);
        break;
    }

    if (!isValid) {
      throw new ValidationError(
        fieldName,
        message || `${fieldName} 格式不正确（期望格式: ${format}）`,
      );
    }
  }

  /**
   * 验证数组
   */
  private static validateArray(
    fieldName: string,
    value: any,
    arrayRule: {
      type?: FieldType;
      min?: number;
      max?: number;
      length?: number;
      items?: ValidationRule;
      uniqueItems?: boolean;
    },
    allValues: Record<string, any>,
  ): void {
    if (!Array.isArray(value)) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 必须是数组类型`,
      );
    }

    // 数组长度验证
    if (arrayRule.length !== undefined && value.length !== arrayRule.length) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 数组长度必须是 ${arrayRule.length}`,
      );
    }

    if (arrayRule.min !== undefined && value.length < arrayRule.min) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 数组长度必须大于等于 ${arrayRule.min}`,
      );
    }

    if (arrayRule.max !== undefined && value.length > arrayRule.max) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 数组长度必须小于等于 ${arrayRule.max}`,
      );
    }

    // 数组元素唯一性验证
    if (arrayRule.uniqueItems) {
      const seen = new Set();
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        // 使用 JSON.stringify 来比较对象和数组
        const key = typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item);
        if (seen.has(key)) {
          throw new ValidationError(
            fieldName,
            `${fieldName} 数组元素必须唯一，发现重复元素`,
          );
        }
        seen.add(key);
      }
    }

    // 数组元素验证
    if (arrayRule.items || arrayRule.type) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];

        // 类型验证
        if (arrayRule.type) {
          const expectedType = arrayRule.type;
          const actualType = typeof item;
          if (expectedType === "array" && !Array.isArray(item)) {
            throw new ValidationError(
              `${fieldName}[${i}]`,
              `${fieldName}[${i}] 必须是数组类型`,
            );
          }
          if (
            expectedType !== "array" && expectedType !== "object" &&
            actualType !== expectedType
          ) {
            throw new ValidationError(
              `${fieldName}[${i}]`,
              `${fieldName}[${i}] 必须是 ${expectedType} 类型`,
            );
          }
        }

        // 元素验证规则
        if (arrayRule.items) {
          const itemFieldDef: FieldDefinition = {
            type: arrayRule.type || "any",
            validate: arrayRule.items,
          };
          this.validateField(`${fieldName}[${i}]`, item, itemFieldDef, {
            ...allValues,
            [fieldName]: value,
          });
        }
      }
    }
  }

  /**
   * 验证字段唯一性
   */
  private static async validateUnique(
    fieldName: string,
    value: any,
    options: {
      exclude?: Record<string, any>;
      where?: Record<string, any>;
    },
    instanceId?: any,
  ): Promise<void> {
    await this.ensureAdapter();

    const tableName = (this as any).tableName;
    if (!tableName) {
      throw new Error("表名未定义");
    }

    // 构建查询条件
    const where: Record<string, any> = {
      [fieldName]: value,
      ...(options.where || {}),
    };

    // 排除当前记录（用于更新操作）
    if (instanceId !== undefined) {
      const primaryKey = (this as any).primaryKey || "id";
      where[primaryKey] = { $ne: instanceId };
    }

    // 如果有额外的排除条件，合并到 where 中
    if (options.exclude) {
      Object.assign(where, options.exclude);
    }

    // 查询是否存在
    const exists = await (this as any).query().where(where).exists();
    if (exists) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 已存在，必须是唯一的`,
      );
    }
  }

  /**
   * 验证字段在数据表中存在
   */
  private static async validateExists(
    fieldName: string,
    value: any,
    options: {
      table?: string;
      where?: Record<string, any>;
    },
  ): Promise<void> {
    await this.ensureAdapter();

    const tableName = options.table || (this as any).tableName;
    if (!tableName) {
      throw new Error("表名未定义");
    }

    // 构建查询条件
    // 如果 where 条件中包含 id 且值为 null，表示需要替换为实际值
    const where: Record<string, any> = {
      ...(options.where || {}),
    };
    // 如果 where 中没有指定字段，使用 fieldName: value
    // 但如果 where 中指定了主键字段（id），则使用主键字段
    if (where.id === null) {
      // 如果 where.id 为 null，表示需要替换为实际值
      where.id = value;
    } else if (!where.id && !where[fieldName]) {
      where[fieldName] = value;
    }

    // 查询是否存在（需要切换到目标表）
    const ModelClass = this as any;
    const originalTable = ModelClass.tableName;
    ModelClass.tableName = tableName;
    try {
      const exists = await ModelClass.query().where(where).exists();
      if (!exists) {
        throw new ValidationError(
          fieldName,
          `${fieldName} 在数据表中不存在`,
        );
      }
    } finally {
      // 恢复原始表名
      ModelClass.tableName = originalTable;
    }
  }

  /**
   * 验证字段在数据表中不存在
   */
  private static async validateNotExists(
    fieldName: string,
    value: any,
    options: {
      table?: string;
      where?: Record<string, any>;
    },
  ): Promise<void> {
    await this.ensureAdapter();

    const tableName = options.table || (this as any).tableName;
    if (!tableName) {
      throw new Error("表名未定义");
    }

    // 构建查询条件
    const where: Record<string, any> = {
      [fieldName]: value,
      ...(options.where || {}),
    };

    // 查询是否存在
    const exists = await (this as any).query().where(where).exists();
    if (exists) {
      throw new ValidationError(
        fieldName,
        `${fieldName} 在数据表中已存在`,
      );
    }
  }

  /**
   * 验证跨表/跨字段值比较
   */
  private static async validateCompareValue(
    fieldName: string,
    value: any,
    options: {
      targetField: string;
      targetModel?: typeof SQLModel;
      compare?: "=" | ">" | "<" | ">=" | "<=";
      where?: Record<string, any>;
    },
    instanceId?: any,
    allValues?: Record<string, any>,
  ): Promise<void> {
    await this.ensureAdapter();

    // 确定目标模型（如果未指定，使用当前模型）
    const TargetModel = (options.targetModel || this) as typeof SQLModel;
    await TargetModel.ensureAdapter();

    let targetValue: any;

    // 如果是同表比较（未指定 targetModel）且是创建新记录（instanceId 为空），从 allValues 中获取
    if (!options.targetModel && !instanceId && allValues) {
      targetValue = allValues[options.targetField];
      if (targetValue === undefined) {
        throw new ValidationError(
          fieldName,
          `${fieldName} 验证失败：未找到目标字段 ${options.targetField}`,
        );
      }
    } else {
      // 构建查询条件
      const where: Record<string, any> = {
        ...(options.where || {}),
      };

      // 如果是同表比较且是更新记录，使用 instanceId 作为查询条件
      if (!options.targetModel && instanceId) {
        where[this.primaryKey] = instanceId;
      }

      // 查询目标字段的值
      const targetRecord = await TargetModel.query()
        .where(where)
        .fields([options.targetField])
        .findOne();

      if (!targetRecord) {
        throw new ValidationError(
          fieldName,
          `${fieldName} 验证失败：未找到目标记录`,
        );
      }

      targetValue = (targetRecord as any)[options.targetField];
    }

    // 根据比较操作符进行验证
    const compare = options.compare || "=";
    let isValid = false;

    switch (compare) {
      case "=":
        isValid = value === targetValue;
        break;
      case ">":
        isValid = value > targetValue;
        break;
      case "<":
        isValid = value < targetValue;
        break;
      case ">=":
        isValid = value >= targetValue;
        break;
      case "<=":
        isValid = value <= targetValue;
        break;
    }

    if (!isValid) {
      const operatorText = {
        "=": "等于",
        ">": "大于",
        "<": "小于",
        ">=": "大于等于",
        "<=": "小于等于",
      }[compare];
      throw new ValidationError(
        fieldName,
        `${fieldName} 必须${operatorText} ${options.targetField} (${targetValue})`,
      );
    }
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
      _condition: WhereCondition | number | string;
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
    },
  ): SQLArrayQueryBuilder<T> {
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
      findAll: async (): Promise<Record<string, any>[]> => {
        await this.ensureAdapter();
        const state = getState();
        const { where, params } = this.buildWhereClause(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const adapter = (this as any).adapter as
          | DatabaseAdapter
          | null
          | undefined;
        const columns = state._fields && state._fields.length > 0
          ? state._fields.map((f) =>
            SQLModel.escapeFieldName.call(this, f, adapter)
          )
            .join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(state._sort);
        const useLimit = typeof state._limit === "number";
        const useSkip = typeof state._skip === "number";
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
          ...params,
          ...extraParams,
        ]);
        // 返回纯 JSON 对象数组，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        return results.map((row: any) => ({ ...row }));
      },
      findOne: async (): Promise<Record<string, any> | null> => {
        await this.ensureAdapter();
        const state = getState();
        const { where, params } = this.buildWhereClause(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const adapter = (this as any).adapter as
          | DatabaseAdapter
          | null
          | undefined;
        const columns = state._fields && state._fields.length > 0
          ? state._fields.map((f) =>
            SQLModel.escapeFieldName.call(this, f, adapter)
          )
            .join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(state._sort);
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        sql = `${sql} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        // 返回纯 JSON 对象，不创建模型实例
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        return { ...results[0] };
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
        const { where, params } = this.buildWhereClause(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const sql =
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        return results.length > 0 ? (parseInt(results[0].count) || 0) : 0;
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        const state = getState();
        return await this.exists(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const state = getState();
        const cond = typeof state._condition === "number" ||
            typeof state._condition === "string"
          ? { [this.primaryKey]: state._condition }
          : (state._condition as any);
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
        // 使用链式查询构建器中已有的条件、排序、字段等设置
        const paginateResult = await this.paginate(
          state._condition as any,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          state._fields,
          state._includeTrashed,
          state._onlyTrashed,
        );
        // 将数据转换为纯 JSON 对象数组
        // 使用展开运算符创建新对象，移除原型链，性能优于 JSON.parse(JSON.stringify())
        return {
          ...paginateResult,
          data: paginateResult.data.map((item: any) => ({ ...item })),
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
    condition: WhereCondition | number | string,
    fields?: string[],
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
    options?: {
      sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
    },
  ): SQLFindQueryBuilder<T> {
    // 创建共享状态对象，确保 asArray() 中的修改能够持久化
    const state = {
      _condition: condition as WhereCondition | number | string,
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
    };

    // 执行查询单条记录的函数
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      // 自动初始化（如果未初始化）
      await this.ensureAdapter();

      // 生成缓存键（条件生成：只在有缓存适配器时才生成）
      const cacheKey = this.generateCacheKey(
        state._condition,
        state._fields,
        { sort: state._sort, skip: state._skip, limit: state._limit },
        state._includeTrashed,
        state._onlyTrashed,
      );

      // 尝试从缓存获取
      if (cacheKey && this.cacheAdapter) {
        const cached = this.cacheAdapter.get(cacheKey);
        const cachedValue = cached instanceof Promise ? await cached : cached;
        if (cachedValue !== undefined) {
          const instance = new (this as any)();
          Object.assign(instance, cachedValue);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        }
      }

      const { where, params } = this.buildWhereClause(
        state._condition,
        state._includeTrashed,
        state._onlyTrashed,
      );
      const adapter = (this as any).adapter as
        | DatabaseAdapter
        | null
        | undefined;
      const columns = state._fields && state._fields.length > 0
        ? state._fields.map((f) =>
          SQLModel.escapeFieldName.call(this, f, adapter)
        )
          .join(", ")
        : "*";
      const orderBy = this.buildOrderByClause(state._sort);
      let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
        ...params,
        ...extraParams,
      ]);

      if (results.length === 0) {
        return null;
      }

      const instance = new (this as any)();
      Object.assign(instance, results[0]);

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

      return instance as InstanceType<T>;
    };

    // 执行查询多条的函数
    const executeFindAll = async (): Promise<InstanceType<T>[]> => {
      await this.ensureAdapter();

      // 生成缓存键（条件生成：只在有缓存适配器时才生成）
      const cacheKey = this.generateCacheKey(
        state._condition,
        state._fields,
        { sort: state._sort, skip: state._skip, limit: state._limit },
        state._includeTrashed,
        state._onlyTrashed,
      );

      // 尝试从缓存获取
      if (cacheKey && this.cacheAdapter) {
        const cached = this.cacheAdapter.get(cacheKey);
        const cachedValue = cached instanceof Promise ? await cached : cached;
        if (cachedValue !== undefined && Array.isArray(cachedValue)) {
          return cachedValue.map((row: any) => {
            const instance = new (this as any)();
            Object.assign(instance, row);
            // 应用虚拟字段
            this.applyVirtuals(instance);
            return instance as InstanceType<T>;
          });
        }
      }

      const { where, params } = this.buildWhereClause(
        state._condition,
        state._includeTrashed,
        state._onlyTrashed,
      );
      const adapter = (this as any).adapter as
        | DatabaseAdapter
        | null
        | undefined;
      const columns = state._fields && state._fields.length > 0
        ? state._fields.map((f) =>
          SQLModel.escapeFieldName.call(this, f, adapter)
        )
          .join(", ")
        : "*";
      const orderBy = this.buildOrderByClause(state._sort);
      const useLimit = typeof state._limit === "number";
      const useSkip = typeof state._skip === "number";
      let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
        ...params,
        ...extraParams,
      ]);

      const instances = results.map((row: any) => {
        const instance = new (this as any)();
        Object.assign(instance, row);
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

      return instances;
    };

    // 创建 Promise（用于直接 await）
    const queryPromise = executeFindOne();

    // 构建查询构建器对象
    const builder: SQLFindQueryBuilder<T> = {
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
        return this.createArrayQueryBuilder(() => state);
      },
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const sql =
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length > 0) {
          return parseInt(results[0].count) || 0;
        }
        return 0;
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        return await this.exists(
          state._condition,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const cond =
          typeof state._condition === "number" ||
            typeof state._condition === "string"
            ? { [this.primaryKey]: state._condition }
            : (state._condition as any);
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
        // 使用链式查询构建器中已有的条件、排序、字段等设置
        return await this.paginate(
          state._condition as any,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          state._fields,
          state._includeTrashed,
          state._onlyTrashed,
        );
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

    return builder as any;
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
    condition: WhereCondition = {},
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
          const instance = new (this as any)();
          Object.assign(instance, row);
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
    let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
      const instance = new (this as any)();
      Object.assign(instance, row);
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
      throw new Error(`Scope "${scopeName}" is not defined`);
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

    // 处理字段（应用默认值、类型转换、验证）
    // 注意：这里先不序列化，因为钩子可能需要访问原始对象/数组
    const processedData = this.processFields(data);

    // 自动时间戳
    if (this.timestamps) {
      const createdAtField = typeof this.timestamps === "object"
        ? (this.timestamps.createdAt || "createdAt")
        : "createdAt";
      const updatedAtField = typeof this.timestamps === "object"
        ? (this.timestamps.updatedAt || "updatedAt")
        : "updatedAt";

      if (!processedData[createdAtField]) {
        processedData[createdAtField] = new Date();
      }
      if (!processedData[updatedAtField]) {
        processedData[updatedAtField] = new Date();
      }

      // 将 Date 对象转换为 ISO 字符串（SQLite 需要字符串格式）
      // 注意：这里先不转换，让 serializeFields 统一处理
    }

    // 创建临时实例用于钩子
    const tempInstance = new (this as any)();
    Object.assign(tempInstance, processedData);

    // beforeValidate 钩子
    if (this.beforeValidate) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.beforeValidate(tempInstance);
      if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
        Object.assign(processedData, tempInstance);
      }
    }

    // 验证数据（包括跨字段验证和数据库查询验证）
    await SQLModel.validate.call(this, processedData);

    // afterValidate 钩子
    if (this.afterValidate) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.afterValidate(tempInstance);
      if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
        Object.assign(processedData, tempInstance);
      }
    }

    // beforeCreate 钩子
    if (this.beforeCreate) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.beforeCreate(tempInstance);
      if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
        Object.assign(processedData, tempInstance);
      }
    }

    // beforeSave 钩子
    if (this.beforeSave) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.beforeSave(tempInstance);
      if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
        Object.assign(processedData, tempInstance);
      }
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

    let sql = `INSERT INTO ${this.tableName} (${
      escapedKeys.join(", ")
    }) VALUES (${placeholders})`;
    if ((this.adapter as any)?.config?.type === "postgresql") {
      const escapedPrimaryKey = SQLModel.escapeFieldName.call(
        this,
        this.primaryKey,
        this.adapter,
      );
      sql = `${sql} RETURNING ${escapedPrimaryKey}`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    const execResult = await this.adapter.execute(sql, values);

    let insertedId: any = null;
    if (
      execResult && typeof execResult === "object" && "insertId" in execResult
    ) {
      insertedId = (execResult as any).insertId ?? null;
    }
    if (
      !insertedId && execResult && typeof execResult === "object" &&
      "rows" in execResult
    ) {
      const rows = (execResult as any).rows;
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
    const instance = new (this as any)();
    Object.assign(instance, processedData);
    if (insertedId) {
      (instance as any)[this.primaryKey] = insertedId;
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
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
      const checkSql = `SELECT 1 FROM ${this.tableName} WHERE ${where} LIMIT 1`;
      const checkResult = await this.adapter.query(checkSql, whereParams);
      if (
        !checkResult || (Array.isArray(checkResult) && checkResult.length === 0)
      ) {
        return 0;
      }
    }

    // 处理字段（应用默认值、类型转换、验证）
    const processedData = this.processFields(data);

    // 自动时间戳
    if (this.timestamps) {
      const updatedAtField = typeof this.timestamps === "object"
        ? (this.timestamps.updatedAt || "updatedAt")
        : "updatedAt";
      processedData[updatedAtField] = new Date();
    }

    // 创建临时实例用于钩子（直接合并，避免额外的展开操作）
    const tempInstance = new (this as any)();
    if (existingInstance) {
      Object.assign(tempInstance, existingInstance);
    }
    Object.assign(tempInstance, processedData);

    // 钩子和验证处理（如果启用）
    // 注意：只有当 enableHooks 或 enableValidation 为 true 时才进入此块
    if (enableHooks || enableValidation) {
      // beforeValidate 钩子（只有启用钩子时才执行）
      if (enableHooks && this.beforeValidate) {
        // 性能优化：检测钩子是否修改了数据，只在有变化时合并
        const beforeSnapshot = { ...tempInstance };
        await this.beforeValidate(tempInstance);
        if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
          // 合并钩子修改的字段，但排除非数据库字段（如 hookData）和主键字段
          // 只合并被钩子修改的字段（通过比较 beforeSnapshot 和 tempInstance）
          const primaryKey = (this as any).primaryKey || "id";
          // 先合并 processedData 中已存在的字段
          for (const key in processedData) {
            if (
              key in tempInstance && key !== "hookData" && key !== primaryKey
            ) {
              processedData[key] = tempInstance[key];
            }
          }
          // 然后合并 existingInstance 中被钩子修改的字段（但不在 processedData 中）
          if (existingInstance) {
            for (const key in existingInstance) {
              // 只合并被修改的字段（在 tempInstance 中但不在 beforeSnapshot 中，或者值不同）
              if (
                key !== "hookData" &&
                key !== primaryKey &&
                !(key in processedData) &&
                key in tempInstance &&
                tempInstance[key] !== beforeSnapshot[key]
              ) {
                processedData[key] = tempInstance[key];
              }
            }
          }
        }
      }

      // 验证数据（包括跨字段验证和数据库查询验证）
      // 传递当前记录的 ID，用于唯一性验证时排除当前记录
      if (enableValidation) {
        const primaryKey = (this as any).primaryKey || "id";
        const instanceId = existingInstance
          ? (existingInstance as any)[primaryKey]
          : undefined;
        // 如果跳过预查询，instanceId 为 undefined，唯一性验证可能不准确
        // 因此建议在跳过预查询时确保没有唯一性验证
        await SQLModel.validate.call(this, processedData, instanceId);
      }

      // afterValidate 钩子
      if (enableHooks && this.afterValidate) {
        // 性能优化：检测钩子是否修改了数据，只在有变化时合并
        const beforeSnapshot = { ...tempInstance };
        await this.afterValidate(tempInstance);
        if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
          // 合并钩子修改的字段，但排除非数据库字段（如 hookData）和主键字段
          // 只合并被钩子修改的字段（通过比较 beforeSnapshot 和 tempInstance）
          const primaryKey = (this as any).primaryKey || "id";
          // 先合并 processedData 中已存在的字段
          for (const key in processedData) {
            if (
              key in tempInstance && key !== "hookData" && key !== primaryKey
            ) {
              processedData[key] = tempInstance[key];
            }
          }
          // 然后合并 existingInstance 中被钩子修改的字段（但不在 processedData 中）
          if (existingInstance) {
            for (const key in existingInstance) {
              // 只合并被修改的字段（在 tempInstance 中但不在 beforeSnapshot 中，或者值不同）
              if (
                key !== "hookData" &&
                key !== primaryKey &&
                !(key in processedData) &&
                key in tempInstance &&
                tempInstance[key] !== beforeSnapshot[key]
              ) {
                processedData[key] = tempInstance[key];
              }
            }
          }
        }
      }

      // beforeUpdate 钩子
      if (enableHooks && this.beforeUpdate) {
        // 性能优化：检测钩子是否修改了数据，只在有变化时合并
        const beforeSnapshot = { ...tempInstance };
        await this.beforeUpdate(tempInstance);
        if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
          // 合并钩子修改的字段，但排除非数据库字段（如 hookData）和主键字段
          // 只合并被钩子修改的字段（通过比较 beforeSnapshot 和 tempInstance）
          const primaryKey = (this as any).primaryKey || "id";
          // 先合并 processedData 中已存在的字段
          for (const key in processedData) {
            if (
              key in tempInstance && key !== "hookData" && key !== primaryKey
            ) {
              processedData[key] = tempInstance[key];
            }
          }
          // 然后合并 existingInstance 中被钩子修改的字段（但不在 processedData 中）
          if (existingInstance) {
            for (const key in existingInstance) {
              // 只合并被修改的字段（在 tempInstance 中但不在 beforeSnapshot 中，或者值不同）
              if (
                key !== "hookData" &&
                key !== primaryKey &&
                !(key in processedData) &&
                key in tempInstance &&
                tempInstance[key] !== beforeSnapshot[key]
              ) {
                processedData[key] = tempInstance[key];
              }
            }
          }
        }
      }

      // beforeSave 钩子
      if (enableHooks && this.beforeSave) {
        // 性能优化：检测钩子是否修改了数据，只在有变化时合并
        const beforeSnapshot = { ...tempInstance };
        await this.beforeSave(tempInstance);
        if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
          // 合并钩子修改的字段，但排除非数据库字段（如 hookData）和主键字段
          // 只合并被钩子修改的字段（通过比较 beforeSnapshot 和 tempInstance）
          const primaryKey = (this as any).primaryKey || "id";
          // 先合并 processedData 中已存在的字段
          for (const key in processedData) {
            if (
              key in tempInstance && key !== "hookData" && key !== primaryKey
            ) {
              processedData[key] = tempInstance[key];
            }
          }
          // 然后合并 existingInstance 中被钩子修改的字段（但不在 processedData 中）
          if (existingInstance) {
            for (const key in existingInstance) {
              // 只合并被修改的字段（在 tempInstance 中但不在 beforeSnapshot 中，或者值不同）
              if (
                key !== "hookData" &&
                key !== primaryKey &&
                !(key in processedData) &&
                key in tempInstance &&
                tempInstance[key] !== beforeSnapshot[key]
              ) {
                processedData[key] = tempInstance[key];
              }
            }
          }
        }
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

    let sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${where}`;
    const dbType = (this.adapter as any)?.config?.type;
    const isPostgres = dbType === "postgresql";
    const isMySQL = dbType === "mysql";
    const isSQLite = dbType === "sqlite";

    // 如果 returnLatest 为 true，尝试使用 RETURNING 子句获取更新后的值
    if (returnLatest && (isPostgres || isMySQL || isSQLite)) {
      sql = `${sql} RETURNING *`;
    } else if (isPostgres) {
      // PostgreSQL 默认使用 RETURNING *（即使不返回实例，也用于钩子）
      sql = `${sql} RETURNING *`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    let result: any;
    try {
      result = await this.adapter.execute(sql, [
        ...values,
        ...whereParams,
      ]);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 MySQL/SQLite），回退到不使用 RETURNING
      if (returnLatest && (isMySQL || isSQLite)) {
        sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${where}`;
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
        ? ((result as any).affectedRows || 0)
        : 0);

    if (affectedRows > 0) {
      let updatedInstance: any | null = null;
      if (
        isPostgres &&
        result && typeof result === "object" && "rows" in result
      ) {
        // PostgreSQL 使用 RETURNING 返回的行
        const rows = (result as any).rows as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          const instance = new (this as any)();
          Object.assign(instance, rows[0]);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          updatedInstance = instance;
        }
      } else if (returnLatest) {
        // MySQL/SQLite 可能不支持 RETURNING 或返回格式不同，需要重新查询
        // 从条件中获取主键值
        const primaryKey = (this as any).primaryKey || "id";
        let primaryKeyValue: any;
        if (typeof condition === "number" || typeof condition === "string") {
          primaryKeyValue = condition;
        } else if (condition && typeof condition === "object") {
          primaryKeyValue = (condition as any)[primaryKey];
        }

        if (primaryKeyValue) {
          // 重新查询数据库获取最新数据
          const latest = await this.find(primaryKeyValue);
          if (latest) {
            updatedInstance = latest;
          } else {
            // 如果查询失败，使用合并后的数据
            const instance = new (this as any)();
            if (existingInstance) {
              Object.assign(instance, existingInstance, processedData);
            } else {
              Object.assign(instance, processedData);
            }
            // 应用虚拟字段
            this.applyVirtuals(instance);
            updatedInstance = instance;
          }
        } else {
          // 无法获取主键值，使用合并后的数据
          const instance = new (this as any)();
          if (existingInstance) {
            Object.assign(instance, existingInstance, processedData);
          } else {
            Object.assign(instance, processedData);
          }
          // 应用虚拟字段
          this.applyVirtuals(instance);
          updatedInstance = instance;
        }
      } else {
        // 不需要返回实例，但需要创建实例用于钩子
        const instance = new (this as any)();
        if (existingInstance) {
          Object.assign(instance, existingInstance, processedData);
        } else {
          Object.assign(instance, processedData);
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
    condition: WhereCondition | number | string,
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
        `UPDATE ${this.tableName} SET ${escapedDeletedAtField} = ? WHERE ${where}`;
      // ensureAdapter() 已确保 adapter 不为 null
      const result = await this.adapter.execute(sql, [
        deletedAtValue,
        ...params,
      ]);
      const affectedRows = (typeof result === "number")
        ? result
        : ((result && typeof result === "object" && "affectedRows" in result)
          ? ((result as any).affectedRows || 0)
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
    const sql = `DELETE FROM ${this.tableName} WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, params);

    // 返回影响的行数（如果适配器支持）
    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? ((result as any).affectedRows || 0)
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

    const primaryKey = (Model.constructor as any).primaryKey || "id";
    const id = (this as any)[primaryKey];

    if (id) {
      // 更新现有记录
      // 将实例对象转换为普通数据对象，排除主键字段
      const data: Record<string, any> = {};
      // 使用 Object.keys 避免 hasOwnProperty 的问题
      const keys = Object.keys(this);
      for (const key of keys) {
        if (key !== primaryKey) {
          const value = (this as any)[key];
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
          `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
        );
      }
      Object.assign(this, updated);
      return this;
    } else {
      // 插入新记录
      const instance = await Model.create(this);
      Object.assign(this, instance);
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

    const primaryKey = (Model.constructor as any).primaryKey || "id";
    const id = (this as any)[primaryKey];

    if (!id) {
      throw new Error("Cannot update instance without primary key");
    }

    // 使用 returnLatest 选项直接获取更新后的数据，避免额外的查询
    const updated = await Model.update(id, data, true);
    if (!updated) {
      throw new Error(
        `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
      );
    }
    Object.assign(this, updated);
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

    const primaryKey = (Model.constructor as any).primaryKey || "id";
    const id = (this as any)[primaryKey];

    if (!id) {
      throw new Error("Cannot delete instance without primary key");
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 如果需要返回 ID，先查询符合条件的记录
    if (options?.returnIds) {
      const conditionObj =
        typeof condition === "number" || typeof condition === "string"
          ? { [this.primaryKey]: condition }
          : condition;
      const records = await this.findAll(conditionObj);
      const primaryKey = (this as any).primaryKey || "id";
      const ids = records.map((record) => (record as any)[primaryKey]);
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
    condition: WhereCondition = {},
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
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
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
    condition: WhereCondition | number | string,
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
      `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE ${where}) as result`;
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
        processedData = this.processFields(data);

        // 自动时间戳
        if (this.timestamps) {
          const createdAtField = typeof this.timestamps === "object"
            ? (this.timestamps.createdAt || "createdAt")
            : "createdAt";
          const updatedAtField = typeof this.timestamps === "object"
            ? (this.timestamps.updatedAt || "updatedAt")
            : "updatedAt";
          if (!processedData[createdAtField]) {
            processedData[createdAtField] = new Date();
          }
          if (!processedData[updatedAtField]) {
            processedData[updatedAtField] = new Date();
          }
        }

        // 钩子处理（如果启用）
        if (enableHooks) {
          const tempInstance = new (this as any)();
          Object.assign(tempInstance, processedData);
          // 保存原始数据的键，用于过滤钩子添加的非数据库字段
          const originalKeys = new Set(Object.keys(processedData));
          if (this.beforeValidate) {
            await this.beforeValidate(tempInstance);
            // 只合并钩子修改的、在原始数据中存在的字段（避免钩子添加的非数据库字段）
            const schema = (this as any).schema;
            if (schema) {
              const schemaKeys = this.getSchemaKeys();
              for (const key of schemaKeys) {
                if (key in tempInstance && originalKeys.has(key)) {
                  processedData[key] = tempInstance[key];
                }
              }
            } else {
              // 即使没有 schema，也只合并原始数据中存在的字段
              for (const key of originalKeys) {
                if (key in tempInstance) {
                  processedData[key] = tempInstance[key];
                }
              }
            }
          }
          if (this.afterValidate) {
            await this.afterValidate(tempInstance);
            // 只合并钩子修改的、在原始数据中存在的字段（避免钩子添加的非数据库字段）
            const schema = (this as any).schema;
            if (schema) {
              const schemaKeys = this.getSchemaKeys();
              for (const key of schemaKeys) {
                if (key in tempInstance && originalKeys.has(key)) {
                  processedData[key] = tempInstance[key];
                }
              }
            } else {
              // 即使没有 schema，也只合并原始数据中存在的字段
              for (const key of originalKeys) {
                if (key in tempInstance) {
                  processedData[key] = tempInstance[key];
                }
              }
            }
          }
          if (this.beforeCreate) {
            await this.beforeCreate(tempInstance);
            // 只合并钩子修改的、在原始数据中存在的字段（避免钩子添加的非数据库字段）
            const schema = (this as any).schema;
            if (schema) {
              const schemaKeys = this.getSchemaKeys();
              for (const key of schemaKeys) {
                if (key in tempInstance && originalKeys.has(key)) {
                  processedData[key] = tempInstance[key];
                }
              }
            } else {
              // 即使没有 schema，也只合并原始数据中存在的字段
              for (const key of originalKeys) {
                if (key in tempInstance) {
                  processedData[key] = tempInstance[key];
                }
              }
            }
          }
          if (this.beforeSave) {
            await this.beforeSave(tempInstance);
            // 只合并钩子修改的、在原始数据中存在的字段（避免钩子添加的非数据库字段）
            const schema = (this as any).schema;
            if (schema) {
              const schemaKeys = this.getSchemaKeys();
              for (const key of schemaKeys) {
                if (key in tempInstance && originalKeys.has(key)) {
                  processedData[key] = tempInstance[key];
                }
              }
            } else {
              // 即使没有 schema，也只合并原始数据中存在的字段
              for (const key of originalKeys) {
                if (key in tempInstance) {
                  processedData[key] = tempInstance[key];
                }
              }
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

    let sql = `INSERT INTO ${this.tableName} (${
      escapedKeys.join(", ")
    }) VALUES ${valuesList}`;
    const dbType = (this.adapter as any)?.config?.type;
    const isPostgres = dbType === "postgresql";
    const isMySQL = dbType === "mysql";
    const isSQLite = dbType === "sqlite";

    // 尝试使用 RETURNING 子句获取插入的 ID（MySQL 8.0+ 和 SQLite 3.35.0+ 支持）
    // 注意：这里假设数据库版本支持 RETURNING，如果失败会回退到其他方式
    if (isPostgres || isMySQL || isSQLite) {
      sql = `${sql} RETURNING ${escapedPrimaryKey}`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    let execResult: any;
    try {
      execResult = await this.adapter.execute(sql, allValues);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 MySQL/SQLite），回退到不使用 RETURNING
      if (isMySQL || isSQLite) {
        sql = `INSERT INTO ${this.tableName} (${
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
      const rows = (execResult as any).rows;
      if (Array.isArray(rows) && rows.length === processedArray.length) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = new (this as any)();
          Object.assign(instance, processedArray[idx]);
          const idVal = rows[idx]?.[this.primaryKey] ?? rows[idx]?.id ?? null;
          if (idVal != null) {
            (instance as any)[this.primaryKey] = idVal;
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
      const firstInsertId = (execResult as any).insertId ?? null;
      if (firstInsertId != null) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = new (this as any)();
          Object.assign(instance, processedArray[idx]);
          (instance as any)[this.primaryKey] = firstInsertId + idx;
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
      const lastInsertRowid = (execResult as any).lastInsertRowid ?? null;
      if (lastInsertRowid != null) {
        for (let idx = 0; idx < processedArray.length; idx++) {
          const instance = new (this as any)();
          Object.assign(instance, processedArray[idx]);
          (instance as any)[this.primaryKey] = lastInsertRowid -
            (processedArray.length - 1 - idx);
          // 应用虚拟字段
          this.applyVirtuals(instance);
          instances.push(instance as InstanceType<T>);
        }
      }
    }

    // 如果无法获取 ID，直接使用处理后的数据创建实例
    if (instances.length === 0) {
      for (const data of processedArray) {
        const instance = new (this as any)();
        Object.assign(instance, data);
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
    condition: WhereCondition = {},
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

    let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
      const instance = new (this as any)();
      Object.assign(instance, row);
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
    condition: WhereCondition | number | string,
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

    let sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${where}`;
    const dbType = (this.adapter as any)?.config?.type;
    const isPostgres = dbType === "postgresql";
    const isSQLite = dbType === "sqlite";

    // 尝试使用 RETURNING 子句获取更新后的值
    // PostgreSQL 完全支持 RETURNING
    // MySQL 8.0.19+ 支持 RETURNING，但适配器需要特殊处理，所以这里不使用
    // SQLite 3.35.0+ 支持 RETURNING
    if (shouldReturnLatest && (isPostgres || isSQLite)) {
      sql = `${sql} RETURNING *`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    let result: any;
    try {
      result = await this.adapter.execute(sql, [...setParams, ...params]);
    } catch (error) {
      // 如果 RETURNING 不支持（旧版本 SQLite），回退到不使用 RETURNING
      if (shouldReturnLatest && isSQLite) {
        sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${where}`;
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
        return (result as any).affectedRows || 0;
      }
      return 0;
    }

    let instance: any | null = null;
    // 检查是否有 RETURNING 返回的数据
    const rows = result && typeof result === "object" && "rows" in result
      ? (result as any).rows as any[]
      : null;

    if (rows && Array.isArray(rows) && rows.length > 0) {
      // PostgreSQL/SQLite 使用 RETURNING 返回的行
      instance = new (this as any)();
      Object.assign(instance, rows[0]);
      // 应用虚拟字段
      this.applyVirtuals(instance);
    } else {
      // 不支持 RETURNING 或 RETURNING 失败（如 MySQL），使用 SELECT 查询获取更新后的值
      // 查询完整的记录以确保包含所有字段
      const selectSql =
        `SELECT * FROM ${this.tableName} WHERE ${where} LIMIT 1`;
      const selectResult = await this.adapter.query(selectSql, params);
      if (selectResult && selectResult.length > 0) {
        instance = new (this as any)();
        Object.assign(instance, selectResult[0]);
        // 应用虚拟字段
        this.applyVirtuals(instance);
      }
    }

    if (!instance) {
      throw new Error("无法获取更新后的记录");
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
    condition: WhereCondition | number | string,
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
      return await (this as any).increment(
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
      return await (this as any).increment(
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
    condition: WhereCondition | number | string,
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

    const sql = `UPDATE ${this.tableName} SET ${
      setClauses.join(", ")
    } WHERE ${where}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, [...setValues, ...params]);

    // 获取受影响的行数
    let affectedRows = 0;
    if (result && typeof result === "object") {
      if ("affectedRows" in result) {
        affectedRows = (result as any).affectedRows || 0;
      } else if ("rowCount" in result) {
        affectedRows = (result as any).rowCount || 0;
      } else if ("changes" in result) {
        affectedRows = (result as any).changes || 0;
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition,
    data: Record<string, any>,
    returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
    resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致（SQL 中此选项通常无效，但保留以统一接口）
    options?: { useDialectUpsert?: boolean; conflictKeys?: string[] },
  ): Promise<InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const useDialect = options?.useDialectUpsert ??
      ((this as any).useDialectUpsert === true);
    const type = (this.adapter as any)?.config?.type;
    const conflictKeys = options?.conflictKeys ??
      (this as any).upsertConflictKeys ??
      (typeof condition === "object" && !Array.isArray(condition)
        ? Object.keys(condition)
        : []);

    if (useDialect && type === "postgresql" && conflictKeys.length > 0) {
      try {
        // 如果 resurrect 为 true，先检查并恢复已软删除的记录
        if (resurrect && this.softDelete) {
          const existing = await this.withTrashed().find(condition);
          if (existing) {
            const id = (existing as any)[this.primaryKey];
            const deletedAtField = this.deletedAtField || "deletedAt";
            if (id && (existing as any)[deletedAtField]) {
              await this.restore(id);
            }
          }
        }
        const processedData = this.processFields(data);
        if (this.timestamps) {
          const updatedAtField = typeof this.timestamps === "object"
            ? (this.timestamps.updatedAt || "updatedAt")
            : "updatedAt";
          processedData[updatedAtField] = new Date();
        }
        if (typeof condition === "object" && condition) {
          for (const k of conflictKeys) {
            if (
              processedData[k] === undefined &&
              (condition as any)[k] !== undefined
            ) {
              const v = (condition as any)[k];
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
        const placeholders = keys.map(() => "?").join(", ");
        const updateSet = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
        const sql = `INSERT INTO ${this.tableName} (${
          keys.join(", ")
        }) VALUES (${placeholders}) ON CONFLICT (${
          conflictKeys.join(", ")
        }) DO UPDATE SET ${updateSet} RETURNING *`;
        // ensureAdapter() 已确保 adapter 不为 null
        const result = await this.adapter.execute(sql, values);
        if (result && typeof result === "object" && "rows" in result) {
          const rows = (result as any).rows as any[];
          if (Array.isArray(rows) && rows.length > 0) {
            const instance = new (this as any)();
            Object.assign(instance, rows[0]);
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

    if (useDialect && type === "mysql") {
      // 如果 resurrect 为 true，先检查并恢复已软删除的记录
      if (resurrect && this.softDelete) {
        const existing = await this.withTrashed().find(condition);
        if (existing) {
          const id = (existing as any)[this.primaryKey];
          const deletedAtField = this.deletedAtField || "deletedAt";
          if (id && (existing as any)[deletedAtField]) {
            await this.restore(id);
          }
        }
      }
      const processedData = this.processFields(data);
      if (this.timestamps) {
        const updatedAtField = typeof this.timestamps === "object"
          ? (this.timestamps.updatedAt || "updatedAt")
          : "updatedAt";
        processedData[updatedAtField] = new Date();
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
      const placeholders = keys.map(() => "?").join(", ");
      const updateSet = keys.map((k) => `${k} = VALUES(${k})`).join(", ");
      const sql = `INSERT INTO ${this.tableName} (${
        keys.join(", ")
      }) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSet}`;
      // ensureAdapter() 已确保 adapter 不为 null
      const result = await this.adapter.execute(sql, values);
      const instance = new (this as any)();
      Object.assign(instance, processedData);
      if (result && typeof result === "object" && "insertId" in result) {
        const insertedId = (result as any).insertId ?? null;
        if (insertedId != null) {
          (instance as any)[this.primaryKey] = insertedId;
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
        const id = (existing as any)[this.primaryKey];
        if (id) {
          const deletedAtField = this.deletedAtField || "deletedAt";
          if ((existing as any)[deletedAtField]) {
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
    condition: WhereCondition = {},
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
      `SELECT DISTINCT ${field} FROM ${this.tableName} WHERE ${where}`;
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
        condition: WhereCondition = {},
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
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
          const instance = new (this as any)();
          Object.assign(instance, row);
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
          `SELECT ${columns} FROM ${this.tableName} WHERE ${where} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
        return instance as InstanceType<T>;
      },
      count: async (condition: WhereCondition = {}): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, true, false);
        const sql =
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length > 0) {
          return parseInt(results[0].count) || 0;
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
        condition: WhereCondition = {},
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
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
          const instance = new (this as any)();
          Object.assign(instance, row);
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
          `SELECT ${columns} FROM ${this.tableName} WHERE ${where} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
        return instance as InstanceType<T>;
      },
      count: async (condition: WhereCondition = {}): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(condition, false, true);
        const sql =
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length > 0) {
          return parseInt(results[0].count) || 0;
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
    const state = {
      _condition: {} as WhereCondition | number | string,
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
    };

    const builder = {
      where: (condition: WhereCondition | number | string) => {
        state._condition = condition;
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
      findAll: async (): Promise<InstanceType<T>[]> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          state._condition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = state._fields && state._fields.length > 0
          ? state._fields.join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(state._sort);
        const useLimit = typeof state._limit === "number";
        const useSkip = typeof state._skip === "number";
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
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
          ...params,
          ...extraParams,
        ]);
        return results.map((row: any) => {
          const instance = new (this as any)();
          Object.assign(instance, row);
          return instance as InstanceType<T>;
        });
      },
      findOne: async (): Promise<InstanceType<T> | null> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          state._condition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const columns = state._fields && state._fields.length > 0
          ? state._fields.join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(state._sort);
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        sql = `${sql} LIMIT 1`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        if (results.length === 0) {
          return null;
        }
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
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
        return await this.findById(id, fields);
      },
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          state._condition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
        const sql =
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
        // ensureAdapter() 已确保 adapter 不为 null
        const results = await this.adapter.query(sql, params);
        return results.length > 0 ? (parseInt(results[0].count) || 0) : 0;
      },
      exists: async (): Promise<boolean> => {
        await this.ensureAdapter();
        return await this.exists(
          state._condition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      update: async (
        data: Record<string, any>,
        returnLatest: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<number | InstanceType<T>> => {
        if (returnLatest) {
          return await this.update(
            state._condition as any,
            data,
            true,
          ) as InstanceType<T>;
        }
        return await this.update(
          state._condition as any,
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
        return await this.updateMany(state._condition as any, data);
      },
      increment: async (
        field: string,
        amount: number = 1,
        returnLatest: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<number | InstanceType<T>> => {
        return await this.increment(
          state._condition as any,
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
        return await this.decrement(
          state._condition as any,
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
        return await this.deleteMany(state._condition as any, options);
      },
      restore: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        return await this.restore(state._condition as any, options);
      },
      restoreById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.restoreById(id);
      },
      forceDelete: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        return await this.forceDelete(state._condition as any, options);
      },
      forceDeleteById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.forceDeleteById(id);
      },
      distinct: async (field: string): Promise<any[]> => {
        const cond =
          typeof state._condition === "number" ||
            typeof state._condition === "string"
            ? { [this.primaryKey]: state._condition }
            : (state._condition as any);
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
        return await this.upsert(
          state._condition as any,
          data,
          returnLatest,
          resurrect,
        );
      },
      findOrCreate: async (
        data: Record<string, any>,
        resurrect: boolean = false, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T>> => {
        const cond =
          typeof state._condition === "number" ||
            typeof state._condition === "string"
            ? { [this.primaryKey]: state._condition }
            : (state._condition as any);
        return await this.findOrCreate(cond, data, resurrect);
      },
      findOneAndUpdate: async (
        data: Record<string, any>,
        options?: { returnDocument?: "before" | "after" }, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T> | null> => {
        return await this.findOneAndUpdate(
          state._condition as any,
          data,
          options ?? { returnDocument: "after" },
        );
      },
      findOneAndDelete: async (): Promise<InstanceType<T> | null> => {
        const existing = await this.find(
          state._condition as any,
          state._fields,
          state._includeTrashed,
          state._onlyTrashed,
        );
        if (!existing) return null;
        const deleted = await this.delete(state._condition as any);
        return deleted > 0 ? existing as InstanceType<T> : null;
      },
      findOneAndReplace: async (
        replacement: Record<string, any>,
        returnLatest: boolean = true, // 统一接口：与 MongoModel 保持一致
      ): Promise<InstanceType<T> | null> => {
        return await (this as typeof SQLModel).findOneAndReplace(
          state._condition as any,
          replacement,
          returnLatest,
        ) as InstanceType<T> | null;
      },
      incrementMany: async (
        fieldOrMap: string | Record<string, number>,
        amount: number = 1,
      ): Promise<number> => {
        return await this.incrementMany(
          state._condition as any,
          fieldOrMap,
          amount,
        );
      },
      decrementMany: async (
        fieldOrMap: string | Record<string, number>,
        amount: number = 1,
      ): Promise<number> => {
        return await this.decrementMany(
          state._condition as any,
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
        return await this.paginate(
          state._condition as any,
          page,
          pageSize,
          state._sort || { [this.primaryKey]: -1 },
          state._fields,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
    };

    return builder as any;
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
    condition: WhereCondition | number | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    if (!this.softDelete) {
      throw new Error("Soft delete is not enabled for this model");
    }
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, true, true);

    let ids: any[] = [];
    if (options?.returnIds) {
      // ensureAdapter() 已确保 adapter 不为 null
      const rows = await this.adapter.query(
        `SELECT ${this.primaryKey} FROM ${this.tableName} WHERE ${where}`,
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
      `UPDATE ${this.tableName} SET ${escapedDeletedAtField} = NULL WHERE ${where}`,
      params,
    );

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? ((result as any).affectedRows || 0)
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
    condition: WhereCondition | number | string,
    options?: { returnIds?: boolean },
  ): Promise<number | { count: number; ids: any[] }> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, true, false);

    let ids: any[] = [];
    if (options?.returnIds) {
      // ensureAdapter() 已确保 adapter 不为 null
      const rows = await this.adapter.query(
        `SELECT ${this.primaryKey} FROM ${this.tableName} WHERE ${where}`,
        params,
      );
      ids = rows.map((r: any) => r[this.primaryKey]).filter((v: any) =>
        v !== null && v !== undefined
      );
    }

    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(
      `DELETE FROM ${this.tableName} WHERE ${where}`,
      params,
    );

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? ((result as any).affectedRows || 0)
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
        const id = (existing as any)[this.primaryKey];
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
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
    condition: WhereCondition | number | string,
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

    // SQLite 不支持 TRUNCATE TABLE，需要使用 DELETE FROM
    // 对于 SQLite，还需要重置自增计数器（如果表有自增主键）
    // 通过适配器的 config.type 来判断数据库类型
    const adapterConfig = (this.adapter as any).config;
    const isSQLite = adapterConfig?.type === "sqlite";
    let sql: string;

    if (isSQLite) {
      // SQLite 使用 DELETE FROM 清空表
      sql = `DELETE FROM ${this.tableName}`;
    } else {
      // 其他数据库使用 TRUNCATE TABLE
      sql = `TRUNCATE TABLE ${this.tableName}`;
    }

    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, []);

    // 如果是 SQLite 且有自增主键，重置自增计数器
    if (isSQLite) {
      try {
        // 尝试重置自增计数器（sqlite_sequence 表存储自增序列）
        await this.adapter.execute(
          `DELETE FROM sqlite_sequence WHERE name = ?`,
          [this.tableName],
        );
      } catch {
        // 如果表没有自增主键或 sqlite_sequence 表不存在，忽略错误
      }
    }

    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? ((result as any).affectedRows || 0)
        : 0);

    return affectedRows;
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
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const relatedKey = localKey || RelatedModel.primaryKey;
    const foreignValue = (this as any)[foreignKey];

    if (!foreignValue) {
      return null;
    }

    return await RelatedModel.find(
      { [relatedKey]: foreignValue },
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
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const localKeyValue = localKey || Model.primaryKey;
    const localValue = (this as any)[localKeyValue];

    if (!localValue) {
      return null;
    }

    return await RelatedModel.find(
      { [foreignKey]: localValue },
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
    // 自动初始化（如果未初始化）
    await Model.ensureAdapter();

    const localKeyValue = localKey || Model.primaryKey;
    const localValue = (this as any)[localKeyValue];

    if (!localValue) {
      return [];
    }

    return await RelatedModel.findAll(
      { [foreignKey]: localValue },
      fields,
      options,
      includeTrashed,
      onlyTrashed,
    );
  }
}
