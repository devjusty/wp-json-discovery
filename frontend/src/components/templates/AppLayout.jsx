import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import LoginButton from '../atoms/LoginButton.jsx';
import UserMenu from '../molecules/UserMenu.jsx';
import { HugeiconsIcon } from "@hugeicons/react";
import { Telescope01Icon } from "@hugeicons/core-free-icons";
function AppLayout({ title, subtitle, headerActions, sidebar, children, onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bodyClass = sidebar ? 'app__body' : 'app__body app__body--single';
  const BrandTag = onNavigate ? 'button' : 'div';

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-main inline-">
          <BrandTag
            className="app__header-brand"
            type={onNavigate ? 'button' : undefined}
            onClick={onNavigate ? () => onNavigate('scan') : undefined}
            aria-label={onNavigate ? 'Back to main dashboard' : undefined}
          >
            <HugeiconsIcon icon={Telescope01Icon} />
            <h1>{title}</h1>
          </BrandTag>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="app__header-right">
          {sidebar ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
              Open navigation
            </Button>
          ) : null}
          {headerActions ? <div className="app__header-actions">{headerActions}</div> : null}
          <div className="app__header-auth">
            <UserMenu onNavigate={onNavigate} />
            <LoginButton />
          </div>
        </div>
      </header>
      <div className={bodyClass}>
        {sidebar ? <aside className="app__sidebar">{sidebar}</aside> : null}
        <main className="app__main">{children}</main>
      </div>
      {sidebar ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Browse primary sections.</SheetDescription>
            </SheetHeader>
            <div className="p-4">{sidebar}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

AppLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  headerActions: PropTypes.node,
  sidebar: PropTypes.node,
  children: PropTypes.node,
  onNavigate: PropTypes.func
};

export default AppLayout;
