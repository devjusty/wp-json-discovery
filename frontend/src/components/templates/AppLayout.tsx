import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import LoginButton from '../atoms/LoginButton.jsx';
import UserMenu from '../molecules/UserMenu';
import { HugeiconsIcon } from "@hugeicons/react";
import { Telescope01Icon } from "@hugeicons/core-free-icons";

type AppLayoutProps = {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  sidebar?: ReactNode;
  children?: ReactNode;
  onNavigate?: (page: string) => void;
};

function AppLayout({ title, subtitle, headerActions, sidebar, children, onNavigate }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bodyClass = sidebar ? 'app__body' : 'app__body app__body--single';
  const mainClass = sidebar ? 'app__main' : 'app__main app__main--full-width';
  const BrandTag = onNavigate ? 'button' : 'div';

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-main inline-">
          <BrandTag
            className="app__header-brand"
            type={onNavigate ? 'button' : undefined}
            onClick={onNavigate ? () => onNavigate('scan') : undefined}
            aria-label={onNavigate ? `Back to main dashboard: ${title}` : undefined}
          >
            <HugeiconsIcon icon={Telescope01Icon} />
            <h1>{title}</h1>
          </BrandTag>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="app__header-right">
          {sidebar ? (
            <Button className="" type="button" variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
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
        <main className={mainClass}>{children}</main>
      </div>
      {sidebar ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent className="" side="left">
            <SheetHeader className="">
              <SheetTitle className="">Navigation</SheetTitle>
              <SheetDescription className="">Browse primary sections.</SheetDescription>
            </SheetHeader>
            <div className="p-4">{sidebar}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

export default AppLayout;
