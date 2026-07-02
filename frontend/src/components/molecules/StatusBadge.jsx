import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function StatusBadge({ label, tone = 'neutral' }) {
  return (
    <Badge variant="outline" className={cn('status-badge', `status-badge--${tone}`)}>
      {label}
    </Badge>
  );
}

StatusBadge.propTypes = {
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.oneOf(['neutral', 'success', 'warning', 'danger', 'info'])
};

export default StatusBadge;
