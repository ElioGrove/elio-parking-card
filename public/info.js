(function () {
  'use strict';

  const {
    normalizePlate,
    isValidPlate,
    isValidPhone,
    isNewEnergyPlate
  } = PlateUtils;

  const params = new URLSearchParams(window.location.search);
  const plateNumber = normalizePlate(params.get('plateNumber') || '');
  const phoneNumber = (params.get('phoneNumber') || '').trim();

  const carPlate = document.getElementById('carPlate');
  const carProvince = document.getElementById('carProvince');
  const carLetter = document.getElementById('carLetter');
  const carNumber = document.getElementById('carNumber');
  const plateDot = document.querySelector('.plate-dot');
  const callButton = document.getElementById('callButton');
  const notice = document.getElementById('notice');

  function setPlate(value) {
    const valid = isValidPlate(value);
    carProvince.textContent = valid ? value.charAt(0) : '';
    carLetter.textContent = valid ? value.charAt(1) : '';
    carNumber.textContent = valid ? value.slice(2) : '车牌无效';
    if (plateDot) {
      plateDot.hidden = !valid;
    }
    if (carPlate && carPlate.classList) {
      if (valid && isNewEnergyPlate(value)) {
        carPlate.classList.add('plate--nev');
      } else {
        carPlate.classList.remove('plate--nev');
      }
    }
  }

  setPlate(plateNumber);

  if (isValidPhone(phoneNumber)) {
    callButton.href = 'tel:' + phoneNumber;
    callButton.setAttribute('aria-disabled', 'false');
  } else {
    callButton.removeAttribute('href');
    callButton.textContent = '号码无效';
    callButton.classList.add('empty');
    callButton.setAttribute('aria-disabled', 'true');
    notice.textContent = '二维码缺少有效手机号，请联系车主重新生成。';
  }
})();
