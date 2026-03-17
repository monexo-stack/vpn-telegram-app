import { type Table } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { cn } from '../ui/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>;
  entityName: string;
  children: React.ReactNode;
};

export function DataTableBulkActions<TData>({
  table,
  entityName,
  children,
}: DataTableBulkActionsProps<TData>) {
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  const handleClearSelection = () => {
    table.resetRowSelection();
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl',
        'transition-all duration-300 ease-out hover:scale-105'
      )}
    >
      <div
        className={cn(
          'p-2 shadow-xl',
          'rounded-xl border',
          'bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60',
          'flex items-center gap-x-2'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleClearSelection}
              className="size-6 rounded-full"
            >
              <X className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Сбросить выбор</p>
          </TooltipContent>
        </Tooltip>

        <Separator className="h-5" orientation="vertical" />

        <div className="flex items-center gap-x-1 text-sm">
          <Badge variant="default" className="min-w-8 rounded-lg">
            {selectedCount}
          </Badge>
          <span className="hidden sm:inline">
            {entityName}
          </span>
        </div>

        <Separator className="h-5" orientation="vertical" />

        {children}
      </div>
    </div>
  );
}
