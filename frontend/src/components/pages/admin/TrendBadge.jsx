import PropTypes from 'prop-types';
import { buildSparkline, formatDelta } from './utils.js';

function TrendBadge({ label, values, lowerIsBetter, formatValue }) {
  const lastValue = values.length ? values[values.length - 1] : null;
  const firstValue = values.length ? values[0] : null;
  const hasTrend = values.length >= 2 && Number.isFinite(lastValue) && Number.isFinite(firstValue);
  const delta = hasTrend ? lastValue - firstValue : 0;
  const pct = hasTrend && firstValue !== 0 ? (delta / firstValue) * 100 : null;
  const isFlat = !hasTrend || delta === 0;
  const improving = hasTrend
    ? (lowerIsBetter ? delta < 0 : delta > 0)
    : false;
  const toneClass = isFlat
    ? 'trend-badge--neutral'
    : improving
      ? 'trend-badge--good'
      : 'trend-badge--bad';
  const sparkline = buildSparkline(values);

  return (
    <div className={`trend-badge ${toneClass}`}>
      <div className="trend-badge__header">
        <span className="trend-badge__label">{label}</span>
        <span className="trend-badge__value">
          {lastValue !== null ? formatValue(lastValue) : '—'}
        </span>
      </div>
      <div className="trend-badge__meta">
        <span className="trend-badge__spark">{sparkline}</span>
        <span>
          {isFlat
            ? 'No trend yet'
            : `${delta > 0 ? '+' : ''}${formatDelta(delta, formatValue)}${pct !== null ? ` (${delta > 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}`}
        </span>
      </div>
    </div>
  );
}

TrendBadge.propTypes = {
  label: PropTypes.string.isRequired,
  values: PropTypes.arrayOf(PropTypes.number),
  lowerIsBetter: PropTypes.bool,
  formatValue: PropTypes.func
};

TrendBadge.defaultProps = {
  values: [],
  lowerIsBetter: true,
  formatValue: (value) => String(value)
};

export default TrendBadge;
