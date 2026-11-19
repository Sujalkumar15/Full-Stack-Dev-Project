import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function UserMenu() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await auth.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full border border-stone-200 bg-white text-sm font-semibold text-stone-600 shadow-sm hover:border-stone-300"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {auth.user?.name.slice(0, 1).toUpperCase() ?? <UserRound className="size-4" />}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium text-stone-800">{auth.user?.name}</p>
            <p className="truncate text-xs text-stone-400">{auth.user?.email}</p>
          </div>
          <div className="my-1 h-px bg-stone-100" />
          <button type="button" className="menu-item" onClick={() => void handleLogout()}>
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
