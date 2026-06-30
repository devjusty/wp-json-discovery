import { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';

function UserMenu({ onNavigate }) {
  const { user, logout, isAuthenticated } = useAuth0();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.name || user.nickname || user.email || 'User';
  const avatarUrl = user.picture;

  return (
    <div className="user-menu" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="user-menu__trigger gap-2 px-2 h-8"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="rounded-full size-5" />
        ) : null}
        <span className="user-menu__name">{displayName}</span>
      </Button>
      {open ? (
        <div className="user-menu__dropdown" role="menu">
          <button
            className="user-menu__item"
            role="menuitem"
            onClick={() => { setOpen(false); onNavigate?.('my-scans'); }}
          >
            My Scans
          </button>
          <button
            className="user-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout({ logoutParams: { returnTo: window.location.origin } });
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;
