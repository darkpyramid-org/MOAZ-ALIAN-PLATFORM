/**
 * Drizzle schema mirroring applied SQL migrations under drizzle/migrations/.
 * Keep aligned when adding migrations. Auth users live in auth.users (Supabase).
 *
 * `categories` and `content_items` used to live here as jsonb blob tables that the
 * browser read through PostgREST. The ASP.NET API in ../api-server now owns that
 * data in the `library` schema — typed columns, real constraints, one writer — so
 * they are out of this schema. The legacy public tables are still in Supabase and
 * can be dropped once nothing reads them:
 *   drop table if exists public.content_items;
 *   drop table if exists public.categories;
 */
import { date, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
    userId: uuid("user_id").notNull(),
    role: appRoleEnum("role").notNull(),
  },
  (t) => [unique().on(t.userId, t.role)],
);

export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  userId: uuid("user_id").notNull(),
  title: text("title").notNull().default("محادثة جديدة"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull(),
  role: text("role").notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
