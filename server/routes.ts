import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertFriendSchema, insertGroupSchema, insertGroupMemberSchema,
  insertExpenseSchema, insertExpenseShareSchema, insertSettlementSchema,
  insertNotificationSchema
} from "@shared/schema";
import { z } from "zod";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Unauthorized");
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // HTTP server
  const httpServer = createServer(app);
  
  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    let userId: number | null = null;
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'auth' && data.userId) {
          userId = data.userId;
          storage.subscribeToNotifications(userId, ws);
          ws.send(JSON.stringify({ type: 'auth_success' }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        storage.unsubscribeFromNotifications(userId, ws);
      }
    });
  });

  // Dashboard
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get user balances
      const { friendBalances, groupBalances } = await storage.getUserBalances(userId);
      
      // Calculate summary
      let totalBalance = 0;
      let youOwe = 0;
      let youAreOwed = 0;
      
      [...friendBalances, ...groupBalances].forEach(balance => {
        totalBalance += balance.amount;
        if (balance.amount < 0) {
          youOwe += Math.abs(balance.amount);
        } else if (balance.amount > 0) {
          youAreOwed += balance.amount;
        }
      });
      
      // Get recent activities
      const expenses = await storage.getExpenses(userId);
      
      // Format activities
      const activities = await Promise.all(expenses.slice(0, 10).map(async (expense) => {
        const payer = await storage.getUser(expense.paidById);
        let groupName = undefined;
        
        if (expense.groupId) {
          const group = await storage.getGroup(expense.groupId);
          if (group) {
            groupName = group.name;
          }
        }
        
        // Determine if the current user is the payer
        const isUserPayer = expense.paidById === userId;
        
        // If user is not the payer, find their share
        let userShare = 0;
        if (!isUserPayer) {
          const shares = await storage.getExpenseShares(expense.id);
          const share = shares.find(share => share.userId === userId);
          if (share) {
            userShare = Number(share.amount);
          }
        }
        
        return {
          id: expense.id,
          type: "expense_added",
          title: isUserPayer 
            ? "You added an expense" 
            : `${payer?.displayName} added an expense`,
          description: expense.description,
          amount: isUserPayer ? 0 : userShare,
          createdAt: expense.createdAt.toISOString(),
          groupName,
          user: {
            id: payer!.id,
            displayName: payer!.displayName,
            avatarUrl: payer!.avatarUrl
          }
        };
      }));
      
      res.json({
        summary: {
          totalBalance,
          youOwe,
          youAreOwed
        },
        activities,
        friendBalances,
        groupBalances
      });
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).send("Server error");
    }
  });

  // Friends
  app.get("/api/friends", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get both accepted friends and pending friend requests
      const friends = await storage.getFriends(userId);
      const pendingFriends = await storage.getPendingFriends(userId);
      
      // Get user details for pending friend requests (both received and sent)
      const pendingFriendDetails = await Promise.all(
        pendingFriends.map(async friendship => {
          // Determine if this is a received request or a sent request
          const isReceivedRequest = friendship.friendId === userId;
          
          // Get the other user's details (either requester or recipient)
          const otherUserId = isReceivedRequest ? friendship.userId : friendship.friendId;
          const otherUser = await storage.getUser(otherUserId);
          
          return {
            id: friendship.id,
            userId: otherUserId,
            displayName: otherUser?.displayName || 'Unknown',
            email: otherUser?.email || '',
            avatarUrl: otherUser?.avatarUrl,
            status: 'pending',
            isPendingReceived: isReceivedRequest,
            isPendingSent: !isReceivedRequest
          };
        })
      );
      
      // Calculate balances for accepted friends
      const acceptedFriendDetails = await Promise.all(friends.map(async friend => {
        const { friendBalances } = await storage.getUserBalances(userId);
        const balance = friendBalances.find(b => b.id === friend.id)?.amount || 0;
        
        return {
          id: friend.id,
          displayName: friend.displayName,
          email: friend.email,
          avatarUrl: friend.avatarUrl,
          balance,
          status: 'accepted'
        };
      }));
      
      // Combine both lists
      const result = [...acceptedFriendDetails, ...pendingFriendDetails];
      
      res.json(result);
    } catch (error) {
      console.error('Error getting friends:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/friends/email", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      const userId = req.user!.id;
      
      // Make sure user isn't trying to add themselves
      const currentUser = await storage.getUser(userId);
      if (currentUser?.email === email) {
        return res.status(400).send("You cannot add yourself as a friend");
      }
      
      // Find user by email
      const friend = await storage.getUserByEmail(email);
      if (!friend) {
        return res.status(404).send("User not found");
      }
      
      // Check if friendship already exists in either direction
      const existingFriendship = await storage.getFriendship(userId, friend.id);
      if (existingFriendship) {
        if (existingFriendship.status === "pending") {
          if (existingFriendship.userId === userId) {
            return res.status(400).send("Friend request already sent");
          } else {
            // The other user already sent a request to this user, so accept it instead
            const updatedFriendship = await storage.updateFriendship(existingFriendship.id, "accepted");
            
            // Notify the other user that their request was accepted
            // (Note: the notification should go to the original requester, not to the friend who is accepting)
            await storage.createNotification({
              userId: existingFriendship.userId, // Send to the one who initiated the request
              type: "friend_request_accepted",
              message: `${currentUser?.displayName} accepted your friend request`,
              read: false,
              data: { userId }
            });
            
            return res.status(200).json(updatedFriendship);
          }
        } else {
          return res.status(400).send("Friendship already exists");
        }
      }
      
      // Create friendship
      const friendship = await storage.addFriend({
        userId,
        friendId: friend.id,
        status: "pending"
      });
      
      // Create notification for friend
      await storage.createNotification({
        userId: friend.id,
        type: "friend_request",
        message: `${currentUser?.displayName} sent you a friend request`,
        read: false,
        data: { userId }
      });
      
      res.status(201).json(friendship);
    } catch (error) {
      console.error('Error adding friend by email:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/friends/manual", isAuthenticated, async (req, res) => {
    try {
      const { displayName, phone } = req.body;
      const userId = req.user!.id;
      
      // For manual friend creation, we'll create a placeholder user
      const friend = await storage.createUser({
        username: `friend_${Date.now()}`,
        password: "placeholder",
        email: phone ? `${phone}@placeholder.com` : `manual_${Date.now()}@placeholder.com`,
        displayName,
        avatarUrl: undefined
      });
      
      // Create friendship
      const friendship = await storage.addFriend({
        userId,
        friendId: friend.id,
        status: "accepted" // Auto-accept for manually added friends
      });
      
      res.status(201).json({
        id: friend.id,
        displayName: friend.displayName,
        email: friend.email,
        avatarUrl: friend.avatarUrl,
        balance: 0
      });
    } catch (error) {
      console.error('Error adding manual friend:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/friends/:id/remind", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const friendId = parseInt(req.params.id);
      
      // Check if friendship exists
      const friendship = await storage.getFriendship(userId, friendId);
      if (!friendship || friendship.status !== "accepted") {
        return res.status(404).send("Friendship not found");
      }
      
      // Calculate balance
      const { friendBalances } = await storage.getUserBalances(userId);
      const balance = friendBalances.find(b => b.id === friendId)?.amount || 0;
      
      if (balance <= 0) {
        return res.status(400).send("Friend doesn't owe you money");
      }
      
      // Create notification for friend
      await storage.createNotification({
        userId: friendId,
        type: "payment_reminder",
        message: `${req.user!.displayName} reminded you about a payment of $${balance.toFixed(2)}`,
        read: false,
        data: { amount: balance }
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error sending reminder:', error);
      res.status(500).send("Server error");
    }
  });

  // Groups
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groups = await storage.getGroups(userId);
      
      const result = await Promise.all(groups.map(async group => {
        const members = await storage.getGroupMembers(group.id);
        
        // Calculate balance for this group
        const { groupBalances } = await storage.getUserBalances(userId);
        const balance = groupBalances.find(b => b.id === group.id)?.amount || 0;
        
        return {
          id: group.id,
          name: group.name,
          type: group.type,
          members: members.map(member => ({
            id: member.id,
            displayName: member.displayName,
            avatarUrl: member.avatarUrl
          })),
          balance
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error('Error getting groups:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const { name, type, members } = req.body;
      const userId = req.user!.id;
      
      const groupData = insertGroupSchema.parse({
        name,
        type,
        creatorId: userId
      });
      
      // Create group
      const group = await storage.createGroup(groupData);
      
      // Add creator as member
      await storage.addGroupMember({
        groupId: group.id,
        userId
      });
      
      // Add other members
      const addedMembers = [userId];
      if (members && members.length > 0) {
        for (const memberId of members) {
          if (!addedMembers.includes(memberId)) {
            await storage.addGroupMember({
              groupId: group.id,
              userId: memberId
            });
            addedMembers.push(memberId);
            
            // Notify the member
            await storage.createNotification({
              userId: memberId,
              type: "group_added",
              message: `${req.user!.displayName} added you to "${name}" group`,
              read: false,
              data: { groupId: group.id }
            });
          }
        }
      }
      
      // Get member details for response
      const memberUsers = await storage.getGroupMembers(group.id);
      
      res.status(201).json({
        id: group.id,
        name: group.name,
        type: group.type,
        members: memberUsers.map(member => ({
          id: member.id,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl
        })),
        balance: 0
      });
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).send("Server error");
    }
  });

  app.get("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if group exists and user is a member
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).send("Group not found");
      }
      
      const members = await storage.getGroupMembers(groupId);
      if (!members.some(member => member.id === userId)) {
        return res.status(403).send("You are not a member of this group");
      }
      
      // Get expenses for this group
      const expenses = await storage.getGroupExpenses(groupId);
      
      // Format expenses with additional information
      const formattedExpenses = await Promise.all(expenses.map(async expense => {
        const payer = await storage.getUser(expense.paidById);
        const shares = await storage.getExpenseShares(expense.id);
        
        return {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          paidBy: {
            id: payer!.id,
            displayName: payer!.displayName,
            avatarUrl: payer!.avatarUrl
          },
          shares: shares.map(share => ({
            userId: share.userId,
            amount: share.amount
          }))
        };
      }));
      
      // Calculate balances within the group
      const memberBalances = await Promise.all(members.map(async member => {
        let balance = 0;
        
        // Calculate what this member owes or is owed
        for (const expense of expenses) {
          if (expense.paidById === member.id) {
            // Member paid, others owe them
            const otherShares = await storage.getExpenseShares(expense.id)
              .filter(share => share.userId !== member.id);
            
            for (const share of otherShares) {
              balance += Number(share.amount);
            }
          } else {
            // Someone else paid, member might owe them
            const memberShare = await storage.getExpenseShares(expense.id)
              .find(share => share.userId === member.id);
            
            if (memberShare) {
              balance -= Number(memberShare.amount);
            }
          }
        }
        
        return {
          id: member.id,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          balance
        };
      }));
      
      res.json({
        id: group.id,
        name: group.name,
        type: group.type,
        createdAt: group.createdAt,
        members: memberBalances,
        expenses: formattedExpenses
      });
    } catch (error) {
      console.error('Error getting group details:', error);
      res.status(500).send("Server error");
    }
  });

  // Expenses
  app.get("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const expenses = await storage.getExpenses(userId);
      
      // Format expenses with additional information
      const result = await Promise.all(expenses.map(async expense => {
        const payer = await storage.getUser(expense.paidById);
        let groupName = undefined;
        
        if (expense.groupId) {
          const group = await storage.getGroup(expense.groupId);
          if (group) {
            groupName = group.name;
          }
        }
        
        const shares = await storage.getExpenseShares(expense.id);
        
        return {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          splitType: expense.splitType,
          paidBy: {
            id: payer!.id,
            displayName: payer!.displayName,
            avatarUrl: payer!.avatarUrl
          },
          groupName,
          shares: await Promise.all(shares.map(async share => {
            const user = await storage.getUser(share.userId);
            return {
              userId: share.userId,
              displayName: user?.displayName,
              amount: share.amount
            };
          }))
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error('Error getting expenses:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { 
        amount, description, date, category, splitType, 
        splitWith, groupId, friends
      } = req.body;
      
      // Validate expense data
      const expenseData = {
        description,
        amount: parseFloat(amount),
        date: new Date(date),
        paidById: userId,
        groupId: splitWith === 'group' ? groupId : null,
        category,
        splitType,
      };
      
      // Create expense
      const expense = await storage.createExpense(expenseData, []);
      
      let involvedUserIds: number[] = [];
      let shares: any[] = [];
      
      if (splitWith === 'group') {
        // Get group members
        const members = await storage.getGroupMembers(groupId);
        involvedUserIds = members.map(m => m.id);
      } else {
        // Add friends from selection
        involvedUserIds = friends || [];
      }
      
      // Make sure payer is included
      if (!involvedUserIds.includes(userId)) {
        involvedUserIds.push(userId);
      }
      
      // Calculate shares based on split type
      const totalAmount = parseFloat(amount);
      
      if (splitType === 'equal') {
        // Equal split
        const shareAmount = totalAmount / involvedUserIds.length;
        
        shares = involvedUserIds.map(memberId => {
          // Payer doesn't owe themselves
          const actualAmount = memberId === userId ? 0 : shareAmount;
          
          return {
            expenseId: expense.id,
            userId: memberId,
            amount: actualAmount,
            paid: memberId === userId // Payer already paid their share
          };
        });
      } else {
        // For demo purposes, just do equal split for now
        // Unequal and percentage would require additional UI inputs
        const shareAmount = totalAmount / involvedUserIds.length;
        
        shares = involvedUserIds.map(memberId => {
          const actualAmount = memberId === userId ? 0 : shareAmount;
          
          return {
            expenseId: expense.id,
            userId: memberId,
            amount: actualAmount,
            paid: memberId === userId
          };
        });
      }
      
      // Add shares to database
      for (const share of shares) {
        await storage.addExpenseShare(share);
      }
      
      // Notify all involved users except the payer
      const payer = await storage.getUser(userId);
      for (const memberId of involvedUserIds) {
        if (memberId !== userId) {
          // Find their share
          const userShare = shares.find(s => s.userId === memberId);
          if (userShare) {
            await storage.createNotification({
              userId: memberId,
              type: "expense_added",
              message: `${payer!.displayName} added "${description}" (${formatCurrency(parseFloat(amount))})`,
              read: false,
              data: { 
                expenseId: expense.id,
                amount: userShare.amount
              }
            });
          }
        }
      }
      
      res.status(201).json({
        ...expense,
        shares
      });
    } catch (error) {
      console.error('Error creating expense:', error);
      res.status(500).send("Server error");
    }
  });

  // Settlements
  app.post("/api/settlements", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.body;
      
      // Calculate what user owes this friend
      const { friendBalances } = await storage.getUserBalances(userId);
      const friendBalance = friendBalances.find(b => b.id === friendId);
      
      if (!friendBalance) {
        return res.status(404).send("Friend not found");
      }
      
      if (friendBalance.amount >= 0) {
        return res.status(400).send("You don't owe this friend any money");
      }
      
      // Create settlement
      const settlement = await storage.createSettlement({
        payerId: userId,
        receiverId: friendId,
        amount: Math.abs(friendBalance.amount),
        date: new Date(),
        description: "Settlement"
      });
      
      // Notify the receiver
      const payer = await storage.getUser(userId);
      await storage.createNotification({
        userId: friendId,
        type: "settlement_received",
        message: `${payer!.displayName} settled up ${formatCurrency(Math.abs(friendBalance.amount))}`,
        read: false,
        data: { 
          settlementId: settlement.id,
          amount: Math.abs(friendBalance.amount)
        }
      });
      
      res.status(201).json(settlement);
    } catch (error) {
      console.error('Error creating settlement:', error);
      res.status(500).send("Server error");
    }
  });

  // Notifications
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const notifications = await storage.getNotifications(userId);
      
      // Add user info to each notification
      const result = await Promise.all(notifications.map(async notification => {
        // Get user info based on notification type and data
        let user;
        
        if ((notification.type === 'friend_request' || notification.type === 'friend_request_accepted') && notification.data) {
          user = await storage.getUser(notification.data.userId);
        } else if (notification.type === 'expense_added' || notification.type === 'settlement_received') {
          // For these, parse from the message to get the user who created the activity
          const matches = notification.message.match(/^([^:]+) /);
          if (matches && matches[1]) {
            const displayName = matches[1];
            // First check friends
            const friends = await storage.getFriends(userId);
            user = friends.find(friend => friend.displayName === displayName);
            
            // If not found in friends, try all users (might be a pending friend)
            if (!user) {
              // Get all users who have pending friend requests with this user
              const pendingFriends = await storage.getPendingFriends(userId);
              for (const pendingFriend of pendingFriends) {
                const requester = await storage.getUser(pendingFriend.userId);
                if (requester && requester.displayName === displayName) {
                  user = requester;
                  break;
                }
              }
            }
          }
        }
        
        if (!user) {
          // Default user if we couldn't find the actual one
          user = {
            id: 0,
            displayName: "System",
            avatarUrl: undefined
          };
        }
        
        return {
          ...notification,
          user
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).send("Server error");
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      await storage.markAllNotificationsAsRead(userId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).send("Server error");
    }
  });

  // Activity feed
  app.get("/api/activity", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const type = req.query.type as string || 'all';
      const timeframe = req.query.timeframe as string || 'all';
      
      // Get expenses
      const expenses = await storage.getExpenses(userId);
      
      // Get settlements
      const settlements = await storage.getSettlements(userId);
      
      // Format activities
      let activities: any[] = [];
      
      // Add expenses to activities
      if (type === 'all' || type === 'expenses') {
        for (const expense of expenses) {
          const payer = await storage.getUser(expense.paidById);
          let groupName = undefined;
          
          if (expense.groupId) {
            const group = await storage.getGroup(expense.groupId);
            if (group) {
              groupName = group.name;
            }
          }
          
          // Determine if the current user is the payer
          const isUserPayer = expense.paidById === userId;
          
          // If user is not the payer, find their share
          let userShare = 0;
          if (!isUserPayer) {
            const shares = await storage.getExpenseShares(expense.id);
            const share = shares.find(share => share.userId === userId);
            if (share) {
              userShare = Number(share.amount);
            }
          }
          
          activities.push({
            id: expense.id,
            type: "expense_added",
            title: isUserPayer 
              ? "You added an expense" 
              : `${payer?.displayName} added an expense`,
            description: expense.description,
            amount: isUserPayer ? 0 : userShare,
            createdAt: expense.createdAt.toISOString(),
            groupName,
            user: {
              id: payer!.id,
              displayName: payer!.displayName,
              avatarUrl: payer!.avatarUrl
            }
          });
        }
      }
      
      // Add settlements to activities
      if (type === 'all' || type === 'settlements') {
        for (const settlement of settlements) {
          const isUserPayer = settlement.payerId === userId;
          const otherUserId = isUserPayer ? settlement.receiverId : settlement.payerId;
          const otherUser = await storage.getUser(otherUserId);
          
          activities.push({
            id: `settlement-${settlement.id}`,
            type: "payment_made",
            title: isUserPayer
              ? "You settled up"
              : `${otherUser?.displayName} settled up`,
            description: settlement.description || "",
            amount: Number(settlement.amount),
            createdAt: settlement.date.toISOString(),
            user: {
              id: otherUser!.id,
              displayName: otherUser!.displayName,
              avatarUrl: otherUser!.avatarUrl
            }
          });
        }
      }
      
      // Filter by timeframe
      if (timeframe !== 'all') {
        const now = new Date();
        let cutoffDate = new Date();
        
        switch (timeframe) {
          case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
          case '3months':
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
          case 'year':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        activities = activities.filter(activity => 
          new Date(activity.createdAt) >= cutoffDate
        );
      }
      
      // Sort by date, newest first
      activities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json(activities);
    } catch (error) {
      console.error('Error getting activity:', error);
      res.status(500).send("Server error");
    }
  });

  return httpServer;
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
