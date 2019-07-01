const CONST = {
  EMPTY: '',
  ZERO: '0',
  DEFAULT: 'DEFAULT'
};

const RE = {
  REPLACER: /\$\{(\w+)\}/g
};

function template (string, substitutions) {
  return string.replace(RE.REPLACER, function (_, key) {
    return key === CONST.DEFAULT ? substitutions.toString() : (substitutions[key] || CONST.EMPTY);
  });
}

function zeroLead (num) {
  return (num < 10 ? CONST.ZERO : CONST.EMPTY) + num;
}

module.exports = {
  template: template,
  zeroLead: zeroLead
};
