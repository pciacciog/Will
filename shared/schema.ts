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
  timezone: varchar("timezone", { length: 50 }).notNull().default("America/New_York"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // user, admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Daily reminder preferences
  dailyReminderTime: varchar("daily_reminder_time", { length: 5 }), // "HH:MM" format, e.g., "07:30"
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(true),
  lastDailyReminderSentAt: timestamp("last_daily_reminder_sent_at"),
  lastMotivationalSentAt: timestamp("last_motivational_sent_at"),
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
  circleId: integer("circle_id").references(() => circles.id), // Nullable for non-circle wills
  createdBy: varchar("created_by").notNull().references(() => users.id),
  mode: varchar("mode", { length: 10 }).notNull().default("personal"), // 'personal' or 'circle'
  visibility: varchar("visibility", { length: 10 }).notNull().default("private"), // 'private' or 'public'
  parentWillId: integer("parent_will_id"), // For joined instances: references the original public will
  willType: varchar("will_type", { length: 20 }).default("classic"), // 'classic' or 'cumulative' (only for circle mode)
  sharedWhat: text("shared_what"), // For cumulative wills: the shared commitment everyone does
  checkInType: varchar("check_in_type", { length: 20 }).default("one-time"), // 'daily' or 'one-time' — auto-determined: ongoing=daily, set-dates=one-time
  reminderTime: varchar("reminder_time", { length: 5 }), // HH:MM format for daily check-in reminders (user's local time)
  checkInTime: varchar("check_in_time", { length: 5 }), // HH:MM format for when to prompt check-in (user's local time)
  activeDays: varchar("active_days", { length: 20 }).default("every_day"), // 'every_day', 'weekdays', 'custom'
  customDays: text("custom_days"), // JSON array of day numbers (0=Sun, 1=Mon, ..., 6=Sat) when activeDays='custom'
  isIndefinite: boolean("is_indefinite").default(false), // true for ongoing wills with no end date
  pausedAt: timestamp("paused_at"), // When the will was paused (null if not paused)
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // Nullable for indefinite wills
  endRoomScheduledAt: timestamp("end_room_scheduled_at"),
  endRoomOpenedAt: timestamp("end_room_opened_at"),
  endRoomUrl: varchar("end_room_url", { length: 500 }),
  endRoomStatus: varchar("end_room_status", { length: 20 }).default("pending"), // pending, open, completed
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, scheduled, active, will_review, waiting_for_end_room, completed
  createdAt: timestamp("created_at").defaultNow(),
  // Notification tracking fields
  midpointAt: timestamp("midpoint_at"), // Precomputed: (startDate + endDate) / 2
  midpointNotificationSentAt: timestamp("midpoint_notification_sent_at"),
  completionNotificationSentAt: timestamp("completion_notification_sent_at"),
}, (table) => [
  index("IDX_wills_mode").on(table.mode),
  index("IDX_wills_status").on(table.status),
  index("IDX_wills_status_start_date").on(table.status, table.startDate),
  index("IDX_wills_status_end_date").on(table.status, table.endDate),
  index("IDX_wills_end_room_status").on(table.endRoomStatus),
  index("IDX_wills_midpoint_check").on(table.status, table.midpointAt, table.midpointNotificationSentAt),
  index("IDX_wills_visibility").on(table.visibility),
  index("IDX_wills_parent_will_id").on(table.parentWillId),
  index("IDX_wills_public_discover").on(table.visibility, table.parentWillId, table.status),
]);

export const willCommitments = pgTable("will_commitments", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  what: text("what").notNull(),
  why: text("why").notNull(),
  checkInType: varchar("check_in_type", { length: 20 }).default("one-time"), // 'daily' or 'one-time' (for circle mode - per member)
  checkInTime: varchar("check_in_time", { length: 5 }), // HH:MM format for member's personal check-in time
  createdAt: timestamp("created_at").defaultNow(),
  // Notification tracking field for acknowledgment reminder
  ackReminderSentAt: timestamp("ack_reminder_sent_at"), // For 6hr unacknowledged reminder
  lastCheckInReminderSentAt: timestamp("last_check_in_reminder_sent_at"), // Per-commitment dedup for daily check-in notifications
  lastMotivationalSentAt: timestamp("last_motivational_sent_at"), // Per-commitment dedup for motivational notifications
}, (table) => [
  index("IDX_will_commitments_will_id").on(table.willId),
  index("IDX_will_commitments_user_id").on(table.userId),
]);

// Tracking table for commitment reminders (for users who haven't committed yet)
export const commitmentReminders = pgTable("commitment_reminders", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => [
  index("IDX_commitment_reminders_will_id").on(table.willId),
]);

export const willAcknowledgments = pgTable("will_acknowledgments", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
});

export const willReviews = pgTable("will_reviews", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  followThrough: varchar("follow_through", { length: 10 }).notNull(), // yes, mostly, no
  reflectionText: varchar("reflection_text", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyProgress = pgTable("daily_progress", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const willCheckIns = pgTable("will_check_ins", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD - the day being tracked
  status: varchar("status", { length: 20 }).notNull(), // 'yes', 'no', 'partial'
  reflectionText: text("reflection_text"), // Optional reflection
  checkedInAt: timestamp("checked_in_at").defaultNow(), // When they actually logged it
  isRetroactive: boolean("is_retroactive").default(false), // Was this filled in late?
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_will_check_ins_will_id").on(table.willId),
  index("IDX_will_check_ins_user_id").on(table.userId),
  index("IDX_will_check_ins_date").on(table.willId, table.userId, table.date),
]);

export const willFinalReflections = pgTable("will_final_reflections", {
  id: serial("id").primaryKey(),
  willId: integer("will_id").notNull().references(() => wills.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  feeling: varchar("feeling", { length: 20 }).notNull(), // 'great', 'okay', 'could_improve'
  finalThoughts: text("final_thoughts"), // Optional
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_will_final_reflections_will_id").on(table.willId),
  index("IDX_will_final_reflections_user_id").on(table.userId),
]);

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

export const deviceTokens = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Nullable to support pending tokens
  deviceToken: text("device_token").notNull().unique(), // UNIQUE constraint for ON CONFLICT support
  platform: varchar("platform", { length: 10 }).notNull(), // ios, android
  isActive: boolean("is_active").notNull().default(true),
  // Token provenance tracking
  isSandbox: boolean("is_sandbox").default(true), // true for development tokens, false for production
  bundleId: varchar("bundle_id", { length: 255 }), // X-App-Bundle header
  buildScheme: varchar("build_scheme", { length: 50 }), // X-App-BuildScheme header (Debug/Release)
  provisioningProfile: varchar("provisioning_profile", { length: 255 }), // X-App-Provisioning header
  appVersion: varchar("app_version", { length: 50 }), // X-App-Version header
  registrationSource: varchar("registration_source", { length: 100 }), // Where token was registered
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_device_tokens_user_active").on(table.userId, table.isActive),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  circleMembers: many(circleMembers),
  createdCircles: many(circles),
  willCommitments: many(willCommitments),
  willAcknowledgments: many(willAcknowledgments),
  willReviews: many(willReviews),
  dailyProgress: many(dailyProgress),
  willPushes: many(willPushes),
  deviceTokens: many(deviceTokens),
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
  reviews: many(willReviews),
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

export const willReviewsRelations = relations(willReviews, ({ one }) => ({
  will: one(wills, {
    fields: [willReviews.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willReviews.userId],
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

export const willCheckInsRelations = relations(willCheckIns, ({ one }) => ({
  will: one(wills, {
    fields: [willCheckIns.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willCheckIns.userId],
    references: [users.id],
  }),
}));

export const willFinalReflectionsRelations = relations(willFinalReflections, ({ one }) => ({
  will: one(wills, {
    fields: [willFinalReflections.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [willFinalReflections.userId],
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

export const commitmentRemindersRelations = relations(commitmentReminders, ({ one }) => ({
  will: one(wills, {
    fields: [commitmentReminders.willId],
    references: [wills.id],
  }),
  user: one(users, {
    fields: [commitmentReminders.userId],
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

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
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

export const insertWillCheckInSchema = createInsertSchema(willCheckIns).omit({
  id: true,
  createdAt: true,
  checkedInAt: true,
});
export type InsertWillCheckIn = z.infer<typeof insertWillCheckInSchema>;
export type WillCheckIn = typeof willCheckIns.$inferSelect;

export const insertWillFinalReflectionSchema = createInsertSchema(willFinalReflections).omit({
  id: true,
  createdAt: true,
});
export type InsertWillFinalReflection = z.infer<typeof insertWillFinalReflectionSchema>;
export type WillFinalReflection = typeof willFinalReflections.$inferSelect;

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

export const insertDeviceTokenSchema = createInsertSchema(deviceTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;
export type DeviceToken = typeof deviceTokens.$inferSelect;

export const insertWillReviewSchema = createInsertSchema(willReviews).omit({
  id: true,
  createdAt: true,
});
export type InsertWillReview = z.infer<typeof insertWillReviewSchema>;
export type WillReview = typeof willReviews.$inferSelect;

export const insertCommitmentReminderSchema = createInsertSchema(commitmentReminders).omit({
  id: true,
  sentAt: true,
});
export type InsertCommitmentReminder = z.infer<typeof insertCommitmentReminderSchema>;
export type CommitmentReminder = typeof commitmentReminders.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_password_reset_tokens_token").on(table.token),
  index("IDX_password_reset_tokens_user_id").on(table.userId),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  willId: integer("will_id").references(() => wills.id),
  circleId: integer("circle_id").references(() => circles.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_user_notifications_user_unread").on(table.userId, table.isRead),
  index("IDX_user_notifications_user_type_will").on(table.userId, table.type, table.willId),
]);

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;
