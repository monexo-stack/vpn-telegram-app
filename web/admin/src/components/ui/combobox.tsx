"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  size?: "default" | "sm";
  showSearch?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyText = "Не найдено.",
  className,
  size = "default",
  showSearch = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            size === "sm" ? "h-8 text-sm px-3" : "h-10 px-4",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "ml-2 shrink-0 opacity-50 transition-transform duration-200",
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          size === "sm" ? "w-[180px]" : "w-[220px]"
        )}
        align="start"
      >
        <Command>
          {showSearch && options.length > 5 && (
            <CommandInput placeholder={searchPlaceholder} />
          )}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    size === "sm" && "text-sm py-1.5"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
