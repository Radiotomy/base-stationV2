import { useAuth } from "@/lib/AuthContext";
import PageNotFound from "@/lib/PageNotFound";

/** Renders children only for admin users — internal/dev pages show a 404 to everyone else. */
export default function AdminGate({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <PageNotFound />;
  return children;
}