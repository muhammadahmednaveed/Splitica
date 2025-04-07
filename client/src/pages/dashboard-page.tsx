import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { BalanceLists, BalanceItem } from "@/components/dashboard/balance-lists";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { ActivityItem } from "@/components/dashboard/recent-activity";

interface DashboardData {
  summary: {
    totalBalance: number;
    youOwe: number;
    youAreOwed: number;
  };
  activities: ActivityItem[];
  friendBalances: BalanceItem[];
  groupBalances: BalanceItem[];
}

export default function DashboardPage() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
  });

  const handleSettleUp = async (id: number) => {
    try {
      await apiRequest("POST", `/api/settlements`, {
        friendId: id,
      });
      toast({
        title: "Success",
        description: "Settlement recorded successfully",
      });
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Button onClick={() => setShowAddExpense(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add an expense
        </Button>
      </div>

      <SummaryCards 
        data={data?.summary || { totalBalance: 0, youOwe: 0, youAreOwed: 0 }} 
        isLoading={isLoading} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left column (activity) takes 2/3 on large screens, full on mobile */}
        <div className="md:col-span-2">
          <RecentActivity 
            activities={(data?.activities || []) as ActivityItem[]} 
            isLoading={isLoading} 
          />
        </div>
        
        {/* Right column (balances) takes 1/3 on large screens, full on mobile */}
        <div className="md:col-span-1">
          <BalanceLists 
            friendBalances={data?.friendBalances || []}
            groupBalances={data?.groupBalances || []}
            onSettleUp={handleSettleUp}
            onRemind={handleRemind}
            onAddExpense={() => setShowAddExpense(true)}
            isLoading={isLoading}
          />
        </div>
      </div>

      <AddExpenseModal 
        isOpen={showAddExpense} 
        onClose={() => setShowAddExpense(false)} 
      />
    </div>
  );
}
