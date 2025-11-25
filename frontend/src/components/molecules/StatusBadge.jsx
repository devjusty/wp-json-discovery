import PropTypes from 'prop-types';
import clsx from 'clsx';

function StatusBadge({ label, tone = 'neutral' }) {
  return (
    <span className={clsx('status-badge', `status-badge--${tone}`)}>
      {label}
    </span>
  );
}

StatusBadge.propTypes = {
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.oneOf(['neutral', 'success', 'warning', 'danger', 'info'])
};

export default StatusBadge;
