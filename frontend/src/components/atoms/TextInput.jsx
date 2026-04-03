import PropTypes from 'prop-types';
import clsx from 'clsx';

function TextInput({ size = 'md', className, ...props }) {
  return <input className={clsx('text-input', `text-input--${size}`, className)} {...props} />;
}

TextInput.propTypes = {
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string
};

export default TextInput;
