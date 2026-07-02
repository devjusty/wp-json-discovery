import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

function UserMenu({ onNavigate }) {
  const { user, logout, isAuthenticated } = useAuth0();
  const [open, setOpen] = useState(false);
  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.name || user.nickname || user.email || 'User';
  const avatarUrl = user.picture;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={(
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 px-2 h-8"
            onClick={() => setOpen((value) => !value)}
          />
        )}
      >
        {avatarUrl ? <img src={avatarUrl} alt="" className="rounded-full size-5" /> : null}
        <span>{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => onNavigate?.('my-scans')}>
          My Scans
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout({ logoutParams: { returnTo: window.location.origin } });
          }}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
