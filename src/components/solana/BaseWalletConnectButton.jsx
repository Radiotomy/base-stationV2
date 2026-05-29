import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BaseWalletConnectButton({ onConnected }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setConnected(true);
          onConnected?.(accounts[0]);
        }
      } catch (err) {
        console.log("Wallet not connected");
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast.error("MetaMask not installed. Please install MetaMask extension.");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setLoading(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        toast.error("No accounts found. Please unlock MetaMask and try again.");
        return;
      }
      const userAddress = accounts[0];
      setAddress(userAddress);
      setConnected(true);
      onConnected?.(userAddress);
      toast.success("Wallet connected!");
    } catch (err) {
      // MetaMask error codes: 4001 = user rejected, -32002 = request already pending
      if (err?.code === 4001) {
        toast.error("Connection cancelled");
      } else if (err?.code === -32002) {
        toast.error("MetaMask is already requesting — check the extension popup");
      } else {
        // Avoid showing minified MetaMask stack traces ("i: Failed to connect...")
        const msg = typeof err?.message === "string" && !err.message.startsWith("i:")
          ? err.message
          : "Could not connect to MetaMask. Make sure it's unlocked and try again.";
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress("");
    setConnected(false);
    toast.success("Wallet disconnected");
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  if (!connected) {
    return (
      <Button
        onClick={connectWallet}
        disabled={loading}
        className="rounded-full bg-blue-600 hover:bg-blue-500 text-white gap-2 px-6"
      >
        <Wallet className="w-4 h-4" />
        {loading ? "Connecting..." : "Connect MetaMask"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border-blue-500/40 text-blue-400 hover:bg-blue-500/10 gap-2"
        >
          <Wallet className="w-4 h-4" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={copyAddress} className="gap-2">
          <Copy className="w-4 h-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View on Basescan
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect} className="gap-2 text-red-400">
          <LogOut className="w-4 h-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}