import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";

export interface BalanceItem {
  id: number;
  name: string;
  avatarUrl?: string;
  amount: number;
  isGroup?: boolean;
}

interface BalanceListsProps {
  friendBalances: BalanceItem[];
  groupBalances: BalanceItem[];
  onSettleUp?: (id: number) => void;
  onRemind?: (id: number) => void;
  onAddExpense?: (id: number) => void;
  isLoading?: boolean;
}

export function BalanceLists({
  friendBalances,
  groupBalances,
  onSettleUp,
  onRemind,
  onAddExpense,
  isLoading = false
}: BalanceListsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderBalanceItem = (item: BalanceItem, type: 'friend' | 'group') => (
    <div key={`${type}-${item.id}`} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center">
          {item.isGroup ? (
            <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
              <span className="text-primary font-medium">
                {getInitials(item.name)}
              </span>
            </div>
          ) : (
            <Avatar className="h-10 w-10">
              {item.avatarUrl ? (
                <AvatarImage src={item.avatarUrl} alt={item.name} />
              ) : (
                <AvatarFallback>{getInitials(item.name)}</AvatarFallback>
              )}
            </Avatar>
          )}
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-900">{item.name}</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
          <div className="text-sm font-medium sm:mr-4">
            {item.amount === 0 ? (
              <span className="text-gray-500">all settled up</span>
            ) : item.amount > 0 ? (
              <span className="text-emerald-600">
                owes you {formatCurrency(item.amount)}
              </span>
            ) : (
              <span className="text-red-500">
                you owe {formatCurrency(Math.abs(item.amount))}
              </span>
            )}
          </div>
          <div>
            {item.amount === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddExpense && onAddExpense(item.id)}
              >
                Add Expense
              </Button>
            ) : item.amount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemind && onRemind(item.id)}
              >
                Remind
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSettleUp && onSettleUp(item.id)}
              >
                Settle Up
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <CardTitle>Friends Balances</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-gray-200 p-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32 ml-4" />
                  </div>
                  <div className="flex items-center">
                    <Skeleton className="h-4 w-24 mr-4" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="border-b border-gray-200">
            <CardTitle>Group Balances</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-gray-200 p-0">
            {[1, 2].map((i) => (
              <div key={i} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32 ml-4" />
                  </div>
                  <div className="flex items-center">
                    <Skeleton className="h-4 w-24 mr-4" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Friends Balances</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-200 p-0">
          {friendBalances.length > 0 ? (
            friendBalances.map((friend) => renderBalanceItem(friend, 'friend'))
          ) : (
            <div className="px-4 py-6 text-center text-gray-500">
              <p>No friend balances</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Group Balances</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-200 p-0">
          {groupBalances.length > 0 ? (
            groupBalances.map((group) => renderBalanceItem(group, 'group'))
          ) : (
            <div className="px-4 py-6 text-center text-gray-500">
              <p>No group balances</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
