"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "./utils";
import { useMiniApp } from "../../context/MiniAppContext";
import { useBackButton } from "../../hooks/useBackButton";

export type ConfirmDialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    buttonBg: "bg-red-500 hover:bg-red-600",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    buttonBg: "bg-orange-500 hover:bg-orange-600",
  },
  info: {
    icon: AlertTriangle,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    buttonBg: "bg-blue-500 hover:bg-blue-600",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const { isMiniApp } = useMiniApp();
  const config = variantConfig[variant];
  const Icon = config.icon;

  // Telegram BackButton
  useBackButton(open, () => onOpenChange(false));

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed z-[9999] w-full border border-border bg-card shadow-2xl duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            // Mini App: bottom sheet style
            isMiniApp ? [
              "bottom-0 left-0 right-0 rounded-t-2xl p-5 pb-safe",
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            ] : [
              // Desktop: centered modal
              "left-[50%] top-[50%] max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-xl p-6",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
              "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            ]
          )}
        >
          {/* Mobile drag handle */}
          {isMiniApp && (
            <div className="flex justify-center pb-4">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          {/* Icon */}
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4", config.iconBg)}>
            <Icon className={cn("w-6 h-6", config.iconColor)} />
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <AlertDialogPrimitive.Title className="text-foreground text-lg font-semibold mb-2">
              {title}
            </AlertDialogPrimitive.Title>
            {description && (
              <AlertDialogPrimitive.Description className="text-muted-foreground text-sm">
                {description}
              </AlertDialogPrimitive.Description>
            )}
          </div>

          {/* Actions */}
          <div className={cn(
            "flex gap-3",
            isMiniApp && "flex-col-reverse"
          )}>
            <AlertDialogPrimitive.Cancel
              disabled={loading}
              className={cn(
                "flex-1 bg-muted text-foreground rounded-xl hover:bg-muted/70 transition-colors disabled:opacity-50",
                isMiniApp ? "px-4 py-3.5" : "px-4 py-2.5"
              )}
            >
              {cancelText}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              className={cn(
                "flex-1 text-white rounded-xl transition-colors disabled:opacity-50",
                isMiniApp ? "px-4 py-3.5" : "px-4 py-2.5",
                config.buttonBg
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Загрузка...
                </span>
              ) : (
                confirmText
              )}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

// Hook for easier usage
interface UseConfirmDialogOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
}

export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    options: UseConfirmDialogOptions;
    onConfirm: () => void;
    loading: boolean;
  }>({
    open: false,
    options: { title: "" },
    onConfirm: () => {},
    loading: false,
  });

  const confirm = React.useCallback(
    (options: UseConfirmDialogOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          options,
          onConfirm: () => {
            setState((prev) => ({ ...prev, open: false }));
            resolve(true);
          },
          loading: false,
        });
      });
    },
    []
  );

  const setLoading = React.useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const close = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const DialogComponent = React.useCallback(
    () => (
      <ConfirmDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) {
            setState((prev) => ({ ...prev, open: false }));
          }
        }}
        onConfirm={state.onConfirm}
        title={state.options.title}
        description={state.options.description}
        confirmText={state.options.confirmText}
        cancelText={state.options.cancelText}
        variant={state.options.variant}
        loading={state.loading}
      />
    ),
    [state]
  );

  return { confirm, DialogComponent, setLoading, close };
}
