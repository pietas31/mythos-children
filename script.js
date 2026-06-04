const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';

console.log('MYTHOS READY');

function goHome() {
  location.reload();
}

function logout() {
  alert('로그아웃 기능은 데이터 연결 후 작동합니다.');
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
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        const player = data.player;

        document.getElementById('character-name').textContent = player.characterName;
        document.getElementById('character-origin').textContent = '클레이오니아 · ' + player.origin;
        document.getElementById('character-age').textContent = player.age + '세';

        if (player.portraitUrl) {
          document.getElementById('character-portrait').src = player.portraitUrl;
        }

        document.getElementById('login-modal').style.display = 'none';

        localStorage.setItem('mythosPersonalCode', personalCode);
      } else {
        alert('로그인 실패: ' + data.message);
      }
    })
    .catch(function(error) {
      alert(
        '로그인 처리 중 오류가 발생했습니다.\n\n' +
        '잠시 후 다시 시도해주세요.\n' +
        '문제가 계속되면 관리자에게 문의해주세요.'
      );

      console.error(error);
    });
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
  if (isRegistering) {
    return;
  }

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
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
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
    .catch(function(error) {
      isRegistering = false;

      alert(
        '회원가입 처리 중 오류가 발생했습니다.\n\n' +
        '잠시 후 다시 시도해주세요.\n' +
        '문제가 계속되면 관리자에게 문의해주세요.'
      );

      console.error(error);
    });
}

function copyIssuedCode() {
  if (!issuedPersonalCode) {
    alert('복사할 개인코드가 없습니다.');
    return;
  }

  navigator.clipboard.writeText(issuedPersonalCode)
    .then(function () {
      alert('개인코드가 복사되었습니다.');
    })
    .catch(function () {
      alert('복사에 실패했습니다. 개인코드를 직접 선택해서 복사해주세요.');
    });
}

function closeCompleteModal() {
  document.getElementById('register-complete-modal').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
}