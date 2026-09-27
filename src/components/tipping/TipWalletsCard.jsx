import { Input } from "@/components/ui/input";

const FIELDS = [
  { key: "base", label: "Base wallet (ETH)", placeholder: "0x…", valid: (v) => /^0x[0-9a-fA-F]{40}$/.test(v) },
  { key: "solana", label: "Solana wallet (SOL)", placeholder: "Base58 address", valid: (v) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) },
  { key: "audius_handle", label: "Audius handle ($AUDIO)", placeholder: "yourhandle", valid: (v) => /^[A-Za-z0-9_.]{1,30}$/.test(v) },
];

export default function TipWalletsCard({ value = {}, onChange }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div>
        <h3 className="font-black text-foreground">Tip Wallets</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Fans tip you directly — wallet to wallet. BASE Station never holds your money. Only add addresses you control; these are public.
        </p>
      </div>
      {FIELDS.map(({ key, label, placeholder, valid }) => {
        const v = (value[key] || "").trim();
        const bad = v && !valid(v);
        return (
          <div key={key}>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">{label}</label>
            <Input
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value.trim().replace(/^@/, "") })}
              placeholder={placeholder}
              className="rounded-xl font-mono text-xs"
            />
            {bad && <p className="text-xs text-destructive mt-1">That doesn't look like a valid {label.split(" (")[0].toLowerCase()}.</p>}
          </div>
        );
      })}
    </div>
  );
}