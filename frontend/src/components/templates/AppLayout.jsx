import PropTypes from 'prop-types';

function AppLayout({ title, subtitle, headerActions, children }) {
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
      <main className="app__main">{children}</main>
    </div>
  );
}

AppLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  headerActions: PropTypes.node,
  children: PropTypes.node.isRequired
};

export default AppLayout;
