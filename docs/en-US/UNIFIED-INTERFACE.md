# SQLModel and MongoModel Unified Interface

> 📖 [README](../../README.md) | [API Reference](./API.md)

---

// IN / NOT IN const articles = await builder .collection("articles")
.in("status", ["published", "archived"]) .query();

// Regex const articles = await builder .collection("articles") .regex("title",
/hello/i) .query();

````
#### Aggregate Query

```typescript
const result = await builder
  .collection("articles")
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
````

---

## 🔄 Transaction Handling

> 📖 **Examples**: See
> [EXAMPLES.md#transaction-handling](./EXAMPLES.md#transaction-handling) for
> Basic Transaction, Nested Transactions (Savepoints), and MongoDB Transaction.

---

## 🔗 Association Query Details

> 📖 **Examples**: See
> [EXAMPLES.md#association-query-details](./EXAMPLES.md#association-query-details)
> for belongsTo, hasOne, and hasMany.

---

## 📦 Migration Management

> 📖 **Examples**: See
> [EXAMPLES.md#migration-management](./EXAMPLES.md#migration-management) for
> Create, Run, Rollback, and Status.

---

## 🔄 SQLModel and MongoModel Unified Interface

`SQLModel` and `MongoModel` provide a unified interface for switching between
databases.

### Unified Interface Comparison

#### Static Query Methods

| Method              | SQLModel | MongoModel | Status                                           |
| ------------------- | -------- | ---------- | ------------------------------------------------ |
| `find`              | ✅       | ✅         | ✅ Unified                                       |
| `findAll`           | ✅       | ✅         | ✅ Unified                                       |
| `findOne`           | ✅       | ✅         | ✅ Unified                                       |
| `findById`          | ✅       | ✅         | ✅ Unified                                       |
| `count`             | ✅       | ✅         | ✅ Unified                                       |
| `exists`            | ✅       | ✅         | ✅ Unified                                       |
| `paginate`          | ✅       | ✅         | ✅ Unified                                       |
| `distinct`          | ✅       | ✅         | ✅ Unified                                       |
| `findOrCreate`      | ✅       | ✅         | ✅ Unified                                       |
| `findOneAndUpdate`  | ✅       | ✅         | ✅ Unified                                       |
| `findOneAndDelete`  | ✅       | ✅         | ✅ Unified                                       |
| `findOneAndReplace` | ✅       | ✅         | ✅ Unified                                       |
| `truncate`          | ✅       | ✅         | ✅ Unified                                       |
| `aggregate`         | ❌       | ✅         | ⚠️ Not unified (SQL has no aggregation pipeline) |

#### Static Operation Methods

| Method            | SQLModel | MongoModel | Status     |
| ----------------- | -------- | ---------- | ---------- |
| `create`          | ✅       | ✅         | ✅ Unified |
| `createMany`      | ✅       | ✅         | ✅ Unified |
| `update`          | ✅       | ✅         | ✅ Unified |
| `updateById`      | ✅       | ✅         | ✅ Unified |
| `updateMany`      | ✅       | ✅         | ✅ Unified |
| `delete`          | ✅       | ✅         | ✅ Unified |
| `deleteById`      | ✅       | ✅         | ✅ Unified |
| `deleteMany`      | ✅       | ✅         | ✅ Unified |
| `increment`       | ✅       | ✅         | ✅ Unified |
| `decrement`       | ✅       | ✅         | ✅ Unified |
| `incrementMany`   | ✅       | ✅         | ✅ Unified |
| `decrementMany`   | ✅       | ✅         | ✅ Unified |
| `upsert`          | ✅       | ✅         | ✅ Unified |
| `restore`         | ✅       | ✅         | ✅ Unified |
| `restoreById`     | ✅       | ✅         | ✅ Unified |
| `forceDelete`     | ✅       | ✅         | ✅ Unified |
| `forceDeleteById` | ✅       | ✅         | ✅ Unified |

#### Query Builder Methods (`query()`)

**Query Methods:**

| Method                     | SQLModel | MongoModel | Status         |
| -------------------------- | -------- | ---------- | -------------- |
| `findAll()`                | ✅       | ✅         | ✅ Unified     |
| `findOne()`                | ✅       | ✅         | ✅ Unified     |
| `one()`                    | ✅       | ✅         | ✅ Unified     |
| `all()`                    | ✅       | ✅         | ✅ Unified     |
| `findById(id, fields?)`    | ✅       | ✅         | ✅ Unified     |
| `count()`                  | ✅       | ✅         | ✅ Unified     |
| `exists()`                 | ✅       | ✅         | ✅ Unified     |
| `distinct(field)`          | ✅       | ✅         | ✅ Unified     |
| `paginate(page, pageSize)` | ✅       | ✅         | ✅ Unified     |
| `aggregate(pipeline)`      | ❌       | ✅         | ⚠️ Not unified |

**Operation Methods:**

| Method                                          | SQLModel | MongoModel | Status     |
| ----------------------------------------------- | -------- | ---------- | ---------- |
| `update(data, returnLatest?)`                   | ✅       | ✅         | ✅ Unified |
| `updateById(id, data)`                          | ✅       | ✅         | ✅ Unified |
| `updateMany(data)`                              | ✅       | ✅         | ✅ Unified |
| `increment(field, amount?, returnLatest?)`      | ✅       | ✅         | ✅ Unified |
| `decrement(field, amount?, returnLatest?)`      | ✅       | ✅         | ✅ Unified |
| `deleteById(id)`                                | ✅       | ✅         | ✅ Unified |
| `deleteMany(options?)`                          | ✅       | ✅         | ✅ Unified |
| `restore(options?)`                             | ✅       | ✅         | ✅ Unified |
| `restoreById(id)`                               | ✅       | ✅         | ✅ Unified |
| `forceDelete(options?)`                         | ✅       | ✅         | ✅ Unified |
| `forceDeleteById(id)`                           | ✅       | ✅         | ✅ Unified |
| `upsert(data, returnLatest?, resurrect?)`       | ✅       | ✅         | ✅ Unified |
| `findOrCreate(data, resurrect?)`                | ✅       | ✅         | ✅ Unified |
| `findOneAndUpdate(data, options?)`              | ✅       | ✅         | ✅ Unified |
| `findOneAndDelete()`                            | ✅       | ✅         | ✅ Unified |
| `findOneAndReplace(replacement, returnLatest?)` | ✅       | ✅         | ✅ Unified |
| `incrementMany(fieldOrMap, amount?)`            | ✅       | ✅         | ✅ Unified |
| `decrementMany(fieldOrMap, amount?)`            | ✅       | ✅         | ✅ Unified |

#### Soft Delete Methods

| Method             | SQLModel | MongoModel | Status     |
| ------------------ | -------- | ---------- | ---------- |
| `withTrashed()`    | ✅       | ✅         | ✅ Unified |
| `onlyTrashed()`    | ✅       | ✅         | ✅ Unified |
| `scope(scopeName)` | ✅       | ✅         | ✅ Unified |

#### Instance Methods

| Method           | SQLModel | MongoModel | Status     |
| ---------------- | -------- | ---------- | ---------- |
| `save()`         | ✅       | ✅         | ✅ Unified |
| `update(data)`   | ✅       | ✅         | ✅ Unified |
| `delete()`       | ✅       | ✅         | ✅ Unified |
| `belongsTo(...)` | ✅       | ✅         | ✅ Unified |
| `hasOne(...)`    | ✅       | ✅         | ✅ Unified |
| `hasMany(...)`   | ✅       | ✅         | ✅ Unified |

#### MongoModel-Specific Methods

| Method                  | SQLModel | MongoModel | Status         | Note                     |
| ----------------------- | -------- | ---------- | -------------- | ------------------------ |
| `createIndexes(force?)` | ❌       | ✅         | ⚠️ Not unified | MongoDB index management |
| `dropIndexes()`         | ❌       | ✅         | ⚠️ Not unified | MongoDB index management |
| `getIndexes()`          | ❌       | ✅         | ⚠️ Not unified | MongoDB index management |
| `transaction(callback)` | ❌       | ✅         | ⚠️ Not unified | MongoDB transaction      |

#### Unification Rate

| Category                        | Total  | Unified | Not Unified | Rate      |
| ------------------------------- | ------ | ------- | ----------- | --------- |
| Static query methods            | 14     | 13      | 1           | 92.9%     |
| Static operation methods        | 17     | 17      | 0           | 100%      |
| Query builder query methods     | 10     | 9       | 1           | 90%       |
| Query builder operation methods | 18     | 18      | 0           | 100%      |
| Soft delete methods             | 3      | 3       | 0           | 100%      |
| Instance methods                | 6      | 6       | 0           | 100%      |
| MongoModel-specific methods     | 4      | 0       | 4           | -         |
| **Total**                       | **72** | **66**  | **6**       | **91.7%** |
