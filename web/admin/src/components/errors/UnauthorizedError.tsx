import { Button } from '../ui/button';

export function UnauthorizedError() {
  return (
    <div className="h-svh w-full">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">401</h1>
        <span className="font-medium">Требуется авторизация</span>
        <p className="text-center text-muted-foreground">
          Пожалуйста, войдите в систему для доступа к этому ресурсу.
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Назад
          </Button>
          <Button onClick={() => {
            localStorage.removeItem('admin_token');
            window.location.href = '/';
          }}>
            Войти
          </Button>
        </div>
      </div>
    </div>
  );
}
