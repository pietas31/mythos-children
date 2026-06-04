const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;

console.log('MYTHOS READY');

function goHome() {
  location.reload();
}

function logout() {
  alert('로그아웃 기능은 데이터 연결 후 작동합니다.');
}

function loginPlayer() {
  alert('로그인 기능은 다음 단계에서 연결합니다.');
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
        alert(
          '가입이 완료되었습니다!\n\n' +
          '개인코드: ' + data.personalCode + '\n\n' +
          '이 코드는 로그인에 필요하니 반드시 저장해주세요.'
        );

        prompt('개인코드를 복사하세요.', data.personalCode);

        document.getElementById('login-code').value = data.personalCode;
        backToLoginModal();
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