import PropTypes from 'prop-types';
import clsx from 'clsx';

function TextInput({ className, ...props }) {
  return <input className={clsx('text-input', className)} {...props} />;
}

TextInput.propTypes = {
  className: PropTypes.string
};

export default TextInput;
