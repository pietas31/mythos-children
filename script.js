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

    <input type="text" placeholder="캐릭터명">

    <input type="text" placeholder="나이">

    <select>
      <option value="">출신지를 선택하세요</option>
      <option value="수도 탈리스">수도 탈리스</option>
      <option value="동부 모네타">동부 모네타</option>
      <option value="서부 아르스">서부 아르스</option>
      <option value="남부 세렌티아">남부 세렌티아</option>
      <option value="북부 니발리스">북부 니발리스</option>
    </select>

    <div class="file-row">
      <span>인장 등록</span>
      <input type="file" accept="image/*">
    </div>

    <button class="modal-btn">
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

    <button class="modal-btn">
      로그인
    </button>

    <button class="modal-btn secondary" onclick="showRegisterForm()">
      회원가입
    </button>
  `;
}