/**
 * SQL / Mongo 模型共享的字段、校验与钩子类型。
 * 行为与既有导出保持兼容：exists / notExists 同时接受 table 与 collection。
 */

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
  required?: boolean;
  type?: FieldType;
  min?: number;
  max?: number;
  length?: number;
  pattern?: RegExp | string;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  message?: string;

  /** 与另一个字段值相等 */
  equals?: string;
  /** 与另一个字段值不相等 */
  notEquals?: string;
  /** 自定义字段比较函数，可以访问所有字段值 */
  compare?: (value: any, allValues: Record<string, any>) => boolean | string;
  /** 跨表/跨字段值比较验证（异步） */
  compareValue?: {
    targetField: string;
    targetModel?: any;
    compare?: "=" | ">" | "<" | ">=" | "<=";
    where?: Record<string, any>;
  };

  unique?: boolean | {
    exclude?: Record<string, any>;
    where?: Record<string, any>;
  };
  exists?: boolean | {
    /** SQL 模型：查询的表名（可选，默认当前表） */
    table?: string;
    /** Mongo 模型：查询的集合名（可选，默认当前集合） */
    collection?: string;
    where?: Record<string, any>;
  };
  notExists?: boolean | {
    table?: string;
    collection?: string;
    where?: Record<string, any>;
  };

  when?: {
    field: string;
    is?: any;
    isNot?: any;
    check?: (value: any, allValues: Record<string, any>) => boolean;
  };
  requiredWhen?: {
    field: string;
    is?: any;
    isNot?: any;
    check?: (value: any, allValues: Record<string, any>) => boolean;
  };
  asyncCustom?: (
    value: any,
    allValues: Record<string, any>,
    context: {
      fieldName: string;
      instanceId?: any;
      model: any;
    },
  ) => Promise<boolean | string>;
  groups?: string[];
  array?: {
    type?: FieldType;
    min?: number;
    max?: number;
    length?: number;
    items?: ValidationRule;
    uniqueItems?: boolean;
  };
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

  integer?: boolean;
  positive?: boolean;
  negative?: boolean;
  multipleOf?: number;
  range?: [number, number];

  alphanumeric?: boolean;
  numeric?: boolean;
  alpha?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;

  before?: string | Date;
  after?: string | Date;
  beforeTime?: string;
  afterTime?: string;
  timezone?: string;

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
  enum?: any[];
  default?: any;
  validate?: ValidationRule;
  get?: (value: any) => any;
  set?: (value: any) => any;
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

/** 自动时间戳配置 */
export type TimestampsConfig =
  | boolean
  | { createdAt?: string; updatedAt?: string };

/** 查询缓存键使用的排序 / 分页选项 */
export type CacheQueryOptions = {
  sort?: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc";
  skip?: number;
  limit?: number;
  /** 预加载规格签名，避免 fields()+with() 命中缺关联键的缓存行 */
  with?: string;
};

export type WhenCondition = {
  field: string;
  is?: any;
  isNot?: any;
  check?: (value: any, allValues: Record<string, any>) => boolean;
};
