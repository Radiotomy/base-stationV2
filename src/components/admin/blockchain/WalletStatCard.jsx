export default function WalletStatCard({ icon: Icon, label, value, accent = 'text-foreground' }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${accent}`} />}
        {label}
      </div>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}