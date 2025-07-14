import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // user, admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const circles = pgTable("circles", {
  id: serial("id").primaryKey(),
  inviteCode: varchar("invite_code", { length: 6 }).notNull().unique(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const circleMembers = pgTable("circle_members", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id").notNull().references(() => circles.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const wills = pgTable("wills", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id").notNull().references(() => circles.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  endRoomScheduledAt: timestamp("end_room_scheduled_at"),
  endRoomUrl: varchar("end_room_url", { length: 500 }),
  endRoomStatus: varchar("end_room_status", { length: 20 }).default("pending"), // pending, open, completed
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, scheduled, active, waiting_for_end_room, completed
  createdAt: timestamp("created_at").defaultNow(),
});

export const willCommitments = pgTable("will_commitments", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  what: text("what").notNull(),
  why: text("why").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const willAcknowledgments = pgTable("will_acknowledgments", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
});

export const dailyProgress = pgTable("daily_progress", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const willPushes = pgTable("will_pushes", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  pushedAt: timestamp("pushed_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  authorId: varchar("author_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, archived
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pageContents = pgTable("page_contents", {
  id: serial("id").primaryKey(),
  pageKey: varchar("page_key", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  metaDescription: text("meta_description"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  circleMembers: many(circleMembers),
  createdCircles: many(circles),
  willCommitments: many(willCommitments),
  willAcknowledgments: many(willAcknowledgments),
  dailyProgress: many(dailyProgress),
  willPushes: many(willPushes),
}));

export const circlesRelations = relations(circles, ({ one, many }) => ({
  creator: one(users, {
    fields: [circles.createdBy],
    references: [users.id],
  }),
  members: many(circleMembers),
  wills: many(wills),
}));

export const circleMembersRelations = relations(circleMembers, ({ one }) => ({
  circle: one(circles, {
    fields: [circleMembers.circleId],
    references: [circles.id],
  }),
  user: one(users, {
    fields: [circleMembers.userId],
    references: [users.id],
  }),
}));

export const willsRelations = relations(wills, ({ one, many }) => ({
  circle: one(circles, {
    fields: [wills.circleId],
    references: [circles.id],
  }),
  creator: one(users, {
    fields: [wills.createdBy],
    references: [users.id],
  }),
  commitments: many(willCommitments),
  acknowledgments: many(willAcknowledgments),
  dailyProgress: many(dailyProgress),
  pushes: many(willPushes),
}));

export const willCommitmentsRelations = relations(willCommitments, ({ one }) => ({
  will: one(wills, {
    fields: [willCommitments.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willCommitments.userId],
    references: [users.id],
  }),
}));

export const willAcknowledgmentsRelations = relations(willAcknowledgments, ({ one }) => ({
  will: one(wills, {
    fields: [willAcknowledgments.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willAcknowledgments.userId],
    references: [users.id],
  }),
}));

export const dailyProgressRelations = relations(dailyProgress, ({ one }) => ({
  will: one(wills, {
    fields: [dailyProgress.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [dailyProgress.userId],
    references: [users.id],
  }),
}));

export const willPushesRelations = relations(willPushes, ({ one }) => ({
  will: one(wills, {
    fields: [willPushes.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willPushes.userId],
    references: [users.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

export const pageContentsRelations = relations(pageContents, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [pageContents.updatedBy],
    references: [users.id],
  }),
}));

// Schemas
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertCircleSchema = createInsertSchema(circles).omit({
  id: true,
  createdAt: true,
});
export type InsertCircle = z.infer<typeof insertCircleSchema>;
export type Circle = typeof circles.$inferSelect;

export const insertCircleMemberSchema = createInsertSchema(circleMembers).omit({
  id: true,
  joinedAt: true,
});
export type InsertCircleMember = z.infer<typeof insertCircleMemberSchema>;
export type CircleMember = typeof circleMembers.$inferSelect;

export const insertWillSchema = createInsertSchema(wills).omit({
  id: true,
  createdAt: true,
  status: true,
});
export type InsertWill = z.infer<typeof insertWillSchema>;
export type Will = typeof wills.$inferSelect;

export const insertWillCommitmentSchema = createInsertSchema(willCommitments).omit({
  id: true,
  createdAt: true,
});
export type InsertWillCommitment = z.infer<typeof insertWillCommitmentSchema>;
export type WillCommitment = typeof willCommitments.$inferSelect;

export const insertWillAcknowledgmentSchema = createInsertSchema(willAcknowledgments).omit({
  id: true,
  acknowledgedAt: true,
});
export type InsertWillAcknowledgment = z.infer<typeof insertWillAcknowledgmentSchema>;
export type WillAcknowledgment = typeof willAcknowledgments.$inferSelect;

export const insertDailyProgressSchema = createInsertSchema(dailyProgress).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyProgress = z.infer<typeof insertDailyProgressSchema>;
export type DailyProgress = typeof dailyProgress.$inferSelect;

export const insertWillPushSchema = createInsertSchema(willPushes).omit({
  id: true,
  pushedAt: true,
});
export type InsertWillPush = z.infer<typeof insertWillPushSchema>;
export type WillPush = typeof willPushes.$inferSelect;

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

export const insertPageContentSchema = createInsertSchema(pageContents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPageContent = z.infer<typeof insertPageContentSchema>;
export type PageContent = typeof pageContents.$inferSelect;
