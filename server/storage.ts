import {
  users,
  circles,
  circleMembers,
  wills,
  willCommitments,
  willAcknowledgments,
  dailyProgress,
  type User,
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
  type DailyProgress,
  type InsertDailyProgress,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Circle operations
  createCircle(circle: InsertCircle): Promise<Circle>;
  getCircleByInviteCode(inviteCode: string): Promise<Circle | undefined>;
  getCircleById(id: number): Promise<Circle | undefined>;
  getUserCircle(userId: string): Promise<(Circle & { members: (CircleMember & { user: User })[] }) | undefined>;
  
  // Circle member operations
  addCircleMember(member: InsertCircleMember): Promise<CircleMember>;
  getCircleMemberCount(circleId: number): Promise<number>;
  isUserInCircle(userId: string, circleId: number): Promise<boolean>;
  getCircleMembers(circleId: number): Promise<(CircleMember & { user: User })[]>;
  
  // Will operations
  createWill(will: InsertWill): Promise<Will>;
  getCircleActiveWill(circleId: number): Promise<Will | undefined>;
  getWillById(id: number): Promise<Will | undefined>;
  updateWillStatus(willId: number, status: string): Promise<void>;
  getWillWithCommitments(willId: number): Promise<(Will & { commitments: (WillCommitment & { user: User })[] }) | undefined>;
  
  // Will commitment operations
  addWillCommitment(commitment: InsertWillCommitment): Promise<WillCommitment>;
  getWillCommitmentCount(willId: number): Promise<number>;
  hasUserCommitted(willId: number, userId: string): Promise<boolean>;
  
  // Will acknowledgment operations
  addWillAcknowledgment(acknowledgment: InsertWillAcknowledgment): Promise<WillAcknowledgment>;
  getWillAcknowledgmentCount(willId: number): Promise<number>;
  hasUserAcknowledged(willId: number, userId: string): Promise<boolean>;
  
  // Daily progress operations
  markDailyProgress(progress: InsertDailyProgress): Promise<DailyProgress>;
  getDailyProgress(willId: number, userId: string, date: string): Promise<DailyProgress | undefined>;
  getUserProgressStats(willId: number, userId: string): Promise<{ completed: number; total: number }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  // Circle member operations
  async addCircleMember(member: InsertCircleMember): Promise<CircleMember> {
    const [newMember] = await db.insert(circleMembers).values(member).returning();
    return newMember;
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
    const [will] = await db
      .select()
      .from(wills)
      .where(and(
        eq(wills.circleId, circleId),
        sql`status != 'completed'`
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
}

export const storage = new DatabaseStorage();
