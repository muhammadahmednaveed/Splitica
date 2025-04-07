import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface GroupMember {
  id: number;
  displayName: string;
  avatarUrl?: string;
}

interface GroupCardProps {
  id: number;
  name: string;
  type: string;
  members: GroupMember[];
  balance: number;
}

export function GroupCard({ id, name, type, members, balance }: GroupCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  // Generate a background color based on group type
  const getBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'trip':
        return 'from-primary-500 to-primary-700';
      case 'home':
        return 'from-emerald-500 to-emerald-600';
      case 'couple':
        return 'from-pink-500 to-purple-600';
      default:
        return 'from-amber-500 to-amber-600';
    }
  };

  // Get the first letter(s) of the group name
  const getGroupInitials = () => {
    return getInitials(name);
  };

  return (
    <Card className="bg-white overflow-hidden shadow rounded-lg">
      <div className="relative">
        <div className={`h-24 bg-gradient-to-r ${getBgColor(type)}`}></div>
        <div className="absolute -bottom-6 left-6 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center">
          <span className="text-primary font-bold text-lg">{getGroupInitials()}</span>
        </div>
      </div>
      <CardContent className="px-4 py-5 sm:p-6 pt-8">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{name}</h3>
        <div className="mt-2 flex items-center text-sm text-gray-500">
          <Users className="h-4 w-4 mr-1.5" />
          <span>{members.length} members</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            {balance === 0 ? (
              <span className="text-sm text-gray-500">All settled up</span>
            ) : balance < 0 ? (
              <span className="text-sm text-gray-500">You owe:</span>
            ) : (
              <span className="text-sm text-gray-500">They owe you:</span>
            )}
            {balance === 0 ? (
              <span className="text-sm font-medium text-gray-500">{formatCurrency(0)}</span>
            ) : balance < 0 ? (
              <span className="text-sm font-medium text-red-500">{formatCurrency(balance)}</span>
            ) : (
              <span className="text-sm font-medium text-emerald-600">{formatCurrency(balance)}</span>
            )}
          </div>
          <div className="mt-3 flex items-center -space-x-2">
            {members.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="h-8 w-8 ring-2 ring-white">
                {member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt={member.displayName} />
                ) : (
                  <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                )}
              </Avatar>
            ))}
            {members.length > 3 && (
              <div className="h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                +{members.length - 3}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${id}`}>View Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
