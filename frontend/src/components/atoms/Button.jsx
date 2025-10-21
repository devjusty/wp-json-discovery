import PropTypes from 'prop-types';
import clsx from 'clsx';

function Button({ as = 'button', variant = 'primary', size = 'md', className, children, ...props }) {
  const ComponentTag = as || 'button';

  const classes = clsx(
    'button',
    `button--${variant}`,
    `button--${size}`,
    className
  );

  return (
    <ComponentTag className={classes} {...props}>
      {children}
    </ComponentTag>
  );
}

Button.propTypes = {
  as: PropTypes.elementType,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  children: PropTypes.node.isRequired
};

export default Button;
