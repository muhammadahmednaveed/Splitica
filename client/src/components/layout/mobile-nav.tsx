import { useLocation, Link } from "wouter";
import { PlusCircle, Home, Users, UserCircle, FileText } from "lucide-react";

interface MobileNavProps {
  onAddExpenseClick: () => void;
}

export function MobileNav({ onAddExpenseClick }: MobileNavProps) {
  const [location] = useLocation();

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around">
        <Link
          href="/"
          className={`flex flex-col items-center py-3 px-3 text-xs font-medium ${
            location === "/" ? "text-primary" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Home className="h-5 w-5 mb-1" />
          <span>Dashboard</span>
        </Link>
        
        <Link
          href="/groups"
          className={`flex flex-col items-center py-3 px-3 text-xs font-medium ${
            location === "/groups" ? "text-primary" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Users className="h-5 w-5 mb-1" />
          <span>Groups</span>
        </Link>
        
        <button
          onClick={onAddExpenseClick}
          className="flex flex-col items-center py-3 px-3 text-xs font-medium text-primary"
        >
          <div className="rounded-full bg-primary p-1 text-white mb-1">
            <PlusCircle className="h-5 w-5" />
          </div>
          <span>Add</span>
        </button>
        
        <Link
          href="/friends"
          className={`flex flex-col items-center py-3 px-3 text-xs font-medium ${
            location === "/friends" ? "text-primary" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <UserCircle className="h-5 w-5 mb-1" />
          <span>Friends</span>
        </Link>
        
        <Link
          href="/activity"
          className={`flex flex-col items-center py-3 px-3 text-xs font-medium ${
            location === "/activity" ? "text-primary" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileText className="h-5 w-5 mb-1" />
          <span>Activity</span>
        </Link>
      </div>
    </div>
  );
}
