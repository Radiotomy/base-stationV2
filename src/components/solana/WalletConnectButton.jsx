import { useState } from "react";
import { Wallet, CheckCircle, ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function WalletConnectButton({ walletAddress, onConnect, onDisconnect }) {
  const [connecting, setConnecting] = useState(false);

  const shortAddr = (addr) => addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "";

  const connectWallet = async () => {
    setConnecting(true);
    try {
      if (typeof window.solana === "undefined") {
        toast.error("Phantom wallet not found. Install it at phantom.app", { duration: 5000 });
        window.open("https://phantom.app", "_blank");
        setConnecting(false);
        return;
      }
      const resp = await window.solana.connect();
      const address = resp.publicKey.toString();
      onConnect(address);
      toast.success("Wallet connected!");
    } catch (err) {
      toast.error("Wallet connection cancelled");
    }
    setConnecting(false);
  };

  if (!walletAddress) {
    return (
      <Button onClick={connectWallet} disabled={connecting}
        className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold gap-2">
        <Wallet className="w-4 h-4" />
        {connecting ? "Connecting…" : "Connect Phantom"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full border-emerald-500/40 text-emerald-400 font-semibold gap-2">
          <CheckCircle className="w-4 h-4" />
          {shortAddr(walletAddress)}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(walletAddress); toast.success("Address copied!"); }}>
          <Copy className="w-4 h-4 mr-2" /> Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(`https://solscan.io/account/${walletAddress}?cluster=devnet`, "_blank")}>
          <ExternalLink className="w-4 h-4 mr-2" /> View on Solscan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDisconnect} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}