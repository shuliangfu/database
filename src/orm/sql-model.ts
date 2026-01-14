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
  findById: (
    id: number | string,
    fields?: string[],
  ) => Promise<InstanceType<T> | null>;
  count: () => Promise<number>;
  exists: () => Promise<boolean>;
  update: (data: Record<string, any>) => Promise<number>;
  updateById: (
    id: number | string,
    data: Record<string, any>,
  ) => Promise<number>;
  updateMany: (data: Record<string, any>) => Promise<number>;
  increment: (field: string, amount?: number) => Promise<number>;
  decrement: (field: string, amount?: number) => Promise<number>;
  deleteById: (id: number | string) => Promise<number>;
  deleteMany: () => Promise<number>;
  restore: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  forceDelete: (
    options?: { returnIds?: boolean },
  ) => Promise<number | { count: number; ids: any[] }>;
  distinct: (field: string) => Promise<any[]>;
  upsert: (data: Record<string, any>) => Promise<InstanceType<T>>;
  findOrCreate: (data: Record<string, any>) => Promise<InstanceType<T>>;
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
    // 创建查询构建器状态
    const _condition: WhereCondition | number | string = condition;
    let _fields: string[] | undefined = fields;
    let _sort:
      | Record<string, 1 | -1 | "asc" | "desc">
      | "asc"
      | "desc"
      | undefined = options?.sort;
    let _skip: number | undefined;
    let _limit: number | undefined;
    let _includeTrashed = includeTrashed;
    let _onlyTrashed = onlyTrashed;

    // 执行查询单条记录的函数
    const executeFindOne = async (): Promise<InstanceType<T> | null> => {
      // 自动初始化（如果未初始化）
      await this.ensureAdapter();

      // 生成缓存键（条件生成：只在有缓存适配器时才生成）
      const cacheKey = this.generateCacheKey(
        _condition,
        _fields,
        { sort: _sort, skip: _skip, limit: _limit },
        _includeTrashed,
        _onlyTrashed,
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
        _condition,
        _includeTrashed,
        _onlyTrashed,
      );
      const adapter = (this as any).adapter as
        | DatabaseAdapter
        | null
        | undefined;
      const columns = _fields && _fields.length > 0
        ? _fields.map((f) => SQLModel.escapeFieldName.call(this, f, adapter))
          .join(", ")
        : "*";
      const orderBy = this.buildOrderByClause(_sort);
      let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
      if (orderBy) {
        sql = `${sql} ORDER BY ${orderBy}`;
      }
      const extraParams: any[] = [];
      if (typeof _limit === "number") {
        sql = `${sql} LIMIT ?`;
        extraParams.push(Math.max(1, Math.floor(_limit)));
      } else {
        sql = `${sql} LIMIT 1`;
      }
      if (typeof _limit === "number" && typeof _skip === "number") {
        sql = `${sql} OFFSET ?`;
        extraParams.push(Math.max(0, Math.floor(_skip)));
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
        _condition,
        _fields,
        { sort: _sort, skip: _skip, limit: _limit },
        _includeTrashed,
        _onlyTrashed,
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
        _condition,
        _includeTrashed,
        _onlyTrashed,
      );
      const adapter = (this as any).adapter as
        | DatabaseAdapter
        | null
        | undefined;
      const columns = _fields && _fields.length > 0
        ? _fields.map((f) => SQLModel.escapeFieldName.call(this, f, adapter))
          .join(", ")
        : "*";
      const orderBy = this.buildOrderByClause(_sort);
      const useLimit = typeof _limit === "number";
      const useSkip = typeof _skip === "number";
      let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
      if (orderBy) {
        sql = `${sql} ORDER BY ${orderBy}`;
      }
      const extraParams: any[] = [];
      if (useLimit) {
        sql = `${sql} LIMIT ?`;
        extraParams.push(Math.max(1, Math.floor(_limit!)));
      }
      if (useLimit && useSkip) {
        sql = `${sql} OFFSET ?`;
        extraParams.push(Math.max(0, Math.floor(_skip!)));
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
        _sort = sort;
        return builder;
      },
      skip: (n: number) => {
        _skip = Math.max(0, Math.floor(n));
        return builder;
      },
      limit: (n: number) => {
        _limit = Math.max(1, Math.floor(n));
        return builder;
      },
      fields: (fields: string[]) => {
        _fields = fields;
        return builder;
      },
      includeTrashed: () => {
        _includeTrashed = true;
        _onlyTrashed = false;
        return builder;
      },
      onlyTrashed: () => {
        _onlyTrashed = true;
        _includeTrashed = false;
        return builder;
      },
      findAll: () => executeFindAll(),
      findOne: () => executeFindOne(),
      one: () => executeFindOne(),
      all: () => executeFindAll(),
      count: async (): Promise<number> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          _condition,
          _includeTrashed,
          _onlyTrashed,
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
          _condition,
          _includeTrashed,
          _onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const cond =
          typeof _condition === "number" || typeof _condition === "string"
            ? { [this.primaryKey]: _condition }
            : (_condition as any);
        return await this.distinct(field, cond, _includeTrashed, _onlyTrashed);
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
          _condition as any,
          page,
          pageSize,
          _sort || { [this.primaryKey]: -1 },
          _fields,
          _includeTrashed,
          _onlyTrashed,
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
   * @param options 可选配置（性能优化：skipPreQuery 可跳过预查询，但需要确保没有钩子和验证）
   * @returns 更新的记录数
   *
   * @example
   * await User.update(1, { name: 'lisi' });
   * await User.update({ id: 1 }, { name: 'lisi' });
   * await User.update({ email: 'user@example.com' }, { name: 'lisi' });
   * // 性能优化：跳过预查询（仅当没有钩子和验证时使用）
   * await User.update(1, { name: 'lisi' }, { skipPreQuery: true });
   */
  static async update(
    condition: WhereCondition | number | string,
    data: Record<string, any>,
    options?: { skipPreQuery?: boolean },
  ): Promise<number> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    // 检查是否可以跳过预查询（性能优化）
    const skipPreQuery = options?.skipPreQuery === true;
    const hasHooks = !!(
      this.beforeValidate ||
      this.afterValidate ||
      this.beforeUpdate ||
      this.beforeSave ||
      this.afterUpdate ||
      this.afterSave
    );

    // 先查找要更新的记录（如果不需要钩子且明确指定跳过，可以跳过）
    let existingInstance: InstanceType<typeof SQLModel> | null = null;
    if (!skipPreQuery || hasHooks) {
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
    // 传递当前记录的 ID，用于唯一性验证时排除当前记录
    const primaryKey = (this as any).primaryKey || "id";
    const instanceId = existingInstance
      ? (existingInstance as any)[primaryKey]
      : undefined;
    // 如果跳过预查询，instanceId 为 undefined，唯一性验证可能不准确
    // 因此建议在跳过预查询时确保没有唯一性验证
    await SQLModel.validate.call(this, processedData, instanceId);

    // afterValidate 钩子
    if (this.afterValidate) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.afterValidate(tempInstance);
      if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
        Object.assign(processedData, tempInstance);
      }
    }

    // beforeUpdate 钩子
    if (this.beforeUpdate) {
      // 性能优化：检测钩子是否修改了数据，只在有变化时合并
      const beforeSnapshot = { ...tempInstance };
      await this.beforeUpdate(tempInstance);
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
    const isPostgres = (this.adapter as any)?.config?.type === "postgresql";
    if (isPostgres) {
      sql = `${sql} RETURNING *`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, [
      ...values,
      ...whereParams,
    ]);

    // 返回影响的行数（如果适配器支持）
    const affectedRows = (typeof result === "number")
      ? result
      : ((result && typeof result === "object" && "affectedRows" in result)
        ? ((result as any).affectedRows || 0)
        : 0);

    if (affectedRows > 0) {
      let updatedInstance: any | null = null;
      if (
        isPostgres && result && typeof result === "object" && "rows" in result
      ) {
        const rows = (result as any).rows as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          const instance = new (this as any)();
          Object.assign(instance, rows[0]);
          updatedInstance = instance;
        }
      } else {
        const instance = new (this as any)();
        if (existingInstance) {
          Object.assign(instance, existingInstance, processedData);
        } else {
          Object.assign(instance, processedData);
        }
        updatedInstance = instance;
      }
      if (updatedInstance) {
        if (this.afterUpdate) {
          await this.afterUpdate(updatedInstance);
        }
        if (this.afterSave) {
          await this.afterSave(updatedInstance);
        }
      }

      // 清除相关缓存
      await this.clearCache();
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

    // 先查找要删除的记录
    let instanceToDelete: InstanceType<typeof SQLModel> | null = null;
    if (typeof condition === "number" || typeof condition === "string") {
      instanceToDelete = await this.find(condition);
    } else {
      const results = await this.findAll(condition);
      instanceToDelete = results[0] || null;
    }

    if (!instanceToDelete) {
      return 0;
    }

    // beforeDelete 钩子
    if (this.beforeDelete) {
      await this.beforeDelete(instanceToDelete);
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
        await this.afterDelete(instanceToDelete);
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
        await this.afterDelete(instanceToDelete);
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
      // 检查更新是否成功（受影响的行数 > 0）
      const affectedRows = await Model.update(id, data);
      if (affectedRows === 0) {
        throw new Error(
          `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
        );
      }
      // 重新查询更新后的数据，确保获取最新状态
      const updated = await Model.find(id);
      if (!updated) {
        throw new Error(`更新后无法找到 ID 为 ${id} 的记录`);
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

    // 检查更新是否成功（受影响的行数 > 0）
    const affectedRows = await Model.update(id, data);
    if (affectedRows === 0) {
      throw new Error(
        `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
      );
    }
    // 重新查询更新后的数据，确保获取最新状态
    const updated = await Model.find(id);
    if (!updated) {
      throw new Error(`更新后无法找到 ID 为 ${id} 的记录`);
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
   * @returns 更新的记录数
   *
   * @example
   * await User.updateMany({ status: 'active' }, { lastLogin: new Date() });
   * await User.updateMany({ age: { $lt: 18 } }, { isMinor: true });
   */
  static async updateMany(
    condition: WhereCondition | number | string,
    data: Record<string, any>,
  ): Promise<number> {
    // updateMany 和 update 在 SQL 中逻辑相同，都是 UPDATE ... WHERE
    return await this.update(condition, data);
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
  ): Promise<number> {
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
   * @returns 创建的模型实例数组
   *
   * @example
   * const users = await User.createMany([
   *   { name: 'John', email: 'john@example.com' },
   *   { name: 'Jane', email: 'jane@example.com' }
   * ]);
   */
  static async createMany<T extends typeof SQLModel>(
    this: T,
    dataArray: Record<string, any>[],
  ): Promise<InstanceType<T>[]> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    if (dataArray.length === 0) {
      return [];
    }

    // 获取所有数据的键（假设所有对象有相同的键）
    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => "?").join(", ");

    // 构建批量插入 SQL
    const valuesList = dataArray.map(() => `(${placeholders})`).join(", ");
    const allValues = dataArray.flatMap((data) => keys.map((key) => data[key]));

    let sql = `INSERT INTO ${this.tableName} (${
      keys.join(", ")
    }) VALUES ${valuesList}`;
    const isPostgres = (this.adapter as any)?.config?.type === "postgresql";
    if (isPostgres) {
      sql = `${sql} RETURNING ${this.primaryKey}`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    const execResult = await this.adapter.execute(sql, allValues);

    // 尝试获取最后插入的 ID（如果支持）
    // 注意：批量插入时，不同数据库获取 ID 的方式不同
    // 这里简化处理，重新查询所有记录
    // 实际应用中可能需要根据业务逻辑优化
    if (
      isPostgres && execResult && typeof execResult === "object" &&
      "rows" in execResult
    ) {
      const rows = (execResult as any).rows;
      if (Array.isArray(rows) && rows.length === dataArray.length) {
        return dataArray.map((data, idx) => {
          const instance = new (this as any)();
          Object.assign(instance, data);
          const idVal = rows[idx]?.[this.primaryKey] ?? rows[idx]?.id ?? null;
          if (idVal != null) {
            (instance as any)[this.primaryKey] = idVal;
          }
          return instance as InstanceType<T>;
        });
      }
    }
    return dataArray.map((data) => {
      const instance = new (this as any)();
      Object.assign(instance, data);
      return instance as InstanceType<T>;
    });
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
   * @param field 要增加的字段名
   * @param amount 增加的数量（默认为 1）
   * @returns 更新的记录数
   *
   * @example
   * await User.increment(1, 'views', 1);
   * await User.increment({ status: 'active' }, 'score', 10);
   */
  static async increment<T extends typeof SQLModel>(
    this: T,
    condition: WhereCondition | number | string,
    field: string,
    amount: number = 1,
    returnLatest: boolean = false,
  ): Promise<number | InstanceType<T>> {
    // 自动初始化（如果未初始化）
    await this.ensureAdapter();

    const { where, params } = this.buildWhereClause(condition, false, false);
    let sql =
      `UPDATE ${this.tableName} SET ${field} = ${field} + ? WHERE ${where}`;
    const isPostgres = (this.adapter as any)?.config?.type === "postgresql";
    if (isPostgres && returnLatest) {
      sql = `${sql} RETURNING *`;
    }
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, [amount, ...params]);

    if (!returnLatest) {
      if (typeof result === "number") {
        return result;
      }
      if (result && typeof result === "object" && "affectedRows" in result) {
        return (result as any).affectedRows || 0;
      }
      return 0;
    }

    let instance: any | null = null;
    if (
      isPostgres && result && typeof result === "object" && "rows" in result
    ) {
      const rows = (result as any).rows as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        instance = new (this as any)();
        Object.assign(instance, rows[0]);
      }
    } else {
      const existing = await this.find(condition);
      if (existing) {
        instance = new (this as any)();
        Object.assign(instance, existing);
        const prevVal = (instance as any)[field];
        (instance as any)[field] = (typeof prevVal === "number" ? prevVal : 0) +
          amount;
      }
    }

    return instance as InstanceType<T>;
  }

  /**
   * 减少字段值
   * @param condition 查询条件（可以是 ID、条件对象）
   * @param field 要减少的字段名
   * @param amount 减少的数量（默认为 1）
   * @returns 更新的记录数
   *
   * @example
   * await User.decrement(1, 'views', 1);
   * await User.decrement({ status: 'active' }, 'score', 10);
   */
  static async decrement<T extends typeof SQLModel>(
    this: T,
    condition: WhereCondition | number | string,
    field: string,
    amount: number = 1,
    returnLatest: boolean = false,
  ): Promise<number | InstanceType<T>> {
    return await (this as any).increment(
      condition,
      field,
      -amount,
      returnLatest,
    );
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
            return instance as InstanceType<T>;
          }
        }
      } catch (_e) {
        void 0;
      }
    }

    if (useDialect && type === "mysql") {
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

    const existing = await this.withTrashed().find(condition);
    if (existing) {
      await this.update(condition, data);
      const updated = await this.find(condition);
      if (updated) {
        return updated as InstanceType<T>;
      }
    }
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
    let _condition: WhereCondition | number | string = {};
    let _fields: string[] | undefined;
    let _sort:
      | Record<string, 1 | -1 | "asc" | "desc">
      | "asc"
      | "desc"
      | undefined;
    let _skip: number | undefined;
    let _limit: number | undefined;
    let _includeTrashed = false;
    let _onlyTrashed = false;

    const builder = {
      where: (condition: WhereCondition | number | string) => {
        _condition = condition;
        return builder;
      },
      fields: (fields: string[]) => {
        _fields = fields;
        return builder;
      },
      sort: (
        sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc",
      ) => {
        _sort = sort;
        return builder;
      },
      skip: (n: number) => {
        _skip = Math.max(0, Math.floor(n));
        return builder;
      },
      limit: (n: number) => {
        _limit = Math.max(1, Math.floor(n));
        return builder;
      },
      includeTrashed: () => {
        _includeTrashed = true;
        _onlyTrashed = false;
        return builder;
      },
      onlyTrashed: () => {
        _onlyTrashed = true;
        _includeTrashed = false;
        return builder;
      },
      findAll: async (): Promise<InstanceType<T>[]> => {
        await this.ensureAdapter();
        const { where, params } = this.buildWhereClause(
          _condition as any,
          _includeTrashed,
          _onlyTrashed,
        );
        const columns = _fields && _fields.length > 0
          ? _fields.join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(_sort);
        const useLimit = typeof _limit === "number";
        const useSkip = typeof _skip === "number";
        let sql = `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`;
        if (orderBy) {
          sql = `${sql} ORDER BY ${orderBy}`;
        }
        const extraParams: any[] = [];
        if (useLimit) {
          sql = `${sql} LIMIT ?`;
          extraParams.push(Math.max(1, Math.floor(_limit!)));
        }
        if (useLimit && useSkip) {
          sql = `${sql} OFFSET ?`;
          extraParams.push(Math.max(0, Math.floor(_skip!)));
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
          _condition as any,
          _includeTrashed,
          _onlyTrashed,
        );
        const columns = _fields && _fields.length > 0
          ? _fields.join(", ")
          : "*";
        const orderBy = this.buildOrderByClause(_sort);
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
          _condition as any,
          _includeTrashed,
          _onlyTrashed,
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
          _condition as any,
          _includeTrashed,
          _onlyTrashed,
        );
      },
      update: async (data: Record<string, any>): Promise<number> => {
        return await this.update(_condition as any, data);
      },
      updateById: async (
        id: number | string,
        data: Record<string, any>,
      ): Promise<number> => {
        await this.ensureAdapter();
        return await this.updateById(id, data);
      },
      updateMany: async (data: Record<string, any>): Promise<number> => {
        return await this.updateMany(_condition as any, data);
      },
      increment: async (field: string, amount: number = 1): Promise<number> => {
        const res = await this.increment(
          _condition as any,
          field,
          amount,
          false,
        );
        return typeof res === "number" ? res : 1;
      },
      decrement: async (field: string, amount: number = 1): Promise<number> => {
        const res = await this.decrement(
          _condition as any,
          field,
          amount,
          false,
        );
        return typeof res === "number" ? res : 1;
      },
      deleteById: async (id: number | string): Promise<number> => {
        await this.ensureAdapter();
        return await this.deleteById(id);
      },
      deleteMany: async (): Promise<number> => {
        return await this.deleteMany(_condition as any);
      },
      restore: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        return await this.restore(_condition as any, options);
      },
      forceDelete: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        return await this.forceDelete(_condition as any, options);
      },
      distinct: async (field: string): Promise<any[]> => {
        const cond =
          typeof _condition === "number" || typeof _condition === "string"
            ? { [this.primaryKey]: _condition }
            : (_condition as any);
        return await this.distinct(field, cond, _includeTrashed, _onlyTrashed);
      },
      upsert: async (data: Record<string, any>): Promise<InstanceType<T>> => {
        return await this.upsert(_condition as any, data);
      },
      findOrCreate: async (
        data: Record<string, any>,
      ): Promise<InstanceType<T>> => {
        const cond =
          typeof _condition === "number" || typeof _condition === "string"
            ? { [this.primaryKey]: _condition }
            : (_condition as any);
        return await this.findOrCreate(cond, data);
      },
      findOneAndUpdate: async (
        data: Record<string, any>,
      ): Promise<InstanceType<T> | null> => {
        const updated = await this.update(_condition as any, data);
        if (updated > 0) {
          return await this.find(
            _condition as any,
            _fields,
            _includeTrashed,
            _onlyTrashed,
          );
        }
        return null;
      },
      findOneAndDelete: async (): Promise<InstanceType<T> | null> => {
        const existing = await this.find(
          _condition as any,
          _fields,
          _includeTrashed,
          _onlyTrashed,
        );
        if (!existing) return null;
        const deleted = await this.delete(_condition as any);
        return deleted > 0 ? existing as InstanceType<T> : null;
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
          _condition as any,
          page,
          pageSize,
          _sort || { [this.primaryKey]: -1 },
          _fields,
          _includeTrashed,
          _onlyTrashed,
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
  static async findOrCreate<T extends typeof SQLModel>(
    this: T,
    condition: WhereCondition,
    data: Record<string, any>,
  ): Promise<InstanceType<T>> {
    await this.ensureAdapter();

    // 先尝试查找
    const existing = await this.find(condition);
    if (existing) {
      return existing as InstanceType<T>;
    }

    // 如果不存在，创建新记录
    return await this.create(data);
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

    const sql = `TRUNCATE TABLE ${this.tableName}`;
    // ensureAdapter() 已确保 adapter 不为 null
    const result = await this.adapter.execute(sql, []);

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
    );
  }
}
