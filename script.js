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

const SPREADSHEET_ID = '1Ep6ylUDwH7P2xj-ZKSvFngyXjA0c3WqmwvAXIYi3neM';
const PORTRAIT_FOLDER_ID = '1NG1Smxh1puAutnchhSG8u4KCTe7OWG7L';

function doGet(e) {
  const action = e.parameter.action;

  if (!action) {
    return jsonOutput({
      success: true,
      message: 'MYTHOS API OK'
    });
  }

  if (action === 'registerPlayer') {
    return registerPlayerByGet(e);
  }

  return jsonOutput({
    success: false,
    message: 'Unknown action: ' + action
  });
}

function registerPlayerByGet(e) {
  try {
    const characterName = e.parameter.characterName || '';
    const age = e.parameter.age || '';
    const origin = e.parameter.origin || '';
    const fileName = e.parameter.fileName || '';
    const mimeType = e.parameter.mimeType || '';
    const portraitBase64 = e.parameter.portraitBase64 || '';

    if (!characterName) {
      return jsonOutput({
        success: false,
        message: 'characterName is required'
      });
    }

    if (!age) {
      return jsonOutput({
        success: false,
        message: 'age is required'
      });
    }

    if (!origin) {
      return jsonOutput({
        success: false,
        message: 'origin is required'
      });
    }

    if (!portraitBase64) {
      return jsonOutput({
        success: false,
        message: 'portrait image is required'
      });
    }

    const personalCode = generatePersonalCode();

    const portraitUrl = uploadPortraitToDrive(
      portraitBase64,
      fileName,
      mimeType,
      personalCode
    );

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('개인');

    if (!sheet) {
      return jsonOutput({
        success: false,
        message: '개인 시트를 찾을 수 없습니다.'
      });
    }

    sheet.appendRow([
      personalCode,      // A 개인코드
      characterName,     // B 캐릭터명
      age,               // C 나이
      '',                // D 역할
      '',                // E 현재장소ID
      origin,            // F 출신지
      portraitUrl        // G 인장URL
    ]);

    return jsonOutput({
      success: true,
      personalCode: personalCode,
      characterName: characterName,
      age: age,
      origin: origin,
      portraitUrl: portraitUrl
    });

  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.toString()
    });
  }
}

function uploadPortraitToDrive(base64Data, originalFileName, mimeType, personalCode) {
  const folder = DriveApp.getFolderById(PORTRAIT_FOLDER_ID);

  const extension = getExtensionFromFileName(originalFileName);
  const safeFileName = personalCode + '_portrait' + extension;

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, safeFileName);

  const file = folder.createFile(blob);

  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  return file.getUrl();
}

function getExtensionFromFileName(fileName) {
  if (!fileName || fileName.indexOf('.') === -1) {
    return '.png';
  }

  return fileName.substring(fileName.lastIndexOf('.'));
}

function generatePersonalCode() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return 'P-' + random;
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSheetAccess() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('개인');
  Logger.log(sheet.getName());
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