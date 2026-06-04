const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';

console.log('MYTHOS READY');

function goHome() {
  location.reload();
}

function logout() {
  localStorage.removeItem('mythosPersonalCode');
  location.reload();
}

function openRegisterModal() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('register-modal').style.display = 'flex';
}

function backToLoginModal() {
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
}

function registerPlayer() {
  if (isRegistering) return;

  const characterName = document.getElementById('characterName').value.trim();
  const age = document.getElementById('age').value.trim();
  const origin = document.getElementById('origin').value;

  if (!characterName) {
    alert('캐릭터명을 입력해주세요.');
    return;
  }

  if (!age) {
    alert('나이를 입력해주세요.');
    return;
  }

  if (!origin) {
    alert('출신지를 선택해주세요.');
    return;
  }

  isRegistering = true;

  const url =
    API_URL
    + '?action=registerPlayer'
    + '&characterName=' + encodeURIComponent(characterName)
    + '&age=' + encodeURIComponent(age)
    + '&origin=' + encodeURIComponent(origin);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      isRegistering = false;

      if (data.success) {
        issuedPersonalCode = data.personalCode;

        document.getElementById('issued-code').textContent = data.personalCode;
        document.getElementById('login-code').value = data.personalCode;

        document.getElementById('register-modal').style.display = 'none';
        document.getElementById('register-complete-modal').style.display = 'flex';
      } else {
        alert('가입 실패: ' + data.message);
      }
    })
    .catch(error => {
      isRegistering = false;
      alert('회원가입 처리 중 오류가 발생했습니다.\n\n문제가 계속되면 관리자에게 문의해주세요.');
      console.error(error);
    });
}

function copyIssuedCode() {
  if (!issuedPersonalCode) {
    alert('복사할 개인코드가 없습니다.');
    return;
  }

  navigator.clipboard.writeText(issuedPersonalCode)
    .then(() => alert('개인코드가 복사되었습니다.'))
    .catch(() => alert('복사에 실패했습니다. 직접 선택해서 복사해주세요.'));
}

function closeCompleteModal() {
  document.getElementById('register-complete-modal').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
}

function loginPlayer() {
  const personalCode = document.getElementById('login-code').value.trim();

  if (!personalCode) {
    alert('개인코드를 입력해주세요.');
    return;
  }

  const url =
    API_URL
    + '?action=loginPlayer'
    + '&personalCode=' + encodeURIComponent(personalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        currentPersonalCode = personalCode;
        localStorage.setItem('mythosPersonalCode', personalCode);

        renderPlayer(data.player);

        document.getElementById('login-modal').style.display = 'none';
      } else {
        alert('로그인 실패: ' + data.message);
      }
    })
    .catch(error => {
      alert('로그인 처리 중 오류가 발생했습니다.\n\n문제가 계속되면 관리자에게 문의해주세요.');
      console.error(error);
    });
}

function renderPlayer(player) {
  document.getElementById('character-name').textContent = player.characterName || '캐릭터명';
  document.getElementById('character-origin').textContent = '클레이오니아 · ' + (player.origin || '출신지');
  document.getElementById('character-age').textContent = (player.age || '-') + '세';

  document.getElementById('character-location').textContent =
    '현재 위치 : ' + (player.currentPlaceId || '-');

  document.getElementById('character-money').textContent =
    '보유 재화 : 0골드';

  if (player.portraitUrl) {
    document.getElementById('character-portrait').src = convertDriveUrl(player.portraitUrl);
  }
}

function updatePortrait() {
  if (!currentPersonalCode) {
    alert('로그인 후 인장을 등록할 수 있습니다.');
    return;
  }

  document.getElementById('portrait-upload-input').click();
}

function convertDriveUrl(url) {
  const match = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);

  if (match && match[1]) {
    return 'https://drive.google.com/uc?export=view&id=' + match[1];
  }

  return url;
}

window.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('portrait-upload-input');

  if (input) {
    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;

      resizeImage(file, function (base64Data) {
        uploadPortraitBase64(base64Data);
      });
    });
  }

  const savedCode = localStorage.getItem('mythosPersonalCode');

  if (savedCode) {
    document.getElementById('login-code').value = savedCode;
    loginPlayer();
  }
});

function resizeImage(file, callback) {
  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxWidth = 420;
      const scale = maxWidth / img.width;

      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      callback(dataUrl.split(',')[1]);
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

function uploadPortraitBase64(base64Data) {
  const callbackName = 'portraitCallback_' + Date.now();

  window[callbackName] = function (data) {
    if (data.success) {
      document.getElementById('character-portrait').src = convertDriveUrl(data.portraitUrl);
      alert('인장이 등록되었습니다.');
    } else {
      alert('인장 등록 실패: ' + data.message);
    }

    delete window[callbackName];
  };

  const url =
    API_URL
    + '?action=updatePortraitUpload'
    + '&callback=' + encodeURIComponent(callbackName)
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&mimeType=' + encodeURIComponent('image/jpeg')
    + '&portraitBase64=' + encodeURIComponent(base64Data);

  const script = document.createElement('script');
  script.src = url;
  document.body.appendChild(script);
}

function convertDriveUrl(url) {
  const match = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);

  if (match && match[1]) {
    return 'https://drive.google.com/uc?export=view&id=' + match[1];
  }

  return url;
}