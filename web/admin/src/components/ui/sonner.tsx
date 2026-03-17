"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";
import { useTheme } from "../../context/ThemeContext";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      duration={5000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-green-500/10 group-[.toaster]:!border-green-500/30 group-[.toaster]:!text-green-500",
          error: "group-[.toaster]:!bg-red-500/10 group-[.toaster]:!border-red-500/30 group-[.toaster]:!text-red-500",
          warning: "group-[.toaster]:!bg-yellow-500/10 group-[.toaster]:!border-yellow-500/30 group-[.toaster]:!text-yellow-500",
          info: "group-[.toaster]:!bg-blue-500/10 group-[.toaster]:!border-blue-500/30 group-[.toaster]:!text-blue-500",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
