(function () {
  'use strict';

  const PLATE_NUMBER_REGEX = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-Z0-9挂学警港澳使领]{5,6}$/;
  const PHONE_NUMBER_REGEX = /^1\d{10}$/;

  function normalizePlate(value) {
    return String(value || '')
      .trim()
      .replace(/[\s·•・.．\-－—]/g, '')
      .toUpperCase();
  }

  function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (/^00861\d{10}$/.test(digits)) {
      digits = digits.slice(4);
    } else if (/^861\d{10}$/.test(digits)) {
      digits = digits.slice(2);
    }
    return digits.slice(0, 11);
  }

  function isValidPlate(value) {
    return PLATE_NUMBER_REGEX.test(value);
  }

  function isValidPhone(value) {
    return PHONE_NUMBER_REGEX.test(value);
  }

  function isNewEnergyPlate(value) {
    return typeof value === 'string' && value.length === 8;
  }

  const api = Object.freeze({
    PLATE_NUMBER_REGEX,
    PHONE_NUMBER_REGEX,
    normalizePlate,
    normalizePhone,
    isValidPlate,
    isValidPhone,
    isNewEnergyPlate
  });

  globalThis.PlateUtils = api;
  if (typeof window !== 'undefined' && window !== globalThis) {
    window.PlateUtils = api;
  }
})();
