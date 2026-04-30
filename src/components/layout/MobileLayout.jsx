import { Outlet } from "react-router-dom";

export default function MobileLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}