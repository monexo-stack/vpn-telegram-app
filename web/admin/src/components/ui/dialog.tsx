"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "./utils";
import { useMiniApp } from "../../context/MiniAppContext";

// Context for dialog variant
type DialogVariant = "default" | "sheet" | "fullscreen";
const DialogVariantContext = React.createContext<DialogVariant>("default");

function Dialog({
  variant = "default",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { variant?: DialogVariant }) {
  return (
    <DialogVariantContext.Provider value={variant}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogVariantContext.Provider>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  hideCloseButton,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideCloseButton?: boolean }) {
  const { isMiniApp } = useMiniApp();
  const variant = React.useContext(DialogVariantContext);

  // Determine effective variant based on platform
  // - On desktop: always use "default" (centered modal)
  // - On Mini App: "default" -> "sheet", others stay as-is
  const effectiveVariant = !isMiniApp
    ? "default"
    : variant === "default"
      ? "sheet"
      : variant;

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed z-50 border shadow-lg duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          // Fullscreen variant (for complex modals in Mini App)
          effectiveVariant === "fullscreen" && [
            "inset-0 w-full h-full max-w-full max-h-full rounded-none",
            "flex flex-col",
          ],
          // Sheet variant (bottom sheet for Mini App)
          effectiveVariant === "sheet" && [
            "bottom-0 left-0 right-0 w-full rounded-t-2xl",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "max-h-[90vh] flex flex-col",
          ],
          // Default variant (centered modal for desktop)
          effectiveVariant === "default" && [
            "top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-[calc(100%-2rem)] sm:max-w-lg rounded-lg",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "grid gap-4 p-6",
          ],
          className,
        )}
        {...props}
      >
        {/* Mobile drag handle for sheet variant */}
        {effectiveVariant === "sheet" && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {children}
        {/* Show close button: on desktop always, on Mini App only for non-sheet when not hidden */}
        {(!isMiniApp || (isMiniApp && !hideCloseButton && effectiveVariant !== "sheet")) && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
