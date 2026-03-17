import { Button } from '../ui/button';

export function MaintenanceError() {
  return (
    <div className="h-svh w-full">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">503</h1>
        <span className="font-medium">Сайт на обслуживании</span>
        <p className="text-center text-muted-foreground">
          Сервис временно недоступен. <br />
          Мы скоро вернёмся.
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Обновить
          </Button>
        </div>
      </div>
    </div>
  );
}
