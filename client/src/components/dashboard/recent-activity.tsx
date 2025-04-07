import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Receipt, DollarSign, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";

export interface ActivityItem {
  id: number;
  type: "expense_added" | "payment_made" | "group_created" | "friend_added";
  title: string;
  description: string;
  amount?: number;
  createdAt: string;
  groupName?: string;
  user: {
    id: number;
    displayName: string;
    avatarUrl?: string;
  };
}

interface RecentActivityProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

export function RecentActivity({ activities, isLoading = false }: RecentActivityProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="ml-4">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-gray-200 p-0">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div key={activity.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {activity.type === "expense_added" || activity.type === "payment_made" ? (
                    <Avatar className="h-10 w-10">
                      {activity.user.avatarUrl ? (
                        <AvatarImage src={activity.user.avatarUrl} alt={activity.user.displayName} />
                      ) : (
                        <AvatarFallback>{getInitials(activity.user.displayName)}</AvatarFallback>
                      )}
                    </Avatar>
                  ) : activity.type === "group_created" ? (
                    <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  ) : (
                    <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
                      {activity.type === "expense_added" ? (
                        <Receipt className="h-5 w-5 text-primary" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="ml-4">
                    <p className="text-sm font-medium text-primary">
                      {activity.title}
                    </p>
                    <div className="text-sm text-gray-500">
                      <span>{activity.description}</span>
                      {activity.groupName && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-primary-100 text-primary rounded-md">{activity.groupName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-gray-500">
            <p>No recent activity</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-gray-200">
        <Link href="/activity" className="text-sm font-medium text-primary hover:text-primary/80">
          View all activity <span aria-hidden="true">&rarr;</span>
        </Link>
      </CardFooter>
    </Card>
  );
}
