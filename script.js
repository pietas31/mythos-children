const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';
let CURRENT_VERSION = 'v18';

console.log('MYTHOS READY');

function goHome() {
  location.reload();
}

function logout() {
  localStorage.removeItem('mythosPersonalCode');
  localStorage.removeItem('mythosPlayerData');
  currentPersonalCode = '';
  location.reload();
}

function setSystemStatus(message) {
  const status = document.getElementById('system-status');

  if (!status) return;

  status.textContent = CURRENT_VERSION + ' · ' + message;
}

function setMailCount(count) {
  const mailCount = document.getElementById('mail-count');

  if (!mailCount) return;

  const safeCount = Number(count || 0);

  if (safeCount >= 100) {
    mailCount.textContent = '99+';
    return;
  }

  mailCount.textContent = String(safeCount);
}

function openMailModal() {
  const modal = document.getElementById('mail-modal');

  if (!modal) return;

  modal.style.display = 'flex';
}

function closeMailModal() {
  const modal = document.getElementById('mail-modal');

  if (!modal) return;

  modal.style.display = 'none';
}

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');

  if (!modal) return;

  modal.style.display = 'flex';
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');

  if (!modal) return;

  modal.style.display = 'none';
}

function openRegisterModal() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('register-modal').style.display = 'flex';
}

function backToLoginModal() {
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
}

function getStatText(value) {
  const stat = Number(value || 0);

  if (!stat) return '-';

  let filled = '';
  let empty = '';

  for (let i = 0; i < stat; i++) {
    filled += '◆';
  }

  for (let i = stat; i < 5; i++) {
    empty += '◇';
  }

  return filled + empty;
}

function flipCharacterCard() {
  const cardWrap = document.querySelector('.character-card-wrap');

  if (!cardWrap) return;

  cardWrap.classList.toggle('is-flipped');
}

function registerPlayer() {
  if (isRegistering) return;

  const characterName = document.getElementById('characterName').value.trim();
  const age = document.getElementById('age').value;
  const origin = document.getElementById('origin').value;

  const strength = document.getElementById('strength').value;
  const stamina = document.getElementById('stamina').value;
  const agility = document.getElementById('agility').value;
  const mental = document.getElementById('mental').value;
  const intelligence = document.getElementById('intelligence').value;
  const luck = document.getElementById('luck').value;

  if (!characterName) {
    alert('캐릭터명을 입력해주세요.');
    return;
  }

  if (!age) {
    alert('나이를 선택해주세요.');
    return;
  }

  if (!origin) {
    alert('출신지를 선택해주세요.');
    return;
  }

  if (!strength || !stamina || !agility || !mental || !intelligence || !luck) {
    alert('능력치를 모두 선택해주세요.');
    return;
  }

  isRegistering = true;

  const url =
    API_URL
    + '?action=registerPlayer'
    + '&characterName=' + encodeURIComponent(characterName)
    + '&age=' + encodeURIComponent(age)
    + '&origin=' + encodeURIComponent(origin)
    + '&strength=' + encodeURIComponent(strength)
    + '&stamina=' + encodeURIComponent(stamina)
    + '&agility=' + encodeURIComponent(agility)
    + '&mental=' + encodeURIComponent(mental)
    + '&intelligence=' + encodeURIComponent(intelligence)
    + '&luck=' + encodeURIComponent(luck);

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
        localStorage.setItem('mythosPlayerData', JSON.stringify(data.player));

        renderPlayer(data.player);

        const mainScreen = document.querySelector('.main-screen');
        if (mainScreen) {
          mainScreen.style.visibility = 'visible';
        }

        setSystemStatus('접속 완료');
        setMailCount(0);

        document.getElementById('login-modal').style.display = 'none';
      } else {
        localStorage.removeItem('mythosPersonalCode');

        const mainScreen = document.querySelector('.main-screen');
        if (mainScreen) {
          mainScreen.style.visibility = 'visible';
        }

        document.getElementById('login-modal').style.display = 'flex';
        setSystemStatus('재로그인 필요');
        setMailCount(0);

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

  document.getElementById('stat-strength').textContent = getStatText(player.strength);
  document.getElementById('stat-stamina').textContent = getStatText(player.stamina);
  document.getElementById('stat-agility').textContent = getStatText(player.agility);
  document.getElementById('stat-mental').textContent = getStatText(player.mental);
  document.getElementById('stat-intelligence').textContent = getStatText(player.intelligence);
  document.getElementById('stat-luck').textContent = getStatText(player.luck);

  if (player.portraitUrl) {
    document.getElementById('character-portrait').src = convertDriveUrl(player.portraitUrl);
    document.getElementById('character-portrait').style.display = 'block';
    document.getElementById('portrait-empty').style.display = 'none';
  } else {
    document.getElementById('character-portrait').style.display = 'none';
    document.getElementById('portrait-empty').style.display = 'flex';
  }
}

function updatePortrait() {
  if (!currentPersonalCode) {
    alert('로그인 후 인장을 등록할 수 있습니다.');
    return;
  }

  document.getElementById('portrait-upload-input').click();
}

window.addEventListener('DOMContentLoaded', function () {
  const mainScreen = document.querySelector('.main-screen');
  const input = document.getElementById('portrait-upload-input');

  setMailCount(0);

  if (mainScreen) {
    mainScreen.style.visibility = 'hidden';
  }

  if (input) {
    input.addEventListener('click', function (event) {
      event.stopPropagation();
    });

    input.addEventListener('change', function (event) {
      event.stopPropagation();

      const file = input.files[0];
      if (!file) return;

      resizeImage(file, function (base64Data) {
        uploadPortraitBase64(base64Data);
      });
    });
  }

  const savedCode = localStorage.getItem('mythosPersonalCode');

  if (savedCode) {
    document.getElementById('login-modal').style.display = 'none';
    setSystemStatus('동기화 중...');
    document.getElementById('login-code').value = savedCode;
    currentPersonalCode = savedCode;

    const savedPlayerData = localStorage.getItem('mythosPlayerData');

    if (savedPlayerData) {
      renderPlayer(JSON.parse(savedPlayerData));

      if (mainScreen) {
        mainScreen.style.visibility = 'visible';
      }
    }

    loginPlayer();
  } else {
    if (mainScreen) {
      mainScreen.style.visibility = 'visible';
    }

    document.getElementById('login-modal').style.display = 'flex';
  }
});

function resizeImage(file, callback) {
  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.onload = function () {
      const canvas = document.createElement('canvas');

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      const outputSize = 500;

      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        sx,
        sy,
        size,
        size,
        0,
        0,
        outputSize,
        outputSize
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      callback(dataUrl.split(',')[1]);
    };

    img.onerror = function () {
      alert('이미지를 불러오지 못했습니다. 다른 이미지를 선택해주세요.');
    };

    img.src = event.target.result;
  };

  reader.onerror = function () {
    alert('파일을 읽지 못했습니다. 다른 이미지를 선택해주세요.');
  };

  reader.readAsDataURL(file);
}

function uploadPortraitBase64(base64Data) {
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'updatePortraitUpload',
      personalCode: currentPersonalCode,
      mimeType: 'image/jpeg',
      portraitBase64: base64Data
    })
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data.success) {
        document.getElementById('character-portrait').src = convertDriveUrl(data.portraitUrl);
        document.getElementById('character-portrait').style.display = 'block';
        document.getElementById('portrait-empty').style.display = 'none';

        const savedPlayerData = localStorage.getItem('mythosPlayerData');

        if (savedPlayerData) {
          const player = JSON.parse(savedPlayerData);
          player.portraitUrl = data.portraitUrl;
          localStorage.setItem('mythosPlayerData', JSON.stringify(player));
        }
      } else {
        alert('인장 등록 실패: ' + data.message);
      }
    })
    .catch(function (error) {
      alert(
        '인장 업로드 중 오류가 발생했습니다.\n\n' +
        '문제가 계속되면 총괄진에게 문의해주세요.'
      );

      console.error(error);
    });
}

function convertDriveUrl(url) {
  const match = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);

  if (match && match[1]) {
    return 'https://lh3.googleusercontent.com/d/' + match[1];
  }

  return url;
}