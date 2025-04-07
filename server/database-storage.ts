import { 
  users, expenses, friends, groups, groupMembers, expenseShares, 
  settlements, notifications, type User, type InsertUser, 
  type Friend, type InsertFriend, type Group, type InsertGroup, 
  type GroupMember, type InsertGroupMember, type Expense, type InsertExpense,
  type ExpenseShare, type InsertExpenseShare, type Settlement, type InsertSettlement,
  type Notification, type InsertNotification
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";
import { and, eq, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import WebSocket from "ws";
import postgres from "postgres";

// Create PostgreSQL session store
const PostgresSessionStore = connectPg(session);

interface SubscriptionMap {
  [userId: number]: WebSocket[];
}

export class DatabaseStorage implements IStorage {
  private subscriptions: SubscriptionMap = {};
  public sessionStore: session.Store;
  
  constructor() {
    // Initialize PostgreSQL session store
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true
    });
  }

  // User related methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Friend related methods
  async getFriends(userId: number): Promise<User[]> {
    // Get friendships where this user is either the user or the friend and status is accepted
    const userFriendships = await db.select({
      friendId: friends.friendId,
    }).from(friends).where(
      and(
        eq(friends.userId, userId),
        eq(friends.status, "accepted")
      )
    );
    
    const friendUserFriendships = await db.select({
      userId: friends.userId,
    }).from(friends).where(
      and(
        eq(friends.friendId, userId),
        eq(friends.status, "accepted")
      )
    );

    // Get all friend IDs
    const friendIds = [
      ...userFriendships.map(f => f.friendId),
      ...friendUserFriendships.map(f => f.userId)
    ];

    if (friendIds.length === 0) return [];

    // Fetch all friend user records
    const friendUsers = await db.select().from(users).where(
      or(...friendIds.map(id => eq(users.id, id)))
    );

    return friendUsers;
  }

  async getPendingFriends(userId: number): Promise<Friend[]> {
    // Get friendship requests where this user is the receiver and status is pending
    const pendingFriends = await db.select().from(friends).where(
      and(
        eq(friends.friendId, userId),
        eq(friends.status, "pending")
      )
    );
    
    // Also get pending friend requests sent by this user (to show as "pending sent")
    const sentRequests = await db.select().from(friends).where(
      and(
        eq(friends.userId, userId),
        eq(friends.status, "pending")
      )
    );
    
    // Combine both lists - requests where the user is the receiver are the primary focus
    return [...pendingFriends, ...sentRequests];
  }

  async getFriendship(userId: number, friendId: number): Promise<Friend | undefined> {
    // We need to check for friendships in both directions
    const result = await db.select().from(friends).where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
        and(eq(friends.userId, friendId), eq(friends.friendId, userId))
      )
    );

    // Return the first friendship found (if any)
    return result.length > 0 ? result[0] : undefined;
  }

  async addFriend(friendship: InsertFriend): Promise<Friend> {
    const result = await db.insert(friends).values(friendship).returning();
    return result[0];
  }

  async updateFriendship(id: number, status: string): Promise<Friend> {
    const result = await db.update(friends)
      .set({ status })
      .where(eq(friends.id, id))
      .returning();
    return result[0];
  }

  // Group related methods
  async getGroups(userId: number): Promise<Group[]> {
    // Get all groups where user is a member
    const userGroupMemberships = await db.select({
      groupId: groupMembers.groupId,
    }).from(groupMembers).where(eq(groupMembers.userId, userId));

    if (userGroupMemberships.length === 0) return [];

    // Fetch all group records
    const userGroups = await db.select().from(groups).where(
      or(...userGroupMemberships.map(m => eq(groups.id, m.groupId)))
    );

    return userGroups;
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const result = await db.select().from(groups).where(eq(groups.id, id));
    return result[0];
  }

  async getGroupMembers(groupId: number): Promise<User[]> {
    // Get all user IDs for a group
    const groupMemberRecords = await db.select({
      userId: groupMembers.userId,
    }).from(groupMembers).where(eq(groupMembers.groupId, groupId));

    if (groupMemberRecords.length === 0) return [];

    // Fetch all member user records
    const groupMemberUsers = await db.select().from(users).where(
      or(...groupMemberRecords.map(m => eq(users.id, m.userId)))
    );

    return groupMemberUsers;
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const result = await db.insert(groups).values(group).returning();
    return result[0];
  }

  async addGroupMember(member: InsertGroupMember): Promise<GroupMember> {
    const result = await db.insert(groupMembers).values(member).returning();
    return result[0];
  }

  // Expense related methods
  async getExpenses(userId: number): Promise<Expense[]> {
    // Get all expenses where user is either the payer or has a share
    const paidExpenses = await db.select().from(expenses).where(
      eq(expenses.paidById, userId)
    );
    
    const shareExpenseIds = await db.select({
      expenseId: expenseShares.expenseId
    }).from(expenseShares).where(eq(expenseShares.userId, userId));

    if (shareExpenseIds.length === 0) return paidExpenses;

    const sharedExpenses = await db.select().from(expenses).where(
      or(...shareExpenseIds.map(s => eq(expenses.id, s.expenseId)))
    );

    // Combine and deduplicate expenses
    const allExpenses = [...paidExpenses];
    for (const expense of sharedExpenses) {
      if (!allExpenses.some(e => e.id === expense.id)) {
        allExpenses.push(expense);
      }
    }

    return allExpenses;
  }

  async getGroupExpenses(groupId: number): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.groupId, groupId));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id));
    return result[0];
  }

  async getExpenseShares(expenseId: number): Promise<ExpenseShare[]> {
    return db.select().from(expenseShares).where(eq(expenseShares.expenseId, expenseId));
  }

  async addExpenseShare(share: InsertExpenseShare): Promise<ExpenseShare> {
    const result = await db.insert(expenseShares).values(share).returning();
    return result[0];
  }

  async createExpense(expense: InsertExpense, shares: InsertExpenseShare[]): Promise<Expense> {
    // Create the expense
    const [newExpense] = await db.insert(expenses).values(expense).returning();

    // Add the shares
    if (shares.length > 0) {
      const sharesWithExpenseId = shares.map(share => ({
        ...share,
        expenseId: newExpense.id,
      }));
      await db.insert(expenseShares).values(sharesWithExpenseId);
    }

    return newExpense;
  }

  // Balance and settlement methods
  async getUserBalances(userId: number): Promise<{friendBalances: any[], groupBalances: any[]}> {
    // Calculate balances from expenses and settlements
    // This is a complex calculation - we'll need to:
    // 1. Get all expenses where the user is involved
    // 2. Calculate what others owe the user and what the user owes others
    // 3. Adjust based on settlements

    const userExpenses = await this.getExpenses(userId);
    
    // Get all expense shares for these expenses
    const expenseIds = userExpenses.map(e => e.id);
    let allShares: ExpenseShare[] = [];
    
    if (expenseIds.length > 0) {
      for (const id of expenseIds) {
        const shares = await this.getExpenseShares(id);
        allShares = [...allShares, ...shares];
      }
    }

    // Get all settlements involving the user
    const userSettlements = await this.getSettlements(userId);

    // Calculate friend balances
    const balances = new Map<number, number>();
    
    // Process expenses where user paid
    for (const expense of userExpenses) {
      if (expense.paidById === userId) {
        // User paid, others owe user
        const expenseShares = allShares.filter(s => s.expenseId === expense.id);
        for (const share of expenseShares) {
          if (share.userId !== userId) {
            const amount = parseFloat(share.amount.toString());
            balances.set(share.userId, (balances.get(share.userId) || 0) + amount);
          }
        }
      } else {
        // Other paid, user owes them
        const userShare = allShares.find(s => s.expenseId === expense.id && s.userId === userId);
        if (userShare) {
          const amount = parseFloat(userShare.amount.toString());
          balances.set(expense.paidById, (balances.get(expense.paidById) || 0) - amount);
        }
      }
    }

    // Adjust based on settlements
    for (const settlement of userSettlements) {
      if (settlement.payerId === userId) {
        // User paid someone
        const amount = parseFloat(settlement.amount.toString());
        balances.set(settlement.receiverId, (balances.get(settlement.receiverId) || 0) - amount);
      } else {
        // Someone paid the user
        const amount = parseFloat(settlement.amount.toString());
        balances.set(settlement.payerId, (balances.get(settlement.payerId) || 0) + amount);
      }
    }

    // Convert to friend balances array with user details
    const friendBalancePromises = Array.from(balances.entries()).map(async ([friendId, amount]) => {
      const friend = await this.getUser(friendId);
      return {
        id: friendId,
        name: friend?.displayName || 'Unknown',
        avatarUrl: friend?.avatarUrl,
        amount,
      };
    });

    const friendBalances = await Promise.all(friendBalancePromises);

    // Group balances would be calculated in a similar way, but grouped by group
    // For now, return an empty array
    return {
      friendBalances,
      groupBalances: []
    };
  }

  async getSettlements(userId?: number): Promise<Settlement[]> {
    if (userId) {
      return db.select().from(settlements).where(
        or(
          eq(settlements.payerId, userId),
          eq(settlements.receiverId, userId)
        )
      );
    }
    return db.select().from(settlements);
  }

  async createSettlement(settlement: InsertSettlement): Promise<Settlement> {
    const result = await db.insert(settlements).values(settlement).returning();
    return result[0];
  }

  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    
    // Broadcast to user if they are connected
    this.broadcastToUser(notification.userId, {
      type: 'notification',
      data: result[0]
    });
    
    return result[0];
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  // WebSocket subscription methods
  subscribeToNotifications(userId: number, ws: WebSocket): void {
    if (!this.subscriptions[userId]) {
      this.subscriptions[userId] = [];
    }
    this.subscriptions[userId].push(ws);
  }

  unsubscribeFromNotifications(userId: number, ws: WebSocket): void {
    if (!this.subscriptions[userId]) return;
    this.subscriptions[userId] = this.subscriptions[userId].filter(conn => conn !== ws);
    if (this.subscriptions[userId].length === 0) {
      delete this.subscriptions[userId];
    }
  }

  broadcastToUser(userId: number, data: any): void {
    if (!this.subscriptions[userId]) return;
    const connections = this.subscriptions[userId];
    const message = JSON.stringify(data);
    
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}