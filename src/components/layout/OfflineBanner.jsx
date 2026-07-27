import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-black text-xs font-bold py-1.5 px-3"
          style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
        >
          <WifiOff className="w-3.5 h-3.5" /> You're offline — showing your last saved data
        </motion.div>
      )}
    </AnimatePresence>
  );
}