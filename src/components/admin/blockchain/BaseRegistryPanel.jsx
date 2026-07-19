import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Anchor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BaseRegistryRow from "./BaseRegistryRow";

export default function BaseRegistryPanel() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  const load = async () => {
    setLoading(true);
    const query = statusFilter === "all" ? {} : { registration_status: statusFilter };
    const rows = await base44.entities.BaseTrackRegistry.filter(query, "-created_date", 50).catch(() => []);
    setRecords(rows);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Anchor className="w-4 h-4 text-blue-400" /> Base Registry
        </h2>
        <div className="flex items-center gap-2">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-8 rounded-lg">
              <TabsTrigger value="pending" className="text-xs h-6 rounded-md">Pending</TabsTrigger>
              <TabsTrigger value="registered" className="text-xs h-6 rounded-md">Registered</TabsTrigger>
              <TabsTrigger value="failed" className="text-xs h-6 rounded-md">Failed</TabsTrigger>
              <TabsTrigger value="all" className="text-xs h-6 rounded-md">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={load} variant="outline" size="sm" className="h-8 rounded-lg gap-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Pending records have IPFS provenance pinned but no confirmed on-chain anchor yet — confirm them with a
        transaction hash, re-pin missing metadata, or mark them failed.
      </p>

      {loading ? (
        <div className="text-center py-10">
          <div className="w-6 h-6 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No {statusFilter === "all" ? "" : statusFilter + " "}registrations
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => <BaseRegistryRow key={r.id} record={r} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}