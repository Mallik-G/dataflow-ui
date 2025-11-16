const formatToJSON = (response) => {
  return JSON.parse(JSON.stringify(response));
};

const formatValidationError = (errors = []) => {
  let obj = errors?.reduce(
    (prev, { path, msg, ...rest }) => ({
      ...prev,
      [path]: msg,
    }),
    {}
  );

  return obj;
};

const generateOTP = (length = 6) => {
  let nums = '3692015487';
  let OTP = '';

  for (let i = 0; i < length; i++) {
    OTP += nums[Math.floor(Math.random() * 10)];
  }

  return OTP;
};

const removeNullUndefined = (value) => {
  if (['', null, undefined, 'null', 'undefined'].includes(value)) {
    return null;
  }

  return value;
};

module.exports = {
  formatToJSON: formatToJSON,
  formatValidationError: formatValidationError,
  generateOTP: generateOTP,
  removeNullUndefined: removeNullUndefined,
};
