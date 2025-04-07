import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ProtectedRoute } from "@/lib/protected-route";
import { AddExpenseModal } from "@/components/add-expense-modal";

import DashboardPage from "@/pages/dashboard-page";
import GroupsPage from "@/pages/groups-page";
import FriendsPage from "@/pages/friends-page";
import ActivityPage from "@/pages/activity-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

// AppContent component that will have access to auth context
function AppContent() {
  const [showMobileAddExpense, setShowMobileAddExpense] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Check if we're on the auth page
  const isAuthPage = location === "/auth";
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      {/* Added proper padding for desktop views */}
      <main className={`flex-grow ${!isAuthPage && 'pb-16 sm:pb-0'}`}>
        <Switch>
          <ProtectedRoute path="/" component={DashboardPage} />
          <ProtectedRoute path="/groups" component={GroupsPage} />
          <ProtectedRoute path="/friends" component={FriendsPage} />
          <ProtectedRoute path="/activity" component={ActivityPage} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {/* Mobile navigation only visible on small screens and when user is logged in */}
      {!isAuthPage && user && (
        <MobileNav onAddExpenseClick={() => setShowMobileAddExpense(true)} />
      )}
      <AddExpenseModal 
        isOpen={showMobileAddExpense} 
        onClose={() => setShowMobileAddExpense(false)} 
      />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
