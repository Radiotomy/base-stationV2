import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function StudioCategoryCard({ title, subtitle, icon: Icon, accent, studios, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="merc-card rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-base text-foreground leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {studios.map(({ to, label, desc, emoji }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all"
          >
            <span className="text-xl flex-shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>
    </motion.div>
  );
}