import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

const Index = () => {
  const { session } = useAuth();
  
  // If user is authenticated, redirect to their role-based dashboard
  // If not authenticated, the landing page will be shown at root route
  if (session) {
    return <Navigate to="/" replace />;
  }
  
  return <Navigate to="/" replace />;
};

export default Index;
