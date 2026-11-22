/**
 * @fileoverview 模型缓存机制共用用例工厂。Mongo 额外的失效场景仍由 tests/mongo/cache.test.ts 注册。
 */

import { MemoryAdapter } from "@dreamer/cache";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import type { AnyModelClass, EngineFixture } from "../fixture.ts";

export interface CacheTestContext {
  User: AnyModelClass;
}

export function registerCacheTests(
  fx: EngineFixture,
  options?: {
    connectOverrides?: Record<string, unknown>;
    extras?: (ctx: CacheTestContext) => void;
  },
): void {
  const TABLE_NAME = fx.storeName("cache", "users");
  const title = fx.isDocument ? "MongoModel 缓存机制测试" : "缓存机制测试";

  const schema = fx.isDocument
    ? {
      _id: { type: "string" as const },
      name: { type: "string" as const, validate: { required: true } },
      email: { type: "string" as const, validate: { required: true } },
      age: { type: "number" as const },
    }
    : {
      id: { type: "integer", primaryKey: true, autoIncrement: true },
      name: { type: "string", required: true },
      email: { type: "string", required: true },
      age: { type: "integer" },
    };

  class CacheTestUser extends (fx.Model as any) {
    static schema = schema;
  }
  (CacheTestUser as any)[fx.storeProp] = TABLE_NAME;
  CacheTestUser.primaryKey = fx.primaryKey;

  const User = CacheTestUser as AnyModelClass;

  function namePatch(user: any, name: string): Record<string, unknown> {
    if (fx.isDocument) {
      return { name, email: user.email };
    }
    return { name };
  }

  describe(title, () => {
    let adapter: any;

    beforeAll(async () => {
      adapter = await fx.connect(options?.connectOverrides);
      if (!adapter) return;
      await fx.createTable(adapter, TABLE_NAME, [
        { name: "id", type: "pk" },
        { name: "name", type: "varchar", notNull: true },
        { name: "email", type: "varchar", notNull: true },
        { name: "age", type: "int" },
      ]);
      if (fx.isDocument) {
        User.setAdapter(adapter);
      } else {
        await User.init();
      }
    });

    beforeEach(async () => {
      if (User.cacheAdapter) {
        const tag = `model:${(User as any)[fx.storeProp]}`;
        try {
          User.cacheAdapter.deleteByTags([tag]);
        } catch {
          // 忽略错误，可能适配器已经被销毁
        }
        User.cacheAdapter = undefined;
      }
      if (fx.isDocument) {
        User.softDelete = false;
      }
    });

    afterEach(async () => {
      if (adapter) {
        await fx.clearStore(adapter, TABLE_NAME);
      }
      if (User.cacheAdapter) {
        const tag = `model:${(User as any)[fx.storeProp]}`;
        try {
          User.cacheAdapter.deleteByTags([tag]);
        } catch {
          // 忽略错误，可能适配器已经被销毁
        }
      }
      User.cacheAdapter = undefined;
      if (fx.isDocument) {
        User.softDelete = false;
      }
    });

    function skipIfNoAdapter(): boolean {
      if (adapter) return false;
      console.log(fx.skipMessage());
      return true;
    }

    it("应该正确缓存查询结果", async () => {
      if (skipIfNoAdapter()) return;
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      const user = await User.create({
        name: "Cache User",
        email: "cache@test.com",
        age: 25,
      });

      const user1 = await User.find(fx.id(user));
      expect(user1).toBeTruthy();
      expect(user1?.name).toBe("Cache User");

      const user2 = await User.find(fx.id(user));
      expect(user2).toBeTruthy();
      expect(user2?.name).toBe("Cache User");
      fx.expectRefEqual(fx.id(user2), user);
    });

    it("应该在数据更新后清除缓存", async () => {
      if (skipIfNoAdapter()) return;
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      const user = await User.create({
        name: "Original",
        email: "original@test.com",
        age: 25,
      });

      const user1 = await User.find(fx.id(user));
      expect(user1?.name).toBe("Original");

      await User.update(fx.id(user), namePatch(user, "Updated"));

      const user2 = await User.find(fx.id(user));
      expect(user2?.name).toBe("Updated");
    });

    it("应该在数据创建后清除相关缓存", async () => {
      if (skipIfNoAdapter()) return;
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      const users1 = await User.findAll();
      expect(users1.length).toBe(0);

      await User.create({
        name: "New User",
        email: "new@test.com",
        age: 30,
      });

      const users2 = await User.findAll();
      expect(users2.length).toBe(1);
      expect(users2[0].name).toBe("New User");
    });

    it("应该在数据删除后清除相关缓存", async () => {
      if (skipIfNoAdapter()) return;
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      const user = await User.create({
        name: "To Delete",
        email: "delete@test.com",
        age: 25,
      });

      const user1 = await User.find(fx.id(user));
      expect(user1).toBeTruthy();

      await User.delete(fx.id(user));

      const user2 = await User.find(fx.id(user));
      expect(user2).toBeNull();
    });

    it("缓存键缓存不应该影响查询结果的正确性", async () => {
      if (skipIfNoAdapter()) return;
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      const user1 = await User.find(fx.id(user));
      const user2 = await User.find(fx.id(user));
      const user3 = await User.find(fx.id(user));

      fx.expectRefEqual(fx.id(user1), user);
      fx.expectRefEqual(fx.id(user2), user);
      fx.expectRefEqual(fx.id(user3), user);

      await User.update(fx.id(user), namePatch(user, "Updated Name"));

      const user4 = await User.find(fx.id(user));
      expect(user4?.name).toBe("Updated Name");
    });

    it("应该在没有缓存适配器时不生成缓存键", async () => {
      if (skipIfNoAdapter()) return;
      User.cacheAdapter = undefined;

      const user = await User.create({
        name: "No Cache",
        email: "nocache@test.com",
        age: 25,
      });

      const user1 = await User.find(fx.id(user));
      expect(user1).toBeTruthy();
      expect(user1?.name).toBe("No Cache");

      await User.update(fx.id(user), namePatch(user, "Updated"));

      const user2 = await User.find(fx.id(user));
      expect(user2?.name).toBe("Updated");
    });

    options?.extras?.({ User });
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });
}
