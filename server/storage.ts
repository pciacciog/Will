import {
  users,
  circles,
  circleMembers,
  wills,
  willCommitments,
  willAcknowledgments,
  willReviews,
  dailyProgress,
  willPushes,
  willCheckIns,
  willFinalReflections,
  blogPosts,
  pageContents,
  deviceTokens,
  sessions,
  passwordResetTokens,
  type User,
  type InsertUser,
  type UpsertUser,
  type Circle,
  type InsertCircle,
  type CircleMember,
  type InsertCircleMember,
  type Will,
  type InsertWill,
  type WillCommitment,
  type InsertWillCommitment,
  type WillAcknowledgment,
  type InsertWillAcknowledgment,
  type WillReview,
  type InsertWillReview,
  type DailyProgress,
  type InsertDailyProgress,
  type WillPush,
  type InsertWillPush,
  type WillCheckIn,
  type InsertWillCheckIn,
  type WillFinalReflection,
  type InsertWillFinalReflection,
  type BlogPost,
  type InsertBlogPost,
  type PageContent,
  type InsertPageContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, 'confirmPassword'>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserProfile(userId: string, profileData: { firstName: string; lastName: string; email: string }): Promise<User>;
  updateUserReminderSettings(userId: string, settings: { dailyReminderTime?: string | null; dailyReminderEnabled?: boolean }): Promise<User>;
  updateUserLastDailyReminderSent(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  // Circle operations
  createCircle(circle: InsertCircle): Promise<Circle>;
  getCircleByInviteCode(inviteCode: string): Promise<Circle | undefined>;
  getCircleById(id: number): Promise<Circle | undefined>;
  getUserCircle(userId: string): Promise<(Circle & { members: (CircleMember & { user: User })[] }) | undefined>;
  getUserCircles(userId: string): Promise<(Circle & { members: (CircleMember & { user: User })[]; activeWillCount: number; currentWillStatus: string | null })[]>;
  getUserCircleCount(userId: string): Promise<number>;
  getCircleWithMembers(circleId: number): Promise<(Circle & { members: (CircleMember & { user: User })[] }) | undefined>;
  
  // Circle member operations
  addCircleMember(member: InsertCircleMember): Promise<CircleMember>;
  removeCircleMember(userId: string, circleId: number): Promise<void>;
  getCircleMemberCount(circleId: number): Promise<number>;
  isUserInCircle(userId: string, circleId: number): Promise<boolean>;
  getCircleMembers(circleId: number): Promise<(CircleMember & { user: User })[]>;
  
  // Will operations
  createWill(will: InsertWill): Promise<Will>;
  getCircleActiveWill(circleId: number): Promise<Will | undefined>;
  getUserSoloWills(userId: string): Promise<(Will & { commitments: (WillCommitment & { user: User })[] })[]>;
  getUserActiveSoloWill(userId: string): Promise<Will | undefined>;
  getWillById(id: number): Promise<Will | undefined>;
  updateWillStatus(willId: number, status: string): Promise<void>;
  updateWill(willId: number, updates: Partial<InsertWill>): Promise<void>;
  updateWillEndRoom(willId: number, endRoomData: { 
    endRoomScheduledAt?: Date; 
    endRoomOpenedAt?: Date;
    endRoomUrl?: string; 
    endRoomStatus?: string; 
  }): Promise<void>;
  getWillWithCommitments(willId: number): Promise<(Will & { commitments: (WillCommitment & { user: User })[] }) | undefined>;
  
  // Will commitment operations
  addWillCommitment(commitment: InsertWillCommitment): Promise<WillCommitment>;
  getWillCommitmentCount(willId: number): Promise<number>;
  hasUserCommitted(willId: number, userId: string): Promise<boolean>;
  
  // Will acknowledgment operations
  addWillAcknowledgment(acknowledgment: InsertWillAcknowledgment): Promise<WillAcknowledgment>;
  getWillAcknowledgmentCount(willId: number): Promise<number>;
  hasUserAcknowledged(willId: number, userId: string): Promise<boolean>;
  getWillAcknowledgments(willId: number): Promise<(WillAcknowledgment & { user: User })[]>;
  
  // Will review operations
  addWillReview(review: InsertWillReview): Promise<WillReview>;
  getWillReview(willId: number, userId: string): Promise<(WillReview & { user: User }) | undefined>;
  getWillReviews(willId: number): Promise<(WillReview & { user: User })[]>;
  getWillReviewCount(willId: number): Promise<number>;
  
  // Will history operations
  getUserWillHistory(userId: string, mode: 'solo' | 'circle', limit?: number): Promise<{
    id: number;
    mode: string;
    startDate: Date;
    endDate: Date;
    status: string;
    circle?: { id: number; inviteCode: string } | null;
    participants: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      commitment: string;
      followThrough: string | null;
      reflectionText: string | null;
    }[];
  }[]>;
  
  // Daily progress operations
  markDailyProgress(progress: InsertDailyProgress): Promise<DailyProgress>;
  getDailyProgress(willId: number, userId: string, date: string): Promise<DailyProgress | undefined>;
  getUserProgressStats(willId: number, userId: string): Promise<{ completed: number; total: number }>;
  
  // Push notification operations
  addWillPush(push: InsertWillPush): Promise<WillPush>;
  hasUserPushed(willId: number, userId: string): Promise<boolean>;
  getWillPushes(willId: number): Promise<(WillPush & { user: User })[]>;
  
  // Admin operations
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  getAllCircles(limit?: number, offset?: number): Promise<(Circle & { memberCount: number })[]>;
  getAllWills(limit?: number, offset?: number): Promise<(Will & { circle: Circle; creator: User; memberCount: number })[]>;
  updateUserRole(userId: string, role: string): Promise<void>;
  deactivateUser(userId: string): Promise<void>;
  activateUser(userId: string): Promise<void>;
  deleteCircle(circleId: number): Promise<void>;
  deleteWill(willId: number): Promise<void>;
  getAdminStats(): Promise<{
    totalUsers: number;
    totalCircles: number;
    totalWills: number;
    activeWills: number;
  }>;
  
  // Blog operations
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  getAllBlogPosts(limit?: number, offset?: number): Promise<(BlogPost & { author: User })[]>;
  getBlogPostBySlug(slug: string): Promise<(BlogPost & { author: User }) | undefined>;
  
  // Page content operations
  createPageContent(content: InsertPageContent): Promise<PageContent>;
  updatePageContent(id: number, content: Partial<InsertPageContent>): Promise<PageContent>;
  deletePageContent(id: number): Promise<void>;
  getAllPageContents(): Promise<PageContent[]>;
  getPageContentByKey(pageKey: string): Promise<PageContent | undefined>;
  
  // Password reset operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Will check-in operations (for daily tracking)
  createWillCheckIn(checkIn: InsertWillCheckIn): Promise<WillCheckIn>;
  updateWillCheckIn(checkInId: number, updates: Partial<InsertWillCheckIn>): Promise<WillCheckIn>;
  getWillCheckIn(willId: number, userId: string, date: string): Promise<WillCheckIn | undefined>;
  getWillCheckIns(willId: number, userId: string): Promise<WillCheckIn[]>;
  getWillCheckInProgress(willId: number, userId: string): Promise<{ total: number; completed: number; successRate: number }>;
  
  // Will final reflection operations
  createWillFinalReflection(reflection: InsertWillFinalReflection): Promise<WillFinalReflection>;
  getWillFinalReflection(willId: number, userId: string): Promise<WillFinalReflection | undefined>;
  
  // User stats operations
  getUserWillStats(userId: string): Promise<{
    totalWills: number;
    overallSuccessRate: number;
    dailyStats: { totalDays: number; successfulDays: number; successRate: number };
    oneTimeStats: { total: number; successful: number; successRate: number };
  }>;
  
  // Enhanced history with check-in data
  getUserWillHistoryWithCheckIns(userId: string, mode: 'solo' | 'circle', limit?: number): Promise<{
    id: number;
    mode: string;
    startDate: Date;
    endDate: Date;
    status: string;
    checkInType: string | null;
    willType: string | null;
    sharedWhat: string | null;
    circle?: { id: number; inviteCode: string } | null;
    currentUserId: string;
    currentUserParticipant: {
      commitment: string;
      followThrough: string | null;
      reflectionText: string | null;
      checkInType: string | null;
    } | null;
    participants: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      commitment: string;
      followThrough: string | null;
      reflectionText: string | null;
      checkInType: string | null;
    }[];
    userCheckInStats?: {
      total: number;
      completed: number;
      partial: number;
      missed: number;
      successRate: number;
    };
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Omit<InsertUser, 'confirmPassword'>): Promise<User> {
    const userWithId = {
      ...userData,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    const [user] = await db
      .insert(users)
      .values(userWithId)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, profileData: { firstName: string; lastName: string; email: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found');
    }
    
    return updatedUser;
  }

  async updateUserReminderSettings(userId: string, settings: { dailyReminderTime?: string | null; dailyReminderEnabled?: boolean }): Promise<User> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (settings.dailyReminderTime !== undefined) {
      updateData.dailyReminderTime = settings.dailyReminderTime;
    }
    if (settings.dailyReminderEnabled !== undefined) {
      updateData.dailyReminderEnabled = settings.dailyReminderEnabled;
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found');
    }
    
    return updatedUser;
  }

  async updateUserLastDailyReminderSent(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastDailyReminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete all user data in proper order to respect foreign key constraints
    
    // 1. Delete device tokens
    await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
    
    // 2. Delete will-related data for this user
    await db.delete(willPushes).where(eq(willPushes.userId, userId));
    await db.delete(dailyProgress).where(eq(dailyProgress.userId, userId));
    await db.delete(willAcknowledgments).where(eq(willAcknowledgments.userId, userId));
    await db.delete(willCommitments).where(eq(willCommitments.userId, userId));
    
    // 3. Delete all wills created by this user and their dependent data
    const userWills = await db.select({ id: wills.id })
      .from(wills)
      .where(eq(wills.createdBy, userId));
    
    for (const will of userWills) {
      await db.delete(willPushes).where(eq(willPushes.willId, will.id));
      await db.delete(dailyProgress).where(eq(dailyProgress.willId, will.id));
      await db.delete(willAcknowledgments).where(eq(willAcknowledgments.willId, will.id));
      await db.delete(willCommitments).where(eq(willCommitments.willId, will.id));
      await db.delete(wills).where(eq(wills.id, will.id));
    }
    
    // 4. Get circles created by this user to handle dependent data
    const userCircles = await db.select({ id: circles.id })
      .from(circles)
      .where(eq(circles.createdBy, userId));
    
    // 5. For each circle created by this user, delete remaining dependent data
    for (const circle of userCircles) {
      // Get all remaining wills in this circle (created by other members)
      const circleWills = await db.select({ id: wills.id })
        .from(wills)
        .where(eq(wills.circleId, circle.id));
      
      // Delete all data for remaining wills in this circle
      for (const will of circleWills) {
        await db.delete(willPushes).where(eq(willPushes.willId, will.id));
        await db.delete(dailyProgress).where(eq(dailyProgress.willId, will.id));
        await db.delete(willAcknowledgments).where(eq(willAcknowledgments.willId, will.id));
        await db.delete(willCommitments).where(eq(willCommitments.willId, will.id));
        await db.delete(wills).where(eq(wills.id, will.id));
      }
      
      // Delete all circle memberships for this circle
      await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
      
      // Delete the circle
      await db.delete(circles).where(eq(circles.id, circle.id));
    }
    
    // 6. Delete circle memberships where user is a member (not creator)
    await db.delete(circleMembers).where(eq(circleMembers.userId, userId));
    
    // 7. Delete blog posts and page contents
    await db.delete(blogPosts).where(eq(blogPosts.authorId, userId));
    await db.delete(pageContents).where(eq(pageContents.updatedBy, userId));
    
    // 8. Delete user sessions
    await db.delete(sessions).where(sql`sess::jsonb->>'userId' = ${userId}`);
    
    // 9. Finally, delete the user account
    await db.delete(users).where(eq(users.id, userId));
  }

  // Circle operations
  async createCircle(circle: InsertCircle): Promise<Circle> {
    const [newCircle] = await db.insert(circles).values(circle).returning();
    return newCircle;
  }

  async getCircleByInviteCode(inviteCode: string): Promise<Circle | undefined> {
    const [circle] = await db.select().from(circles).where(eq(circles.inviteCode, inviteCode));
    return circle;
  }

  async getCircleById(id: number): Promise<Circle | undefined> {
    const [circle] = await db.select().from(circles).where(eq(circles.id, id));
    return circle;
  }

  async getUserCircle(userId: string): Promise<(Circle & { members: (CircleMember & { user: User })[] }) | undefined> {
    const result = await db
      .select({
        circle: circles,
        member: circleMembers,
        user: users,
      })
      .from(circleMembers)
      .innerJoin(circles, eq(circleMembers.circleId, circles.id))
      .innerJoin(users, eq(circleMembers.userId, users.id))
      .where(eq(circleMembers.userId, userId));

    if (result.length === 0) return undefined;

    const circle = result[0].circle;
    const allMembers = await this.getCircleMembers(circle.id);

    return {
      ...circle,
      members: allMembers,
    };
  }

  async getUserCircles(userId: string): Promise<(Circle & { members: (CircleMember & { user: User })[]; activeWillCount: number; currentWillStatus: string | null })[]> {
    // Get all circles where user is a member
    const userCircleIds = await db
      .select({ circleId: circleMembers.circleId })
      .from(circleMembers)
      .where(eq(circleMembers.userId, userId));

    if (userCircleIds.length === 0) return [];

    const circleIds = userCircleIds.map(c => c.circleId);
    
    // Get all circles
    const circlesList = await db
      .select()
      .from(circles)
      .where(inArray(circles.id, circleIds));

    // Build result with members, active will count, and current will status
    const result = await Promise.all(circlesList.map(async (circle) => {
      const members = await this.getCircleMembers(circle.id);
      
      // Count active wills (status not 'archived' or 'completed')
      const [activeWillResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(wills)
        .where(and(
          eq(wills.circleId, circle.id),
          sql`status NOT IN ('archived', 'completed')`
        ));
      
      // Get the current will's status (most recent non-archived will)
      const [currentWill] = await db
        .select({ status: wills.status })
        .from(wills)
        .where(and(
          eq(wills.circleId, circle.id),
          sql`status NOT IN ('archived', 'completed')`
        ))
        .orderBy(sql`created_at DESC`)
        .limit(1);
      
      return {
        ...circle,
        members,
        activeWillCount: activeWillResult?.count || 0,
        currentWillStatus: currentWill?.status || null,
      };
    }));

    // Sort by circles with active wills first, then by most recent activity
    return result.sort((a, b) => {
      if (a.activeWillCount > 0 && b.activeWillCount === 0) return -1;
      if (a.activeWillCount === 0 && b.activeWillCount > 0) return 1;
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });
  }

  async getUserCircleCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(circleMembers)
      .where(eq(circleMembers.userId, userId));
    return result?.count || 0;
  }

  async getCircleWithMembers(circleId: number): Promise<(Circle & { members: (CircleMember & { user: User })[] }) | undefined> {
    const circle = await this.getCircleById(circleId);
    if (!circle) return undefined;
    
    const members = await this.getCircleMembers(circleId);
    return {
      ...circle,
      members,
    };
  }

  // Circle member operations
  async addCircleMember(member: InsertCircleMember): Promise<CircleMember> {
    const [newMember] = await db.insert(circleMembers).values(member).returning();
    return newMember;
  }

  async removeCircleMember(userId: string, circleId: number): Promise<void> {
    await db.delete(circleMembers)
      .where(and(
        eq(circleMembers.userId, userId),
        eq(circleMembers.circleId, circleId)
      ));
  }

  async getCircleMemberCount(circleId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(circleMembers)
      .where(eq(circleMembers.circleId, circleId));
    return result.count;
  }

  async isUserInCircle(userId: string, circleId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(circleMembers)
      .where(and(eq(circleMembers.userId, userId), eq(circleMembers.circleId, circleId)));
    return !!result;
  }

  async getCircleMembers(circleId: number): Promise<(CircleMember & { user: User })[]> {
    const result = await db
      .select({
        member: circleMembers,
        user: users,
      })
      .from(circleMembers)
      .innerJoin(users, eq(circleMembers.userId, users.id))
      .where(eq(circleMembers.circleId, circleId));

    return result.map(r => ({ ...r.member, user: r.user }));
  }

  // Will operations
  async createWill(will: InsertWill): Promise<Will> {
    const [newWill] = await db.insert(wills).values(will).returning();
    return newWill;
  }

  async getCircleActiveWill(circleId: number): Promise<Will | undefined> {
    // Return wills that are "in progress" OR completed (awaiting acknowledgments)
    // Valid statuses: pending, scheduled, active, will_review, completed
    // Archived wills are excluded - they are fully closed
    // CRITICAL: 'completed' must be included so acknowledgment checks work!
    const [will] = await db
      .select()
      .from(wills)
      .where(and(
        eq(wills.circleId, circleId),
        sql`status IN ('pending', 'scheduled', 'active', 'will_review', 'completed')`
      ))
      .orderBy(desc(wills.createdAt))
      .limit(1);
    return will;
  }

  async getUserSoloWills(userId: string): Promise<(Will & { commitments: (WillCommitment & { user: User })[] })[]> {
    // Get all solo wills created by this user
    const soloWillsList = await db
      .select()
      .from(wills)
      .where(and(
        eq(wills.createdBy, userId),
        eq(wills.mode, 'solo')
      ))
      .orderBy(desc(wills.createdAt));
    
    // For each will, get commitments with user info
    const willsWithCommitments = await Promise.all(
      soloWillsList.map(async (will) => {
        const commitmentsList = await db
          .select()
          .from(willCommitments)
          .innerJoin(users, eq(willCommitments.userId, users.id))
          .where(eq(willCommitments.willId, will.id));
        
        return {
          ...will,
          commitments: commitmentsList.map(c => ({
            ...c.will_commitments,
            user: c.users,
          })),
        };
      })
    );
    
    return willsWithCommitments;
  }

  async getUserActiveSoloWill(userId: string): Promise<Will | undefined> {
    const [will] = await db
      .select()
      .from(wills)
      .where(and(
        eq(wills.createdBy, userId),
        eq(wills.mode, 'solo'),
        sql`status NOT IN ('completed', 'archived')`
      ))
      .orderBy(desc(wills.createdAt))
      .limit(1);
    return will;
  }

  async getWillById(id: number): Promise<Will | undefined> {
    const [will] = await db.select().from(wills).where(eq(wills.id, id));
    return will;
  }

  async updateWillStatus(willId: number, status: string): Promise<void> {
    await db.update(wills).set({ status }).where(eq(wills.id, willId));
  }

  async updateWill(willId: number, updates: Partial<InsertWill>): Promise<void> {
    await db.update(wills).set(updates).where(eq(wills.id, willId));
  }

  async updateWillEndRoom(willId: number, endRoomData: { 
    endRoomScheduledAt?: Date; 
    endRoomOpenedAt?: Date;
    endRoomUrl?: string; 
    endRoomStatus?: string; 
  }): Promise<void> {
    await db.update(wills).set(endRoomData).where(eq(wills.id, willId));
  }

  async getWillWithCommitments(willId: number): Promise<(Will & { commitments: (WillCommitment & { user: User })[] }) | undefined> {
    const will = await this.getWillById(willId);
    if (!will) return undefined;

    const commitments = await db
      .select({
        commitment: willCommitments,
        user: users,
      })
      .from(willCommitments)
      .innerJoin(users, eq(willCommitments.userId, users.id))
      .where(eq(willCommitments.willId, willId));

    return {
      ...will,
      commitments: commitments.map(c => ({ ...c.commitment, user: c.user })),
    };
  }

  // Will commitment operations
  async addWillCommitment(commitment: InsertWillCommitment): Promise<WillCommitment> {
    const [newCommitment] = await db.insert(willCommitments).values(commitment).returning();
    return newCommitment;
  }

  async getWillCommitmentCount(willId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(willCommitments)
      .where(eq(willCommitments.willId, willId));
    return result.count;
  }

  async hasUserCommitted(willId: number, userId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(willCommitments)
      .where(and(eq(willCommitments.willId, willId), eq(willCommitments.userId, userId)));
    return !!result;
  }

  // Will acknowledgment operations
  async addWillAcknowledgment(acknowledgment: InsertWillAcknowledgment): Promise<WillAcknowledgment> {
    const [newAcknowledgment] = await db.insert(willAcknowledgments).values(acknowledgment).returning();
    return newAcknowledgment;
  }

  async getWillAcknowledgmentCount(willId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(willAcknowledgments)
      .where(eq(willAcknowledgments.willId, willId));
    return result.count;
  }

  async hasUserAcknowledged(willId: number, userId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(willAcknowledgments)
      .where(and(eq(willAcknowledgments.willId, willId), eq(willAcknowledgments.userId, userId)));
    return !!result;
  }

  async getWillAcknowledgments(willId: number): Promise<(WillAcknowledgment & { user: User })[]> {
    const results = await db
      .select({
        acknowledgment: willAcknowledgments,
        user: users,
      })
      .from(willAcknowledgments)
      .innerJoin(users, eq(willAcknowledgments.userId, users.id))
      .where(eq(willAcknowledgments.willId, willId));

    return results.map(r => ({ ...r.acknowledgment, user: r.user }));
  }

  // Will review operations
  async addWillReview(review: InsertWillReview): Promise<WillReview> {
    const [newReview] = await db.insert(willReviews).values(review).returning();
    return newReview;
  }

  async getWillReview(willId: number, userId: string): Promise<(WillReview & { user: User }) | undefined> {
    const [result] = await db
      .select({
        id: willReviews.id,
        willId: willReviews.willId,
        userId: willReviews.userId,
        followThrough: willReviews.followThrough,
        reflectionText: willReviews.reflectionText,
        createdAt: willReviews.createdAt,
        user: users,
      })
      .from(willReviews)
      .leftJoin(users, eq(willReviews.userId, users.id))
      .where(and(eq(willReviews.willId, willId), eq(willReviews.userId, userId)));
    return result as (WillReview & { user: User }) | undefined;
  }

  async getWillReviews(willId: number): Promise<(WillReview & { user: User })[]> {
    const results = await db
      .select({
        id: willReviews.id,
        willId: willReviews.willId,
        userId: willReviews.userId,
        followThrough: willReviews.followThrough,
        reflectionText: willReviews.reflectionText,
        createdAt: willReviews.createdAt,
        user: users,
      })
      .from(willReviews)
      .leftJoin(users, eq(willReviews.userId, users.id))
      .where(eq(willReviews.willId, willId));
    return results as (WillReview & { user: User })[];
  }

  async getWillReviewCount(willId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(willReviews)
      .where(eq(willReviews.willId, willId));
    return result.count;
  }

  // Will history operations
  async getUserWillHistory(userId: string, mode: 'solo' | 'circle', limit: number = 20): Promise<{
    id: number;
    mode: string;
    startDate: Date;
    endDate: Date;
    status: string;
    circle?: { id: number; inviteCode: string } | null;
    participants: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      commitment: string;
      followThrough: string | null;
      reflectionText: string | null;
    }[];
  }[]> {
    // Get completed wills where user participated (has a commitment)
    let completedWills;
    
    if (mode === 'solo') {
      // Solo mode: get wills created by the user
      // Include both 'completed' and 'archived' statuses since wills are archived after acknowledgment
      completedWills = await db
        .select()
        .from(wills)
        .where(and(
          eq(wills.createdBy, userId),
          eq(wills.mode, 'solo'),
          inArray(wills.status, ['completed', 'archived'])
        ))
        .orderBy(desc(wills.endDate))
        .limit(limit);
    } else {
      // Circle mode: get wills where user has a commitment
      const userCommitments = await db
        .select({ willId: willCommitments.willId })
        .from(willCommitments)
        .where(eq(willCommitments.userId, userId));
      
      const willIds = userCommitments.map(c => c.willId);
      
      if (willIds.length === 0) {
        return [];
      }
      
      // Include both 'completed' and 'archived' statuses since wills are archived after acknowledgment
      completedWills = await db
        .select()
        .from(wills)
        .where(and(
          inArray(wills.id, willIds),
          eq(wills.mode, 'circle'),
          inArray(wills.status, ['completed', 'archived'])
        ))
        .orderBy(desc(wills.endDate))
        .limit(limit);
    }
    
    // Build the result with participants, reviews, and circle info
    const result = await Promise.all(
      completedWills.map(async (will) => {
        // Get commitments with user info
        const commitmentsList = await db
          .select({
            commitment: willCommitments,
            user: users,
          })
          .from(willCommitments)
          .innerJoin(users, eq(willCommitments.userId, users.id))
          .where(eq(willCommitments.willId, will.id));
        
        // Get reviews for this will
        const reviewsList = await db
          .select()
          .from(willReviews)
          .where(eq(willReviews.willId, will.id));
        
        // Map reviews by userId for easy lookup
        const reviewsByUser = new Map(
          reviewsList.map(r => [r.userId, r])
        );
        
        // Get circle info if circle mode
        let circle = null;
        if (mode === 'circle' && will.circleId) {
          const [circleData] = await db
            .select({ id: circles.id, inviteCode: circles.inviteCode })
            .from(circles)
            .where(eq(circles.id, will.circleId));
          circle = circleData || null;
        }
        
        // Build participants array with commitment + review data
        const participants = commitmentsList.map(({ commitment, user }) => {
          const review = reviewsByUser.get(user.id);
          return {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            commitment: commitment.what,
            followThrough: review?.followThrough || null,
            reflectionText: review?.reflectionText || null,
          };
        });
        
        return {
          id: will.id,
          mode: will.mode,
          startDate: will.startDate,
          endDate: will.endDate,
          status: will.status,
          circle,
          participants,
        };
      })
    );
    
    return result;
  }

  // Daily progress operations
  async markDailyProgress(progress: InsertDailyProgress): Promise<DailyProgress> {
    const [newProgress] = await db
      .insert(dailyProgress)
      .values(progress)
      .onConflictDoUpdate({
        target: [dailyProgress.willId, dailyProgress.userId, dailyProgress.date],
        set: { completed: progress.completed },
      })
      .returning();
    return newProgress;
  }

  async getDailyProgress(willId: number, userId: string, date: string): Promise<DailyProgress | undefined> {
    const [progress] = await db
      .select()
      .from(dailyProgress)
      .where(and(
        eq(dailyProgress.willId, willId),
        eq(dailyProgress.userId, userId),
        eq(dailyProgress.date, date)
      ));
    return progress;
  }

  async getUserProgressStats(willId: number, userId: string): Promise<{ completed: number; total: number }> {
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dailyProgress)
      .where(and(
        eq(dailyProgress.willId, willId),
        eq(dailyProgress.userId, userId),
        eq(dailyProgress.completed, true)
      ));

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dailyProgress)
      .where(and(
        eq(dailyProgress.willId, willId),
        eq(dailyProgress.userId, userId)
      ));

    return {
      completed: completedResult.count,
      total: totalResult.count,
    };
  }

  // Admin operations
  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    return await db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
  }

  async getAllCircles(limit = 50, offset = 0): Promise<(Circle & { memberCount: number })[]> {
    const circlesList = await db.select().from(circles).limit(limit).offset(offset).orderBy(desc(circles.createdAt));
    
    const circlesWithMemberCount = await Promise.all(
      circlesList.map(async (circle) => {
        const memberCount = await this.getCircleMemberCount(circle.id);
        return { ...circle, memberCount };
      })
    );
    
    return circlesWithMemberCount;
  }

  async getAllWills(limit = 50, offset = 0): Promise<(Will & { circle: Circle; creator: User; memberCount: number })[]> {
    const willsData = await db
      .select({
        will: wills,
        circle: circles,
        creator: users,
      })
      .from(wills)
      .innerJoin(circles, eq(wills.circleId, circles.id))
      .innerJoin(users, eq(wills.createdBy, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(wills.createdAt));

    const willsWithMemberCount = await Promise.all(
      willsData.map(async (item) => {
        const memberCount = item.will.circleId ? await this.getCircleMemberCount(item.will.circleId) : 0;
        return {
          ...item.will,
          circle: item.circle,
          creator: item.creator,
          memberCount,
        };
      })
    );

    return willsWithMemberCount;
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }

  async deactivateUser(userId: string): Promise<void> {
    await db.update(users).set({ isActive: false }).where(eq(users.id, userId));
  }

  async activateUser(userId: string): Promise<void> {
    await db.update(users).set({ isActive: true }).where(eq(users.id, userId));
  }

  async deleteCircle(circleId: number): Promise<void> {
    // Delete related data first
    await db.delete(circleMembers).where(eq(circleMembers.circleId, circleId));
    await db.delete(circles).where(eq(circles.id, circleId));
  }

  async deleteWill(willId: number): Promise<void> {
    // Delete related data first
    await db.delete(willCommitments).where(eq(willCommitments.willId, willId));
    await db.delete(willAcknowledgments).where(eq(willAcknowledgments.willId, willId));
    await db.delete(dailyProgress).where(eq(dailyProgress.willId, willId));
    await db.delete(willPushes).where(eq(willPushes.willId, willId));
    await db.delete(wills).where(eq(wills.id, willId));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalCircles: number;
    totalWills: number;
    activeWills: number;
  }> {
    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [totalCirclesResult] = await db.select({ count: sql<number>`count(*)` }).from(circles);
    const [totalWillsResult] = await db.select({ count: sql<number>`count(*)` }).from(wills);
    const [activeWillsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(wills)
      .where(sql`status IN ('pending', 'scheduled', 'active')`);

    return {
      totalUsers: totalUsersResult.count,
      totalCircles: totalCirclesResult.count,
      totalWills: totalWillsResult.count,
      activeWills: activeWillsResult.count,
    };
  }

  // Blog operations
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updatedPost] = await db
      .update(blogPosts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updatedPost;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getAllBlogPosts(limit = 50, offset = 0): Promise<(BlogPost & { author: User })[]> {
    const posts = await db
      .select({
        post: blogPosts,
        author: users,
      })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.authorId, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(blogPosts.createdAt));

    return posts.map(p => ({ ...p.post, author: p.author }));
  }

  async getBlogPostBySlug(slug: string): Promise<(BlogPost & { author: User }) | undefined> {
    const [result] = await db
      .select({
        post: blogPosts,
        author: users,
      })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.authorId, users.id))
      .where(eq(blogPosts.slug, slug));

    return result ? { ...result.post, author: result.author } : undefined;
  }

  // Page content operations
  async createPageContent(content: InsertPageContent): Promise<PageContent> {
    const [newContent] = await db.insert(pageContents).values(content).returning();
    return newContent;
  }

  async updatePageContent(id: number, content: Partial<InsertPageContent>): Promise<PageContent> {
    const [updatedContent] = await db
      .update(pageContents)
      .set({ ...content, updatedAt: new Date() })
      .where(eq(pageContents.id, id))
      .returning();
    return updatedContent;
  }

  async deletePageContent(id: number): Promise<void> {
    await db.delete(pageContents).where(eq(pageContents.id, id));
  }

  async getAllPageContents(): Promise<PageContent[]> {
    return await db.select().from(pageContents).orderBy(pageContents.pageKey);
  }

  async getPageContentByKey(pageKey: string): Promise<PageContent | undefined> {
    const [content] = await db.select().from(pageContents).where(eq(pageContents.pageKey, pageKey));
    return content;
  }

  // Push notification operations
  async addWillPush(push: InsertWillPush): Promise<WillPush> {
    const [newPush] = await db.insert(willPushes).values(push).returning();
    return newPush;
  }

  async hasUserPushed(willId: number, userId: string): Promise<boolean> {
    const [push] = await db
      .select()
      .from(willPushes)
      .where(and(eq(willPushes.willId, willId), eq(willPushes.userId, userId)));
    return !!push;
  }

  async getWillPushes(willId: number): Promise<(WillPush & { user: User })[]> {
    const pushes = await db
      .select({
        push: willPushes,
        user: users,
      })
      .from(willPushes)
      .leftJoin(users, eq(willPushes.userId, users.id))
      .where(eq(willPushes.willId, willId))
      .orderBy(desc(willPushes.pushedAt));
    
    return pushes.map(({ push, user }) => ({
      ...push,
      user: user!,
    }));
  }

  // Password reset operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [result] = await db
      .select({
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Will check-in operations (for daily tracking)
  async createWillCheckIn(checkIn: InsertWillCheckIn): Promise<WillCheckIn> {
    const [result] = await db.insert(willCheckIns).values(checkIn).returning();
    return result;
  }

  async updateWillCheckIn(checkInId: number, updates: Partial<InsertWillCheckIn>): Promise<WillCheckIn> {
    const [result] = await db
      .update(willCheckIns)
      .set(updates)
      .where(eq(willCheckIns.id, checkInId))
      .returning();
    return result;
  }

  async getWillCheckIn(willId: number, userId: string, date: string): Promise<WillCheckIn | undefined> {
    const [result] = await db
      .select()
      .from(willCheckIns)
      .where(
        and(
          eq(willCheckIns.willId, willId),
          eq(willCheckIns.userId, userId),
          eq(willCheckIns.date, date)
        )
      );
    return result;
  }

  async getWillCheckIns(willId: number, userId: string): Promise<WillCheckIn[]> {
    return db
      .select()
      .from(willCheckIns)
      .where(
        and(
          eq(willCheckIns.willId, willId),
          eq(willCheckIns.userId, userId)
        )
      )
      .orderBy(willCheckIns.date);
  }

  async getWillCheckInProgress(willId: number, userId: string): Promise<{ total: number; completed: number; successRate: number }> {
    const checkIns = await this.getWillCheckIns(willId, userId);
    const total = checkIns.length;
    
    let completed = 0;
    for (const checkIn of checkIns) {
      if (checkIn.status === 'yes') {
        completed += 1;
      } else if (checkIn.status === 'partial') {
        completed += 0.5;
      }
    }
    
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, successRate };
  }

  // Will final reflection operations
  async createWillFinalReflection(reflection: InsertWillFinalReflection): Promise<WillFinalReflection> {
    const [result] = await db.insert(willFinalReflections).values(reflection).returning();
    return result;
  }

  async getWillFinalReflection(willId: number, userId: string): Promise<WillFinalReflection | undefined> {
    const [result] = await db
      .select()
      .from(willFinalReflections)
      .where(
        and(
          eq(willFinalReflections.willId, willId),
          eq(willFinalReflections.userId, userId)
        )
      );
    return result;
  }

  async getUserWillStats(userId: string): Promise<{
    totalWills: number;
    overallSuccessRate: number;
    dailyStats: { totalDays: number; successfulDays: number; successRate: number };
    oneTimeStats: { total: number; successful: number; successRate: number };
  }> {
    // Get all user commitments with their reviews
    const userCommitmentsList = await db
      .select({ 
        willId: willCommitments.willId, 
        checkInType: willCommitments.checkInType 
      })
      .from(willCommitments)
      .where(eq(willCommitments.userId, userId));
    
    // Get all user's will reviews (for followThrough data)
    const userReviews = await db
      .select()
      .from(willReviews)
      .where(eq(willReviews.userId, userId));
    
    const willIds = userCommitmentsList.map(c => c.willId);
    
    // Get solo wills
    const soloWillsList = await db
      .select()
      .from(wills)
      .where(and(
        eq(wills.createdBy, userId),
        eq(wills.mode, 'solo'),
        inArray(wills.status, ['completed', 'archived'])
      ));
    
    // Get circle wills the user was part of
    let circleWillsList: typeof soloWillsList = [];
    if (willIds.length > 0) {
      circleWillsList = await db
        .select()
        .from(wills)
        .where(and(
          inArray(wills.id, willIds),
          eq(wills.mode, 'circle'),
          inArray(wills.status, ['completed', 'archived'])
        ));
    }
    
    const allWills = [...soloWillsList, ...circleWillsList];
    const totalWills = allWills.length;
    
    // Get all check-ins for user
    const allCheckIns = await db
      .select()
      .from(willCheckIns)
      .where(eq(willCheckIns.userId, userId));
    
    // Calculate daily stats
    let totalDays = 0;
    let successfulDays = 0;
    for (const checkIn of allCheckIns) {
      totalDays++;
      if (checkIn.status === 'yes') {
        successfulDays += 1;
      } else if (checkIn.status === 'partial') {
        successfulDays += 0.5;
      }
    }
    const dailySuccessRate = totalDays > 0 ? Math.round((successfulDays / totalDays) * 100) : 0;
    
    // Calculate one-time stats based on followThrough from reviews
    let oneTimeTotal = 0;
    let oneTimeSuccessful = 0;
    
    // For solo wills with one-time check-in type
    for (const w of soloWillsList) {
      if (w.checkInType === 'one-time' || !w.checkInType) {
        const review = userReviews.find(r => r.willId === w.id);
        if (review) {
          oneTimeTotal++;
          if (review.followThrough === 'yes') {
            oneTimeSuccessful++;
          } else if (review.followThrough === 'mostly') {
            oneTimeSuccessful += 0.75;
          }
        }
      }
    }
    
    // For circle wills where user had one-time check-in
    for (const commitment of userCommitmentsList) {
      const w = circleWillsList.find(cw => cw.id === commitment.willId);
      if (w && (commitment.checkInType === 'one-time' || !commitment.checkInType)) {
        const review = userReviews.find(r => r.willId === w.id);
        if (review) {
          oneTimeTotal++;
          if (review.followThrough === 'yes') {
            oneTimeSuccessful++;
          } else if (review.followThrough === 'mostly') {
            oneTimeSuccessful += 0.75;
          }
        }
      }
    }
    
    const oneTimeSuccessRate = oneTimeTotal > 0 ? Math.round((oneTimeSuccessful / oneTimeTotal) * 100) : 0;
    
    // Combined success rate: weight both equally if both exist
    let overallSuccessRate = 0;
    if (totalDays > 0 && oneTimeTotal > 0) {
      overallSuccessRate = Math.round((dailySuccessRate + oneTimeSuccessRate) / 2);
    } else if (totalDays > 0) {
      overallSuccessRate = dailySuccessRate;
    } else if (oneTimeTotal > 0) {
      overallSuccessRate = oneTimeSuccessRate;
    }
    
    return {
      totalWills,
      overallSuccessRate,
      dailyStats: { totalDays, successfulDays, successRate: dailySuccessRate },
      oneTimeStats: { total: oneTimeTotal, successful: oneTimeSuccessful, successRate: oneTimeSuccessRate },
    };
  }

  async getUserWillHistoryWithCheckIns(userId: string, mode: 'solo' | 'circle', limit: number = 20): Promise<{
    id: number;
    mode: string;
    startDate: Date;
    endDate: Date;
    status: string;
    checkInType: string | null;
    willType: string | null;
    sharedWhat: string | null;
    circle?: { id: number; inviteCode: string } | null;
    participants: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      commitment: string;
      followThrough: string | null;
      reflectionText: string | null;
      checkInType: string | null;
    }[];
    userCheckInStats?: {
      total: number;
      completed: number;
      partial: number;
      missed: number;
      successRate: number;
    };
  }[]> {
    // Get completed wills using existing history method logic
    let completedWills;
    
    if (mode === 'solo') {
      completedWills = await db
        .select()
        .from(wills)
        .where(and(
          eq(wills.createdBy, userId),
          eq(wills.mode, 'solo'),
          inArray(wills.status, ['completed', 'archived'])
        ))
        .orderBy(desc(wills.endDate))
        .limit(limit);
    } else {
      const userCommitmentsList = await db
        .select({ willId: willCommitments.willId })
        .from(willCommitments)
        .where(eq(willCommitments.userId, userId));
      
      const willIds = userCommitmentsList.map(c => c.willId);
      
      if (willIds.length === 0) {
        return [];
      }
      
      completedWills = await db
        .select()
        .from(wills)
        .where(and(
          inArray(wills.id, willIds),
          eq(wills.mode, 'circle'),
          inArray(wills.status, ['completed', 'archived'])
        ))
        .orderBy(desc(wills.endDate))
        .limit(limit);
    }

    const results = [];
    
    for (const will of completedWills) {
      // Get circle info if applicable
      let circleInfo = null;
      if (will.circleId) {
        const [circle] = await db.select().from(circles).where(eq(circles.id, will.circleId));
        if (circle) {
          circleInfo = { id: circle.id, inviteCode: circle.inviteCode };
        }
      }
      
      // Get all commitments for this will with user info
      const commitmentsList = await db
        .select()
        .from(willCommitments)
        .leftJoin(users, eq(willCommitments.userId, users.id))
        .where(eq(willCommitments.willId, will.id));
      
      // Get all reviews for this will
      const reviewsList = await db
        .select()
        .from(willReviews)
        .where(eq(willReviews.willId, will.id));
      
      const participants = commitmentsList.map(row => {
        const userReview = reviewsList.find(r => r.userId === row.will_commitments.userId);
        return {
          userId: row.will_commitments.userId,
          firstName: row.users?.firstName || null,
          lastName: row.users?.lastName || null,
          email: row.users?.email || '',
          commitment: row.will_commitments.what || '',
          followThrough: userReview?.followThrough || null,
          reflectionText: userReview?.reflectionText || null,
          checkInType: row.will_commitments.checkInType,
        };
      });
      
      // Get user's check-in stats for this will
      let userCheckInStats = undefined;
      
      // Determine user's check-in type
      const userCommitment = participants.find(p => p.userId === userId);
      const userCheckInType = mode === 'solo' 
        ? will.checkInType 
        : (will.willType === 'cumulative' ? will.checkInType : userCommitment?.checkInType);
      
      if (userCheckInType === 'daily') {
        const checkIns = await this.getWillCheckIns(will.id, userId);
        let completed = 0;
        let partial = 0;
        let missed = 0;
        
        for (const checkIn of checkIns) {
          if (checkIn.status === 'yes') completed++;
          else if (checkIn.status === 'partial') partial++;
          else if (checkIn.status === 'no') missed++;
        }
        
        const total = checkIns.length;
        const successValue = completed + (partial * 0.5);
        const successRate = total > 0 ? Math.round((successValue / total) * 100) : 0;
        
        userCheckInStats = { total, completed, partial, missed, successRate };
      }
      
      // Get current user's participant data
      const currentUserParticipant = userCommitment ? {
        commitment: userCommitment.commitment,
        followThrough: userCommitment.followThrough,
        reflectionText: userCommitment.reflectionText,
        checkInType: userCommitment.checkInType,
      } : null;

      results.push({
        id: will.id,
        mode: will.mode,
        startDate: will.startDate,
        endDate: will.endDate,
        status: will.status,
        checkInType: will.checkInType,
        willType: will.willType,
        sharedWhat: will.sharedWhat,
        circle: circleInfo,
        currentUserId: userId,
        currentUserParticipant,
        participants,
        userCheckInStats,
      });
    }
    
    return results;
  }
}

export const storage = new DatabaseStorage();
