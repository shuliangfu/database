/**
 * @fileoverview MongoModel 数据验证测试
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { type ModelSchema, MongoModel } from "../../src/orm/mongo-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_NAME = "mongo_validation_users";
const COLLECTION_CATEGORIES = "mongo_validation_categories";
const COLLECTION_BANNED_EMAILS = "mongo_validation_banned_emails";
const COLLECTION_UNIQUE_TEST = "mongo_validation_unique_test";

describe("MongoModel 数据验证", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase({
        type: "mongodb",
        connection: {
          host: "localhost",
          port: 27017,
          database: "test_mongo_validation",
        },
        mongoOptions: {
          timeoutMS: 5000,
          replicaSet: "rs0", // 指定副本集名称
          directConnection: true,
        },
      });
      adapter = getDatabase() as DatabaseAdapter;
    } catch (error) {
      console.log("MongoDB not available, skipping validation tests");
      console.error(error);
    }
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  describe("基础验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证必填字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          name: {
            type: "string",
            validate: { required: true },
          },
          email: {
            type: "string",
            validate: { required: true },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 缺少必填字段应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({ name: "Test" } as any);
        },
        Error,
      );

      // 提供所有必填字段应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证字段类型", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: { type: "number" },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 类型错误应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: "not_a_number" as any,
          });
        },
        Error,
      );

      // 正确类型应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 25,
      });
      expect(user.age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证最小值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: { min: 18 },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 小于最小值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 15,
          });
        },
        Error,
      );

      // 大于等于最小值应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 20,
      });
      expect(user.age).toBe(20);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证最大值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: { max: 100 },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 大于最大值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 150,
          });
        },
        Error,
      );

      // 小于等于最大值应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 50,
      });
      expect(user.age).toBe(50);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证正则表达式", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 不符合正则表达式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "invalid_email",
          });
        },
        Error,
      );

      // 符合正则表达式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@example.com",
      });
      expect(user.email).toBe("test@example.com");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证枚举值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          status: {
            type: "enum",
            enum: ["active", "inactive", "pending"],
            validate: {
              enum: ["active", "inactive", "pending"],
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 不在枚举值中应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            status: "invalid" as any,
          });
        },
        Error,
      );

      // 在枚举值中应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        status: "active",
      });
      expect(user.status).toBe("active");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证自定义验证函数", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: {
              custom: (value: any) => {
                if (value < 0 || value > 150) {
                  return "年龄必须在 0-150 之间";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 自定义验证失败应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 200,
          });
        },
        Error,
      );

      // 自定义验证通过应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 25,
      });
      expect(user.age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("跨字段验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证跨字段相等（equals）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          password: {
            type: "string",
            validate: { required: true },
          },
          confirmPassword: {
            type: "string",
            validate: {
              required: true,
              equals: "password",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 密码不匹配应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            password: "password123",
            confirmPassword: "password456",
          });
        },
        Error,
      );

      // 密码匹配应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证跨字段不相等（notEquals）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          oldPassword: {
            type: "string",
            validate: { required: true },
          },
          newPassword: {
            type: "string",
            validate: {
              required: true,
              notEquals: "oldPassword",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 新旧密码相同应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            oldPassword: "password123",
            newPassword: "password123",
          });
        },
        Error,
      );

      // 新旧密码不同应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        oldPassword: "password123",
        newPassword: "password456",
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证跨字段自定义比较（compare）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          startDate: {
            type: "date",
            validate: { required: true },
          },
          endDate: {
            type: "date",
            validate: {
              required: true,
              compare: (value, allValues) => {
                if (value <= allValues.startDate) {
                  return "结束日期必须大于开始日期";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 结束日期小于等于开始日期应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            startDate: new Date("2024-12-31"),
            endDate: new Date("2024-12-30"),
          });
        },
        Error,
      );

      // 结束日期大于开始日期应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("跨表/跨字段值比较验证（compareValue）", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
        await db.collection(COLLECTION_CATEGORIES).deleteMany({});
      }
    });

    it("应该验证同表跨字段比较（compareValue - 等于）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          startDate: {
            type: "string",
            validate: { required: true },
          },
          endDate: {
            type: "string",
            validate: {
              required: true,
              compareValue: {
                targetField: "startDate",
                compare: ">",
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            startDate: "2024-12-31",
            endDate: "2024-12-30",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            startDate: "2024-12-31",
            endDate: "2024-12-31",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证跨表比较（compareValue - 跨表）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class Category extends MongoModel {
        static override collectionName = COLLECTION_CATEGORIES;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          name: {
            type: "string",
            validate: { required: true },
          },
        };
      }
      Category.setAdapter(adapter);

      const category = await Category.create({
        name: "Test Category",
      });

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          categoryId: {
            type: "any",
            validate: {
              compareValue: {
                targetField: "_id",
                targetModel: Category,
                compare: "=",
                where: { _id: category._id },
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建一个无效的 ObjectId 用于测试
      const invalidId = category._id.toString().split("").reverse().join("");
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            categoryId: invalidId,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        categoryId: category._id,
      });
      // MongoDB 的 _id 可能是 ObjectId 或字符串，比较时使用字符串形式
      expect(user.categoryId.toString()).toBe(category._id.toString());
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证数值比较（compareValue - 大于等于）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: { required: true },
          },
          score: {
            type: "number",
            validate: {
              compareValue: {
                targetField: "age",
                compare: ">=",
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 30,
            score: 20,
          });
        },
        Error,
      );

      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        age: 30,
        score: 30,
      });
      expect(user1.score).toBe(30);

      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
        age: 30,
        score: 50,
      });
      expect(user2.score).toBe(50);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证数值比较（compareValue - 小于等于）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: { required: true },
          },
          score: {
            type: "number",
            validate: {
              compareValue: {
                targetField: "age",
                compare: "<=",
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 30,
            score: 50,
          });
        },
        Error,
      );

      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        age: 30,
        score: 30,
      });
      expect(user1.score).toBe(30);

      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
        age: 30,
        score: 20,
      });
      expect(user2.score).toBe(20);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("唯一性验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
        await db.collection(COLLECTION_UNIQUE_TEST).deleteMany({});
      }
    });

    it("应该验证唯一性（unique）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              unique: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建第一个用户应该成功
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test@test.com",
      });
      expect(user1).toBeTruthy();

      // 创建相同邮箱的用户应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test@test.com",
          });
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证唯一性（更新时排除当前记录）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              unique: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建用户
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
      });
      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
      });

      // 更新用户1的邮箱为已存在的邮箱应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.update(String(user1._id), {
            email: "test2@test.com",
          });
        },
        Error,
      );

      // 更新用户1的邮箱为相同邮箱应该成功（排除当前记录）
      await ValidatedUser.update(String(user1._id), {
        email: "test1@test.com",
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证唯一性（更新时修改唯一字段，不能与其他人重复）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              required: true,
              unique: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建两个用户
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        username: "user1",
      });
      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
        username: "user2",
      });

      expect(user1).toBeTruthy();
      expect(user2).toBeTruthy();

      // 更新用户1的username为user2的username（已存在的值），应该验证失败
      await assertRejects(
        async () => {
          await ValidatedUser.update(String(user1._id), {
            username: "user2", // 这个值已经被 user2 使用了
          });
        },
        Error,
      );

      // 验证更新失败后，user1的username没有被修改
      const user1AfterFailedUpdate = await ValidatedUser.findById(
        String(user1._id),
      );
      expect(user1AfterFailedUpdate).toBeTruthy();
      expect(user1AfterFailedUpdate?.username).toBe("user1"); // 仍然是原来的值

      // 更新用户1的username为一个新的唯一值，应该成功
      await ValidatedUser.update(String(user1._id), {
        username: "user1_new",
      });

      // 验证更新成功
      const user1AfterUpdate = await ValidatedUser.findById(String(user1._id));
      expect(user1AfterUpdate).toBeTruthy();
      expect(user1AfterUpdate?.username).toBe("user1_new");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证唯一性（更新时只修改其他字段，唯一字段不变）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      /**
       * 测试场景：
       * 1. 数据库有3条数据：{ _id: 1, username: "user_1", age: 20 }, { _id: 2, username: "user_2", age: 22 }, { _id: 3, username: "user_3", age: 30 }
       * 2. username是唯一字段
       * 3. 更新_id为1的数据，只修改age为30，应该可以（因为username没变，是自己的值）
       * 4. 更新_id为1的数据，修改username为user_2（已存在的值），应该验证失败
       */
      class UniqueTestUser extends MongoModel {
        static override collectionName = COLLECTION_UNIQUE_TEST;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              required: true,
              unique: true,
            },
          },
          age: {
            type: "number",
          },
        };
      }
      UniqueTestUser.setAdapter(adapter);

      // 创建3条测试数据
      const user1 = await UniqueTestUser.create({
        username: "user_1",
        age: 20,
      });
      const user2 = await UniqueTestUser.create({
        username: "user_2",
        age: 22,
      });
      const user3 = await UniqueTestUser.create({
        username: "user_3",
        age: 30,
      });

      expect(user1).toBeTruthy();
      expect(user2).toBeTruthy();
      expect(user3).toBeTruthy();

      // 场景1：更新_id为1的数据，只修改age为30，应该可以（因为username没变，是自己的值）
      const updated1 = await UniqueTestUser.update(String(user1._id), {
        age: 30,
      });
      expect(updated1).toBeGreaterThan(0);

      // 验证更新成功
      const user1AfterUpdate = await UniqueTestUser.findById(
        String(user1._id),
      );
      expect(user1AfterUpdate).toBeTruthy();
      expect(user1AfterUpdate?.age).toBe(30);
      expect(user1AfterUpdate?.username).toBe("user_1"); // username 没变

      // 场景2：更新_id为1的数据，修改username为user_2（已存在的值），应该验证失败
      await assertRejects(
        async () => {
          await UniqueTestUser.update(String(user1._id), {
            username: "user_2", // 这个值已经被 user2 使用了
          });
        },
        Error,
      );

      // 验证更新失败后，数据没有被修改
      const user1AfterFailedUpdate = await UniqueTestUser.findById(
        String(user1._id),
      );
      expect(user1AfterFailedUpdate).toBeTruthy();
      expect(user1AfterFailedUpdate?.username).toBe("user_1"); // 仍然是原来的值
      expect(user1AfterFailedUpdate?.age).toBe(30); // age 仍然是之前更新的值

      // 场景3：更新_id为1的数据，同时修改username和age，但username改为已存在的值，应该验证失败
      await assertRejects(
        async () => {
          await UniqueTestUser.update(String(user1._id), {
            username: "user_3", // 这个值已经被 user3 使用了
            age: 25,
          });
        },
        Error,
      );

      // 场景4：更新_id为1的数据，修改username为一个新的唯一值，应该成功
      const updated2 = await UniqueTestUser.update(String(user1._id), {
        username: "user_1_updated", // 新的唯一值
        age: 25,
      });
      expect(updated2).toBeGreaterThan(0);

      // 验证更新成功
      const user1AfterFinalUpdate = await UniqueTestUser.findById(
        String(user1._id),
      );
      expect(user1AfterFinalUpdate).toBeTruthy();
      expect(user1AfterFinalUpdate?.username).toBe("user_1_updated");
      expect(user1AfterFinalUpdate?.age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("数据库查询验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_CATEGORIES).deleteMany({});
        await db.collection(COLLECTION_BANNED_EMAILS).deleteMany({});
        await db.collection(COLLECTION_NAME).deleteMany({
          categoryId: { $exists: true },
        });
      }
    });

    it("应该验证存在性（exists）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先创建一个分类集合
      class Category extends MongoModel {
        static override collectionName = COLLECTION_CATEGORIES;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          name: {
            type: "string",
            validate: { required: true },
          },
        };
      }
      Category.setAdapter(adapter);

      // 创建分类
      const category = await Category.create({ name: "Tech" });

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          categoryId: {
            type: "string",
            validate: {
              required: true,
              exists: {
                collection: COLLECTION_CATEGORIES,
                where: { _id: null }, // 将在验证时替换为实际值
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 使用存在的分类ID应该成功
      // 注意：validateExists 使用 fieldName 查询，所以需要查询 categories 集合中的 categoryId 字段
      // 但 MongoDB 中通常使用 _id 作为主键，所以我们需要在 where 条件中指定
      // 或者直接使用 _id 字段
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        categoryId: String(category._id),
      });
      expect(user).toBeTruthy();

      // 使用不存在的分类ID应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test2@test.com",
            categoryId: "507f1f77bcf86cd799439011",
          });
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证不存在性（notExists）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              notExists: {
                collection: COLLECTION_BANNED_EMAILS,
                where: {},
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建被禁止邮箱集合
      class BannedEmail extends MongoModel {
        static override collectionName = COLLECTION_BANNED_EMAILS;
        static override primaryKey = "_id";
      }
      BannedEmail.setAdapter(adapter);
      await BannedEmail.create({ email: "banned@test.com" });

      // 使用被禁止的邮箱应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "banned@test.com",
          });
        },
        Error,
      );

      // 使用未被禁止的邮箱应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "allowed@test.com",
      });
      expect(user).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("条件验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证条件验证（when）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          hasDiscount: {
            type: "boolean",
            validate: { required: true },
          },
          discountCode: {
            type: "string",
            validate: {
              when: {
                field: "hasDiscount",
                is: true,
              },
              required: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 当 hasDiscount 为 true 时，discountCode 必填
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            hasDiscount: true,
            discountCode: undefined,
          });
        },
        Error,
      );

      // 当 hasDiscount 为 false 时，discountCode 不需要验证
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        hasDiscount: false,
        discountCode: undefined,
      });
      expect(user1).toBeTruthy();

      // 当 hasDiscount 为 true 且提供 discountCode 时应该成功
      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
        hasDiscount: true,
        discountCode: "SAVE20",
      });
      expect(user2).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证条件必填（requiredWhen）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          userType: {
            type: "string",
            validate: { required: true },
          },
          companyName: {
            type: "string",
            validate: {
              requiredWhen: {
                field: "userType",
                is: "company",
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 当 userType 为 "company" 时，companyName 必填
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            userType: "company",
            companyName: undefined,
          });
        },
        Error,
      );

      // 当 userType 为 "individual" 时，companyName 不需要必填
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        userType: "individual",
        companyName: undefined,
      });
      expect(user1).toBeTruthy();

      // 当 userType 为 "company" 且提供 companyName 时应该成功
      const user2 = await ValidatedUser.create({
        name: "Test2",
        email: "test2@test.com",
        userType: "company",
        companyName: "Test Company",
      });
      expect(user2).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("高级验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证异步自定义验证（asyncCustom）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              required: true,
              asyncCustom: async (value, allValues, context) => {
                // 检查用户名是否已存在（排除当前记录）
                const existing = await context.model
                  .query()
                  .where({ username: value })
                  .findOne();
                // instanceId 可能是 ObjectId 对象或字符串，需要统一转换为字符串比较
                const instanceIdStr = context.instanceId
                  ? String(context.instanceId)
                  : null;
                const existingIdStr = existing ? String(existing._id) : null;
                if (
                  existing && instanceIdStr && existingIdStr !== instanceIdStr
                ) {
                  return "用户名已存在";
                }
                if (existing && !instanceIdStr) {
                  return "用户名已存在";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建第一个用户应该成功
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test1@test.com",
        username: "testuser",
      });
      expect(user1).toBeTruthy();

      // 创建相同用户名的用户应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test2@test.com",
            username: "testuser",
          });
        },
        Error,
      );

      // 更新用户1的用户名为相同用户名应该成功（排除当前记录）
      // 注意：更新时需要提供所有必填字段
      await ValidatedUser.update(String(user1._id), {
        name: user1.name,
        email: user1.email,
        username: "testuser",
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证验证组（groups）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          password: {
            type: "string",
            validate: {
              required: true,
              groups: ["create", "update"],
            },
          },
          email: {
            type: "string",
            validate: {
              required: true,
              groups: ["create"],
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 使用 "create" 组验证，password 和 email 都需要
      await assertRejects(
        async () => {
          await ValidatedUser.validate(
            { password: "12345678" },
            undefined,
            ["create"],
          );
        },
        Error,
      );

      // 使用 "update" 组验证，只需要 password
      await ValidatedUser.validate(
        { password: "12345678" },
        undefined,
        ["update"],
      );

      // 不使用验证组，所有字段都需要验证
      await assertRejects(
        async () => {
          await ValidatedUser.validate({ password: "12345678" });
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证数组（array）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          tags: {
            type: "array",
            validate: {
              array: {
                type: "string",
                min: 1,
                max: 5,
                items: {
                  min: 2,
                  max: 20,
                },
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 数组长度小于最小值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: [],
          });
        },
        Error,
      );

      // 数组长度大于最大值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
          });
        },
        Error,
      );

      // 数组元素长度小于最小值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["a"],
          });
        },
        Error,
      );

      // 数组元素长度大于最大值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["a".repeat(21)],
          });
        },
        Error,
      );

      // 有效的数组应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        tags: ["tag1", "tag2", "tag3"],
      });
      expect(user.tags).toEqual(["tag1", "tag2", "tag3"]);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("格式验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证格式（format - email）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              format: "email",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的邮箱格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "invalid_email",
          });
        },
        Error,
      );

      // 有效的邮箱格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@example.com",
      });
      expect(user.email).toBe("test@example.com");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证格式（format - url）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          website: {
            type: "string",
            validate: {
              format: "url",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 URL 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            website: "not_a_url",
          });
        },
        Error,
      );

      // 有效的 URL 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        website: "https://example.com",
      });
      expect(user.website).toBe("https://example.com");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证格式（format - ipv4）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          ipAddress: {
            type: "string",
            validate: {
              format: "ipv4",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 IPv4 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            ipAddress: "999.999.999.999",
          });
        },
        Error,
      );

      // 有效的 IPv4 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        ipAddress: "192.168.1.1",
      });
      expect(user.ipAddress).toBe("192.168.1.1");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证格式（format - uuid）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          uuid: {
            type: "string",
            validate: {
              format: "uuid",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 UUID 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            uuid: "not-a-uuid",
          });
        },
        Error,
      );

      // 有效的 UUID 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(user.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证格式（format - date）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          birthDate: {
            type: "string",
            validate: {
              format: "date",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的日期格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            birthDate: "not-a-date",
          });
        },
        Error,
      );

      // 有效的日期格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        birthDate: "2024-01-01",
      });
      expect(user.birthDate).toBe("2024-01-01");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证格式（format - time）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          workTime: {
            type: "string",
            validate: {
              format: "time",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的时间格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "25:00:00",
          });
        },
        Error,
      );

      // 有效的时间格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        workTime: "09:00:00",
      });
      expect(user.workTime).toBe("09:00:00");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("数值验证增强", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证整数（integer）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          age: {
            type: "number",
            validate: {
              integer: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 25.5,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 25,
      });
      expect(user.age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证正数（positive）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          score: {
            type: "number",
            validate: {
              positive: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            score: -10,
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            score: 0,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        score: 100,
      });
      expect(user.score).toBe(100);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证负数（negative）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          score: {
            type: "number",
            validate: {
              negative: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            score: 10,
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            score: 0,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        score: -10,
      });
      expect(user.score).toBe(-10);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证倍数（multipleOf）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          price: {
            type: "number",
            validate: {
              multipleOf: 5,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            price: 13,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        price: 15,
      });
      expect(user.price).toBe(15);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证范围（range）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          percentage: {
            type: "number",
            validate: {
              range: [0, 100],
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            percentage: -1,
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            percentage: 101,
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        percentage: 50,
      });
      expect(user.percentage).toBe(50);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("字符串验证增强", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证字母数字（alphanumeric）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              alphanumeric: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            username: "user_name",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "user123",
      });
      expect(user.username).toBe("user123");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证数字（numeric）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          userCode: {
            type: "string",
            validate: {
              numeric: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            userCode: "123abc",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        userCode: "123456",
      });
      expect(user.userCode).toBe("123456");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证字母（alpha）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              alpha: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            username: "user123",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "username",
      });
      expect(user.username).toBe("username");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证小写（lowercase）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              lowercase: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            username: "UserName",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "username",
      });
      expect(user.username).toBe("username");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证大写（uppercase）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          productCode: {
            type: "string",
            validate: {
              uppercase: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            productCode: "PRODUCTcode",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        productCode: "PRODUCT",
      });
      expect(user.productCode).toBe("PRODUCT");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证开头（startsWith）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          website: {
            type: "string",
            validate: {
              startsWith: "https://",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            website: "http://example.com",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        website: "https://example.com",
      });
      expect(user.website).toBe("https://example.com");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证结尾（endsWith）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          domain: {
            type: "string",
            validate: {
              endsWith: ".com",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            domain: "example.org",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        domain: "example.com",
      });
      expect(user.domain).toBe("example.com");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证包含（contains）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          textField: {
            type: "string",
            validate: {
              contains: "admin",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            textField: "user",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        textField: "admin_user",
      });
      expect(user.textField).toBe("admin_user");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该自动去除首尾空格（trim）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              trim: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "  username  ",
      });
      expect(user.username).toBe("username");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该自动转换为小写（toLowerCase）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              toLowerCase: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "USERNAME",
      });
      expect(user.username).toBe("username");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该自动转换为大写（toUpperCase）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          productCode: {
            type: "string",
            validate: {
              toUpperCase: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        productCode: "product",
      });
      expect(user.productCode).toBe("PRODUCT");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("日期/时间验证增强", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证日期早于（before）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          birthDate: {
            type: "string",
            validate: {
              before: "2024-01-01",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            birthDate: "2024-01-01",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            birthDate: "2024-12-31",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        birthDate: "2023-12-31",
      });
      expect(user.birthDate).toBe("2023-12-31");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证日期晚于（after）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          eventDate: {
            type: "string",
            validate: {
              after: "2024-01-01",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            eventDate: "2024-01-01",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            eventDate: "2023-12-31",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        eventDate: "2024-12-31",
      });
      expect(user.eventDate).toBe("2024-12-31");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证时间早于（beforeTime）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          workTime: {
            type: "string",
            validate: {
              format: "time",
              beforeTime: "18:00:00",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "18:00:00",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "19:00:00",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        workTime: "17:00:00",
      });
      expect(user.workTime).toBe("17:00:00");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该验证时间晚于（afterTime）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          workTime: {
            type: "string",
            validate: {
              format: "time",
              afterTime: "09:00:00",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "09:00:00",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "08:00:00",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        workTime: "10:00:00",
      });
      expect(user.workTime).toBe("10:00:00");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("数组验证增强", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证数组元素唯一性（uniqueItems）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          tags: {
            type: "array",
            validate: {
              array: {
                type: "string",
                uniqueItems: true,
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["tag1", "tag2", "tag1"],
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        tags: ["tag1", "tag2", "tag3"],
      });
      expect(user.tags).toEqual(["tag1", "tag2", "tag3"]);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("密码强度验证", () => {
    beforeEach(async () => {
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
      }
    });

    it("应该验证密码强度（passwordStrength）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class ValidatedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override primaryKey = "_id";
        static override schema: ModelSchema = {
          passwordField: {
            type: "string",
            validate: {
              passwordStrength: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSymbols: true,
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            passwordField: "Short1!",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            passwordField: "password123!",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            passwordField: "PASSWORD123!",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            passwordField: "Password!",
          });
        },
        Error,
      );

      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            passwordField: "Password123",
          });
        },
        Error,
      );

      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        passwordField: "Password123!",
      });
      expect(user.passwordField).toBe("Password123!");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
