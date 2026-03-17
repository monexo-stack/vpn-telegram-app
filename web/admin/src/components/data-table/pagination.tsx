import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { type Table } from '@tanstack/react-table';
import { cn, getPageNumbers } from '../ui/utils';
import { Button } from '../ui/button';
import { Combobox } from '../ui/combobox';

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  className?: string;
};

export function DataTablePagination<TData>({
  table,
  className,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div
      className={cn(
        'mt-auto flex items-center justify-between px-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-[85px]">
          <Combobox
            value={`${table.getState().pagination.pageSize}`}
            onChange={(value) => table.setPageSize(Number(value))}
            options={[10, 20, 30, 40, 50].map((s) => ({ value: `${s}`, label: `${s}` }))}
            size="sm"
            showSearch={false}
          />
        </div>
        <p className="text-sm font-medium hidden sm:block">Строк на странице</p>
      </div>

      <div className="flex items-center gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium hidden md:block">
            Страница {currentPage} из {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              className="h-8 w-8 p-0 hidden lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">На первую страницу</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">На предыдущую страницу</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers.map((pageNumber, index) => (
              <div key={`${pageNumber}-${index}`} className="hidden sm:flex items-center">
                {pageNumber === '...' ? (
                  <span className="px-1 text-sm text-muted-foreground">...</span>
                ) : (
                  <Button
                    variant={currentPage === pageNumber ? 'default' : 'outline'}
                    className="h-8 min-w-8 px-2"
                    onClick={() => table.setPageIndex((pageNumber as number) - 1)}
                  >
                    {pageNumber}
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">На следующую страницу</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 hidden lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">На последнюю страницу</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
