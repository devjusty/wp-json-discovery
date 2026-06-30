import PropTypes from 'prop-types';
import LoginButton from '../atoms/LoginButton.jsx';
import UserMenu from '../molecules/UserMenu.jsx';
import { HugeiconsIcon } from "@hugeicons/react";
import { Telescope01Icon } from "@hugeicons/core-free-icons";
function AppLayout({ title, subtitle, headerActions, sidebar, children, onNavigate }) {
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
