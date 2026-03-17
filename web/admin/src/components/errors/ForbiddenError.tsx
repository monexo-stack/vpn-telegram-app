import { Button } from '../ui/button';

export function ForbiddenError() {
  return (
    <div className="h-svh w-full">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">403</h1>
        <span className="font-medium">Доступ запрещён</span>
        <p className="text-center text-muted-foreground">
          У вас нет прав для просмотра этого ресурса.
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Назад
          </Button>
          <Button onClick={() => window.location.href = '/'}>
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
}
