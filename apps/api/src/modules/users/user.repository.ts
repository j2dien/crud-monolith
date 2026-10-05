import { desc, eq } from "drizzle-orm";
import type { UserInput } from "@crud/contracts/users";
import { db } from "../../db/client";
import { users } from "../../db/schema";

export const userRepository = {
  list() {
    return db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(100);
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
    const [user] = await db.insert(users).values(input).returning();
    return user!;
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
