import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

export const accountRoleEnum = pgEnum(
  "account_role",
  ["admin", "viewer"],
);

export const accounts = pgTable("accounts", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  name: varchar("name", {
    length: 100,
  }).notNull(),

  email: varchar("email", {
    length: 254,
  })
    .notNull()
    .unique("accounts_email_unique"),

  passwordHash: varchar("password_hash", {
    length: 255,
  }).notNull(),

  role: accountRoleEnum("role")
    .notNull()
    .default("viewer"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", {
      length: 64,
    }).primaryKey(),

    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, {
        onDelete: "cascade",
      }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_account_id_idx")
      .on(table.accountId),

    index("sessions_expires_at_idx")
      .on(table.expiresAt),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: varchar("key", {
      length: 64,
    }).primaryKey(),

    attempts: integer("attempts")
      .notNull()
      .default(0),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("login_attempts_expires_at_idx")
      .on(table.expiresAt),
  ],
);