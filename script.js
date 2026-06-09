const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';
let CURRENT_VERSION = 'v19';

let currentMailTab = 'all';
let currentMailPage = 1;
let currentMailTotalPages = 1;
let currentMailDetailId = '';
let currentMailCache = [];
let currentMailUnreadCount = 0;
let hasLoadedMailOnce = false;

console.log('MYTHOS READY v19');

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

  const safeCount = Number(count || 0);
  currentMailUnreadCount = safeCount;

  if (!mailCount) return;

  if (safeCount >= 100) {
    mailCount.textContent = '99+';
    return;
  }

  mailCount.textContent = String(safeCount);
}

function refreshUnreadMailCount() {
  if (!currentPersonalCode) {
    setMailCount(0);
    return;
  }

  const url =
    API_URL
    + '?action=getUnreadMailCount'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setMailCount(data.count);
      } else {
        setMailCount(0);
      }
    })
    .catch(error => {
      console.error(error);
      setMailCount(0);
    });
}

function openMailModal() {
  const modal = document.getElementById('mail-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  currentMailTab = 'all';
  currentMailPage = 1;
  currentMailDetailId = '';

  updateMailTabActive('all');

  if (hasLoadedMailOnce && currentMailCache.length) {
    showMailListMode();
  } else {
    const list = document.getElementById('mail-list');
    showMailLoading('우편을 불러오는 중입니다.');
  }

  loadMailList();
}

function closeMailModal() {
  const modal = document.getElementById('mail-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function selectMailTab(tab) {
  currentMailTab = tab;
  currentMailPage = 1;
  currentMailDetailId = '';

  updateMailTabActive(tab);
  showMailLoading('우편을 불러오는 중입니다.');
  loadMailList();
}

function updateMailTabActive(tab) {
  const tabs = document.querySelectorAll('.mail-tab');

  tabs.forEach(button => {
    button.classList.remove('active');
  });

  const tabMap = {
    all: 0,
    kept: 1,
    letter: 2,
    supply: 3
  };

  const index = tabMap[tab];

  if (typeof index !== 'undefined' && tabs[index]) {
    tabs[index].classList.add('active');
  }
}

function loadMailList() {
  if (!currentPersonalCode) return;

  const list = document.getElementById('mail-list');
  if (list) {
    list.innerHTML = '<div class="mail-empty">우편을 불러오는 중입니다.</div>';
  }

  const url =
    API_URL
    + '?action=getMailList'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&tab=' + encodeURIComponent(currentMailTab)
    + '&page=' + encodeURIComponent(currentMailPage);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        renderMailError(data.message || '우편을 불러오지 못했습니다.');
        return;
      }

      currentMailPage = data.page || 1;
      currentMailTotalPages = data.totalPages || 1;
      currentMailCache = data.mails || [];
      hasLoadedMailOnce = true;

      const page = document.querySelector('.mail-page');
      if (page) page.style.display = 'flex';

      showMailListMode();

      if (typeof data.unreadCount !== 'undefined') {
        setMailCount(data.unreadCount);
      }
    })
    .catch(error => {
      console.error(error);
      renderMailError('우편을 불러오는 중 오류가 발생했습니다.');
    });
}

function renderMailList(mails) {
  const list = document.getElementById('mail-list');
  if (!list) return;

  if (!mails.length) {
    list.innerHTML = '<div class="mail-empty">받은 우편이 없습니다.</div>';
    renderMailPage();
    setMailBottomButtons('list');
    return;
  }

  list.innerHTML = mails.map(mail => {
    const readClass = mail.isRead ? 'is-read' : 'is-unread';
    const keepMark = mail.isKept ? '★' : '☆';
    const typeLabel = getMailTypeLabel(mail.mailType);
    const iconPath = mail.iconFileName ? 'assets/icons/' + mail.iconFileName : '';

    return `
      <button class="mail-item ${readClass}" type="button" onclick="openMailDetail('${escapeForAttribute(mail.mailId)}')">
        <span class="mail-keep-mark">${mail.mailType === 'SUPPLY' ? '' : keepMark}</span>
        ${iconPath ? `<img class="mail-icon" src="${iconPath}" alt="">` : ''}
        <span class="mail-title">[${typeLabel}] ${escapeHtml(mail.title || '제목 없음')}</span>
      </button>
    `;
  }).join('');

  renderMailPage();
  setMailBottomButtons('list');
}

function renderMailError(message) {
  const list = document.getElementById('mail-list');
  if (!list) return;
  list.innerHTML = '<div class="mail-empty">' + escapeHtml(message) + '</div>';
}

function showMailLoading(message) {
  const list = document.getElementById('mail-list');
  const detail = document.getElementById('mail-detail');
  const page = document.querySelector('.mail-page');
  const actions = document.getElementById('mail-bottom-actions');

  if (detail) detail.style.display = 'none';
  if (list) {
    list.style.display = 'flex';
    list.innerHTML =
      '<div class="mail-loading">' +
        '<div class="mail-loading-dot"></div>' +
        '<div>' + escapeHtml(message || '불러오는 중입니다.') + '</div>' +
      '</div>';
  }

  if (page) page.style.display = 'flex';
  if (actions) actions.style.display = 'grid';

  renderMailPage();
  setMailBottomButtons('list');
}

function renderMailPage() {
  const pageText = document.getElementById('mail-page-text');

  if (!pageText) return;

  if (currentMailDetailId) {
    const index = currentMailCache.findIndex(mail => String(mail.mailId) === String(currentMailDetailId));
    pageText.textContent = (index + 1) + ' / ' + currentMailCache.length;
    return;
  }

  pageText.textContent = currentMailPage + ' / ' + currentMailTotalPages;
}

function goPrevMailPage() {
  if (currentMailPage <= 1) return;
  currentMailPage--;
  loadMailList();
}

function goNextMailPage() {
  if (currentMailPage >= currentMailTotalPages) return;
  currentMailPage++;
  loadMailList();
}

function goPrevMail() {
  if (currentMailDetailId) {
    goPrevMailInDetail();
    return;
  }

  goPrevMailPage();
}

function goNextMail() {
  if (currentMailDetailId) {
    goNextMailInDetail();
    return;
  }

  goNextMailPage();
}

function openMailDetail(mailId) {
  if (!currentPersonalCode || !mailId) return;

  const cachedMail = currentMailCache.find(mail => String(mail.mailId) === String(mailId));

  if (!cachedMail) {
    alert('우편 정보를 찾을 수 없습니다. 우편함을 다시 열어주세요.');
    return;
  }

  currentMailDetailId = mailId;

  const wasUnread = !cachedMail.isRead;
  cachedMail.isRead = true;

  renderMailDetail(cachedMail);

  if (wasUnread) {
    setMailCount(Math.max(currentMailUnreadCount - 1, 0));
    markMailReadSilently(mailId);
  }
}

function markMailRead(mailId) {
  if (!currentPersonalCode || !mailId) return;

  const url =
    API_URL
    + '?action=markMailRead'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&mailId=' + encodeURIComponent(mailId);

  fetch(url)
    .then(response => response.json())
    .then(() => {
      loadMailList();
      refreshUnreadMailCount();
    })
    .catch(error => console.error(error));
}

function markMailReadSilently(mailId) {
  if (!currentPersonalCode || !mailId) return;

  const url =
    API_URL
    + '?action=markMailRead'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&mailId=' + encodeURIComponent(mailId);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.warn(data.message || '읽음 처리 실패');
      }
    })
    .catch(error => console.error(error));
}

function renderMailDetail(mail) {
  document.getElementById('mail-detail-title').textContent = mail.title || '제목 없음';
  document.getElementById('mail-detail-content').textContent = mail.content || '';

  document.getElementById('mail-detail-sender').textContent =
    'From. ' + (mail.senderName || '-');

  document.getElementById('mail-detail-date').textContent =
    formatMailDateForView(mail.sentAt);

  const reward = document.getElementById('mail-detail-reward');

  if (reward) {
    if (mail.mailType === 'SUPPLY') {
      const iconPath = mail.iconFileName ? 'assets/icons/' + mail.iconFileName : '';

      reward.style.display = 'block';
      reward.innerHTML =
        '<div class="mail-reward-row">' +
          '<div>' +
            '<strong>보급품 정보</strong><br>' +
            '골드 : ' + Number(mail.goldAmount || 0) + 'G' +
            (mail.expiresAt ? '<br>수령 마감 : ' + formatMailDateForView(mail.expiresAt) : '') +
          '</div>' +
          (iconPath ? '<img class="mail-reward-icon" src="' + iconPath + '" alt="">' : '') +
        '</div>';
    } else {
      reward.style.display = 'none';
      reward.innerHTML = '';
    }
  }

  showMailDetailMode(mail);
}

function closeMailDetail() {
  showMailListMode();
}

function toggleCurrentMailKeep() {
  if (!currentMailDetailId) return;

  const mail = currentMailCache.find(item => String(item.mailId) === String(currentMailDetailId));
  if (!mail) return;

  mail.isKept = !mail.isKept;
  renderMailDetail(mail);

  toggleMailKeep(currentMailDetailId);
}

function deleteCurrentMail() {
  if (!currentMailDetailId) return;

  deleteMail(currentMailDetailId);
  closeMailDetail();
}

function formatMailDateForView(value) {
  if (!value) return '';

  return String(value)
    .replaceAll('-', '.')
    .slice(0, 16);
}

function setMailBottomButtons(mode, mail) {
  const leftBtn = document.getElementById('mail-bottom-left-btn');
  const centerBtn = document.getElementById('mail-bottom-center-btn');
  const rightBtn = document.getElementById('mail-bottom-right-btn');

  if (!leftBtn || !centerBtn || !rightBtn) return;

  leftBtn.style.display = 'block';
  centerBtn.style.display = 'block';
  rightBtn.style.display = 'block';

  if (mode === 'detail') {
    leftBtn.textContent = '보관';
    leftBtn.onclick = function () {
      if (mail && mail.mailType === 'SUPPLY') {
        alert('보급 우편은 보관할 수 없습니다.');
        return;
      }

      toggleCurrentMailKeep();
    };

    centerBtn.textContent = '수령';
    centerBtn.onclick = function () {
      if (!mail || mail.mailType !== 'SUPPLY') {
        alert('첨부된 보급품이 없습니다.');
        return;
      }

      receiveCurrentMail();
    };

    rightBtn.textContent = '삭제';
    rightBtn.onclick = function () {
      if (mail && mail.mailType === 'SUPPLY') {
        alert('수령을 마친 뒤 삭제해주세요.');
        return;
      }

      deleteCurrentMail();
    };

    if (mail && mail.isKept && mail.mailType !== 'SUPPLY') {
      leftBtn.textContent = '보관 해제';
    }

    return;
  }

  leftBtn.textContent = '작성';
  leftBtn.onclick = function () {
    alert('편지 작성 기능은 v19-3에서 연결할 예정입니다.');
  };

  centerBtn.textContent = '수령';
  centerBtn.onclick = function () {
    alert('수령 모드는 v19-3에서 연결할 예정입니다.');
  };

  rightBtn.textContent = '삭제';
  rightBtn.onclick = function () {
    alert('삭제 모드는 추후 연결할 예정입니다.');
  };
}

function showMailListMode() {
  const list = document.getElementById('mail-list');
  const detail = document.getElementById('mail-detail');
  const page = document.querySelector('.mail-page');
  const actions = document.getElementById('mail-bottom-actions');

  currentMailDetailId = '';

  if (detail) detail.style.display = 'none';
  if (list) list.style.display = 'flex';
  if (page) page.style.display = 'flex';
  if (actions) actions.style.display = 'grid';

  renderMailList(currentMailCache);
  renderMailPage();
  setMailBottomButtons('list');
}

function showMailDetailMode(mail) {
  const list = document.getElementById('mail-list');
  const detail = document.getElementById('mail-detail');
  const page = document.querySelector('.mail-page');
  const actions = document.getElementById('mail-bottom-actions');

  if (list) list.style.display = 'none';
  if (detail) detail.style.display = 'block';
  if (page) page.style.display = 'flex';
  if (actions) actions.style.display = 'grid';

  setMailBottomButtons('detail', mail);
  renderMailPage();
}

function goPrevMailInDetail() {
  if (!currentMailDetailId || !currentMailCache.length) return;

  const index = currentMailCache.findIndex(mail => String(mail.mailId) === String(currentMailDetailId));
  if (index <= 0) return;

  openMailDetail(currentMailCache[index - 1].mailId);
}

function goNextMailInDetail() {
  if (!currentMailDetailId || !currentMailCache.length) return;

  const index = currentMailCache.findIndex(mail => String(mail.mailId) === String(currentMailDetailId));
  if (index < 0 || index >= currentMailCache.length - 1) return;

  openMailDetail(currentMailCache[index + 1].mailId);
}

function receiveCurrentMail() {
  if (currentMailDetailId) {
    alert('보급 수령 기능은 v19-3에서 연결할 예정입니다.');

    const mail = currentMailCache.find(item => String(item.mailId) === String(currentMailDetailId));
    if (mail) {
      showMailDetailMode(mail);
    }

    return;
  }

  alert('수령 모드는 v19-3에서 연결할 예정입니다.');
  showMailListMode();
}

function deleteMail(mailId) {
  if (!currentPersonalCode || !mailId) return;

  const url =
    API_URL
    + '?action=deleteMail'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&mailId=' + encodeURIComponent(mailId);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        alert(data.message || '우편을 삭제하지 못했습니다.');
        return;
      }

      loadMailList();
      refreshUnreadMailCount();
    })
    .catch(error => console.error(error));
}

function getMailTypeLabel(type) {
  if (type === 'SUPPLY') return '보급';
  if (type === 'ANON') return '서신';
  if (type === 'PREMIUM') return '서신';
  if (type === 'GM') return '서신';
  return '서신';
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

  for (let i = 0; i < stat; i++) filled += '◆';
  for (let i = stat; i < 5; i++) empty += '◇';

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
        refreshUnreadMailCount();

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

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeForAttribute(text) {
  return String(text || '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '&quot;');
}