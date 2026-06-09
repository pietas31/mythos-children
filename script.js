const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';
let CURRENT_VERSION = 'v19-5';

let currentMailTab = 'all';
let currentMailPage = 1;
let currentMailTotalPages = 1;
let currentMailDetailId = '';
let currentMailDetailIndex = 0;
let currentMailCache = [];
let currentMailUnreadCount = 0;
let currentMailTotalCount = 0;
let hasLoadedMailOnce = false;
let currentMailSelectionMode = '';
let selectedMailIndexes = [];

console.log('MYTHOS READY v19-5');

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
  currentMailDetailIndex = 0;

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
  currentMailDetailIndex = 0;

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
      currentMailTotalCount = data.totalCount || 0;
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
    const canSelect =
  currentMailSelectionMode === 'delete'
    ? canSelectMailForDelete(mail)
    : currentMailSelectionMode === 'receive'
      ? canSelectMailForReceive(mail)
      : false;
    const selected = selectedMailIndexes.includes(Number(mail.detailIndex));
    const selectClass = currentMailSelectionMode ? ' is-select-mode' : '';
    const disabledClass = currentMailSelectionMode && !canSelect ? ' is-disabled-select' : '';

    return `
      <div class="mail-item ${readClass}${selectClass}${disabledClass}" onclick="handleMailItemClick(${Number(mail.detailIndex || 0)}, '${escapeForAttribute(mail.mailId)}')">
        ${
          currentMailSelectionMode
            ? `<span class="mail-select-box">${selected ? '✓' : ''}</span>`
            : `<span class="mail-keep-mark">${mail.mailType === 'SUPPLY' ? '' : keepMark}</span>`
        }
        ${iconPath ? `<img class="mail-icon" src="${iconPath}" alt="">` : ''}
        <span class="mail-title">[${typeLabel}] ${escapeHtml(mail.title || '제목 없음')}</span>
      </div>
    `;
  }).join('');

  renderMailPage();
  setMailBottomButtons(currentMailSelectionMode ? currentMailSelectionMode + '-select' : 'list');
}

function handleMailItemClick(detailIndex, mailId) {
  if (currentMailSelectionMode === 'delete' || currentMailSelectionMode === 'receive') {
    toggleMailSelectionByIndex(detailIndex);
    return;
  }

  openMailDetailByIndex(detailIndex);
}

function canSelectMailForDelete(mail) {
  if (!mail) return false;
  if (mail.mailType === 'SUPPLY' && !mail.isReceived) return false;
  return true;
}

function canSelectMailForReceive(mail) {
  if (!mail) return false;
  if (mail.mailType !== 'SUPPLY') return false;
  if (mail.isReceived) return false;
  return true;
}

function toggleMailSelectionByIndex(detailIndex) {
  const mail = currentMailCache.find(item => Number(item.detailIndex) === Number(detailIndex));

  const canSelect =
  currentMailSelectionMode === 'delete'
    ? canSelectMailForDelete(mail)
    : currentMailSelectionMode === 'receive'
      ? canSelectMailForReceive(mail)
      : false;

if (!canSelect) {
  if (currentMailSelectionMode === 'receive') {
    openAlertModal('수령 불가', '수령 가능한 보급 우편만 선택할 수 있습니다.');
    return;
  }

  openAlertModal('삭제 불가', '수령하지 않은 보급 우편은 삭제할 수 없습니다.');
  return;
}

  const safeIndex = Number(detailIndex);

  if (selectedMailIndexes.includes(safeIndex)) {
    selectedMailIndexes = selectedMailIndexes.filter(index => index !== safeIndex);
  } else {
    selectedMailIndexes.push(safeIndex);
  }

  renderMailList(currentMailCache);
}

function enterMailDeleteMode() {
  currentMailSelectionMode = 'delete';
  selectedMailIndexes = [];
  renderMailList(currentMailCache);
}

function enterMailReceiveMode() {
  currentMailSelectionMode = 'receive';
  selectedMailIndexes = [];
  renderMailList(currentMailCache);
}

function cancelMailSelectionMode() {
  currentMailSelectionMode = '';
  selectedMailIndexes = [];
  renderMailList(currentMailCache);
}

function selectAllVisibleMails() {
  if (currentMailSelectionMode !== 'delete' && currentMailSelectionMode !== 'receive') return;

  selectedMailIndexes = currentMailCache
    .filter(mail => {
      if (currentMailSelectionMode === 'delete') return canSelectMailForDelete(mail);
      if (currentMailSelectionMode === 'receive') return canSelectMailForReceive(mail);
      return false;
    })
    .map(mail => Number(mail.detailIndex));

  if (!selectedMailIndexes.length) {
    const message =
      currentMailSelectionMode === 'receive'
        ? '현재 페이지에 수령 가능한 보급 우편이 없습니다.'
        : '현재 페이지에 삭제할 수 있는 우편이 없습니다.';

    openAlertModal('선택 불가', message);
    return;
  }

  renderMailList(currentMailCache);
}

function deleteSelectedMails() {
  if (!selectedMailIndexes.length) {
    openAlertModal('선택 필요', '삭제할 우편을 선택해주세요.');
    return;
  }

  openConfirmModal(
    '선택 우편 삭제',
    '선택한 우편을 삭제하시겠습니까?\n삭제한 우편은 복구할 수 없습니다.',
    function () {
      deleteSelectedMailsAfterConfirm();
    }
  );
}

function deleteSelectedMailsAfterConfirm() {
  const targetIndexes = selectedMailIndexes.slice();

  const requests = targetIndexes.map(detailIndex => {
    const mail = currentMailCache.find(item => Number(item.detailIndex) === Number(detailIndex));
    const mailId = mail ? mail.mailId : '';

    const url =
      API_URL
      + '?action=deleteMail'
      + '&personalCode=' + encodeURIComponent(currentPersonalCode)
      + '&mailId=' + encodeURIComponent(mailId);

    return fetch(url).then(response => response.json());
  });

  Promise.all(requests)
    .then(results => {
      const failed = results.filter(data => !data.success);

      currentMailSelectionMode = '';
      selectedMailIndexes = [];

      loadMailList();
      refreshUnreadMailCount();

      if (failed.length) {
        openAlertModal('일부 삭제 실패', '일부 우편을 삭제하지 못했습니다.');
        return;
      }

      openAlertModal('삭제 완료', '선택한 우편을 삭제했습니다.');
    })
    .catch(error => {
      console.error(error);
      openAlertModal('삭제 오류', '선택 우편 삭제 중 오류가 발생했습니다.');
    });
}

function receiveSelectedMails() {
  if (!selectedMailIndexes.length) {
    openAlertModal('선택 필요', '수령할 보급 우편을 선택해주세요.');
    return;
  }

  openConfirmModal(
    '선택 보급 수령',
    '선택한 보급품을 수령하시겠습니까?',
    function () {
      receiveSelectedMailsAfterConfirm();
    }
  );
}

function receiveSelectedMailsAfterConfirm() {
  const targetIndexes = selectedMailIndexes.slice();

  const centerBtn = document.getElementById('mail-bottom-center-btn');
  if (centerBtn) {
    centerBtn.textContent = '수령 중...';
    centerBtn.disabled = true;
  }

  const url =
    API_URL
    + '?action=receiveSelectedSupplyMails'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&tab=' + encodeURIComponent(currentMailTab)
    + '&detailIndexes=' + encodeURIComponent(targetIndexes.join(','));

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        if (centerBtn) {
          centerBtn.textContent = '선택 수령';
          centerBtn.disabled = false;
        }

        openAlertModal('수령 실패', data.message || '선택한 보급품을 수령하지 못했습니다.');
        return;
      }

      currentMailSelectionMode = '';
      selectedMailIndexes = [];

      if (typeof data.balance !== 'undefined') {
        updateGoldDisplay(data.balance);
      }

      loadMailList();
      refreshUnreadMailCount();

      openAlertModal('수령 완료', makeReceiveResultMessage(data));
    })
    .catch(error => {
      console.error(error);

      if (centerBtn) {
        centerBtn.textContent = '선택 수령';
        centerBtn.disabled = false;
      }

      openAlertModal('수령 오류', '선택 보급품 수령 중 오류가 발생했습니다.');
    });
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

  if (currentMailDetailIndex) {
    pageText.textContent = currentMailDetailIndex + ' / ' + currentMailTotalCount;
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
  if (currentMailDetailIndex) {
    goPrevMailInDetail();
    return;
  }

  goPrevMailPage();
}

function goNextMail() {
  if (currentMailDetailIndex) {
    goNextMailInDetail();
    return;
  }

  goNextMailPage();
}

function openMailDetail(mailId) {
  const cachedMail = currentMailCache.find(mail => String(mail.mailId) === String(mailId));
  if (!cachedMail) return;

  openMailDetailByIndex(Number(cachedMail.detailIndex || 0));
}

function openMailDetailByIndex(detailIndex) {
  if (!currentPersonalCode || !detailIndex) return;

  const cachedMail = currentMailCache.find(mail => Number(mail.detailIndex) === Number(detailIndex));

  if (!cachedMail) {
    alert('우편 정보를 찾을 수 없습니다. 우편함을 다시 열어주세요.');
    return;
  }

  currentMailDetailId = cachedMail.mailId;
  currentMailDetailIndex = Number(cachedMail.detailIndex || detailIndex);

  const wasUnread = !cachedMail.isRead;
  cachedMail.isRead = true;

  renderMailDetail(cachedMail);
  renderMailPage();

  if (wasUnread) {
    setMailCount(Math.max(currentMailUnreadCount - 1, 0));
    markMailReadSilently(cachedMail.mailId);
  }
}

function markMailRead(mailId) {
  if (!currentPersonalCode || !currentMailDetailIndex) return;

  const url =
    API_URL
    + '?action=markMailRead'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&tab=' + encodeURIComponent(currentMailTab)
    + '&detailIndex=' + encodeURIComponent(currentMailDetailIndex);

  fetch(url)
    .then(response => response.json())
    .then(() => {
      loadMailList();
      refreshUnreadMailCount();
    })
    .catch(error => console.error(error));
}

function markMailReadSilently(mailId) {
  if (!currentPersonalCode || !currentMailDetailIndex) return;

  const url =
    API_URL
    + '?action=markMailRead'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&tab=' + encodeURIComponent(currentMailTab)
    + '&detailIndex=' + encodeURIComponent(currentMailDetailIndex);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log('읽음 처리 결과:', data);

      if (!data.success) {
        console.warn(data.message || '읽음 처리 실패');
        return;
      }

      const mail = currentMailCache.find(item => Number(item.detailIndex) === Number(currentMailDetailIndex));
      if (mail) {
        mail.isRead = true;
      }

      refreshUnreadMailCount();
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
      const itemText = mail.itemData ? escapeHtml(mail.itemData) : '없음';
      const receivedText = mail.isReceived
        ? '<br>수령 상태 : 수령 완료' + (mail.receivedAt ? '<br>수령 시각 : ' + formatMailDateForView(mail.receivedAt) : '')
        : '<br>수령 상태 : 미수령';

      reward.style.display = 'block';
      reward.innerHTML =
        '<div class="mail-reward-row">' +
          '<div>' +
            '<strong>보급품 정보</strong><br>' +
            '골드 : ' + Number(mail.goldAmount || 0) + 'G' +
            '<br>아이템 : ' + itemText +
            (mail.expiresAt ? '<br>수령 마감 : ' + formatMailDateForView(mail.expiresAt) : '') +
            receivedText +
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

function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const okBtn = document.getElementById('confirm-ok-btn');

  if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) return;

  titleEl.textContent = title || '확인';
  messageEl.textContent = message || '';

  modal.style.display = 'flex';

  cancelBtn.onclick = function () {
    modal.style.display = 'none';
  };

  okBtn.onclick = function () {
    modal.style.display = 'none';

    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };
}

function openAlertModal(title, message) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
    alert(message || title || '알림');
    return;
  }

  titleEl.textContent = title || '알림';
  messageEl.textContent = message || '';

  okBtn.style.display = 'none';
  cancelBtn.style.display = 'block';
  cancelBtn.textContent = '확인';

  modal.style.display = 'flex';

  cancelBtn.onclick = function () {
    modal.style.display = 'none';
    cancelBtn.textContent = '취소';
    okBtn.style.display = 'block';
  };
}

function deleteCurrentMail() {
  if (!currentMailDetailId) return;

  openConfirmModal(
    '우편 삭제',
    '이 우편을 삭제하시겠습니까?\n삭제한 우편은 복구할 수 없습니다.',
    function () {
      deleteMail(currentMailDetailId);
      closeMailDetail();
    }
  );
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

leftBtn.disabled = false;
centerBtn.disabled = false;
rightBtn.disabled = false;

  if (mode === 'delete-select') {
    leftBtn.textContent = '전체 선택';
    leftBtn.onclick = function () {
      selectAllVisibleMails();
    };

    centerBtn.textContent = '선택 삭제';
    centerBtn.onclick = function () {
      deleteSelectedMails();
    };

    rightBtn.textContent = '취소';
    rightBtn.onclick = function () {
      cancelMailSelectionMode();
    };

    return;
  }

  if (mode === 'receive-select') {
    leftBtn.textContent = '전체 선택';
    leftBtn.onclick = function () {
      selectAllVisibleMails();
    };

    centerBtn.textContent = '선택 수령';
    centerBtn.onclick = function () {
      receiveSelectedMails();
    };

    rightBtn.textContent = '취소';
    rightBtn.onclick = function () {
      cancelMailSelectionMode();
    };

    return;
  }

  if (mode === 'detail') {
    leftBtn.textContent = '보관';
    leftBtn.onclick = function () {
      if (mail && mail.mailType === 'SUPPLY') {
        openAlertModal('보관 불가', '보급 우편은 보관할 수 없습니다.');
        return;
      }

      toggleCurrentMailKeep();
    };

    centerBtn.textContent = mail && mail.mailType === 'SUPPLY' && mail.isReceived ? '수령 완료' : '수령';
    centerBtn.onclick = function () {
      if (!mail || mail.mailType !== 'SUPPLY') {
        openAlertModal('수령 불가', '첨부된 보급품이 없습니다.');
        return;
      }

      if (mail.isReceived) {
        openAlertModal('수령 완료', '이미 수령한 보급품입니다.');
        return;
      }

      receiveCurrentMail();
    };

    rightBtn.textContent = '삭제';
    rightBtn.onclick = function () {
      if (mail && mail.mailType === 'SUPPLY' && !mail.isReceived) {
        openAlertModal('삭제 불가', '수령을 마친 뒤 삭제해주세요.');
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
  openMailWriteModal();
};

  centerBtn.textContent = '수령';
centerBtn.onclick = function () {
  enterMailReceiveMode();
};

rightBtn.textContent = '삭제';
rightBtn.onclick = function () {
  enterMailDeleteMode();
};
}

function showMailListMode() {
  const list = document.getElementById('mail-list');
  const detail = document.getElementById('mail-detail');
  const page = document.querySelector('.mail-page');
  const actions = document.getElementById('mail-bottom-actions');

  currentMailDetailId = '';
  currentMailDetailIndex = 0;

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
  moveMailDetailByOffset(-1);
}

function goNextMailInDetail() {
  moveMailDetailByOffset(1);
}

function moveMailDetailByOffset(offset) {
  if (!currentMailDetailIndex || !currentMailTotalCount) return;

  const currentIndex = Number(currentMailDetailIndex);
  const targetIndex = currentIndex + offset;

  if (targetIndex < 1 || targetIndex > currentMailTotalCount) return;

  const cachedTarget = currentMailCache.find(mail => Number(mail.detailIndex) === Number(targetIndex));

  if (cachedTarget) {
    openMailDetailByIndex(targetIndex);
    return;
  }

  loadMailPageAndOpenByIndex(targetIndex);
}

function loadMailPageAndOpenByIndex(targetIndex) {
  const pageSize = getCurrentMailPageSize();
  const targetPage = Math.ceil(targetIndex / pageSize);

  currentMailPage = targetPage;
  currentMailDetailId = '';

  showMailLoading('우편을 불러오는 중입니다.');

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

      currentMailPage = data.page || targetPage;
      currentMailTotalPages = data.totalPages || 1;
      currentMailTotalCount = data.totalCount || 0;
      currentMailCache = data.mails || [];

      if (typeof data.unreadCount !== 'undefined') {
        setMailCount(data.unreadCount);
      }

      const targetMail = currentMailCache.find(mail => Number(mail.detailIndex) === Number(targetIndex));

      if (!targetMail) {
        showMailListMode();
        alert('해당 우편을 찾지 못했습니다. 우편함을 다시 불러왔습니다.');
        return;
      }

      openMailDetailByIndex(targetIndex);
    })
    .catch(error => {
      console.error(error);
      renderMailError('우편을 불러오는 중 오류가 발생했습니다.');
    });
}

function getCurrentMailPageSize() {
  if (!currentMailCache.length) return 5;

  const firstMail = currentMailCache[0];
  const firstIndex = Number(firstMail.detailIndex || 1);

  if (currentMailPage > 1 && firstIndex > 1) {
    return Math.max(1, Math.round((firstIndex - 1) / (currentMailPage - 1)));
  }

  return Math.max(1, currentMailCache.length);
}

function receiveCurrentMail() {
  if (!currentPersonalCode || !currentMailDetailIndex) {
    alert('수령할 우편을 찾을 수 없습니다.');
    return;
  }

  const mail = currentMailCache.find(item => Number(item.detailIndex) === Number(currentMailDetailIndex));

  if (!mail || mail.mailType !== 'SUPPLY') {
    alert('첨부된 보급품이 없습니다.');
    return;
  }

  if (mail.isReceived) {
    alert('이미 수령한 보급품입니다.');
    return;
  }

const centerBtn = document.getElementById('mail-bottom-center-btn');
if (centerBtn) {
  centerBtn.textContent = '수령 중...';
  centerBtn.disabled = true;
}

  const url =
    API_URL
    + '?action=receiveSupplyMail'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&tab=' + encodeURIComponent(currentMailTab)
    + '&detailIndex=' + encodeURIComponent(currentMailDetailIndex);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
  openAlertModal('수령 실패', data.message || '보급품을 수령하지 못했습니다.');

  if (centerBtn) {
    centerBtn.textContent = '수령';
    centerBtn.disabled = false;
  }

  return;
}

      mail.isReceived = true;
      mail.receivedAt = data.receivedAt || '';
      renderMailDetail(mail);

      if (typeof data.balance !== 'undefined') {
        updateGoldDisplay(data.balance);
      }

      openAlertModal('수령 완료', makeReceiveResultMessage(data));
    })
    .catch(error => {
  console.error(error);

  if (centerBtn) {
    centerBtn.textContent = '수령';
    centerBtn.disabled = false;
  }

  openAlertModal('수령 오류', '보급품 수령 중 오류가 발생했습니다.');
});
}

function makeReceiveResultMessage(data) {
  const lines = ['보급품을 수령했습니다.'];

  if (Number(data.goldAmount || 0) > 0) {
    lines.push('골드 +' + Number(data.goldAmount || 0) + 'G');
  }

  if (data.items && data.items.length) {
    const itemText = data.items
      .map(item => item.itemName + ' x' + item.quantity)
      .join(', ');

    lines.push('아이템 ' + itemText);
  }

  return lines.join('\n');
}

function updateGoldDisplay(balance) {
  const money = document.getElementById('character-money');
  if (money) {
    money.textContent = '보유 재화 : ' + Number(balance || 0) + '골드';
  }

  const savedPlayerData = localStorage.getItem('mythosPlayerData');

  if (savedPlayerData) {
    const player = JSON.parse(savedPlayerData);
    player.goldBalance = Number(balance || 0);
    localStorage.setItem('mythosPlayerData', JSON.stringify(player));
  }
}

function toggleMailKeep(mailId) {
  if (!currentPersonalCode || !mailId) return;

  const url =
    API_URL
    + '?action=toggleMailKeep'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode)
    + '&mailId=' + encodeURIComponent(mailId);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        alert(data.message || '보관 상태를 변경하지 못했습니다.');

        const mail = currentMailCache.find(item => String(item.mailId) === String(mailId));
        if (mail) {
          mail.isKept = !mail.isKept;
          renderMailDetail(mail);
        }

        return;
      }
    })
    .catch(error => {
      console.error(error);
      alert('보관 처리 중 오류가 발생했습니다.');
    });
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

let selectedMailReceiverName = '';
let mailReceiverSearchSeq = 0;
let mailReceiverSearchTimer = null;

function openMailWriteModal() {
  const modal = document.getElementById('mail-write-modal');
  if (!modal) return;

  document.getElementById('mail-write-receiver-name').value = '';
  document.getElementById('mail-write-title').value = '';
  document.getElementById('mail-write-content').value = '';
  updateMailWriteCount();

  selectedMailReceiverName = '';

  const candidates = document.getElementById('mail-receiver-candidates');
  if (candidates) candidates.innerHTML = '';

  modal.style.display = 'flex';
}

function closeMailWriteModal() {
  const modal = document.getElementById('mail-write-modal');
  if (!modal) return;

  modal.style.display = 'none';
}

function searchMailReceiverCandidates() {
  const input = document.getElementById('mail-write-receiver-name');
  const candidates = document.getElementById('mail-receiver-candidates');

  if (!input || !candidates) return;

  const keyword = input.value.trim();
  selectedMailReceiverName = '';

  mailReceiverSearchSeq++;

  if (mailReceiverSearchTimer) {
    clearTimeout(mailReceiverSearchTimer);
  }

  if (keyword.length < 2) {
    candidates.innerHTML = '<div class="mail-receiver-hint">2글자 이상 입력하면 후보가 표시됩니다.</div>';
    return;
  }

  candidates.innerHTML = '<div class="mail-receiver-hint">입력을 멈추면 검색합니다.</div>';

  mailReceiverSearchTimer = setTimeout(function () {
    const searchSeq = mailReceiverSearchSeq;

    candidates.innerHTML = '<div class="mail-receiver-hint">검색 중...</div>';

    const url =
      API_URL
      + '?action=searchMailReceivers'
      + '&keyword=' + encodeURIComponent(keyword);

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (searchSeq !== mailReceiverSearchSeq) return;

        if (!data.success) {
          candidates.innerHTML = '<div class="mail-receiver-hint">검색에 실패했습니다.</div>';
          return;
        }

        if (!data.receivers || !data.receivers.length) {
          candidates.innerHTML = '<div class="mail-receiver-hint">일치하는 캐릭터가 없습니다.</div>';
          return;
        }

        candidates.innerHTML = data.receivers.map(receiver => {
          return `
            <button
              type="button"
              class="mail-receiver-candidate"
              onclick="selectMailReceiver('${escapeForAttribute(receiver.characterName)}')"
            >
              ${escapeHtml(receiver.characterName)}
            </button>
          `;
        }).join('');
      })
      .catch(error => {
        if (searchSeq !== mailReceiverSearchSeq) return;

        console.error(error);
        candidates.innerHTML = '<div class="mail-receiver-hint">검색 중 오류가 발생했습니다.</div>';
      });
  }, 350);
}

function selectMailReceiver(characterName) {
  const input = document.getElementById('mail-write-receiver-name');
  const candidates = document.getElementById('mail-receiver-candidates');

  selectedMailReceiverName = characterName;

  if (input) input.value = characterName;
  if (candidates) candidates.innerHTML = '<div class="mail-receiver-selected">선택됨 : ' + escapeHtml(characterName) + '</div>';
}

function updateMailWriteCount() {
  const content = document.getElementById('mail-write-content');
  const count = document.getElementById('mail-write-count-current');

  if (!content || !count) return;

  count.textContent = String(content.value.length);
}

function sendUserLetter() {
  if (!currentPersonalCode) {
    openAlertModal('발송 불가', '로그인 후 서신을 보낼 수 있습니다.');
    return;
  }

  const receiverName = document.getElementById('mail-write-receiver-name').value.trim();
  const title = document.getElementById('mail-write-title').value.trim();
  const content = document.getElementById('mail-write-content').value.trim();
  const sendBtn = document.getElementById('mail-write-send-btn');

  if (!receiverName) {
  openAlertModal('입력 필요', '받는 사람 캐릭터명을 입력해주세요.');
  return;
}

  if (!title) {
    openAlertModal('입력 필요', '제목을 입력해주세요.');
    return;
  }

  if (!content) {
    openAlertModal('입력 필요', '내용을 입력해주세요.');
    return;
  }

  if (sendBtn) {
    sendBtn.textContent = '발송 중...';
    sendBtn.disabled = true;
  }

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'sendUserLetter',
      senderCode: currentPersonalCode,
      receiverName: receiverName,
      title: title,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => {
      if (sendBtn) {
        sendBtn.textContent = '발송';
        sendBtn.disabled = false;
      }

      if (!data.success) {
        openAlertModal('발송 실패', data.message || '서신을 발송하지 못했습니다.');
        return;
      }

      closeMailWriteModal();
      openAlertModal('발송 완료', '서신을 발송했습니다.');
    })
    .catch(error => {
      console.error(error);

      if (sendBtn) {
        sendBtn.textContent = '발송';
        sendBtn.disabled = false;
      }

      openAlertModal('발송 오류', '서신 발송 중 오류가 발생했습니다.');
    });
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
    '보유 재화 : ' + Number(player.goldBalance || 0) + '골드';

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