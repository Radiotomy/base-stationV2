export default function ParamsTable({ title = 'Parameters', params }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 text-left">
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Field</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Required</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map((p) => (
              <tr key={p.name}>
                <td className="px-4 py-3 font-mono text-[12.5px] text-[#FFC98A] whitespace-nowrap">{p.name}</td>
                <td className="px-4 py-3 font-mono text-[12.5px] text-muted-foreground whitespace-nowrap">{p.type}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`text-[11px] font-medium ${p.required ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {p.required ? 'required' : 'optional'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-muted-foreground">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}