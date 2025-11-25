import PropTypes from 'prop-types';

function AppLayout({ title, subtitle, headerActions, sidebar, children }) {
  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {headerActions ? (
          <div className="app__header-actions">{headerActions}</div>
        ) : null}
      </header>
      <div className="app__body">
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
  children: PropTypes.node.isRequired
};

AppLayout.defaultProps = {
  subtitle: '',
  headerActions: null,
  sidebar: null
};

export default AppLayout;
