import { 
  users, expenses, friends, groups, groupMembers, expenseShares, 
  settlements, notifications, type User, type InsertUser, 
  type Friend, type InsertFriend, type Group, type InsertGroup, 
  type GroupMember, type InsertGroupMember, type Expense, type InsertExpense,
  type ExpenseShare, type InsertExpenseShare, type Settlement, type InsertSettlement,
  type Notification, type InsertNotification
} from "@shared/schema";
import session from "express-session";
import WebSocket from "ws";
import { DatabaseStorage } from "./database-storage";

interface SubscriptionMap {
  [userId: number]: WebSocket[];
}

export interface IStorage {
  // User related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Friend related methods
  getFriends(userId: number): Promise<User[]>;
  getPendingFriends(userId: number): Promise<Friend[]>;
  getFriendship(userId: number, friendId: number): Promise<Friend | undefined>;
  addFriend(friendship: InsertFriend): Promise<Friend>;
  updateFriendship(id: number, status: string): Promise<Friend>;
  
  // Group related methods
  getGroups(userId: number): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupMembers(groupId: number): Promise<User[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  addGroupMember(member: InsertGroupMember): Promise<GroupMember>;
  
  // Expense related methods
  getExpenses(userId: number): Promise<Expense[]>;
  getGroupExpenses(groupId: number): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  getExpenseShares(expenseId: number): Promise<ExpenseShare[]>;
  addExpenseShare(share: InsertExpenseShare): Promise<ExpenseShare>;
  createExpense(expense: InsertExpense, shares: InsertExpenseShare[]): Promise<Expense>;
  
  // Balance and settlement methods
  getUserBalances(userId: number): Promise<{friendBalances: any[], groupBalances: any[]}>;
  getSettlements(userId?: number): Promise<Settlement[]>;
  createSettlement(settlement: InsertSettlement): Promise<Settlement>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // WebSocket subscription methods
  subscribeToNotifications(userId: number, ws: WebSocket): void;
  unsubscribeFromNotifications(userId: number, ws: WebSocket): void;
  broadcastToUser(userId: number, data: any): void;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  // Storage collections
  private users: Map<number, User>;
  private friends: Map<number, Friend>;
  private groups: Map<number, Group>;
  private groupMembers: Map<number, GroupMember>;
  private expenses: Map<number, Expense>;
  private expenseShares: Map<number, ExpenseShare>;
  private settlements: Map<number, Settlement>;
  private notifications: Map<number, Notification>;
  
  // Current IDs for auto-increment
  private currentIds: {
    users: number;
    friends: number;
    groups: number;
    groupMembers: number;
    expenses: number;
    expenseShares: number;
    settlements: number;
    notifications: number;
  };
  
  // WebSocket subscriptions
  private subscriptions: SubscriptionMap;
  
  // Session store
  public sessionStore: session.SessionStore;

  constructor() {
    // Initialize collections
    this.users = new Map();
    this.friends = new Map();
    this.groups = new Map();
    this.groupMembers = new Map();
    this.expenses = new Map();
    this.expenseShares = new Map();
    this.settlements = new Map();
    this.notifications = new Map();
    
    // Initialize IDs
    this.currentIds = {
      users: 1,
      friends: 1,
      groups: 1,
      groupMembers: 1,
      expenses: 1,
      expenseShares: 1,
      settlements: 1,
      notifications: 1
    };
    
    // Initialize WebSocket subscriptions
    this.subscriptions = {};
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Friend methods
  async getFriends(userId: number): Promise<User[]> {
    // Get all accepted friendships where userId is involved
    const userFriendships = Array.from(this.friends.values()).filter(
      (friendship) => 
        (friendship.userId === userId || friendship.friendId === userId) && 
        friendship.status === 'accepted'
    );
    
    // Extract the IDs of the friends
    const friendIds = userFriendships.map(friendship => 
      friendship.userId === userId ? friendship.friendId : friendship.userId
    );
    
    // Get the user objects for each friend ID
    const friendUsers = friendIds.map(id => this.users.get(id)).filter(Boolean) as User[];
    
    return friendUsers;
  }

  async getPendingFriends(userId: number): Promise<Friend[]> {
    return Array.from(this.friends.values()).filter(
      (friendship) => 
        (friendship.userId === userId || friendship.friendId === userId) && 
        friendship.status === 'pending'
    );
  }

  async getFriendship(userId: number, friendId: number): Promise<Friend | undefined> {
    return Array.from(this.friends.values()).find(
      (friendship) => 
        (friendship.userId === userId && friendship.friendId === friendId) ||
        (friendship.userId === friendId && friendship.friendId === userId)
    );
  }

  async addFriend(insertFriend: InsertFriend): Promise<Friend> {
    const id = this.currentIds.friends++;
    const friend: Friend = { ...insertFriend, id };
    this.friends.set(id, friend);
    return friend;
  }

  async updateFriendship(id: number, status: string): Promise<Friend> {
    const friendship = this.friends.get(id);
    if (!friendship) {
      throw new Error('Friendship not found');
    }
    
    const updatedFriendship = { ...friendship, status };
    this.friends.set(id, updatedFriendship);
    return updatedFriendship;
  }

  // Group methods
  async getGroups(userId: number): Promise<Group[]> {
    // Find all groupMembers entries for this user
    const userGroupMemberships = Array.from(this.groupMembers.values()).filter(
      (membership) => membership.userId === userId
    );
    
    // Get the group IDs
    const groupIds = userGroupMemberships.map(membership => membership.groupId);
    
    // Get the group objects
    const groups = groupIds.map(id => this.groups.get(id)).filter(Boolean) as Group[];
    
    return groups;
  }

  async getGroup(id: number): Promise<Group | undefined> {
    return this.groups.get(id);
  }

  async getGroupMembers(groupId: number): Promise<User[]> {
    // Find all groupMembers entries for this group
    const groupMemberships = Array.from(this.groupMembers.values()).filter(
      (membership) => membership.groupId === groupId
    );
    
    // Get the user IDs
    const userIds = groupMemberships.map(membership => membership.userId);
    
    // Get the user objects
    const users = userIds.map(id => this.users.get(id)).filter(Boolean) as User[];
    
    return users;
  }

  async createGroup(insertGroup: InsertGroup): Promise<Group> {
    const id = this.currentIds.groups++;
    const now = new Date();
    const group: Group = { 
      ...insertGroup, 
      id, 
      createdAt: now
    };
    this.groups.set(id, group);
    return group;
  }

  async addGroupMember(insertMember: InsertGroupMember): Promise<GroupMember> {
    const id = this.currentIds.groupMembers++;
    const member: GroupMember = { ...insertMember, id };
    this.groupMembers.set(id, member);
    return member;
  }

  // Expense methods
  async getExpenses(userId: number): Promise<Expense[]> {
    // Get expenses where user is the payer
    const userExpenses = Array.from(this.expenses.values()).filter(
      (expense) => expense.paidById === userId
    );
    
    // Get expense IDs where user has a share
    const userShareExpenseIds = Array.from(this.expenseShares.values())
      .filter(share => share.userId === userId)
      .map(share => share.expenseId);
    
    // Get those expenses
    const expensesWhereUserHasShare = userShareExpenseIds
      .map(id => this.expenses.get(id))
      .filter(Boolean) as Expense[];
    
    // Combine and deduplicate
    const allExpenses = [...userExpenses, ...expensesWhereUserHasShare];
    const uniqueExpenses = Array.from(
      new Map(allExpenses.map(item => [item.id, item])).values()
    );
    
    return uniqueExpenses.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getGroupExpenses(groupId: number): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.groupId === groupId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async getExpenseShares(expenseId: number): Promise<ExpenseShare[]> {
    return Array.from(this.expenseShares.values())
      .filter(share => share.expenseId === expenseId);
  }
  
  async addExpenseShare(share: InsertExpenseShare): Promise<ExpenseShare> {
    const id = this.currentIds.expenseShares++;
    const newShare: ExpenseShare = {
      ...share,
      id,
      paid: share.paid || false
    };
    this.expenseShares.set(id, newShare);
    return newShare;
  }

  async createExpense(expense: InsertExpense, shares: InsertExpenseShare[]): Promise<Expense> {
    // Create expense
    const id = this.currentIds.expenses++;
    const now = new Date();
    const newExpense: Expense = { 
      ...expense, 
      id, 
      createdAt: now
    };
    this.expenses.set(id, newExpense);
    
    // Create expense shares
    shares.forEach(share => {
      const shareId = this.currentIds.expenseShares++;
      const newShare: ExpenseShare = {
        ...share,
        id: shareId,
        expenseId: id
      };
      this.expenseShares.set(shareId, newShare);
    });
    
    return newExpense;
  }

  // Balance and settlement methods
  async getUserBalances(userId: number): Promise<{friendBalances: any[], groupBalances: any[]}> {
    // Initialize response objects
    const friendBalances: any[] = [];
    const groupBalances: any[] = [];
    
    // Get all expenses where user is involved
    const userExpenses = await this.getExpenses(userId);
    
    // Get all user's friends
    const friends = await this.getFriends(userId);
    
    // Calculate friend balances
    for (const friend of friends) {
      let balance = 0;
      
      // Expenses paid by user that friend owes money for
      const expensesPaidByUser = userExpenses.filter(e => 
        e.paidById === userId && e.groupId === null
      );
      
      for (const expense of expensesPaidByUser) {
        const friendShare = Array.from(this.expenseShares.values()).find(
          share => share.expenseId === expense.id && share.userId === friend.id
        );
        
        if (friendShare) {
          balance += Number(friendShare.amount);
        }
      }
      
      // Expenses paid by friend that user owes money for
      const expensesPaidByFriend = Array.from(this.expenses.values()).filter(
        e => e.paidById === friend.id && e.groupId === null
      );
      
      for (const expense of expensesPaidByFriend) {
        const userShare = Array.from(this.expenseShares.values()).find(
          share => share.expenseId === expense.id && share.userId === userId
        );
        
        if (userShare) {
          balance -= Number(userShare.amount);
        }
      }
      
      // Settlements between user and friend
      const settlements = Array.from(this.settlements.values()).filter(
        s => (s.payerId === userId && s.receiverId === friend.id) ||
             (s.payerId === friend.id && s.receiverId === userId)
      );
      
      for (const settlement of settlements) {
        if (settlement.payerId === userId) {
          balance -= Number(settlement.amount);
        } else {
          balance += Number(settlement.amount);
        }
      }
      
      friendBalances.push({
        id: friend.id,
        name: friend.displayName,
        avatarUrl: friend.avatarUrl,
        amount: balance
      });
    }
    
    // Get all user's groups
    const groups = await this.getGroups(userId);
    
    // Calculate group balances
    for (const group of groups) {
      let balance = 0;
      
      // Get all expenses for this group
      const groupExpenses = await this.getGroupExpenses(group.id);
      
      for (const expense of groupExpenses) {
        if (expense.paidById === userId) {
          // User paid, others owe them
          const otherMembersShares = Array.from(this.expenseShares.values()).filter(
            share => share.expenseId === expense.id && share.userId !== userId
          );
          
          for (const share of otherMembersShares) {
            balance += Number(share.amount);
          }
        } else {
          // Someone else paid, user might owe them
          const userShare = Array.from(this.expenseShares.values()).find(
            share => share.expenseId === expense.id && share.userId === userId
          );
          
          if (userShare) {
            balance -= Number(userShare.amount);
          }
        }
      }
      
      groupBalances.push({
        id: group.id,
        name: group.name,
        isGroup: true,
        amount: balance
      });
    }
    
    return { friendBalances, groupBalances };
  }

  async getSettlements(userId?: number): Promise<Settlement[]> {
    const settlements = Array.from(this.settlements.values());
    
    if (userId !== undefined) {
      return settlements.filter(settlement => 
        settlement.payerId === userId || settlement.receiverId === userId
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    return settlements.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async createSettlement(insertSettlement: InsertSettlement): Promise<Settlement> {
    const id = this.currentIds.settlements++;
    const now = new Date();
    const settlement: Settlement = { 
      ...insertSettlement, 
      id, 
      date: now
    };
    this.settlements.set(id, settlement);
    return settlement;
  }

  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.currentIds.notifications++;
    const now = new Date();
    const notification: Notification = { 
      ...insertNotification, 
      id, 
      createdAt: now
    };
    this.notifications.set(id, notification);
    
    // Broadcast to user if they're subscribed
    this.broadcastToUser(insertNotification.userId, {
      type: 'notification',
      data: notification
    });
    
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      const updatedNotification = { ...notification, read: true };
      this.notifications.set(id, updatedNotification);
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);
      
    userNotifications.forEach(notification => {
      const updatedNotification = { ...notification, read: true };
      this.notifications.set(notification.id, updatedNotification);
    });
  }

  // WebSocket subscription methods
  subscribeToNotifications(userId: number, ws: WebSocket): void {
    if (!this.subscriptions[userId]) {
      this.subscriptions[userId] = [];
    }
    
    // Only add if not already subscribed
    if (!this.subscriptions[userId].includes(ws)) {
      this.subscriptions[userId].push(ws);
    }
  }

  unsubscribeFromNotifications(userId: number, ws: WebSocket): void {
    if (this.subscriptions[userId]) {
      this.subscriptions[userId] = this.subscriptions[userId].filter(
        socket => socket !== ws
      );
      
      // Clean up if no more subscriptions
      if (this.subscriptions[userId].length === 0) {
        delete this.subscriptions[userId];
      }
    }
  }

  broadcastToUser(userId: number, data: any): void {
    if (this.subscriptions[userId]) {
      const message = JSON.stringify(data);
      this.subscriptions[userId].forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }
}

// Export single instance
export const storage = new DatabaseStorage();
