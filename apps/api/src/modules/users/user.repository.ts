import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import type { UserInput, UsersQueryParams } from "@crud/contracts/users";
import { db } from "../../db/client";
import { users } from "../../db/schema";

// Pada pencarian biasa, %, _, dan \ dianggap karakter literal,
// bukan wildcard yang ditentukan pengguna.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

const sortableColumns = {
  createdAt: users.createdAt,
  name: users.name,
  email: users.email,
}

export const userRepository = {
  async list(params: UsersQueryParams) {
    const {
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
    } = params;

    const offset = (page - 1) * pageSize;

    const pattern = search
      ? `%${escapeLikePattern(search)}%`
      : undefined

    const filter = pattern
      ? or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
      )
      : undefined;

    const sortColumn = sortableColumns[sortBy];
    const order = sortOrder === "asc" ? asc : desc;

    const [data, countRows] = await Promise.all([
      db
        .select()
        .from(users)
        .where(filter)
        .orderBy(
          order(sortColumn),
          order(users.id),
        )
        .limit(pageSize)
        .offset(offset),

      db
        .select({ total: count() })
        .from(users)
        .where(filter),
    ]);

    const total = countRows[0]?.total ?? 0;

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    }
  },

  async findById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  },

  async create(input: UserInput) {
    const [user] = await db
      .insert(users)
      .values(input)
      .returning();

    if (!user) {
      throw new Error("Insert user returned no row");
    }
    
    return user;
  },

  async update(id: string, input: UserInput) {
    const [user] = await db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();

    return user;
  },

  async delete(id: string) {
    const [user] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({id: users.id})

    return user;
  },
}
