/**
 * Drizzle schema mirroring application-owned tables in drizzle/migrations/.
 * Supabase-managed auth.users and storage.objects remain externally managed.
 * Keep this file aligned with forward-only SQL migrations.
 */
import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["admin", "editor"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
  },
  (t) => [unique().on(t.userId, t.role)],
);

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentItems = pgTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.type, t.slug),
    check("content_items_type_check", sql`${t.type} in ('video', 'book', 'article', 'research')`),
  ],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: text("id").primaryKey().default("main"),
    data: jsonb("data").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("site_settings_id_check", sql`${t.id} = 'main'`)],
);

export const debates = pgTable("debates", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestName: text("guest_name").notNull(),
  guestBackground: text("guest_background"),
  topic: text("topic").notNull(),
  replySummary: text("reply_summary"),
  outcome: text("outcome").notNull().default("open"),
  debateDate: date("debate_date"),
  videoUrl: text("video_url"),
  tags: text("tags").array().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("محادثة جديدة"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("chat_messages_role_check", sql`${t.role} in ('user', 'assistant')`),
    index("chat_messages_thread_idx").on(t.threadId, t.createdAt),
  ],
);
