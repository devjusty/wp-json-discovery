import PropTypes from 'prop-types';
import clsx from 'clsx';

export function Card({ as = 'section', className, children, ...props }) {
  const SectionTag = as || 'section';

  return (
    <SectionTag className={clsx('card', className)} {...props}>
      {children}
    </SectionTag>
  );
}

Card.propTypes = {
  as: PropTypes.elementType,
  className: PropTypes.string,
  children: PropTypes.node.isRequired
};

export function CardHeader({ className, children }) {
  return <header className={clsx('card__header', className)}>{children}</header>;
}

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

export function CardContent({ className, children }) {
  return <div className={clsx('card__content', className)}>{children}</div>;
}

CardContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

export function CardActions({ className, children }) {
  return <div className={clsx('card__actions', className)}>{children}</div>;
}

CardActions.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};
