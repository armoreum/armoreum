import { ArrowUpRight, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './defi-tools-gateway.css';

type DeFiToolsGatewayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeFiToolsGateway({ open, onOpenChange }: DeFiToolsGatewayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        id="defi-tools-gateway"
        className="defi-tools-gateway-dialog"
        data-testid="dialog-defi-tools-gateway"
      >
        <DialogHeader className="defi-tools-gateway-header">
          <p className="defi-tools-gateway-eyebrow">DEFI TOOLS</p>
          <DialogTitle>Choose a tool</DialogTitle>
          <DialogDescription>
            Two interface previews. Transactions and contract checks are not connected.
          </DialogDescription>
        </DialogHeader>

        <ul className="defi-tools-gateway-options" aria-label="DeFi tool options">
          <li>
            <Link
              href="/defi-tools/jailswap"
              className="defi-tools-gateway-option"
              data-testid="link-gateway-jailswap"
              onClick={() => onOpenChange(false)}
            >
              <span className="defi-tools-gateway-icon" aria-hidden="true">
                <ShieldCheck size={21} strokeWidth={1.6} />
              </span>
              <span className="defi-tools-gateway-copy">
                <strong>JailSwap</strong>
                <span className="defi-tools-gateway-subtitle">Protected Asset Swaps</span>
                <span className="defi-tools-gateway-description">
                  Design goal: add authorization to supported asset swaps. Jail and Unjail controls apply only where the relevant smart contracts enforce them; this preview has no verified contract or backend connection.
                </span>
              </span>
              <ArrowUpRight className="defi-tools-gateway-arrow" size={17} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link
              href="/defi-tools/bridge"
              className="defi-tools-gateway-option"
              data-testid="link-gateway-bridge"
              onClick={() => onOpenChange(false)}
            >
              <span className="defi-tools-gateway-icon" aria-hidden="true">
                <ArrowLeftRight size={21} strokeWidth={1.6} />
              </span>
              <span className="defi-tools-gateway-copy">
                <strong>Bridge</strong>
                <span className="defi-tools-gateway-subtitle defi-tools-gateway-network-pair">
                  <span>Robinhood</span>
                  <ArrowLeftRight className="defi-tools-gateway-network-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span>Ethereum</span>
                </span>
                <span className="defi-tools-gateway-description">
                  Planned transfer flow in either direction. Transfers, tracking, and destination confirmation are not connected in this preview.
                </span>
              </span>
              <ArrowUpRight className="defi-tools-gateway-arrow" size={17} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
