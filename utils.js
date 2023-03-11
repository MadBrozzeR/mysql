const CONST = {
  EMPTY: '',
  ZERO: '0',
};

const RE = {
  REPLACER: /\$\{(\w+)\}/g
};

function zeroLead (num) {
  return (num < 10 ? CONST.ZERO : CONST.EMPTY) + num;
}

function template (template, substitutions) {
  return template.replace(RE.REPLACER, function (_, key) {
    return substitutions[key] || CONST.EMPTY;
  });
}

module.exports = {
  template: template,
  zeroLead: zeroLead
};
