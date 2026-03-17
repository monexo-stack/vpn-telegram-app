import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface GeneralErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  minimal?: boolean;
}

export function GeneralError({ className, minimal = false }: GeneralErrorProps) {
  return (
    <div className={cn('h-svh w-full', className)}>
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        {!minimal && (
          <h1 className="text-[7rem] font-bold leading-tight">500</h1>
        )}
        <span className="font-medium">Упс! Что-то пошло не так</span>
        <p className="text-center text-muted-foreground">
          Произошла внутренняя ошибка сервера. <br />
          Мы уже работаем над её устранением.
        </p>
        {!minimal && (
          <div className="mt-6 flex gap-4">
            <Button variant="outline" onClick={() => window.history.back()}>
              Назад
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              На главную
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
