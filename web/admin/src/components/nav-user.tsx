import { useState } from 'react';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ConfirmDialog } from './ui/confirm-dialog';

interface NavUserProps {
  user: {
    name: string;
    role: string;
  };
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  support: 'Поддержка',
  viewer: 'Просмотр',
};

export function NavUser({ user, onLogout }: NavUserProps) {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDialog(false);
    onLogout();
  };

  return (
    <>
      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
          >
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <ChevronsUpDown className="size-4 opacity-50 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:text-sidebar-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-56 rounded-lg"
          side="top"
          align="start"
          sideOffset={8}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {user.name} • {ROLE_LABELS[user.role] || user.role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleLogoutClick}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        onConfirm={handleLogoutConfirm}
        title="Выход из системы"
        description="Вы уверены, что хотите выйти из панели управления?"
        confirmText="Выйти"
        cancelText="Отмена"
        variant="warning"
      />
    </>
  );
}
