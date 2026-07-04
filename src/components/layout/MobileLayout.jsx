import { Outlet } from "react-router-dom";
import MobileNav from "@/components/layout/MobileNav";

export default function MobileLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* pb-20 on mobile leaves room for the bottom nav; md+ has no bottom nav */}
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}