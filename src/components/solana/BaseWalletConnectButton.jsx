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
      const userAddress = accounts[0];
      setAddress(userAddress);
      setConnected(true);
      onConnected?.(userAddress);
      toast.success("Wallet connected!");
    } catch (err) {
      toast.error(err.message || "Failed to connect wallet");
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