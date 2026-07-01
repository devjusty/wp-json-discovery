import PropTypes from 'prop-types';
import { Button as UiButton, buttonVariants } from '../ui/button.jsx';
import { cn } from '@/lib/utils.js';

function Button({ as = 'button', variant = 'primary', size = 'md', className, children, ...props }) {
  const ComponentTag = as || 'button';
  const mappedVariant = variant === 'primary' ? 'default' : variant;
  const mappedSize = size === 'md' ? 'default' : size;

  if (ComponentTag === 'button') {
    return (
      <UiButton variant={mappedVariant} size={mappedSize} className={className} {...props}>
        {children}
      </UiButton>
    );
  }

  return (
    <ComponentTag
      data-slot="button"
      className={cn(buttonVariants({ variant: mappedVariant, size: mappedSize, className }))}
      {...props}
    >
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
