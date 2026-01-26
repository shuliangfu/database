/**
 * MongoDB 模型基类
 * 提供 ODM 功能，支持对象条件查询和字段投影
 */

import { ObjectId } from "mongodb";
import type { MongoDBAdapter } from "../adapters/mongodb.ts";
import type { CacheAdapter } from "../cache/cache-adapter.ts";
import type { DatabaseAdapter } from "../types.ts";
import type {
  CompoundIndex,
  GeospatialIndex,
  IndexDefinitions,
  IndexDirection,
  SingleFieldIndex,
  TextIndex,
} from "../types/index.ts";

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
    targetModel?: typeof MongoModel;
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
    /** 查询的集合名（可选，默认当前集合） */
    collection?: string;
    /** 查询条件（可选） */
    where?: Record<string, any>;
  };
  /** 在数据表中不存在（必须不存在） */
  notExists?: boolean | {
    /** 查询的集合名（可选，默认当前集合） */
    collection?: string;
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
      model: typeof MongoModel;
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

  // 密码强度验证
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
export type LifecycleHook<T = any> = (
  instance: T,
  options?: any,
) => Promise<void> | void;

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
  orWhere: (condition: MongoWhereCondition | string) => MongoFindQueryBuilder<T>;
  andWhere: (condition: MongoWhereCondition | string) => MongoFindQueryBuilder<T>;
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
      throw new Error(
        `Database adapter not initialized for model "${this.collectionName}". Please call 'await ${this.collectionName}.ensureInitialized()' or 'await ${this.collectionName}.init()' before accessing this property.`,
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
  private static _schemaKeysCache: Map<typeof MongoModel, string[]> = new Map();

  /**
   * 获取 Schema 键（带缓存）
   * 性能优化：缓存 schema 键，避免重复调用 Object.keys()
   * @returns Schema 字段名数组
   */
  private static getSchemaKeys(): string[] {
    const schema = this.schema;
    if (!schema) {
      return [];
    }

    // 检查缓存
    let keys = this._schemaKeysCache.get(this as typeof MongoModel);
    if (!keys) {
      // 计算并缓存
      keys = Object.keys(schema);
      this._schemaKeysCache.set(this as typeof MongoModel, keys);
    }

    return keys;
  }

  /**
   * 虚拟字段定义缓存（性能优化：避免重复遍历虚拟字段定义）
   * 键：模型类，值：虚拟字段定义数组 [name, getter][]
   */
  private static _virtualsCache = new WeakMap<
    typeof MongoModel,
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
    let cached = this._virtualsCache.get(this as typeof MongoModel);
    if (!cached) {
      // 计算并缓存
      cached = Object.entries(virtuals) as Array<
        [string, (instance: any) => any]
      >;
      this._virtualsCache.set(this as typeof MongoModel, cached);
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
   * 缓存键缓存（性能优化：避免重复生成相同的缓存键）
   * 键：序列化的参数，值：生成的缓存键
   */
  private static _cacheKeyCache = new WeakMap<
    typeof MongoModel,
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
    let cacheMap = this._cacheKeyCache.get(this as typeof MongoModel);
    if (!cacheMap) {
      cacheMap = new Map();
      this._cacheKeyCache.set(this as typeof MongoModel, cacheMap);
    }

    const cached = cacheMap.get(paramKey);
    if (cached !== undefined) {
      return cached;
    }

    // 快速字符串化条件（避免 JSON.stringify 开销）
    let conditionStr: string;
    if (typeof condition === "string") {
      conditionStr = condition;
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
      this.collectionName,
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
    const cacheKey = `model:${this.collectionName}:query:${parts.join(":")}`;

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
    // 快速序列化参数（用于缓存键查找）
    const parts: string[] = [];

    // 条件
    if (typeof condition === "string") {
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
      const tag = `model:${this.collectionName}`;
      const result = this.cacheAdapter.deleteByTags([tag]);
      await (result instanceof Promise ? result : Promise.resolve(result));
    }
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
    if (this._adapter) return;
    await this.ensureInitialized(connectionName);
    if (!this.adapter) {
      throw new Error(
        "Database adapter not set. Please call Model.setAdapter() or ensure database is initialized.",
      );
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

    // 必填验证（优先检查字段定义中的 required，然后是验证规则中的）
    if (isRequired && (value === null || value === undefined || value === "")) {
      throw new ValidationError(
        fieldName,
        rule?.message || `${fieldName} is required`,
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

    // 枚举类型验证（优先检查字段定义中的 enum）
    if (fieldDef.type === "enum") {
      if (fieldDef.enum && !fieldDef.enum.includes(value)) {
        throw new ValidationError(
          fieldName,
          rule?.message ||
            `${fieldName} must be one of: ${fieldDef.enum.join(", ")}`,
        );
      }
    }

    // 类型验证
    if (fieldDef.type && fieldDef.type !== "enum") {
      const typeCheck = this.checkType(value, fieldDef.type);
      if (!typeCheck) {
        throw new ValidationError(
          fieldName,
          rule?.message || `${fieldName} must be of type ${fieldDef.type}`,
        );
      }
    }

    // 验证规则中的类型验证（如果字段定义中没有指定类型）
    if (rule?.type && !fieldDef.type) {
      const typeCheck = this.checkType(value, rule.type);
      if (!typeCheck) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be of type ${rule.type}`,
        );
      }
    }

    // 验证规则中的枚举验证（如果字段定义中没有指定枚举）
    if (rule?.enum && fieldDef.type !== "enum" && !rule.enum.includes(value)) {
      throw new ValidationError(
        fieldName,
        rule.message || `${fieldName} must be one of: ${rule.enum.join(", ")}`,
      );
    }

    // 字符串长度验证
    if (rule && typeof value === "string") {
      if (rule.length !== undefined && value.length !== rule.length) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must be exactly ${rule.length} characters`,
        );
      }
      if (rule.min !== undefined && value.length < rule.min) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must be at least ${rule.min} characters`,
        );
      }
      if (rule.max !== undefined && value.length > rule.max) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be at most ${rule.max} characters`,
        );
      }
    }

    // 数字范围验证
    if (rule && typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be at least ${rule.min}`,
        );
      }
      if (rule.max !== undefined && value > rule.max) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be at most ${rule.max}`,
        );
      }
    }

    // 正则表达式验证
    if (rule?.pattern) {
      const regex = typeof rule.pattern === "string"
        ? new RegExp(rule.pattern)
        : rule.pattern;
      if (typeof value === "string" && !regex.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} format is invalid`,
        );
      }
    }

    // 数值验证增强
    if (typeof value === "number") {
      // 整数验证
      if (rule?.integer && !Number.isInteger(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be an integer`,
        );
      }

      // 正数验证
      if (rule?.positive && value <= 0) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be positive`,
        );
      }

      // 负数验证
      if (rule?.negative && value >= 0) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be negative`,
        );
      }

      // 倍数验证
      if (rule?.multipleOf !== undefined) {
        if (value % rule.multipleOf !== 0) {
          throw new ValidationError(
            fieldName,
            rule.message ||
              `${fieldName} must be a multiple of ${rule.multipleOf}`,
          );
        }
      }

      // 范围验证
      if (rule?.range) {
        const [min, max] = rule.range;
        if (value < min || value > max) {
          throw new ValidationError(
            fieldName,
            rule.message || `${fieldName} must be between ${min} and ${max}`,
          );
        }
      }
    }

    // 字符串验证增强
    if (typeof value === "string") {
      // 字符类型验证
      if (rule?.alphanumeric && !/^[a-zA-Z0-9]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must contain only alphanumeric characters`,
        );
      }

      if (rule?.numeric && !/^[0-9]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must contain only numbers`,
        );
      }

      if (rule?.alpha && !/^[a-zA-Z]+$/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must contain only letters`,
        );
      }

      // 大小写验证
      if (rule?.lowercase && value !== value.toLowerCase()) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be lowercase`,
        );
      }

      if (rule?.uppercase && value !== value.toUpperCase()) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must be uppercase`,
        );
      }

      // 字符串包含验证
      if (
        rule?.startsWith !== undefined && !value.startsWith(rule.startsWith)
      ) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must start with "${rule.startsWith}"`,
        );
      }

      if (rule?.endsWith !== undefined && !value.endsWith(rule.endsWith)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must end with "${rule.endsWith}"`,
        );
      }

      if (rule?.contains !== undefined && !value.includes(rule.contains)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must contain "${rule.contains}"`,
        );
      }

      // 字符串处理（自动转换，修改 allValues）
      if (rule?.trim) {
        allValues[fieldName] = value.trim();
      }
      if (rule?.toLowerCase) {
        allValues[fieldName] = value.toLowerCase();
      }
      if (rule?.toUpperCase) {
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
        if (rule?.before !== undefined) {
          const beforeDate = rule.before instanceof Date
            ? rule.before
            : new Date(rule.before);
          if (dateValue >= beforeDate) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} must be before ${rule.before}`,
            );
          }
        }

        if (rule?.after !== undefined) {
          const afterDate = rule.after instanceof Date
            ? rule.after
            : new Date(rule.after);
          if (dateValue <= afterDate) {
            throw new ValidationError(
              fieldName,
              rule.message || `${fieldName} must be after ${rule.after}`,
            );
          }
        }

        // 时间比较（只比较时间部分，忽略日期）
        if (rule?.beforeTime !== undefined) {
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
              rule.message || `${fieldName} must be before ${rule.beforeTime}`,
            );
          }
        }

        if (rule?.afterTime !== undefined) {
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
              rule.message || `${fieldName} must be after ${rule.afterTime}`,
            );
          }
        }
      }
    }

    // 密码强度验证
    if (rule?.passwordStrength && typeof value === "string") {
      const options = rule.passwordStrength;
      if (options.minLength && value.length < options.minLength) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must be at least ${options.minLength} characters`,
        );
      }
      if (options.requireUppercase && !/[A-Z]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must contain at least one uppercase letter`,
        );
      }
      if (options.requireLowercase && !/[a-z]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must contain at least one lowercase letter`,
        );
      }
      if (options.requireNumbers && !/[0-9]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must contain at least one number`,
        );
      }
      if (options.requireSymbols && !/[^a-zA-Z0-9]/.test(value)) {
        throw new ValidationError(
          fieldName,
          rule.message || `${fieldName} must contain at least one symbol`,
        );
      }
    }

    // 跨字段验证：equals（与另一个字段值相等）
    if (rule?.equals) {
      const otherValue = allValues[rule.equals];
      if (value !== otherValue) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must equal ${rule.equals}`,
        );
      }
    }

    // 跨字段验证：notEquals（与另一个字段值不相等）
    if (rule?.notEquals) {
      const otherValue = allValues[rule.notEquals];
      if (value === otherValue) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            `${fieldName} must not equal ${rule.notEquals}`,
        );
      }
    }

    // 跨字段验证：compare（自定义比较函数）
    if (rule?.compare) {
      const result = rule.compare(value, allValues);
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string"
              ? result
              : `${fieldName} validation failed`),
        );
      }
    }

    // 数组验证
    if (rule.array) {
      this.validateArray(fieldName, value, rule.array, allValues);
    }

    // 自定义验证
    if (rule?.custom) {
      const result = rule.custom(value);
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string"
              ? result
              : `${fieldName} validation failed`),
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
        model: this as typeof MongoModel,
      });
      if (result !== true) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            (typeof result === "string"
              ? result
              : `${fieldName} validation failed`),
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
        message || `${fieldName} format is invalid (expected: ${format})`,
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
        `${fieldName} must be an array`,
      );
    }

    // 数组长度验证
    if (arrayRule.length !== undefined && value.length !== arrayRule.length) {
      throw new ValidationError(
        fieldName,
        `${fieldName} array length must be ${arrayRule.length}`,
      );
    }

    if (arrayRule.min !== undefined && value.length < arrayRule.min) {
      throw new ValidationError(
        fieldName,
        `${fieldName} array length must be at least ${arrayRule.min}`,
      );
    }

    if (arrayRule.max !== undefined && value.length > arrayRule.max) {
      throw new ValidationError(
        fieldName,
        `${fieldName} array length must be at most ${arrayRule.max}`,
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
            `${fieldName} array items must be unique, duplicate found`,
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
              `${fieldName}[${i}] must be an array`,
            );
          }
          if (
            expectedType !== "array" && expectedType !== "object" &&
            actualType !== expectedType
          ) {
            throw new ValidationError(
              `${fieldName}[${i}]`,
              `${fieldName}[${i}] must be of type ${expectedType}`,
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

    const collectionName = (this as any).collectionName;
    if (!collectionName) {
      throw new Error("集合名未定义");
    }

    // 构建查询条件
    const where: Record<string, any> = {
      [fieldName]: value,
      ...(options.where || {}),
    };

    // 排除当前记录（用于更新操作）
    if (instanceId !== undefined) {
      const primaryKey = (this as any).primaryKey || "_id";
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
        `${fieldName} already exists, must be unique`,
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
      collection?: string;
      where?: Record<string, any>;
    },
  ): Promise<void> {
    await this.ensureAdapter();

    const collectionName = options.collection || (this as any).collectionName;
    if (!collectionName) {
      throw new Error("集合名未定义");
    }

    // 构建查询条件
    // 如果 where 条件中包含 _id 且值为 null，表示需要替换为实际值
    const where: Record<string, any> = {
      ...(options.where || {}),
    };
    // 如果 where 中没有指定字段，使用 fieldName: value
    // 但如果 where 中指定了主键字段（_id），则使用主键字段
    if (where._id === null) {
      // 如果 where._id 为 null，表示需要替换为实际值
      where._id = value;
    } else if (!where._id && !where[fieldName]) {
      where[fieldName] = value;
    }

    // 查询是否存在（需要切换到目标集合）
    const ModelClass = this as any;
    const originalCollection = ModelClass.collectionName;
    ModelClass.collectionName = collectionName;
    try {
      const exists = await ModelClass.query().where(where).exists();
      if (!exists) {
        throw new ValidationError(
          fieldName,
          `${fieldName} does not exist in collection`,
        );
      }
    } finally {
      // 恢复原始集合名
      ModelClass.collectionName = originalCollection;
    }
  }

  /**
   * 验证字段在数据表中不存在
   */
  private static async validateNotExists(
    fieldName: string,
    value: any,
    options: {
      collection?: string;
      where?: Record<string, any>;
    },
  ): Promise<void> {
    await this.ensureAdapter();

    const collectionName = options.collection || (this as any).collectionName;
    if (!collectionName) {
      throw new Error("集合名未定义");
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
        `${fieldName} already exists in collection`,
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
      targetModel?: typeof MongoModel;
      compare?: "=" | ">" | "<" | ">=" | "<=";
      where?: Record<string, any>;
    },
    instanceId?: any,
    allValues?: Record<string, any>,
  ): Promise<void> {
    await this.ensureAdapter();

    // 确定目标模型（如果未指定，使用当前模型）
    const TargetModel = (options.targetModel || this) as typeof MongoModel;
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

    // 对于相等比较，如果值可以转换为字符串，则进行字符串比较（处理 ObjectId 等情况）
    if (compare === "=") {
      // 尝试转换为字符串进行比较（处理 ObjectId 等类型）
      const valueStr = value?.toString();
      const targetStr = targetValue?.toString();
      isValid = value === targetValue || valueStr === targetStr;
    } else {
      // 对于其他比较操作符，直接比较
      switch (compare) {
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
   * 检查值是否符合指定类型
   */
  private static checkType(value: any, type: FieldType): boolean {
    switch (type) {
      case "string": {
        return typeof value === "string";
      }
      case "number": {
        return typeof value === "number" && !isNaN(value);
      }
      case "bigint": {
        return typeof value === "bigint" ||
          (typeof value === "number" && Number.isInteger(value));
      }
      case "decimal": {
        return typeof value === "number" && !isNaN(value);
      }
      case "boolean": {
        return typeof value === "boolean";
      }
      case "date": {
        return value instanceof Date || !isNaN(Date.parse(value));
      }
      case "timestamp": {
        return typeof value === "number" && value > 0;
      }
      case "array": {
        return Array.isArray(value);
      }
      case "object": {
        return typeof value === "object" && value !== null &&
          !Array.isArray(value);
      }
      case "json": {
        // JSON 类型可以是对象或数组
        return typeof value === "object" && value !== null;
      }
      case "enum": {
        // 枚举类型检查在 validateField 中处理
        return true;
      }
      case "uuid": {
        // UUID 格式验证: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return typeof value === "string" && uuidRegex.test(value);
      }
      case "text": {
        return typeof value === "string";
      }
      case "binary": {
        // 检查是否为二进制数据类型
        if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
          return true;
        }
        // 在 Node.js 环境中检查 Buffer
        if (typeof globalThis !== "undefined" && "Buffer" in globalThis) {
          const Buffer = (globalThis as any).Buffer;
          if (Buffer && Buffer.isBuffer && Buffer.isBuffer(value)) {
            return true;
          }
        }
        return false;
      }
      case "any": {
        return true;
      }
      default: {
        return false;
      }
    }
  }

  /**
   * 处理字段值（应用默认值、类型转换、getter/setter）
   * @param data 原始数据
   * @returns 处理后的数据
   */
  private static processFields(data: Record<string, any>): Record<string, any> {
    const schema = this.schema;
    if (!schema) {
      return data;
    }

    const processed: Record<string, any> = {};

    // 处理已定义的字段（使用缓存的键，减少 Object.entries() 开销）
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const fieldDef = schema[fieldName];
      let value = data[fieldName];

      // 应用默认值
      if (
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
    const schema = this.schema;
    if (!schema) {
      return;
    }

    // 合并验证循环：在一次遍历中完成同步和异步验证
    // 收集异步验证任务，最后并行执行
    const asyncValidations: Promise<void>[] = [];

    // 使用缓存的键，减少 Object.entries() 开销
    const schemaKeys = this.getSchemaKeys();
    for (const fieldName of schemaKeys) {
      const fieldDef = schema[fieldName];
      const value = data[fieldName];

      // 如果只验证提供的字段，且该字段不在提供的字段集合中，跳过验证
      // 注意：processFields 会将所有 schema 字段添加到 processed 中（即使值为 undefined）
      // 所以需要使用 providedFields 来判断哪些字段是用户实际提供的
      if (onlyValidateProvidedFields) {
        // 如果提供了字段集合，使用它；否则回退到检查字段是否在 data 中
        if (providedFields) {
          if (!providedFields.has(fieldName)) {
            continue;
          }
        } else if (!(fieldName in data) || value === undefined) {
          // 回退逻辑：如果字段不在 data 中，或者值为 undefined，跳过验证
          continue;
        }
      }

      // 检查验证组
      if (groups && fieldDef.validate?.groups) {
        const hasGroup = fieldDef.validate.groups.some((g) =>
          groups.includes(g)
        );
        if (!hasGroup) {
          continue; // 跳过不在指定组中的字段
        }
      }

      // 同步验证（字段级别的验证）
      this.validateField(fieldName, value, fieldDef, data);

      // 收集异步验证任务
      if (value !== null && value !== undefined && value !== "") {
        asyncValidations.push(
          this.validateFieldAsync(
            fieldName,
            value,
            fieldDef,
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
  private static normalizeCondition(condition: MongoWhereCondition): any {
    if (
      !condition || typeof condition !== "object" || Array.isArray(condition)
    ) {
      return condition;
    }

    const normalized: any = { ...condition };

    // 如果条件中包含主键字段
    if (normalized[this.primaryKey] !== undefined) {
      const idValue = normalized[this.primaryKey];

      // 如果主键字段的值是字符串，需要转换为 ObjectId
      // 注意：MongoDB 的 _id 字段总是 ObjectId 类型，无论 primaryKey 是什么
      if (typeof idValue === "string") {
        // 使用 normalizeId 方法进行转换和验证（会抛出异常如果格式无效）
        const objectId = this.normalizeId(idValue);
        // 如果 primaryKey 不是 "_id"，需要映射到 MongoDB 的 _id 字段
        if (this.primaryKey !== "_id") {
          // 删除自定义主键字段，使用 _id 字段
          delete normalized[this.primaryKey];
          normalized._id = objectId;
        } else {
          // primaryKey 就是 _id，直接转换
          normalized[this.primaryKey] = objectId;
        }
      }
    }

    // 如果条件中直接包含 _id 字段（即使 primaryKey 不是 "_id"）
    if (
      normalized._id !== undefined &&
      normalized._id !== normalized[this.primaryKey]
    ) {
      const idValue = normalized._id;
      // 如果是字符串，需要转换为 ObjectId
      if (typeof idValue === "string") {
        normalized._id = this.normalizeId(idValue);
      }
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
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            return this.normalizeCondition(item);
          }
          return item;
        });
      }
      // 处理 $in 和 $nin 操作符中的数组
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
    filter: Record<string, any>,
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Record<string, any> {
    if (!this.softDelete || includeTrashed) {
      return filter;
    }
    // 只查询已软删除的记录：deletedAt 存在且不为 null
    if (onlyTrashed) {
      return {
        ...filter,
        [this.deletedAtField]: { $exists: true, $ne: null },
      };
    }
    // 排除已软删除的记录：deletedAt 不存在或为 null
    return {
      ...filter,
      $or: [
        { [this.deletedAtField]: { $exists: false } },
        { [this.deletedAtField]: null },
      ],
    };
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
        if (state._conditions.length === 1 && state._conditions[0].type === "where") {
          const condition = state._conditions[0].condition;
          // 如果是字符串，需要转换为对象
          if (typeof condition === "string") {
            return { [this.primaryKey]: condition };
          }
          return condition;
        }

        // 检查是否有 OR 条件
        const hasOrCondition = state._conditions.some(item => item.type === "or");

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
            Object.assign(result, condition);
          }

          // 如果有冲突的键，需要使用 $and
          if (Object.keys(result).length < andConditions.reduce((sum, c) => sum + Object.keys(c).length, 0)) {
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
      findAll: async (): Promise<Record<string, any>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const state = getState();
        const projection = this.buildProjection(state._fields);
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
        return results.map((row: any) => ({ ...row }));
      },
      findOne: async (): Promise<Record<string, any> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const state = getState();
        const projection = this.buildProjection(state._fields);
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
        return { ...results[0] };
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
        const db = (this.adapter as any as MongoDBAdapter).getDatabase();
        if (!db) {
          throw new Error("Database not connected");
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
          finalCondition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const state = getState();
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : (finalCondition as any);
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
          finalCondition as any,
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
        { type: "where" as const, condition: condition as MongoWhereCondition | string },
      ] as Array<{ type: "where" | "or" | "and"; condition: MongoWhereCondition | string }>,
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
    };

    /**
     * 构建最终查询条件
     * 如果使用新的 _conditions 结构，返回组合对象；否则返回单个条件（向后兼容）
     */
    const buildFinalCondition = (): MongoWhereCondition | string => {
      // 如果使用新的 _conditions 结构
      if (state._conditions && state._conditions.length > 0) {
        // 如果只有一个 where 条件，直接返回
        if (state._conditions.length === 1 && state._conditions[0].type === "where") {
          const condition = state._conditions[0].condition;
          // 如果是字符串，需要转换为对象
          if (typeof condition === "string") {
            return { [this.primaryKey]: condition };
          }
          return condition;
        }

        // 检查是否有 OR 条件
        const hasOrCondition = state._conditions.some(item => item.type === "or");

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
      if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
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
          // 如果缓存值是空对象 {}，不应该返回，应该查询数据库
          // 因为空对象可能是之前缓存的数据，但数据已经被删除或软删除
          if (
            cachedValue === null ||
            (typeof cachedValue === "object" &&
              Object.keys(cachedValue).length === 0)
          ) {
            // 空对象或 null，不返回，继续查询数据库
          } else {
            const instance = new (this as any)();
            Object.assign(instance, cachedValue);

            // 应用虚拟字段
            // 应用虚拟字段（使用缓存的虚拟字段定义）
            this.applyVirtuals(instance);

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

      const projection = this.buildProjection(state._fields);
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

      const instance = new (this as any)();
      Object.assign(instance, results[0]);

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

      return instance as InstanceType<T>;
    };

    // 执行查询多条的函数
    const executeFindAll = async (): Promise<InstanceType<T>[]> => {
      // 自动初始化（懒加载）
      await this.ensureAdapter();

      const finalCondition = buildFinalCondition();

      const projection = this.buildProjection(state._fields);
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

      return results.map((row: any) => {
        const instance = new (this as any)();
        Object.assign(instance, row);
        if ((this as any).virtuals) {
          const Model = this as any;
          for (const [name, getter] of Object.entries(Model.virtuals)) {
            const getterFn = getter as (instance: any) => any;
            Object.defineProperty(instance, name, {
              get: () => getterFn(instance),
              enumerable: true,
              configurable: true,
            });
          }
        }
        return instance as InstanceType<T>;
      });
    };

    // 创建 Promise（用于直接 await）
    const queryPromise = executeFindOne();

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
        // 返回共享状态对象的引用，确保 asArray() 中的修改能够持久化
        // 将 _condition 转换为 _conditions 格式以兼容 createArrayQueryBuilder
        const stateForArray = {
          ...state,
          _conditions: [] as Array<{ type: "where" | "or" | "and"; condition: MongoWhereCondition | string }>,
          _condition: state._condition,
        };
        if (state._condition) {
          stateForArray._conditions = [{ type: "where" as const, condition: state._condition }];
        }
        return this.createArrayQueryBuilder(() => stateForArray);
      },
      count: async (): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = (this.adapter as any as MongoDBAdapter).getDatabase();
        if (!db) {
          throw new Error("Database not connected");
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
          finalCondition as any,
          state._includeTrashed,
          state._onlyTrashed,
        );
      },
      distinct: async (field: string): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : (finalCondition as any);
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
          finalCondition && typeof finalCondition === "object" && Object.keys(finalCondition).length > 0
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
        return await this.paginate(
          finalCondition as any,
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
    condition: MongoWhereCondition = {},
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
          const instance = new (this as any)();
          Object.assign(instance, row);

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

    // 软删除：自动过滤已删除的记录（默认排除软删除）
    const queryFilter = this.applySoftDeleteFilter(
      condition,
      includeTrashed,
      onlyTrashed,
    );

    const results = await this.adapter.query(
      this.collectionName,
      queryFilter,
      queryOptions,
    );

    const instances = results.map((row: any) => {
      const instance = new (this as any)();
      Object.assign(instance, row);

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
      throw new Error(`Scope "${scopeName}" is not defined`);
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
    // 处理字段（应用默认值、类型转换、验证）
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
    await this.validate(processedData);

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
        insertedId = (result as any).insertedId;
      } else if ("_id" in processedData) {
        insertedId = processedData._id;
      }
    }

    const instance = new (this as any)();
    Object.assign(instance, processedData);
    if (insertedId != null) {
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
   * @param returnLatest 返回最新记录（true）或选项对象（性能优化：skipPreQuery 可跳过预查询）
   * @param fields 返回的字段（当 returnLatest 为 true 时）
   * @returns 更新的记录数或更新后的记录
   *
   * @example
   * await User.update('507f1f77bcf86cd799439011', { name: 'lisi' });
   * await User.update({ _id: '507f1f77bcf86cd799439011' }, { name: 'lisi' });
   * await User.update({ email: 'user@example.com' }, { name: 'lisi' });
   * // 性能优化：跳过预查询（仅当没有钩子和验证时使用，需要类型断言）
   * await User.update(1, { name: 'lisi' }, { skipPreQuery: true } as any);
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
      const db = (this.adapter as any as MongoDBAdapter).getDatabase();
      if (!db) {
        throw new Error("Database not connected");
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
          const primaryKey = (this as any).primaryKey || "_id";
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

      // 验证数据（如果启用）
      // 传递当前记录的 ID，用于唯一性验证时排除当前记录
      if (enableValidation) {
        const primaryKey = (this as any).primaryKey || "_id";
        const instanceId = existingInstance
          ? (existingInstance as any)[primaryKey]
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
            validationData[key] = (existingInstance as any)[key];
          }
        }
        // 然后用 processedData 覆盖（只覆盖被更新的字段）
        Object.assign(validationData, processedData);
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
        // 性能优化：检测钩子是否修改了数据，只在有变化时合并
        const beforeSnapshot = { ...tempInstance };
        await this.afterValidate(tempInstance);
        if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
          // 合并钩子修改的字段，但排除非数据库字段（如 hookData）和主键字段
          const primaryKey = (this as any).primaryKey || "_id";
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
          const primaryKey = (this as any).primaryKey || "_id";
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
          const primaryKey = (this as any).primaryKey || "_id";
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
      const result = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        { $set: updateData },
        opts,
      );
      if (!result) {
        return 0;
      }
      const updatedInstance = new (this as any)();
      Object.assign(updatedInstance, result);
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
            primaryKeyValue = (condition as any)[primaryKey] ||
              (condition as any)._id;
          }
          if (!primaryKeyValue) {
            // 如果无法获取主键值（例如 updateMany 使用复杂条件），跳过 afterUpdate 和 afterSave 钩子
            // 这是正常的，因为 updateMany 不返回实例
            return modifiedCount;
          }
          // 查询最新数据（缓存已清除，会从数据库查询）
          const latest = await this.find(primaryKeyValue);
          const updatedInstance = latest || new (this as any)();
          if (!latest) {
            // 如果查询失败，使用更新后的数据
            Object.assign(updatedInstance, updateData);
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
          const updatedInstance = latest || new (this as any)();
          if (!latest) {
            // 如果查询失败，使用合并后的数据
            Object.assign(updatedInstance, {
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
          ? ((result as any).modifiedCount || 0)
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
        ? ((result as any).deletedCount || 0)
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

    const primaryKey = (Model.constructor as any).primaryKey || "_id";
    let id = (this as any)[primaryKey];

    // 如果 id 是 ObjectId 对象，转换为字符串
    if (id && typeof id === "object" && id.toString) {
      id = id.toString();
    }

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
      // 确保 id 是字符串格式
      const affectedRows = await Model.update(String(id), data);
      if (affectedRows === 0) {
        throw new Error(
          `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
        );
      }
      // 重新查询更新后的数据，确保获取最新状态
      // 确保 id 是字符串格式
      const updated = await Model.find(String(id));
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

    const primaryKey = (Model.constructor as any).primaryKey || "_id";
    let id = (this as any)[primaryKey];

    // 如果 id 是 ObjectId 对象，转换为字符串
    if (id && typeof id === "object" && id.toString) {
      id = id.toString();
    }

    if (!id) {
      throw new Error("Cannot update instance without primary key");
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
        `更新失败：未找到 ID 为 ${id} 的记录或记录已被删除`,
      );
    }
    // 更新成功，同步实例数据
    Object.assign(this, updated);
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
    let id = (this as any)[primaryKey];

    if (!id) {
      throw new Error("Cannot delete instance without primary key");
    }

    // 如果 id 是 ObjectId 对象，转换为字符串
    if (id && typeof id === "object" && id.toString) {
      id = id.toString();
    }

    const deleted = await Model.delete(id);
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
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
      const db = (this.adapter as any as MongoDBAdapter).getDatabase();
      if (!db) {
        throw new Error("Database not connected");
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
      const db = (this.adapter as any as MongoDBAdapter).getDatabase();
      if (!db) {
        throw new Error("Database not connected");
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
        ? ((result as any).deletedCount || 0)
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
    condition: MongoWhereCondition = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<number> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();

    if (!db) {
      throw new Error("Database not connected");
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
      throw new Error(`MongoDB count error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();

    if (!db) {
      throw new Error("Database not connected");
    }

    try {
      const count = await db.collection(this.collectionName).countDocuments(
        filter,
        { limit: 1 },
      );
      return count > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB exists error: ${message}`);
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
      const item = this.processFields(data);
      if (this.timestamps) {
        const createdAtField = typeof this.timestamps === "object"
          ? (this.timestamps.createdAt || "createdAt")
          : "createdAt";
        const updatedAtField = typeof this.timestamps === "object"
          ? (this.timestamps.updatedAt || "updatedAt")
          : "updatedAt";
        if (!item[createdAtField]) {
          item[createdAtField] = new Date();
        }
        if (!item[updatedAtField]) {
          item[updatedAtField] = new Date();
        }
      }

      // 钩子和验证处理（如果启用）
      if (enableHooks || enableValidation) {
        const tempInstance = new (this as any)();
        Object.assign(tempInstance, item);

        // beforeValidate 钩子
        if (enableHooks && this.beforeValidate) {
          // 性能优化：检测钩子是否修改了数据，只在有变化时合并
          const beforeSnapshot = { ...tempInstance };
          await this.beforeValidate(tempInstance);
          if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
            Object.assign(item, tempInstance);
          }
        }

        // 验证数据（如果启用）
        if (enableValidation) {
          await this.validate.call(this, item);
        }

        // afterValidate 钩子
        if (enableHooks && this.afterValidate) {
          // 性能优化：检测钩子是否修改了数据，只在有变化时合并
          const beforeSnapshot = { ...tempInstance };
          await this.afterValidate(tempInstance);
          if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
            Object.assign(item, tempInstance);
          }
        }

        // 钩子处理（如果启用）
        if (enableHooks) {
          if (this.beforeCreate) {
            // 性能优化：检测钩子是否修改了数据，只在有变化时合并
            const beforeSnapshot = { ...tempInstance };
            await this.beforeCreate(tempInstance);
            if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
              Object.assign(item, tempInstance);
            }
          }
          if (this.beforeSave) {
            // 性能优化：检测钩子是否修改了数据，只在有变化时合并
            const beforeSnapshot = { ...tempInstance };
            await this.beforeSave(tempInstance);
            if (this.hasObjectChanged(beforeSnapshot, tempInstance)) {
              Object.assign(item, tempInstance);
            }
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
    const insertedIdsMap = (result && typeof result === "object" &&
        "insertedIds" in result)
      ? (result as any).insertedIds
      : undefined;
    for (let i = 0; i < processedArray.length; i++) {
      const instance = new (this as any)();
      const item = { ...processedArray[i] };
      const insertedId = insertedIdsMap ? insertedIdsMap[i] : undefined;
      if (insertedId != null) {
        (item as any)[this.primaryKey] = insertedId;
      }
      Object.assign(instance, item);
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
    condition: MongoWhereCondition = {},
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
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();

    if (!db) {
      throw new Error("Database not connected");
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
        const result = await db.collection(this.collectionName)
          .findOneAndUpdate(
            filter,
            { $inc: incUpdate },
            opts,
          );
        if (!result) {
          return 0;
        }
        const instance = new (this as any)();
        Object.assign(instance, result);
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
      throw new Error(`MongoDB increment error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
      const result = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        { $set: data },
        opts,
      );

      if (!result) {
        return null;
      }

      const instance = new (this as any)();
      Object.assign(instance, result);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（findOneAndUpdate 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB findOneAndUpdate error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
        const result = await db.collection(this.collectionName)
          .findOneAndUpdate(
            filter,
            { $set: { [this.deletedAtField]: new Date() } },
            optsUpdate,
          );
        if (!result) {
          return null;
        }
        const instance = new (this as any)();
        Object.assign(instance, result);
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);

        // 清除相关缓存（findOneAndDelete 后需要清除缓存）
        await this.clearCache();

        return instance as InstanceType<T>;
      } else {
        const result = await db.collection(this.collectionName)
          .findOneAndDelete(
            filter,
            optsDelete,
          );
        if (!result) {
          return null;
        }
        const instance = new (this as any)();
        Object.assign(instance, result);
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);

        // 清除相关缓存（findOneAndDelete 后需要清除缓存）
        await this.clearCache();

        return instance as InstanceType<T>;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB findOneAndDelete error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
    }

    try {
      const opts: any = {
        upsert: true,
        returnDocument: returnLatest ? "after" : "before",
      };
      const result = await db.collection(this.collectionName).findOneAndUpdate(
        filter,
        {
          $set: data,
          ...(resurrect && this.softDelete
            ? { $unset: { [this.deletedAtField]: "" } }
            : {}),
        },
        opts,
      );

      const instance = new (this as any)();
      Object.assign(instance, result);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（upsert 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB upsert error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
      const instance = new (this as any)();
      Object.assign(instance, result);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);

      // 清除相关缓存（findOneAndReplace 后需要清除缓存）
      await this.clearCache();

      return instance as InstanceType<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB findOneAndReplace error: ${message}`);
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
    condition: MongoWhereCondition = {},
    includeTrashed: boolean = false,
    onlyTrashed: boolean = false,
  ): Promise<any[]> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();

    if (!db) {
      throw new Error("Database not connected");
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
      throw new Error(`MongoDB distinct error: ${message}`);
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
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();

    if (!db) {
      throw new Error("Database not connected");
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
      throw new Error(`MongoDB aggregate error: ${message}`);
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
        condition: MongoWhereCondition = {},
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
          const instance = new (this as any)();
          Object.assign(instance, row);
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
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      },
      count: async (condition: MongoWhereCondition = {}): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        // 应用软删除过滤器（onlyTrashed: true）
        const queryFilter = this.applySoftDeleteFilter(condition, false, true);
        const db = (this.adapter as any as MongoDBAdapter).getDatabase();
        if (!db) {
          throw new Error("Database not connected");
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
        condition: MongoWhereCondition = {},
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
          const instance = new (this as any)();
          Object.assign(instance, row);
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
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
        return instance as InstanceType<T>;
      },
      count: async (condition: MongoWhereCondition = {}): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = (this.adapter as any as MongoDBAdapter).getDatabase();
        if (!db) {
          throw new Error("Database not connected");
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
      throw new Error("Soft delete is not enabled for this model");
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
        { $unset: { [this.deletedAtField]: "" } },
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
      throw new Error(`MongoDB restore error: ${message}`);
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

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
      throw new Error(`MongoDB forceDelete error: ${message}`);
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
    };

    /**
     * 构建最终的查询条件
     * 将多个条件合并为 MongoDB 查询对象
     */
    const buildFinalCondition = (): MongoWhereCondition | string => {
      if (state._conditions.length === 0) {
        return {};
      }

      // 如果只有一个 where 条件，直接返回
      if (state._conditions.length === 1 && state._conditions[0].type === "where") {
        const condition = state._conditions[0].condition;
        // 如果是字符串，需要转换为对象
        if (typeof condition === "string") {
          return { [this.primaryKey]: condition };
        }
        return condition;
      }

      // 检查是否有 OR 条件
      const hasOrCondition = state._conditions.some(item => item.type === "or");

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
          Object.assign(result, condition);
        }

        // 如果有冲突的键，需要使用 $and
        if (Object.keys(result).length < andConditions.reduce((sum, c) => sum + Object.keys(c).length, 0)) {
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
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
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
      const projection = this.buildProjection(state._fields);
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
      const instance = new (this as any)();
      Object.assign(instance, results[0]);
      // 应用虚拟字段（使用缓存的虚拟字段定义）
      this.applyVirtuals(instance);
      return instance as InstanceType<T>;
    };

    // 创建 Promise（用于直接 await）
    const queryPromise = executeFindOne();

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
      findAll: async (): Promise<InstanceType<T>[]> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const projection = this.buildProjection(state._fields);
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

        return results.map((row: any) => {
          const instance = new (this as any)();
          Object.assign(instance, row);
          // 应用虚拟字段（使用缓存的虚拟字段定义）
          this.applyVirtuals(instance);
          return instance as InstanceType<T>;
        });
      },
      findOne: async (): Promise<InstanceType<T> | null> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const projection = this.buildProjection(state._fields);
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
        const instance = new (this as any)();
        Object.assign(instance, results[0]);
        // 应用虚拟字段（使用缓存的虚拟字段定义）
        this.applyVirtuals(instance);
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
        return await this.findById(id, fields);
      },
      count: async (): Promise<number> => {
        // 自动初始化（懒加载）
        await this.ensureAdapter();
        const db = (this.adapter as any as MongoDBAdapter).getDatabase();
        if (!db) {
          throw new Error("Database not connected");
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
          finalCondition as any,
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
            finalCondition as any,
            data,
            true,
          ) as InstanceType<T>;
        }
        return await this.update(
          finalCondition as any,
          data,
          false,
        ) as number;
      },
      updateMany: async (data: Record<string, any>): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.updateMany(finalCondition as any, data);
      },
      increment: async (
        field: string,
        amount: number = 1,
        returnLatest: boolean = false,
      ): Promise<number | InstanceType<T>> => {
        const finalCondition = buildFinalCondition();
        return await this.increment(
          finalCondition as any,
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
          finalCondition as any,
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
        return await this.deleteMany(finalCondition as any, options);
      },
      restore: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.restore(finalCondition as any, options);
      },
      restoreById: async (id: string): Promise<number> => {
        await this.ensureAdapter();
        return await this.restoreById(id);
      },
      forceDelete: async (
        options?: { returnIds?: boolean },
      ): Promise<number | { count: number; ids: any[] }> => {
        const finalCondition = buildFinalCondition();
        return await this.forceDelete(finalCondition as any, options);
      },
      forceDeleteById: async (id: string): Promise<number> => {
        await this.ensureAdapter();
        return await this.forceDeleteById(id);
      },
      distinct: async (field: string): Promise<any[]> => {
        const finalCondition = buildFinalCondition();
        const cond = typeof finalCondition === "string"
          ? { [this.primaryKey]: finalCondition }
          : (finalCondition as any);
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
          finalCondition as any,
          data,
          options ?? { returnDocument: "after" },
          state._fields,
        );
      },
      findOneAndDelete: async (): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndDelete(
          finalCondition as any,
          state._fields,
        );
      },
      findOneAndReplace: async (
        replacement: Record<string, any>,
        returnLatest: boolean = true,
      ): Promise<InstanceType<T> | null> => {
        const finalCondition = buildFinalCondition();
        return await this.findOneAndReplace(
          finalCondition as any,
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
          finalCondition as any,
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
          : (finalCondition as any);
        return await this.findOrCreate(cond, data, resurrect);
      },
      incrementMany: async (
        fieldOrMap: string | Record<string, number>,
        amount: number = 1,
      ): Promise<number> => {
        const finalCondition = buildFinalCondition();
        return await this.incrementMany(
          finalCondition as any,
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
          finalCondition as any,
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
        return await this.paginate(
          finalCondition as any,
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
   * 清空集合（删除所有记录）
   * @returns 删除的记录数
   *
   * @example
   * await User.truncate();
   */
  static async truncate(): Promise<number> {
    // 自动初始化（懒加载）
    await this.ensureAdapter();
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
    }

    try {
      const result = await db.collection(this.collectionName).deleteMany({});
      return result.deletedCount || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB truncate error: ${message}`);
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
      throw new Error("Database adapter not set");
    }

    // 通过执行一个简单的查询来确保连接（这会自动调用 ensureConnection）
    // 如果适配器未连接，query 方法会抛出错误
    try {
      await this.adapter.query(this.collectionName, {}, { limit: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Database not connected: ${message}`);
    }

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
        throw new Error(`Failed to create index: ${message}`);
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
    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
        throw new Error(`Failed to drop index ${index.name}: ${message}`);
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
      throw new Error("Database adapter not set");
    }

    // 通过执行一个简单的查询来确保连接（这会自动调用 ensureConnection）
    // 如果适配器未连接，query 方法会抛出错误
    try {
      await this.adapter.query(this.collectionName, {}, { limit: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Database not connected: ${message}`);
    }

    const db = (this.adapter as any as MongoDBAdapter).getDatabase();
    if (!db) {
      throw new Error("Database not connected");
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
