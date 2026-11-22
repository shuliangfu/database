/**
 * 字段校验共享实现。
 * SQL 与 Mongo 的 validateField 保留各自原有分支（类型 / 枚举 / 错误文案），
 * 格式、数组、条件、异步 unique/exists 等抽到公共函数。
 */

import { $tr } from "../../i18n.ts";
import { assignData } from "./safe-assign.ts";
import type {
  FieldDefinition,
  FieldType,
  ModelSchema,
  ValidationRule,
  WhenCondition,
} from "./types.ts";
import { ValidationError } from "./types.ts";

export type ValidationDialect = "sql" | "mongo";

/**
 * 异步校验（unique / exists / compareValue）所需的宿主能力。
 */
export interface ValidationHost {
  dialect: ValidationDialect;
  model: unknown;
  storeName?: string;
  setStoreName: (name: string) => void;
  primaryKey: string;
  /** exists() 里把 where 中 null 主键替换为实际值时使用的键（SQL: id，Mongo: _id） */
  existsNullKey: string;
  missingStoreMessageKey: string;
  defaultPrimaryKey: string;
  ensureAdapter: () => Promise<void>;
  queryExists: (where: Record<string, any>) => Promise<boolean>;
  queryFindOne: (
    where: Record<string, any>,
    fields: string[],
  ) => Promise<any>;
  getSchema: () => ModelSchema | undefined;
  getSchemaKeys: () => string[];
}

export function checkWhenCondition(
  when: WhenCondition,
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

export function validateFormat(
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
      message ||
        $tr(
          "log.validation.formatExpected",
          { field: fieldName, format },
        ),
    );
  }
}

function validateArrayWith(
  fieldName: string,
  value: any,
  arrayRule: NonNullable<ValidationRule["array"]>,
  allValues: Record<string, any>,
  validateItem: (
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition,
    allValues: Record<string, any>,
  ) => void,
): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      fieldName,
      $tr("log.validation.typeArray", {
        field: fieldName,
      }),
    );
  }

  if (arrayRule.length !== undefined && value.length !== arrayRule.length) {
    throw new ValidationError(
      fieldName,
      $tr(
        "log.validation.arrayLength",
        { field: fieldName, length: String(arrayRule.length) },
      ),
    );
  }

  if (arrayRule.min !== undefined && value.length < arrayRule.min) {
    throw new ValidationError(
      fieldName,
      $tr(
        "log.validation.arrayMinLength",
        { field: fieldName, min: arrayRule.min },
      ),
    );
  }

  if (arrayRule.max !== undefined && value.length > arrayRule.max) {
    throw new ValidationError(
      fieldName,
      $tr(
        "log.validation.arrayMaxLength",
        { field: fieldName, max: arrayRule.max },
      ),
    );
  }

  if (arrayRule.uniqueItems) {
    const seen = new Set();
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const key = typeof item === "object" && item !== null
        ? JSON.stringify(item)
        : String(item);
      if (seen.has(key)) {
        throw new ValidationError(
          fieldName,
          $tr(
            "log.validation.arrayUniqueItems",
            { field: fieldName },
          ),
        );
      }
      seen.add(key);
    }
  }

  if (arrayRule.items || arrayRule.type) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const elemField = `${fieldName}[${i}]`;

      if (arrayRule.type) {
        const expectedType = arrayRule.type;
        const actualType = typeof item;
        if (expectedType === "array" && !Array.isArray(item)) {
          throw new ValidationError(
            elemField,
            $tr(
              "log.validation.typeArray",
              {
                field: elemField,
              },
            ),
          );
        }
        if (
          expectedType !== "array" && expectedType !== "object" &&
          actualType !== expectedType
        ) {
          throw new ValidationError(
            elemField,
            $tr(
              "log.validation.arrayElementType",
              { field: elemField, type: expectedType },
            ),
          );
        }
      }

      if (arrayRule.items) {
        const itemFieldDef: FieldDefinition = {
          type: arrayRule.type || "any",
          validate: arrayRule.items,
        };
        validateItem(`${fieldName}[${i}]`, item, itemFieldDef, {
          ...allValues,
          [fieldName]: value,
        });
      }
    }
  }
}

function validateArraySql(
  fieldName: string,
  value: any,
  arrayRule: NonNullable<ValidationRule["array"]>,
  allValues: Record<string, any>,
): void {
  validateArrayWith(fieldName, value, arrayRule, allValues, validateSqlField);
}

function validateArrayMongo(
  fieldName: string,
  value: any,
  arrayRule: NonNullable<ValidationRule["array"]>,
  allValues: Record<string, any>,
): void {
  validateArrayWith(fieldName, value, arrayRule, allValues, validateMongoField);
}

export function validateArray(
  fieldName: string,
  value: any,
  arrayRule: NonNullable<ValidationRule["array"]>,
  allValues: Record<string, any>,
  dialect: ValidationDialect,
): void {
  if (dialect === "mongo") {
    validateArrayMongo(fieldName, value, arrayRule, allValues);
  } else {
    validateArraySql(fieldName, value, arrayRule, allValues);
  }
}

export function checkType(value: any, type: FieldType): boolean {
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
      return typeof value === "object" && value !== null;
    }
    case "enum": {
      return true;
    }
    case "uuid": {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return typeof value === "string" && uuidRegex.test(value);
    }
    case "text": {
      return typeof value === "string";
    }
    case "binary": {
      if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        return true;
      }
      if (typeof globalThis !== "undefined" && "Buffer" in globalThis) {
        const Buffer =
          (globalThis as { Buffer?: { isBuffer?: (v: unknown) => boolean } })
            .Buffer;
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

export function validateSqlField(
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
    const shouldValidate = checkWhenCondition(rule.when, allValues);
    if (!shouldValidate) {
      return; // 条件不满足，跳过验证
    }
  }

  // 条件必填验证
  let isRequired = rule.required || false;
  if (rule.requiredWhen) {
    const shouldBeRequired = checkWhenCondition(
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
      rule.message ||
        $tr("log.validation.required", {
          field: fieldName,
        }),
    );
  }

  // 如果值为空且不是必填，跳过其他验证
  if (value === null || value === undefined || value === "") {
    return;
  }

  // 格式验证（内置格式验证器）
  if (rule.format) {
    validateFormat(fieldName, value, rule.format, rule.message);
  }

  // 类型验证
  if (rule.type) {
    const expectedType = rule.type;
    const actualType = typeof value;
    if (expectedType === "array" && !Array.isArray(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.typeArray", {
            field: fieldName,
          }),
      );
    }
    if (
      expectedType === "object" &&
      (actualType !== "object" || Array.isArray(value) || value === null)
    ) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.typeObject",
            {
              field: fieldName,
            },
          ),
      );
    }
    if (
      expectedType !== "array" && expectedType !== "object" &&
      actualType !== expectedType
    ) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.typeExpected",
            { field: fieldName, type: expectedType },
          ),
      );
    }
  }

  // 长度验证（字符串或数组）
  if (rule.length !== undefined) {
    const len = Array.isArray(value) ? value.length : String(value).length;
    if (len !== rule.length) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.lengthRequired",
            { field: fieldName, length: String(rule.length) },
          ),
      );
    }
  }

  // 最小值/最大长度验证
  if (rule.min !== undefined) {
    if (typeof value === "number") {
      if (value < rule.min) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.minNumber",
              {
                field: fieldName,
                min: rule.min,
              },
            ),
        );
      }
    } else {
      const len = Array.isArray(value) ? value.length : String(value).length;
      if (len < rule.min) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.minLength",
              { field: fieldName, min: rule.min },
            ),
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
          rule.message ||
            $tr(
              "log.validation.maxNumber",
              {
                field: fieldName,
                max: rule.max,
              },
            ),
        );
      }
    } else {
      const len = Array.isArray(value) ? value.length : String(value).length;
      if (len > rule.max) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.maxLength",
              { field: fieldName, max: rule.max },
            ),
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
        rule.message ||
          $tr("log.validation.pattern", {
            field: fieldName,
          }),
      );
    }
  }

  // 数值验证增强
  if (typeof value === "number") {
    // 整数验证
    if (rule.integer && !Number.isInteger(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.integer", {
            field: fieldName,
          }),
      );
    }

    // 正数验证
    if (rule.positive && value <= 0) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.positive", {
            field: fieldName,
          }),
      );
    }

    // 负数验证
    if (rule.negative && value >= 0) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.negative", {
            field: fieldName,
          }),
      );
    }

    // 倍数验证
    if (rule.multipleOf !== undefined) {
      if (value % rule.multipleOf !== 0) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.multipleOf",
              { field: fieldName, multipleOf: rule.multipleOf },
            ),
        );
      }
    }

    // 范围验证
    if (rule.range) {
      const [min, max] = rule.range;
      if (value < min || value > max) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.range",
              { field: fieldName, min, max },
            ),
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
        rule.message ||
          $tr(
            "log.validation.alphaNum",
            {
              field: fieldName,
            },
          ),
      );
    }

    if (rule.numeric && !/^[0-9]+$/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.numeric", {
            field: fieldName,
          }),
      );
    }

    if (rule.alpha && !/^[a-zA-Z]+$/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.alpha", {
            field: fieldName,
          }),
      );
    }

    // 大小写验证
    if (rule.lowercase && value !== value.toLowerCase()) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.lowercase", {
            field: fieldName,
          }),
      );
    }

    if (rule.uppercase && value !== value.toUpperCase()) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.uppercase", {
            field: fieldName,
          }),
      );
    }

    // 字符串包含验证
    if (rule.startsWith !== undefined && !value.startsWith(rule.startsWith)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.startsWith",
            { field: fieldName, value: rule.startsWith },
          ),
      );
    }

    if (rule.endsWith !== undefined && !value.endsWith(rule.endsWith)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.endsWith",
            { field: fieldName, value: rule.endsWith },
          ),
      );
    }

    if (rule.contains !== undefined && !value.includes(rule.contains)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.contains",
            { field: fieldName, value: rule.contains },
          ),
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
            rule.message ||
              $tr(
                "log.validation.before",
                {
                  field: fieldName,
                  value: String(rule.before),
                },
              ),
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
            rule.message ||
              $tr(
                "log.validation.after",
                {
                  field: fieldName,
                  value: String(rule.after),
                },
              ),
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
            rule.message ||
              $tr(
                "log.validation.beforeTime",
                { field: fieldName, value: rule.beforeTime },
              ),
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
            rule.message ||
              $tr(
                "log.validation.afterTime",
                { field: fieldName, value: rule.afterTime },
              ),
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
          $tr(
            "log.validation.passwordMinLength",
            { field: fieldName, min: options.minLength },
          ),
      );
    }
    if (options.requireUppercase && !/[A-Z]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordUppercase",
            { field: fieldName },
          ),
      );
    }
    if (options.requireLowercase && !/[a-z]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordLowercase",
            { field: fieldName },
          ),
      );
    }
    if (options.requireNumbers && !/[0-9]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordNumber",
            { field: fieldName },
          ),
      );
    }
    if (options.requireSymbols && !/[^a-zA-Z0-9]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordSpecial",
            { field: fieldName },
          ),
      );
    }
  }

  // 枚举验证
  if (rule.enum && !rule.enum.includes(value)) {
    throw new ValidationError(
      fieldName,
      rule.message ||
        $tr(
          "log.validation.enum",
          { field: fieldName, values: rule.enum.join(", ") },
        ),
    );
  }

  // 数组验证
  if (rule.array) {
    validateArraySql(fieldName, value, rule.array, allValues);
  }

  // 跨字段验证：equals（与另一个字段值相等）
  if (rule.equals) {
    const otherValue = allValues[rule.equals];
    if (value !== otherValue) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.equals",
            {
              field: fieldName,
              other: rule.equals,
            },
          ),
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
          $tr(
            "log.validation.notEquals",
            { field: fieldName, other: rule.notEquals },
          ),
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

export function validateMongoField(
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
    const shouldValidate = checkWhenCondition(rule.when, allValues);
    if (!shouldValidate) {
      return; // 条件不满足，跳过验证
    }
  }

  // 条件必填验证
  let isRequired = rule.required || false;
  if (rule.requiredWhen) {
    const shouldBeRequired = checkWhenCondition(
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
      rule?.message ||
        $tr("log.validation.required", {
          field: fieldName,
        }),
    );
  }

  // 如果值为空且不是必填，跳过其他验证
  if (value === null || value === undefined || value === "") {
    return;
  }

  // 格式验证（内置格式验证器）
  if (rule.format) {
    validateFormat(fieldName, value, rule.format, rule.message);
  }

  // 枚举类型验证（优先检查字段定义中的 enum）
  if (fieldDef.type === "enum") {
    if (fieldDef.enum && !fieldDef.enum.includes(value)) {
      throw new ValidationError(
        fieldName,
        rule?.message ||
          $tr("log.validation.enum", {
            field: fieldName,
            choices: fieldDef.enum.join(", "),
          }),
      );
    }
  }

  // 类型验证
  if (fieldDef.type && fieldDef.type !== "enum") {
    const typeCheck = checkType(value, fieldDef.type);
    if (!typeCheck) {
      throw new ValidationError(
        fieldName,
        rule?.message ||
          $tr(
            "log.validation.typeExpected",
            { field: fieldName, type: fieldDef.type },
          ),
      );
    }
  }

  // 验证规则中的类型验证（如果字段定义中没有指定类型）
  if (rule?.type && !fieldDef.type) {
    const typeCheck = checkType(value, rule.type);
    if (!typeCheck) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.typeExpected",
            { field: fieldName, type: rule.type },
          ),
      );
    }
  }

  // 验证规则中的枚举验证（如果字段定义中没有指定枚举）
  if (rule?.enum && fieldDef.type !== "enum" && !rule.enum.includes(value)) {
    throw new ValidationError(
      fieldName,
      rule.message ||
        $tr(
          "log.validation.enum",
          { field: fieldName, values: rule.enum.join(", ") },
        ),
    );
  }

  // 字符串长度验证
  if (rule && typeof value === "string") {
    if (rule.length !== undefined && value.length !== rule.length) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.lengthRequired",
            { field: fieldName, length: String(rule.length) },
          ),
      );
    }
    if (rule.min !== undefined && value.length < rule.min) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.minLength",
            { field: fieldName, min: rule.min },
          ),
      );
    }
    if (rule.max !== undefined && value.length > rule.max) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.maxLength",
            { field: fieldName, max: rule.max },
          ),
      );
    }
  }

  // 数字范围验证
  if (rule && typeof value === "number") {
    if (rule.min !== undefined && value < rule.min) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.minNumber",
            {
              field: fieldName,
              min: rule.min,
            },
          ),
      );
    }
    if (rule.max !== undefined && value > rule.max) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.maxNumber",
            {
              field: fieldName,
              max: rule.max,
            },
          ),
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
        rule.message ||
          $tr("log.validation.pattern", {
            field: fieldName,
          }),
      );
    }
  }

  // 数值验证增强
  if (typeof value === "number") {
    // 整数验证
    if (rule?.integer && !Number.isInteger(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.integer", {
            field: fieldName,
          }),
      );
    }

    // 正数验证
    if (rule?.positive && value <= 0) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.positive", {
            field: fieldName,
          }),
      );
    }

    // 负数验证
    if (rule?.negative && value >= 0) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.negative", {
            field: fieldName,
          }),
      );
    }

    // 倍数验证
    if (rule?.multipleOf !== undefined) {
      if (value % rule.multipleOf !== 0) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.multipleOf",
              { field: fieldName, multipleOf: rule.multipleOf },
            ),
        );
      }
    }

    // 范围验证
    if (rule?.range) {
      const [min, max] = rule.range;
      if (value < min || value > max) {
        throw new ValidationError(
          fieldName,
          rule.message ||
            $tr(
              "log.validation.range",
              { field: fieldName, min, max },
            ),
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
          $tr(
            "log.validation.alphaNum",
            {
              field: fieldName,
            },
          ),
      );
    }

    if (rule?.numeric && !/^[0-9]+$/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.numeric", {
            field: fieldName,
          }),
      );
    }

    if (rule?.alpha && !/^[a-zA-Z]+$/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.alpha", {
            field: fieldName,
          }),
      );
    }

    // 大小写验证
    if (rule?.lowercase && value !== value.toLowerCase()) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.lowercase", {
            field: fieldName,
          }),
      );
    }

    if (rule?.uppercase && value !== value.toUpperCase()) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr("log.validation.uppercase", {
            field: fieldName,
          }),
      );
    }

    // 字符串包含验证
    if (
      rule?.startsWith !== undefined && !value.startsWith(rule.startsWith)
    ) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.startsWith",
            { field: fieldName, value: rule.startsWith },
          ),
      );
    }

    if (rule?.endsWith !== undefined && !value.endsWith(rule.endsWith)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.endsWith",
            { field: fieldName, value: rule.endsWith },
          ),
      );
    }

    if (rule?.contains !== undefined && !value.includes(rule.contains)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.contains",
            { field: fieldName, value: rule.contains },
          ),
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
            rule.message ||
              $tr(
                "log.validation.before",
                {
                  field: fieldName,
                  value: String(rule.before),
                },
              ),
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
            rule.message ||
              $tr(
                "log.validation.after",
                {
                  field: fieldName,
                  value: String(rule.after),
                },
              ),
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
            rule.message ||
              $tr(
                "log.validation.beforeTime",
                { field: fieldName, value: rule.beforeTime },
              ),
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
            rule.message ||
              $tr(
                "log.validation.afterTime",
                { field: fieldName, value: rule.afterTime },
              ),
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
          $tr(
            "log.validation.passwordMinLength",
            { field: fieldName, min: options.minLength },
          ),
      );
    }
    if (options.requireUppercase && !/[A-Z]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordUppercase",
            { field: fieldName },
          ),
      );
    }
    if (options.requireLowercase && !/[a-z]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordLowercase",
            { field: fieldName },
          ),
      );
    }
    if (options.requireNumbers && !/[0-9]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordNumber",
            { field: fieldName },
          ),
      );
    }
    if (options.requireSymbols && !/[^a-zA-Z0-9]/.test(value)) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          $tr(
            "log.validation.passwordSpecial",
            { field: fieldName },
          ),
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
          $tr(
            "log.validation.equals",
            {
              field: fieldName,
              other: rule.equals,
            },
          ),
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
          $tr(
            "log.validation.notEquals",
            { field: fieldName, other: rule.notEquals },
          ),
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
          (typeof result === "string" ? result : $tr(
            "log.validation.customFailed",
            {
              field: fieldName,
            },
          )),
      );
    }
  }

  // 数组验证
  if (rule.array) {
    validateArrayMongo(fieldName, value, rule.array, allValues);
  }

  // 自定义验证
  if (rule?.custom) {
    const result = rule.custom(value);
    if (result !== true) {
      throw new ValidationError(
        fieldName,
        rule.message ||
          (typeof result === "string" ? result : $tr(
            "log.validation.customFailed",
            {
              field: fieldName,
            },
          )),
      );
    }
  }
}

export async function validateUnique(
  host: ValidationHost,
  fieldName: string,
  value: any,
  options: {
    exclude?: Record<string, any>;
    where?: Record<string, any>;
  },
  instanceId?: any,
): Promise<void> {
  await host.ensureAdapter();

  const storeName = host.storeName;
  if (!storeName) {
    throw new Error($tr(host.missingStoreMessageKey));
  }

  const where: Record<string, any> = {
    [fieldName]: value,
    ...(options.where || {}),
  };

  if (instanceId !== undefined) {
    const primaryKey = host.primaryKey || host.defaultPrimaryKey;
    where[primaryKey] = { $ne: instanceId };
  }

  if (options.exclude) {
    assignData(where, options.exclude);
  }

  const exists = await host.queryExists(where);
  if (exists) {
    throw new ValidationError(
      fieldName,
      $tr(
        "log.validation.unique",
        { field: fieldName },
      ),
    );
  }
}

export async function validateExists(
  host: ValidationHost,
  fieldName: string,
  value: any,
  options: {
    table?: string;
    collection?: string;
    where?: Record<string, any>;
  },
): Promise<void> {
  await host.ensureAdapter();

  const storeName = options.table || options.collection || host.storeName;
  if (!storeName) {
    throw new Error($tr(host.missingStoreMessageKey));
  }

  const where: Record<string, any> = {
    ...(options.where || {}),
  };
  const nullKey = host.existsNullKey;
  if (where[nullKey] === null) {
    where[nullKey] = value;
  } else if (!where[nullKey] && !where[fieldName]) {
    where[fieldName] = value;
  }

  const original = host.storeName;
  host.setStoreName(storeName);
  try {
    const exists = await host.queryExists(where);
    if (!exists) {
      throw new ValidationError(
        fieldName,
        $tr(
          "log.validation.exists",
          { field: fieldName },
        ),
      );
    }
  } finally {
    if (original !== undefined) {
      host.setStoreName(original);
    }
  }
}

export async function validateNotExists(
  host: ValidationHost,
  fieldName: string,
  value: any,
  options: {
    table?: string;
    collection?: string;
    where?: Record<string, any>;
  },
): Promise<void> {
  await host.ensureAdapter();

  const storeName = options.table || options.collection || host.storeName;
  if (!storeName) {
    throw new Error($tr(host.missingStoreMessageKey));
  }

  const where: Record<string, any> = {
    [fieldName]: value,
    ...(options.where || {}),
  };

  const exists = await host.queryExists(where);
  if (exists) {
    throw new ValidationError(
      fieldName,
      $tr(
        "log.validation.notExists",
        { field: fieldName },
      ),
    );
  }
}

export async function validateCompareValue(
  host: ValidationHost,
  fieldName: string,
  value: any,
  options: {
    targetField: string;
    targetModel?: any;
    compare?: "=" | ">" | "<" | ">=" | "<=";
    where?: Record<string, any>;
  },
  instanceId?: any,
  allValues?: Record<string, any>,
): Promise<void> {
  await host.ensureAdapter();

  const TargetModel = options.targetModel || host.model;
  if (TargetModel.ensureAdapter) {
    await TargetModel.ensureAdapter();
  }

  let targetValue: any;

  if (!options.targetModel && !instanceId && allValues) {
    targetValue = allValues[options.targetField];
    if (targetValue === undefined) {
      throw new ValidationError(
        fieldName,
        $tr(
          "log.validation.compareValueNotFound",
          { field: fieldName, targetField: options.targetField },
        ),
      );
    }
  } else {
    const where: Record<string, any> = {
      ...(options.where || {}),
    };

    if (!options.targetModel && instanceId) {
      where[host.primaryKey] = instanceId;
    }

    const targetRecord = TargetModel === host.model
      ? await host.queryFindOne(where, [options.targetField])
      : await TargetModel.query()
        .where(where)
        .fields([options.targetField])
        .findOne();

    if (!targetRecord) {
      throw new ValidationError(
        fieldName,
        $tr(
          "log.validation.compareValueNoRecord",
          { field: fieldName },
        ),
      );
    }

    targetValue =
      (targetRecord as Record<string, unknown>)[options.targetField];
  }

  const compare = options.compare || "=";
  let isValid = false;

  if (host.dialect === "mongo") {
    if (compare === "=") {
      const valueStr = value?.toString();
      const targetStr = targetValue?.toString();
      isValid = value === targetValue || valueStr === targetStr;
    } else {
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
  } else {
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
  }

  if (!isValid) {
    const operatorKey = {
      "=": "compareValueEqual",
      ">": "compareValueGreater",
      "<": "compareValueLess",
      ">=": "compareValueGreaterOrEqual",
      "<=": "compareValueLessOrEqual",
    }[compare];
    throw new ValidationError(
      fieldName,
      $tr(
        `log.validation.${operatorKey}`,
        {
          field: fieldName,
          targetField: options.targetField,
          targetValue: String(targetValue),
        },
      ),
    );
  }
}

export async function validateFieldAsync(
  host: ValidationHost,
  fieldName: string,
  value: any,
  fieldDef: FieldDefinition,
  allValues: Record<string, any>,
  instanceId?: any,
): Promise<void> {
  const rule = fieldDef.validate;
  if (!rule) {
    return;
  }

  if (value === null || value === undefined || value === "") {
    return;
  }

  if (rule.unique) {
    await validateUnique(
      host,
      fieldName,
      value,
      rule.unique === true ? {} : rule.unique,
      instanceId,
    );
  }

  if (rule.exists) {
    await validateExists(
      host,
      fieldName,
      value,
      rule.exists === true ? {} : rule.exists,
    );
  }

  if (rule.notExists) {
    await validateNotExists(
      host,
      fieldName,
      value,
      rule.notExists === true ? {} : rule.notExists,
    );
  }

  if (rule.compareValue) {
    await validateCompareValue(
      host,
      fieldName,
      value,
      rule.compareValue,
      instanceId,
      allValues,
    );
  }

  if (rule.asyncCustom) {
    const result = await rule.asyncCustom(value, allValues, {
      fieldName,
      instanceId,
      model: host.model,
    });
    if (result !== true) {
      const fallback = host.dialect === "mongo"
        ? `${fieldName} validation failed`
        : `${fieldName} 验证失败`;
      throw new ValidationError(
        fieldName,
        rule.message ||
          (typeof result === "string" ? result : fallback),
      );
    }
  }
}

export async function validateRecord(
  host: ValidationHost,
  data: Record<string, any>,
  instanceId?: any,
  groups?: string[],
  onlyValidateProvidedFields?: boolean,
  providedFields?: Set<string>,
): Promise<void> {
  const schema = host.getSchema();
  if (!schema) {
    return;
  }

  const asyncValidations: Promise<void>[] = [];
  const schemaKeys = host.getSchemaKeys();
  const dialect = host.dialect;
  const validateField = dialect === "mongo"
    ? validateMongoField
    : validateSqlField;

  for (const fieldName of schemaKeys) {
    const fieldDef = schema[fieldName];
    const value = data[fieldName];

    if (onlyValidateProvidedFields) {
      if (providedFields) {
        if (!providedFields.has(fieldName)) {
          continue;
        }
      } else if (!(fieldName in data) || value === undefined) {
        continue;
      }
    }

    if (groups && fieldDef.validate?.groups) {
      const hasGroup = fieldDef.validate.groups.some((g) => groups.includes(g));
      if (!hasGroup) {
        continue;
      }
    }

    validateField(fieldName, value, fieldDef, data);

    if (value !== null && value !== undefined && value !== "") {
      asyncValidations.push(
        validateFieldAsync(host, fieldName, value, fieldDef, data, instanceId),
      );
    }
  }

  if (asyncValidations.length > 0) {
    await Promise.all(asyncValidations);
  }
}
