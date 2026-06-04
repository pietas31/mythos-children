const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

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
  const characterName = document.getElementById('characterName')?.value.trim() || '';
  const age = document.getElementById('age')?.value.trim() || '';
  const origin = document.getElementById('origin')?.value || '';
  const portraitFile = document.getElementById('portraitFile')?.files[0];

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

  if (!portraitFile) {
    alert('인장 이미지를 선택해주세요.');
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    const base64Data = reader.result.split(',')[1];

    const callbackName = 'mythosRegisterCallback_' + Date.now();

    window[callbackName] = function (data) {
      if (data.success) {
        alert(
          '가입이 완료되었습니다!\n\n' +
          '개인코드: ' + data.personalCode + '\n\n' +
          '이 코드는 로그인에 필요하니 반드시 저장해주세요.'
        );

        document.getElementById('login-code').value = data.personalCode;

        backToLoginModal();
      } else {
        alert('가입 실패: ' + data.message);
      }

      delete window[callbackName];
    };

    const url =
      API_URL
      + '?action=registerPlayer'
      + '&callback=' + encodeURIComponent(callbackName)
      + '&characterName=' + encodeURIComponent(characterName)
      + '&age=' + encodeURIComponent(age)
      + '&origin=' + encodeURIComponent(origin)
      + '&fileName=' + encodeURIComponent(portraitFile.name)
      + '&mimeType=' + encodeURIComponent(portraitFile.type)
      + '&portraitBase64=' + encodeURIComponent(base64Data);

    const script = document.createElement('script');
    script.src = url;

    script.onerror = function () {
      alert('가입 요청을 보내는 중 오류가 발생했습니다. 이미지 용량이 너무 클 수 있습니다.');
      delete window[callbackName];
    };

    document.body.appendChild(script);
  };

  reader.readAsDataURL(portraitFile);
}

  reader.readAsDataURL(portraitFile);
}