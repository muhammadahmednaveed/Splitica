import { Card, CardContent } from "@/components/ui/card";

interface DashboardSummary {
  totalBalance: number;
  youOwe: number;
  youAreOwed: number;
}

interface SummaryCardsProps {
  data: DashboardSummary;
  isLoading?: boolean;
}

export function SummaryCards({ data, isLoading = false }: SummaryCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white">
            <CardContent className="px-4 py-5 sm:p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-6">
      {/* Total Balance */}
      <Card className="bg-white">
        <CardContent className="px-4 py-5 sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">Total Balance</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">
            {formatCurrency(data.totalBalance)}
          </dd>
          <div className="mt-2 text-sm text-gray-500">Overall across all groups and friends</div>
        </CardContent>
      </Card>

      {/* You Owe */}
      <Card className="bg-white">
        <CardContent className="px-4 py-5 sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">You Owe</dt>
          <dd className="mt-1 text-3xl font-semibold text-red-500">
            {formatCurrency(data.youOwe)}
          </dd>
          <div className="mt-2 text-sm text-gray-500">Total amount you need to pay back</div>
        </CardContent>
      </Card>

      {/* You Are Owed */}
      <Card className="bg-white">
        <CardContent className="px-4 py-5 sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">You Are Owed</dt>
          <dd className="mt-1 text-3xl font-semibold text-emerald-600">
            {formatCurrency(data.youAreOwed)}
          </dd>
          <div className="mt-2 text-sm text-gray-500">Total amount others owe you</div>
        </CardContent>
      </Card>
    </div>
  );
}
