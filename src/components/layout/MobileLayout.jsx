import { Outlet } from "react-router-dom";
import MobileNav from "./MobileNav";

export default function MobileLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <main className="flex-1">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}