const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

console.log('MYTHOS READY');

function goHome() {
  location.reload();
}

function logout() {
  alert('로그아웃 기능은 데이터 연결 후 작동합니다.');
}

function showLoginForm() {
  const modalBox = document.querySelector('.modal-box');

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

function showRegisterForm() {
  const modalBox = document.querySelector('.modal-box');

  modalBox.innerHTML = `
    <h2>회원가입</h2>

    <input
      id="register-name"
      type="text"
      placeholder="캐릭터명"
    >

    <input
      id="register-age"
      type="text"
      placeholder="나이"
    >

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
      <input
        id="register-portrait"
        type="file"
        accept="image/*"
      >
    </div>

    <button class="modal-btn" onclick="registerPlayer()">
      가입하기
    </button>

    <button class="modal-btn secondary" onclick="showLoginForm()">
      로그인으로 돌아가기
    </button>
  `;
}

function registerPlayer() {
  alert('가입 요청을 시작합니다.');

  const characterName = document.getElementById('characterName')?.value || '';
  const age = document.getElementById('age')?.value || '';
  const origin = document.getElementById('origin')?.value || '';

  const url =
    API_URL
    + '?action=registerPlayer'
    + '&characterName=' + encodeURIComponent(characterName)
    + '&age=' + encodeURIComponent(age)
    + '&origin=' + encodeURIComponent(origin);

  window.open(url, '_blank');
}

function loginPlayer() {
  alert('로그인 기능은 다음 단계에서 연결합니다.');
}