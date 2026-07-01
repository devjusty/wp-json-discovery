import PropTypes from 'prop-types';
import {
  Card as UiCard,
  CardHeader as UiCardHeader,
  CardContent as UiCardContent,
  CardFooter as UiCardFooter
} from '../ui/card.jsx';
import { cn } from '@/lib/utils.js';

export function Card({ as = 'section', className, children, ...props }) {
  const SectionTag = as || 'section';

  if (SectionTag === 'section') {
    return <UiCard className={className} {...props}>{children}</UiCard>;
  }

  return (
    <SectionTag
      data-slot="card"
      className={cn(
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-none bg-card py-(--card-spacing) text-xs/relaxed text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-none *:[img:last-child]:rounded-none',
        className
      )}
      {...props}
    >
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
  return <UiCardHeader className={className}>{children}</UiCardHeader>;
}

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

export function CardContent({ className, children }) {
  return <UiCardContent className={className}>{children}</UiCardContent>;
}

CardContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

export function CardActions({ className, children }) {
  return <UiCardFooter className={className}>{children}</UiCardFooter>;
}

CardActions.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};
