import { CircleAlert, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  primaryLabel: string;
  note: string;
  error?: string | null;
  testId: string;
  onConfirm: () => void;
};

export function LaunchConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  primaryLabel,
  note,
  error,
  testId,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
      }}
    >
      <DialogContent
        className="launch-confirm-dialog"
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="launch-confirm-dialog-header">
          <DialogTitle className="launch-confirm-dialog-title">
            <ShieldCheck size={21} aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="launch-confirm-dialog-scroll">
          {error && (
            <div className="launch-confirm-dialog-error" role="alert" data-testid="status-launch-confirm-error">
              <CircleAlert size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <p className="launch-confirm-dialog-note">{note}</p>
        </div>
        <DialogFooter className="launch-confirm-dialog-footer">
          <button
            type="button"
            className="button button-primary"
            onClick={onConfirm}
            data-testid={testId}
          >
            {primaryLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
