import { decimal, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password").notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  amount: decimal("amount", {precision: 10,scale: 2,}).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  date: varchar("date", { length: 255 }).notNull(),
});
