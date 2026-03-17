import { X } from 'lucide-react';
import { type Table } from '@tanstack/react-table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DataTableFacetedFilter } from './faceted-filter';

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  searchPlaceholder?: string;
  searchKey?: string;
  filters?: {
    columnId: string;
    title: string;
    options: {
      label: string;
      value: string;
      icon?: React.ComponentType<{ className?: string }>;
    }[];
  }[];
  children?: React.ReactNode;
};

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = 'Поиск...',
  searchKey,
  filters = [],
  children,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || table.getState().globalFilter;

  return (
    <div className="flex flex-col gap-2">
      {/* Search row */}
      <div className="flex items-center gap-2">
        {searchKey ? (
          <Input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="h-8 w-full sm:w-[200px] lg:w-[350px]"
          />
        ) : (
          <Input
            placeholder={searchPlaceholder}
            value={table.getState().globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[350px]"
          />
        )}
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          {children}
        </div>
      </div>
      {/* Filters row - scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          if (!column) return null;
          return (
            <DataTableFacetedFilter
              key={filter.columnId}
              column={column}
              title={filter.title}
              options={filter.options}
            />
          );
        })}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter('');
            }}
            className="h-8 px-2 lg:px-3 shrink-0"
          >
            Сбросить
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
        <div className="flex sm:hidden shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}
