import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupModal } from "@/components/create-group-modal";
import { PlusIcon } from "lucide-react";

export interface Group {
  id: number;
  name: string;
  type: string;
  members: Array<{
    id: number;
    displayName: string;
    avatarUrl?: string;
  }>;
  balance: number;
}

export function GroupList() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="h-24 bg-gray-200" />
              <div className="px-4 py-5 sm:p-6">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-24 mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row mb-6 sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Your Groups</h1>
        <Button onClick={() => setShowCreateGroup(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create a group
        </Button>
      </div>

      {groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} {...group} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No groups yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new group.</p>
          <div className="mt-6">
            <Button onClick={() => setShowCreateGroup(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create a group
            </Button>
          </div>
        </div>
      )}

      <CreateGroupModal 
        isOpen={showCreateGroup} 
        onClose={() => setShowCreateGroup(false)} 
      />
    </div>
  );
}

// Import at the top
import { Users } from "lucide-react";
