import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AddFriendModal } from "@/components/add-friend-modal";
import { PlusIcon, UserPlus } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface Friend {
  id: number;
  displayName: string;
  email: string;
  avatarUrl?: string;
  balance: number;
}

export function FriendList() {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const { toast } = useToast();
  
  const { data: friends = [], isLoading } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const handleSettleUp = async (id: number) => {
    try {
      await apiRequest("POST", `/api/settlements`, {
        friendId: id,
      });
      toast({
        title: "Success",
        description: "Settlement recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record settlement",
        variant: "destructive",
      });
    }
  };

  const handleRemind = async (id: number) => {
    try {
      await apiRequest("POST", `/api/friends/${id}/remind`);
      toast({
        title: "Reminder sent",
        description: "Your friend has been notified",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reminder",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <ul className="divide-y divide-gray-200">
            {[1, 2, 3, 4].map((i) => (
              <li key={i}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="ml-4">
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Skeleton className="h-4 w-24 mr-4" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <Button onClick={() => setShowAddFriend(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add a friend
        </Button>
      </div>

      {friends.length > 0 ? (
        <Card className="overflow-hidden">
          {/* Friends list with enhanced responsive styling */}
          <ul className="divide-y divide-gray-200">
            {friends.map((friend) => (
              <li key={friend.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10">
                        {friend.avatarUrl ? (
                          <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                        ) : (
                          <AvatarFallback>{getInitials(friend.displayName)}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{friend.displayName}</div>
                        <div className="text-sm text-gray-500">{friend.email}</div>
                      </div>
                    </div>
                    {/* Responsive balance and actions section */}
                    <div className="flex items-center justify-between sm:justify-end mt-2 sm:mt-0 w-full sm:w-auto">
                      <div className="text-sm font-medium sm:mr-4">
                        {friend.balance === 0 ? (
                          <span className="text-gray-500">all settled up</span>
                        ) : friend.balance > 0 ? (
                          <span className="text-emerald-600">owes you {formatCurrency(friend.balance)}</span>
                        ) : (
                          <span className="text-red-500">you owe {formatCurrency(friend.balance)}</span>
                        )}
                      </div>
                      <div>
                        {friend.balance === 0 ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-primary-700 bg-primary-100 hover:bg-primary-200 border-transparent"
                          >
                            Add Expense
                          </Button>
                        ) : friend.balance > 0 ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRemind(friend.id)}
                          >
                            Remind
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSettleUp(friend.id)}
                          >
                            Settle Up
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No friends yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a friend.</p>
          <div className="mt-6">
            <Button onClick={() => setShowAddFriend(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add a friend
            </Button>
          </div>
        </div>
      )}

      <AddFriendModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
      />
    </div>
  );
}
