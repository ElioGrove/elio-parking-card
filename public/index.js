(function () {
  'use strict';

  const {
    normalizePlate,
    normalizePhone,
    isValidPlate,
    isValidPhone,
    isNewEnergyPlate
  } = PlateUtils;

  const inputForm = document.getElementById('inputForm');
  const plateInput = document.getElementById('plateNumber');
  const phoneInput = document.getElementById('phoneNumber');
  const plateError = document.getElementById('plateNumberError');
  const phoneError = document.getElementById('phoneNumberError');
  const previewLink = document.getElementById('previewLink');
  const downloadButton = document.getElementById('downloadButton');
  const resetButton = document.getElementById('resetButton');
  const qrCodeDiv = document.getElementById('qrcode');
  const qrStatus = document.getElementById('qrStatus');
  const previewPlate = document.getElementById('previewPlate');
  const previewProvince = document.getElementById('previewProvince');
  const previewLetter = document.getElementById('previewLetter');
  const previewNumber = document.getElementById('previewNumber');
  const saveModal = document.getElementById('saveModal');
  const saveModalImage = document.getElementById('saveModalImage');
  const closeSaveModalButton = document.getElementById('closeSaveModal');
  const confirmSaveModalButton = document.getElementById('confirmSaveModal');

  let lastUrl = '';
  let isComposingPlate = false;

  function isWeChatBrowser() {
    return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent || '');
  }

  function getInfoUrl(plateNumber, phoneNumber) {
    const url = new URL('info.html', window.location.href);
    url.searchParams.set('plateNumber', plateNumber);
    url.searchParams.set('phoneNumber', phoneNumber);
    return url.toString();
  }

  function setPreviewPlate(plateNumber) {
    const value = plateNumber || '京A88888';
    previewProvince.textContent = value.charAt(0) || '京';
    previewLetter.textContent = value.charAt(1) || 'A';
    previewNumber.textContent = value.slice(2) || '88888';
    if (previewPlate && previewPlate.classList) {
      if (isNewEnergyPlate(value)) {
        previewPlate.classList.add('plate--nev');
      } else {
        previewPlate.classList.remove('plate--nev');
      }
    }
  }

  function setQrPlaceholder(message) {
    const placeholder = document.createElement('div');
    placeholder.className = 'qr-placeholder';
    placeholder.textContent = message;
    qrCodeDiv.textContent = '';
    qrCodeDiv.appendChild(placeholder);
    qrCodeDiv.removeAttribute('title');
  }

  function closeSaveModal(restoreFocus) {
    if (!saveModal) {
      return;
    }
    const wasOpen = !saveModal.hidden;
    saveModal.hidden = true;
    if (saveModalImage) {
      saveModalImage.removeAttribute('src');
    }
    if (wasOpen && restoreFocus && !downloadButton.disabled) {
      downloadButton.focus();
    }
  }

  function openSaveModal(dataUrl) {
    if (!saveModal || !saveModalImage) {
      return false;
    }
    saveModalImage.src = dataUrl;
    saveModal.hidden = false;
    qrStatus.textContent = '请长按弹窗中的图片保存到相册';
    if (closeSaveModalButton) {
      closeSaveModalButton.focus();
    }
    return true;
  }

  function disableQrActions() {
    lastUrl = '';
    previewLink.removeAttribute('href');
    previewLink.classList.add('disabled');
    previewLink.setAttribute('aria-disabled', 'true');
    downloadButton.disabled = true;
    closeSaveModal(false);
  }

  function updateState(options) {
    const shouldCommitPlate = !(options && options.skipPlateCommit);
    const plateNumber = normalizePlate(plateInput.value);
    const phoneNumber = normalizePhone(phoneInput.value);
    const hasPlate = plateNumber.length > 0;
    const hasPhone = phoneNumber.length > 0;
    const plateValid = isValidPlate(plateNumber);
    const phoneValid = isValidPhone(phoneNumber);

    if (shouldCommitPlate && plateInput.value !== plateNumber) {
      plateInput.value = plateNumber;
    }
    if (phoneInput.value !== phoneNumber) {
      phoneInput.value = phoneNumber;
    }

    setPreviewPlate(plateNumber.slice(0, 8));
    plateError.textContent = hasPlate && !plateValid ? '请输入正确的车牌号' : '';
    phoneError.textContent = hasPhone && !phoneValid ? '请输入 11 位中国大陆手机号' : '';
    plateInput.setAttribute('aria-invalid', String(hasPlate && !plateValid));
    phoneInput.setAttribute('aria-invalid', String(hasPhone && !phoneValid));

    if (!plateValid || !phoneValid) {
      disableQrActions();
      qrStatus.textContent = '等待有效车牌号和手机号';
      setQrPlaceholder('填写信息后\n自动生成二维码');
      return;
    }

    const url = getInfoUrl(plateNumber, phoneNumber);
    if (url === lastUrl) {
      return;
    }

    disableQrActions();
    qrCodeDiv.textContent = '';
    try {
      new QRCode(qrCodeDiv, {
        text: url,
        width: 624,
        height: 624,
        colorDark: '#111827',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      qrCodeDiv.removeAttribute('title');
      const qrImage = qrCodeDiv.querySelector('img');
      if (qrImage) {
        qrImage.alt = '挪车二维码';
      }
      lastUrl = url;
      previewLink.href = url;
      previewLink.classList.remove('disabled');
      previewLink.setAttribute('aria-disabled', 'false');
      downloadButton.disabled = false;
      qrStatus.textContent = '二维码已生成，扫码后进入车辆信息页';
    } catch (error) {
      setQrPlaceholder('二维码生成失败');
      qrStatus.textContent = '二维码生成失败，请检查页面地址长度并重试或刷新页面。';
    }
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function getQrImageSource() {
    // The canvas is ready synchronously; QRCode.js updates its image asynchronously.
    return qrCodeDiv.querySelector('canvas') || qrCodeDiv.querySelector('img') || qrCodeDiv.querySelector('svg');
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  async function renderCardImage() {
    const qrSource = getQrImageSource();

    if (!lastUrl || !qrSource) {
      return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas is unavailable');
    }

    ctx.fillStyle = '#f5f7fb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 90, 90, 900, 900, 32);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '700 52px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('微信扫码 | 呼叫车主', 540, 180);

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 190, 230, 700, 700, 24);
    ctx.fill();

    ctx.imageSmoothingEnabled = false;

    if (qrSource.tagName.toLowerCase() === 'canvas') {
      ctx.drawImage(qrSource, 228, 268, 624, 624);
    } else if (qrSource.tagName.toLowerCase() === 'svg') {
      const svgData = new XMLSerializer().serializeToString(qrSource);
      const image = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData));
      ctx.drawImage(image, 228, 268, 624, 624);
    } else {
      const image = await loadImage(qrSource.src);
      ctx.drawImage(image, 228, 268, 624, 624);
    }

    return canvas.toDataURL('image/png');
  }

  inputForm.addEventListener('submit', function (event) {
    event.preventDefault();
    updateState();
    if (lastUrl) {
      window.open(lastUrl, '_blank', 'noopener,noreferrer');
    }
  });

  plateInput.addEventListener('compositionstart', function () {
    isComposingPlate = true;
  });
  plateInput.addEventListener('compositionend', function () {
    isComposingPlate = false;
    updateState();
  });
  plateInput.addEventListener('input', function () {
    updateState({ skipPlateCommit: isComposingPlate });
  });
  phoneInput.addEventListener('input', function () {
    updateState();
  });

  previewLink.addEventListener('click', function (event) {
    if (!lastUrl) {
      event.preventDefault();
    }
  });

  downloadButton.addEventListener('click', async function () {
    const sourceUrl = lastUrl;
    downloadButton.disabled = true;
    try {
      const dataUrl = await renderCardImage();
      if (!dataUrl || lastUrl !== sourceUrl) {
        return;
      }

      if (isWeChatBrowser() && openSaveModal(dataUrl)) {
        return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'move-car-qrcode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      qrStatus.textContent = '下载失败，请重试或使用浏览器保存二维码图片。';
    } finally {
      downloadButton.disabled = !lastUrl;
    }
  });

  resetButton.addEventListener('click', function () {
    plateInput.value = '';
    phoneInput.value = '';
    updateState();
    plateInput.focus();
  });

  if (closeSaveModalButton) {
    closeSaveModalButton.addEventListener('click', function () {
      closeSaveModal(true);
    });
  }

  if (confirmSaveModalButton) {
    confirmSaveModalButton.addEventListener('click', function () {
      closeSaveModal(true);
    });
  }

  if (saveModal) {
    saveModal.addEventListener('click', function (event) {
      if (event.target && event.target.getAttribute && event.target.getAttribute('data-close-modal') === 'true') {
        closeSaveModal(true);
      }
    });
  }

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && saveModal && !saveModal.hidden) {
        closeSaveModal(true);
      }
    });
  }

  updateState();
})();
