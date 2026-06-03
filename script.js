const API_URL =
  'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

console.log("MYTHOS READY");

function goHome() {
  location.reload();
}

function logout() {
  alert("로그아웃 기능은 데이터 연결 후 작동합니다.");
}

function showRegisterForm() {
  const modalBox = document.querySelector(".modal-box");

  modalBox.innerHTML = `
    <h2>회원가입</h2>

    <input id="register-name" type="text" placeholder="캐릭터명">
    <input id="register-age" type="text" placeholder="나이">

    <select id="register-origin">
      <option value="">출신지를 선택하세요</option>
      <option value="수도 탈리스">수도 탈리스</option>
      <option value="동부 모네타">동부 모네타</option>
      <option value="서부 아르스">서부 아르스</option>
      <option value="남부 세렌티아">남부 세렌티아</option>
      <option value="북부 니발리스">북부 니발리스</option>
    </select>

    <div class="file-row">
      <span>인장 등록</span>
      <input id="register-portrait" type="file" accept="image/*">
    </div>

    <button class="modal-btn" onclick="registerPlayer()">
      가입하기
    </button>

    <button class="modal-btn secondary" onclick="showLoginForm()">
      로그인으로 돌아가기
    </button>
  `;
}

function showLoginForm() {
  const modalBox = document.querySelector(".modal-box");

  modalBox.innerHTML = `
    <h2>MYTHOS</h2>

    <input
      type="text"
      placeholder="개인코드"
      id="login-code"
    >

    <button class="modal-btn" onclick="loginPlayer()">
      로그인
    </button>

    <button class="modal-btn secondary" onclick="showRegisterForm()">
      회원가입
    </button>
  `;
}

async function loginPlayer() {
  const code = document.getElementById('login-code').value.trim();

  if (!code) {
    alert('개인코드를 입력해주세요.');
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'login',
        data: {
          personalCode: code
        }
      })
    });

    const result = await response.json();

    if (result.error) {
      alert(result.error);
      return;
    }

    alert(result.characterName + '님 환영합니다.');
  } catch (err) {
    console.error(err);
    alert('서버 연결 실패: ' + err.message);
  }
}

async function registerPlayer() {
  alert('가입 요청을 시작합니다.');

  const characterName = document.getElementById('register-name').value.trim();
  const age = document.getElementById('register-age').value.trim();
  const origin = document.getElementById('register-origin').value.trim();
  const file = document.getElementById('register-portrait').files[0];

  if (!characterName || !age || !origin) {
    alert('캐릭터명, 나이, 출신지를 모두 입력해주세요.');
    return;
  }

  let portraitData = '';
  let portraitName = '';

  if (file) {
    portraitData = await fileToBase64(file);
    portraitName = file.name;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'registerPlayer',
        data: {
          characterName,
          age,
          origin,
          portraitData,
          portraitName
        }
      })
    });

    const result = await response.json();

    if (result.error) {
      alert(result.error);
      return;
    }

    alert(
      `가입이 완료되었습니다.\n\n당신의 개인코드:\n${result.personalCode}\n\n※ 이 코드는 반드시 저장해 주세요.\n※ 개인코드는 타인과 공유하지 마세요.\n※ 분실 시 총괄진에게 문의 바랍니다.`
    );

    showLoginForm();
  } catch (err) {
    console.error(err);
    alert('서버 연결 실패: ' + err.message);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}