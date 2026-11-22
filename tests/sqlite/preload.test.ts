/**
 * @fileoverview 关联预加载（with / preload）定向测试
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MemoryAdapter } from "@dreamer/cache";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

const TABLE_USERS = "test_sqlite_preload_users";
const TABLE_POSTS = "test_sqlite_preload_posts";
const TABLE_PROFILES = "test_sqlite_preload_profiles";
const TABLE_ROLES = "test_sqlite_preload_roles";
const TABLE_USER_ROLES = "test_sqlite_preload_user_roles";

class User extends SQLModel {
  static override tableName = TABLE_USERS;
  static override primaryKey = "id";
}

class Post extends SQLModel {
  static override tableName = TABLE_POSTS;
  static override primaryKey = "id";
}

class Profile extends SQLModel {
  static override tableName = TABLE_PROFILES;
  static override primaryKey = "id";
}

class Role extends SQLModel {
  static override tableName = TABLE_ROLES;
  static override primaryKey = "id";
}

class UserRole extends SQLModel {
  static override tableName = TABLE_USER_ROLES;
  static override primaryKey = "id";
}

class SoftDeletePost extends SQLModel {
  static override tableName = TABLE_POSTS;
  static override primaryKey = "id";
  static override softDelete = true;
  static override deletedAtField = "deleted_at";
}

describe("关联预加载", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    await initDatabase({
      adapter: "sqlite",
      connection: { filename: ":memory:" },
    });
    adapter = getDatabase();

    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_USER_ROLES}`, []).catch(
      () => {},
    );
    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_ROLES}`, []).catch(
      () => {},
    );
    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_POSTS}`, []).catch(
      () => {},
    );
    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_PROFILES}`, []).catch(
      () => {},
    );
    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_USERS}`, []).catch(
      () => {},
    );
    await adapter.execute(
      `CREATE TABLE ${TABLE_USERS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        deleted_at DATETIME
      )`,
      [],
    );
    await adapter.execute(
      `CREATE TABLE ${TABLE_POSTS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        deleted_at DATETIME
      )`,
      [],
    );
    await adapter.execute(
      `CREATE TABLE ${TABLE_PROFILES} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        bio TEXT,
        deleted_at DATETIME
      )`,
      [],
    );
    await adapter.execute(
      `CREATE TABLE ${TABLE_ROLES} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        deleted_at DATETIME
      )`,
      [],
    );
    await adapter.execute(
      `CREATE TABLE ${TABLE_USER_ROLES} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        deleted_at DATETIME
      )`,
      [],
    );

    User.setAdapter(adapter);
    Post.setAdapter(adapter);
    Profile.setAdapter(adapter);
    SoftDeletePost.setAdapter(adapter);
    Role.setAdapter(adapter);
    UserRole.setAdapter(adapter);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await adapter.execute(`DELETE FROM ${TABLE_USER_ROLES}`, []);
    await adapter.execute(`DELETE FROM ${TABLE_ROLES}`, []);
    await adapter.execute(`DELETE FROM ${TABLE_POSTS}`, []);
    await adapter.execute(`DELETE FROM ${TABLE_PROFILES}`, []);
    await adapter.execute(`DELETE FROM ${TABLE_USERS}`, []);
  });

  async function seed() {
    const alice = await User.create({
      name: "Alice",
      email: "alice@preload.test",
    });
    const bob = await User.create({
      name: "Bob",
      email: "bob@preload.test",
    });
    const p1 = await Post.create({ user_id: alice.id, title: "A1" });
    const p2 = await Post.create({ user_id: alice.id, title: "A2" });
    const p3 = await Post.create({ user_id: bob.id, title: "B1" });
    const profile = await Profile.create({
      user_id: alice.id,
      bio: "Alice bio",
    });
    const admin = await Role.create({ name: "admin" });
    const editor = await Role.create({ name: "editor" });
    await UserRole.create({ user_id: alice.id, role_id: admin.id });
    await UserRole.create({ user_id: alice.id, role_id: editor.id });
    await UserRole.create({ user_id: bob.id, role_id: editor.id });
    return { alice, bob, p1, p2, p3, profile, admin, editor };
  }

  it("应该用 with 预加载 belongsTo", async () => {
    const { alice, bob } = await seed();
    const posts = await Post.query()
      .sort({ id: "asc" })
      .with({
        author: {
          type: "belongsTo",
          model: User,
          foreignKey: "user_id",
        },
      })
      .findAll();
    expect(posts.length).toBe(3);
    expect((posts[0] as any).author?.name).toBe("Alice");
    expect((posts[0] as any).author?.id).toBe(alice.id);
    expect((posts[1] as any).author?.name).toBe("Alice");
    expect((posts[2] as any).author?.name).toBe("Bob");
    expect((posts[2] as any).author?.id).toBe(bob.id);
  });

  it("静态 preload 对 belongsTo 只发起一次关联查询", async () => {
    const { alice } = await seed();
    const posts = await Post.query().sort({ id: "asc" }).findAll();
    const original = User.findAll.bind(User);
    let calls = 0;
    (User as any).findAll = async function (...args: any[]) {
      calls++;
      return await original(...args);
    };
    try {
      await Post.preload(posts, {
        author: {
          type: "belongsTo",
          model: User,
          foreignKey: "user_id",
        },
      });
      expect(calls).toBe(1);
      expect((posts[0] as any).author?.name).toBe("Alice");
      expect((posts[0] as any).author?.id).toBe(alice.id);
    } finally {
      (User as any).findAll = original;
    }
  });

  it("应该用 preload 别名预加载 hasOne / hasMany", async () => {
    const { alice, bob } = await seed();
    const users = await User.query()
      .sort({ id: "asc" })
      .preload({
        posts: {
          type: "hasMany",
          model: Post,
          foreignKey: "user_id",
          sort: { id: "asc" },
        },
        profile: {
          type: "hasOne",
          model: Profile,
          foreignKey: "user_id",
        },
      })
      .findAll();
    expect(users.length).toBe(2);
    expect((users[0] as any).posts.map((p: any) => p.title)).toEqual([
      "A1",
      "A2",
    ]);
    expect((users[0] as any).profile?.bio).toBe("Alice bio");
    expect((users[1] as any).posts.map((p: any) => p.title)).toEqual(["B1"]);
    expect((users[1] as any).profile).toBeNull();
    expect(users[0].id).toBe(alice.id);
    expect(users[1].id).toBe(bob.id);
  });

  it("静态 preload 对 hasMany / hasOne 各只发起一次关联查询", async () => {
    await seed();
    const users = await User.query().sort({ id: "asc" }).findAll();
    const origPost = Post.findAll.bind(Post);
    const origProfile = Profile.findAll.bind(Profile);
    let postCalls = 0;
    let profileCalls = 0;
    (Post as any).findAll = async function (...args: any[]) {
      postCalls++;
      return await origPost(...args);
    };
    (Profile as any).findAll = async function (...args: any[]) {
      profileCalls++;
      return await origProfile(...args);
    };
    try {
      await User.preload(users, {
        posts: {
          type: "hasMany",
          model: Post,
          foreignKey: "user_id",
          sort: { id: "asc" },
        },
        profile: {
          type: "hasOne",
          model: Profile,
          foreignKey: "user_id",
        },
      });
      expect(postCalls).toBe(1);
      expect(profileCalls).toBe(1);
      expect((users[0] as any).posts.map((p: any) => p.title)).toEqual([
        "A1",
        "A2",
      ]);
      expect((users[0] as any).profile?.bio).toBe("Alice bio");
    } finally {
      (Post as any).findAll = origPost;
      (Profile as any).findAll = origProfile;
    }
  });

  it("hasMany 的 limit 应按每条父记录切片，而不是限制总行数", async () => {
    await seed();
    const users = await User.query()
      .sort({ id: "asc" })
      .with({
        posts: {
          type: "hasMany",
          model: Post,
          foreignKey: "user_id",
          sort: { id: "asc" },
          limit: 1,
        },
      })
      .findAll();
    expect((users[0] as any).posts.map((p: any) => p.title)).toEqual(["A1"]);
    expect((users[1] as any).posts.map((p: any) => p.title)).toEqual(["B1"]);
  });

  it("字段裁剪时仍应自动带上关联所需的外键/主键", async () => {
    await seed();
    const posts = await Post.query()
      .fields(["title"])
      .with({
        author: {
          type: "belongsTo",
          model: User,
          foreignKey: "user_id",
          fields: ["name"],
        },
      })
      .findAll();
    expect(posts[0].title).toBeTruthy();
    expect((posts[0] as any).user_id).toBeTruthy();
    expect((posts[0] as any).author?.name).toBeTruthy();
  });

  it("默认不把软删记录预加载进来，spec.includeTrashed 才包含", async () => {
    const { alice } = await seed();
    const doomed = await SoftDeletePost.create({
      user_id: alice.id,
      title: "trashed",
    });
    await SoftDeletePost.delete(doomed.id);

    const users = await User.query()
      .where({ id: alice.id })
      .with({
        posts: {
          type: "hasMany",
          model: SoftDeletePost,
          foreignKey: "user_id",
        },
      })
      .findAll();
    const titles = (users[0] as any).posts.map((p: any) => p.title).sort();
    expect(titles).toEqual(["A1", "A2"]);

    const withTrashed = await User.query()
      .where({ id: alice.id })
      .with({
        posts: {
          type: "hasMany",
          model: SoftDeletePost,
          foreignKey: "user_id",
          includeTrashed: true,
        },
      })
      .findAll();
    const allTitles = (withTrashed[0] as any).posts.map((p: any) => p.title)
      .sort();
    expect(allTitles).toEqual(["A1", "A2", "trashed"]);
  });

  it("findOne 与静态 preload 也应挂上关联", async () => {
    const { alice } = await seed();
    const user = await User.query()
      .where({ id: alice.id })
      .with({
        profile: {
          type: "hasOne",
          model: Profile,
          foreignKey: "user_id",
        },
      })
      .findOne();
    expect((user as any)?.profile?.bio).toBe("Alice bio");

    const loaded = await User.query().sort({ id: "asc" }).findAll();
    expect((loaded[0] as any).posts).toBeUndefined();
    await User.preload(loaded, {
      posts: {
        type: "hasMany",
        model: Post,
        foreignKey: "user_id",
        sort: { id: "asc" },
      },
    });
    expect((loaded[0] as any).posts.length).toBe(2);
  });

  it("find() 链式 with 应预加载且不先发浪费的 findOne", async () => {
    const { alice } = await seed();
    const calls: string[] = [];
    const orig = adapter.query.bind(adapter);
    (adapter as any).query = async (sql: string, params?: any[]) => {
      calls.push(sql);
      return await orig(sql, params);
    };
    try {
      const users = await User.find({})
        .sort({ id: "asc" })
        .with({
          posts: {
            type: "hasMany",
            model: Post,
            foreignKey: "user_id",
            sort: { id: "asc" },
          },
        })
        .findAll();
      expect((users[0] as any).posts.length).toBe(2);
      const userSelects = calls.filter((sql) =>
        sql.includes(`FROM ${TABLE_USERS}`)
      );
      expect(userSelects.length).toBe(1);
      expect(userSelects[0]).not.toMatch(/LIMIT 1\s*$/);
    } finally {
      (adapter as any).query = orig;
    }
  });

  it("asArray 与 with 可组合且不丢关联", async () => {
    const { alice } = await seed();
    const rows = await User.query()
      .where({ id: alice.id })
      .fields(["id", "name"])
      .with({
        profile: {
          type: "hasOne",
          model: Profile,
          foreignKey: "user_id",
        },
      })
      .asArray()
      .findAll();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].profile?.bio).toBe("Alice bio");
    expect(rows[0].id).toBe(alice.id);
  });

  it("fields 与 belongsTo 组合时自动补关联键", async () => {
    const { alice } = await seed();
    const posts = await Post.find({})
      .fields(["id", "title"])
      .sort({ id: "asc" })
      .with({
        author: {
          type: "belongsTo",
          model: User,
          foreignKey: "user_id",
        },
      })
      .asArray()
      .findAll();
    expect(posts[0].title).toBe("A1");
    expect(posts[0].user_id).toBe(alice.id);
    expect(posts[0].author?.name).toBe("Alice");
  });

  it("with 预加载 belongsToMany，fields 自动补本表主键", async () => {
    const { alice, bob } = await seed();
    const users = await User.find({})
      .fields(["name"])
      .sort({ id: "asc" })
      .with({
        roles: {
          type: "belongsToMany",
          model: Role,
          pivot: UserRole,
          foreignKey: "user_id",
          otherKey: "role_id",
          sort: { id: "asc" },
        },
      })
      .asArray()
      .findAll();
    expect(users[0].id).toBe(alice.id);
    expect(users[0].roles.map((r: { name: string }) => r.name)).toEqual([
      "admin",
      "editor",
    ]);
    expect(users[1].id).toBe(bob.id);
    expect(users[1].roles.map((r: { name: string }) => r.name)).toEqual([
      "editor",
    ]);
  });

  it("实例 belongsToMany 返回关联记录", async () => {
    const { alice } = await seed();
    const user = await User.find(alice.id as number | string);
    const roles = await user!.belongsToMany(Role, {
      pivot: UserRole,
      foreignKey: "user_id",
      otherKey: "role_id",
      sort: { id: "asc" },
    });
    expect(roles.map((r) => r.name)).toEqual(["admin", "editor"]);
  });

  it("开启缓存后，较窄 fields 再 with 不会命中缺关联键的缓存", async () => {
    const { alice } = await seed();
    const cache = new MemoryAdapter();
    Post.cacheAdapter = cache;
    try {
      const first = await Post.find({ user_id: alice.id })
        .fields(["id", "title"])
        .sort({ id: "asc" })
        .asArray()
        .findAll();
      expect(first[0].title).toBe("A1");
      expect(first[0].user_id).toBeUndefined();

      const second = await Post.find({ user_id: alice.id })
        .fields(["id", "title"])
        .sort({ id: "asc" })
        .with({
          author: {
            type: "belongsTo",
            model: User,
            foreignKey: "user_id",
          },
        })
        .asArray()
        .findAll();
      expect(second[0].title).toBe("A1");
      expect(second[0].user_id).toBe(alice.id);
      expect(second[0].author?.name).toBe("Alice");
    } finally {
      Post.cacheAdapter = undefined;
    }
  });
}, { sanitizeOps: false, sanitizeResources: false });
