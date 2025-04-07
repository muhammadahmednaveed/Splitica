import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Receipt, DollarSign, Users, UserPlus } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { ActivityItem } from "@/components/dashboard/recent-activity";

interface ActivityFilterOptions {
  type: "all" | "expenses" | "settlements" | "groups" | "friends";
  timeframe: "all" | "month" | "3months" | "year";
}

export function ActivityList() {
  const [filters, setFilters] = useState<ActivityFilterOptions>({
    type: "all",
    timeframe: "all",
  });

  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/activity', filters],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  // Icon based on activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "expense_added":
        return <Receipt className="h-5 w-5 text-primary-600" />;
      case "payment_made":
        return <DollarSign className="h-5 w-5 text-emerald-600" />;
      case "group_created":
        return <Users className="h-5 w-5 text-primary-600" />;
      case "friend_added":
        return <UserPlus className="h-5 w-5 text-primary-600" />;
      default:
        return <Receipt className="h-5 w-5 text-primary-600" />;
    }
  };

  // Get background color for icon container
  const getIconBgColor = (type: string) => {
    switch (type) {
      case "expense_added":
        return "bg-primary-100";
      case "payment_made":
        return "bg-emerald-100";
      case "group_created":
      case "friend_added":
        return "bg-primary-100";
      default:
        return "bg-gray-100";
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-40" />
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="divide-y divide-gray-200 p-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full mr-4" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <div className="flex space-x-3">
          <Select
            value={filters.type}
            onValueChange={(value) => 
              setFilters({ ...filters, type: value as ActivityFilterOptions["type"] })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transactions</SelectItem>
              <SelectItem value="expenses">Expenses</SelectItem>
              <SelectItem value="settlements">Settlements</SelectItem>
              <SelectItem value="groups">Groups</SelectItem>
              <SelectItem value="friends">Friends</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={filters.timeframe}
            onValueChange={(value) => 
              setFilters({ ...filters, timeframe: value as ActivityFilterOptions["timeframe"] })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y divide-gray-200 p-0">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div key={activity.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 mr-4">
                      {activity.type === "expense_added" || activity.type === "payment_made" ? (
                        <Avatar className="h-10 w-10">
                          {activity.user.avatarUrl ? (
                            <AvatarImage src={activity.user.avatarUrl} alt={activity.user.displayName} />
                          ) : (
                            <AvatarFallback>{getInitials(activity.user.displayName)}</AvatarFallback>
                          )}
                        </Avatar>
                      ) : (
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getIconBgColor(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-primary">
                        {activity.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {activity.description && (
                          <span className="font-medium">{activity.description}</span>
                        )}
                        {activity.groupName && (
                          <span className="ml-1 px-2 py-0.5 text-xs bg-primary-100 text-primary rounded-md">
                            {activity.groupName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  {activity.amount !== undefined && (
                    <div className={`text-sm font-medium ${
                      activity.type === "expense_added" 
                        ? "text-red-500" 
                        : "text-emerald-600"
                    }`}>
                      {activity.type === "expense_added" 
                        ? `you owe ${formatCurrency(activity.amount)}` 
                        : `paid you ${formatCurrency(activity.amount)}`
                      }
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-500">
              <Receipt className="mx-auto h-8 w-8 mb-2 text-gray-400" />
              <p className="mb-1">No activity found</p>
              <p className="text-xs text-gray-400">Try changing your filters</p>
            </div>
          )}
        </CardContent>
        
        {activities.length > 10 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <nav className="flex items-center justify-between">
              <div className="flex-1 flex justify-between">
                <Button variant="outline" size="sm">
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </nav>
          </div>
        )}
      </Card>
    </div>
  );
}
