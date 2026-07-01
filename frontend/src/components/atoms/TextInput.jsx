import PropTypes from 'prop-types';
import { Input as UiInput } from '../ui/input.jsx';

function TextInput({ size = 'md', className, ...props }) {
  return <UiInput data-size={size} className={className} {...props} />;
}

TextInput.propTypes = {
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string
};

export default TextInput;
