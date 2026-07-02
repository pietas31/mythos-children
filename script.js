const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';
let CURRENT_VERSION = 'v21';

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
let currentLetterMode = 'basic';
let currentAnonymousLetterForced = false;
let letterPaperStatusCache = null;
let letterPaperStatusCacheAt = 0;
const LETTER_PAPER_CACHE_TTL = 30000;
let userSettingsCache = null;
let isSavingUserSettings = false;
let userSettingsSaveTimer = null;
let userSettingsSaveSeq = 0;
let isMemoLoading = false;
let isMemoSaving = false;
let isInventoryLoading = false;
let currentInventoryAllItems = [];
let currentInventoryItems = [];
let currentInventorySlotItems = [];
let currentInventorySelectedIndex = -1;
let currentInventoryTab = 'all';
let currentInventoryPage = 1;
let draggedInventorySlotIndex = -1;
let shouldReturnToInventoryAfterMailWrite = false;
let inventoryCache = null;
let inventoryCacheAt = 0;
const INVENTORY_CACHE_TTL = 30000;
const INVENTORY_SLOT_COUNT = 40;
let currentMemoTab = 'all';
let currentMemoPage = 1;
let currentMemoRenderCache = [];
const MEMO_PAGE_SIZE = 5;
const SERVER_MEMO_CACHE_TTL = 30000;
let currentMemoDetailPages = [];
let currentMemoDetailPage = 1;
let currentMemoDetailMemoIndex = -1;
const MEMO_DETAIL_LEFT_LENGTH = 293;
const MEMO_DETAIL_RIGHT_LENGTH = 390;
let currentMemoDetailBaseMeta = '';
let currentMemoEditIndex = -1;
let currentMemoEditId = '';
let currentInvestigationNodeId = 'trial-start';
let investigationHistory = [];
let investigationState = null;
const MYTHOS_ERA_YEAR_BY_STAGE = {
  1: 1412,
  2: 1418,
  3: 1424
};

console.log('MYTHOS READY v21');

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

  loadMailList({ keepCurrent: hasLoadedMailOnce && currentMailCache.length });
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

function loadMailList(options) {
  if (!currentPersonalCode) return;

  const keepCurrent = !!(options && options.keepCurrent);
  const list = document.getElementById('mail-list');
  if (list && !keepCurrent) {
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
      <div class="mail-item ${readClass}${selectClass}${disabledClass} ${getMailTypeClass(mail.mailType)}" onclick="handleMailItemClick(${Number(mail.detailIndex || 0)}, '${escapeForAttribute(mail.mailId)}')">
        ${
          currentMailSelectionMode
            ? `<span class="mail-select-box">${selected ? '✓' : ''}</span>`
            : mail.mailType === 'SUPPLY'
              ? `<span class="mail-keep-mark is-empty"></span>`
              : `<button type="button" class="mail-keep-mark ${mail.isKept ? 'active' : ''}" onclick="toggleMailKeepFromList(event, '${escapeForAttribute(mail.mailId)}')">${keepMark}</button>`
        }
        ${iconPath ? `<img class="mail-icon" src="${iconPath}" alt="">` : ''}
        <span class="mail-type-badge">${typeLabel}</span>
        <span class="mail-title">${escapeHtml(mail.title || '제목 없음')}</span>
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

function toggleMailKeepFromList(event, mailId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const mail = currentMailCache.find(item => String(item.mailId) === String(mailId));
  if (!mail) return;

  mail.isKept = !mail.isKept;
  renderMailList(currentMailCache);
  toggleMailKeep(mailId, { fromList: true });
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
      const itemText = mail.itemDataDisplay
  ? escapeHtml(mail.itemDataDisplay)
  : mail.itemData
    ? escapeHtml(formatSupplyItemText(mail.itemData))
    : '없음';
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
  return formatMythosDateTime(value);
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
  openLetterPaperSelectModal();
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

function formatSupplyItemText(itemData) {
  if (!itemData) return '없음';

  return String(itemData)
    .split(',')
    .map(part => {
      const split = part.split(':');
      const itemId = String(split[0] || '').trim();
      const quantity = Number(split[1] || 1);

      return itemId + ' x' + quantity;
    })
    .join(', ');
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

function toggleMailKeep(mailId, options) {
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
          if (options && options.fromList) {
            renderMailList(currentMailCache);
          } else {
            renderMailDetail(mail);
          }
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
    })
    .catch(error => console.error(error));
}

let selectedMailReceiverName = '';
let mailReceiverSearchSeq = 0;
let mailReceiverSearchTimer = null;

let selectedSupplyItemId = '';
let selectedSupplyItemName = '';
let selectedSupplyItems = [];
let supplyItemSearchSeq = 0;
let supplyItemSearchTimer = null;

let selectedSupplyReceiverName = '';
let supplyReceiverSearchSeq = 0;
let supplyReceiverSearchTimer = null;

function openMailWriteModal(mode, options) {
  const modal = document.getElementById('mail-write-modal');
  if (!modal) return;

  currentLetterMode = mode || 'basic';
  currentAnonymousLetterForced = !!(options && options.forceAnonymous);

  document.getElementById('mail-write-receiver-name').value = '';
  document.getElementById('mail-write-title').value = '';
  document.getElementById('mail-write-content').value = '';

  const anonymousInput = document.getElementById('mail-write-anonymous');
  const anonymousOption = document.querySelector('.mail-anonymous-option');
  const canUseAnonymous = currentLetterMode === 'basic';

  if (anonymousInput) {
    anonymousInput.checked = currentAnonymousLetterForced;
    anonymousInput.disabled = currentAnonymousLetterForced;
  }

  if (anonymousOption) {
    anonymousOption.style.display = canUseAnonymous ? 'flex' : 'none';
  }

  selectedMailReceiverName = '';

  const candidates = document.getElementById('mail-receiver-candidates');
  if (candidates) candidates.innerHTML = '';

  updateMailWriteLimit();
  updateMailWriteCount();

  modal.style.display = 'flex';
}

function openLetterPaperSelectModal() {
  if (!currentPersonalCode) {
    openAlertModal('작성 불가', '로그인 후 서신을 작성할 수 있습니다.');
    return;
  }

  const cachedStatus = getCachedLetterPaperStatus();
  if (cachedStatus) {
    handleLetterPaperStatus(cachedStatus);
    return;
  }

  const url =
    API_URL
    + '?action=getLetterPaperStatus'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        openAlertModal('확인 실패', data.message || '편지지 보유량을 확인하지 못했습니다.');
        return;
      }

      setCachedLetterPaperStatus(data);
      handleLetterPaperStatus(data);
    })
    .catch(error => {
      console.error(error);
      openAlertModal('확인 오류', '편지지 보유량 확인 중 오류가 발생했습니다.');
    });
}

function getCachedLetterPaperStatus() {
  if (!letterPaperStatusCache) return null;
  if (Date.now() - letterPaperStatusCacheAt > LETTER_PAPER_CACHE_TTL) return null;

  return letterPaperStatusCache;
}

function setCachedLetterPaperStatus(data) {
  letterPaperStatusCache = {
    basicCount: Number(data.basicCount || 0),
    premiumCount: Number(data.premiumCount || 0),
    anonymousCount: Number(data.anonymousCount || 0)
  };
  letterPaperStatusCacheAt = Date.now();
}

function invalidateLetterPaperStatusCache() {
  letterPaperStatusCache = null;
  letterPaperStatusCacheAt = 0;
}

function prefetchLetterPaperStatus() {
  if (!currentPersonalCode || getCachedLetterPaperStatus()) return;

  const url =
    API_URL
    + '?action=getLetterPaperStatus'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.success) setCachedLetterPaperStatus(data);
    })
    .catch(error => console.warn('편지지 보유량 사전 확인 실패:', error));
}

function handleLetterPaperStatus(data) {
  const basicCount = Number(data.basicCount || 0);
  const premiumCount = Number(data.premiumCount || 0);
  const anonymousCount = Number(data.anonymousCount || 0);
  const canWriteBasic = basicCount > 0 || anonymousCount > 0;
  const availableTypeCount =
    (canWriteBasic ? 1 : 0)
    + (premiumCount > 0 ? 1 : 0);

  if (availableTypeCount <= 0) {
    openAlertModal('작성 불가', '보유한 편지지가 없어 서신을 작성할 수 없습니다.');
    return;
  }

  if (availableTypeCount === 1 && canWriteBasic) {
    openMailWriteModal('basic', { forceAnonymous: basicCount <= 0 && anonymousCount > 0 });
    return;
  }

  if (availableTypeCount === 1 && premiumCount > 0) {
    openMailWriteModal('premium');
    return;
  }

  openLetterPaperModal(basicCount, premiumCount, anonymousCount);
}

function openLetterPaperModal(basicCount, premiumCount, anonymousCount) {
  const modal = document.getElementById('letter-paper-modal');
  const basicText = document.getElementById('basic-paper-count');
  const premiumText = document.getElementById('premium-paper-count');
  const basicBtn = document.getElementById('basic-paper-btn');
  const premiumBtn = document.getElementById('premium-paper-btn');

  if (!modal) return;

  if (basicText) {
    basicText.textContent =
      '보유 ' + Number(basicCount || 0) + '개'
      + (Number(anonymousCount || 0) > 0 ? ' · 익명 ' + Number(anonymousCount || 0) + '개' : '');
  }
  if (premiumText) premiumText.textContent = '보유 ' + Number(premiumCount || 0) + '개';
  if (basicBtn) basicBtn.style.display = (Number(basicCount || 0) > 0 || Number(anonymousCount || 0) > 0) ? 'block' : 'none';
  if (premiumBtn) premiumBtn.style.display = Number(premiumCount || 0) > 0 ? 'block' : 'none';

  modal.style.display = 'flex';
}

function closeLetterPaperModal() {
  const modal = document.getElementById('letter-paper-modal');
  if (!modal) return;

  modal.style.display = 'none';
}

function chooseLetterPaper(mode) {
  closeLetterPaperModal();
  if (mode === 'basic') {
    const cachedStatus = getCachedLetterPaperStatus();
    const basicCount = cachedStatus ? Number(cachedStatus.basicCount || 0) : 0;
    const anonymousCount = cachedStatus ? Number(cachedStatus.anonymousCount || 0) : 0;
    openMailWriteModal('basic', { forceAnonymous: basicCount <= 0 && anonymousCount > 0 });
    return;
  }

  openMailWriteModal(mode);
}

function updateMailWriteLimit() {
  const content = document.getElementById('mail-write-content');
  const maxText = document.getElementById('mail-write-count-max');

  const limit = currentLetterMode === 'premium' ? 1000 : 300;

  if (content) {
    content.maxLength = limit;
    content.placeholder = currentLetterMode === 'premium'
      ? '내용을 입력해주세요. (고급 서신, 최대 1000자)'
      : '내용을 입력해주세요. (일반 서신, 최대 300자)';
  }

  if (maxText) {
    maxText.textContent = String(limit);
  }
}

function sendSelectedLetter() {
  if (currentLetterMode === 'premium') {
    sendPremiumLetter();
    return;
  }

  sendUserLetter();
}

function closeMailWriteModal() {
  const modal = document.getElementById('mail-write-modal');
  if (!modal) return;

  modal.style.display = 'none';

  if (shouldReturnToInventoryAfterMailWrite) {
    shouldReturnToInventoryAfterMailWrite = false;
    openInventoryModal();
  }
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
  candidates.innerHTML =
    '<div class="mail-receiver-hint">검색 실패: ' +
    escapeHtml(data.message || '알 수 없는 오류') +
    '</div>';
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
  const maxText = document.getElementById('mail-write-count-max');

  if (!content || !count) return;

  const limit = currentLetterMode === 'premium' ? 1000 : 300;

  count.textContent = String(content.value.length);
  if (maxText) maxText.textContent = String(limit);
}

function sendUserLetter() {
  if (!currentPersonalCode) {
    openAlertModal('발송 불가', '로그인 후 서신을 보낼 수 있습니다.');
    return;
  }

  const receiverName = document.getElementById('mail-write-receiver-name').value.trim();
  const title = document.getElementById('mail-write-title').value.trim();
  const content = document.getElementById('mail-write-content').value.trim();
  const anonymousInput = document.getElementById('mail-write-anonymous');
  const isAnonymous = !!(anonymousInput && anonymousInput.checked);
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

  if (content.length > 300) {
    openAlertModal('입력 오류', '일반 서신 내용은 300자 이내로 작성해주세요.');
    return;
  }

  const cachedStatus = getCachedLetterPaperStatus();
  const anonymousCount = cachedStatus ? Number(cachedStatus.anonymousCount || 0) : 0;

  if (isAnonymous && !currentAnonymousLetterForced && anonymousCount <= 0) {
    openConfirmModal(
      '익명 편지지 없음',
      '익명 편지지가 없습니다.\n일반 편지지로 일반 서신을 발송하시겠습니까?',
      function () {
        sendUserLetterAfterConfirm(receiverName, title, content, false, sendBtn);
      }
    );
    return;
  }

  openConfirmModal(
    isAnonymous ? '익명 서신 발송' : '일반 서신 발송',
    receiverName
      + (isAnonymous
        ? '님에게 익명 서신을 발송하시겠습니까?\n익명 편지지 1개가 소모됩니다.'
        : '님에게 일반 서신을 발송하시겠습니까?\n일반 편지지 1개가 소모됩니다.'),
    function () {
      sendUserLetterAfterConfirm(receiverName, title, content, isAnonymous, sendBtn);
    }
  );
}

function sendUserLetterAfterConfirm(receiverName, title, content, isAnonymous, sendBtn) {
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
      content: content,
      isAnonymous: isAnonymous
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

      shouldReturnToInventoryAfterMailWrite = false;
      closeMailWriteModal();
      invalidateLetterPaperStatusCache();
      prefetchLetterPaperStatus();
      openAlertModal('발송 완료', isAnonymous ? '익명 서신을 발송했습니다.' : '일반 서신을 발송했습니다.');
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

function sendPremiumLetter() {
  if (!currentPersonalCode) {
    openAlertModal('발송 불가', '로그인 후 고급 서신을 보낼 수 있습니다.');
    return;
  }

  const receiverName = document.getElementById('mail-write-receiver-name').value.trim();
  const title = document.getElementById('mail-write-title').value.trim();
  const content = document.getElementById('mail-write-content').value.trim();
  const premiumBtn = document.getElementById('mail-write-send-btn');

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

  if (content.length > 1000) {
    openAlertModal('입력 오류', '고급 서신 내용은 1000자 이내로 작성해주세요.');
    return;
  }

  openConfirmModal(
    '고급 서신 발송',
    receiverName + '님에게 고급 서신을 발송하시겠습니까?\n고급 편지지 1개가 소모됩니다.',
    function () {
      sendPremiumLetterAfterConfirm(receiverName, title, content, premiumBtn);
    }
  );
}

function sendPremiumLetterAfterConfirm(receiverName, title, content, premiumBtn) {
  if (premiumBtn) {
    premiumBtn.textContent = '발송 중...';
    premiumBtn.disabled = true;
  }

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'sendPremiumLetter',
      senderCode: currentPersonalCode,
      receiverName: receiverName,
      title: title,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => {
      if (premiumBtn) {
        premiumBtn.textContent = '발송';
        premiumBtn.disabled = false;
      }

      if (!data.success) {
        openAlertModal('발송 실패', data.message || '고급 서신을 발송하지 못했습니다.');
        return;
      }

      shouldReturnToInventoryAfterMailWrite = false;
      closeMailWriteModal();
      invalidateLetterPaperStatusCache();
      prefetchLetterPaperStatus();
      openAlertModal('발송 완료', '고급 서신을 발송했습니다.');
    })
    .catch(error => {
      console.error(error);

      if (premiumBtn) {
        premiumBtn.textContent = '고급 발송';
        premiumBtn.disabled = false;
      }

      openAlertModal('발송 오류', '고급 서신 발송 중 오류가 발생했습니다.');
    });
}

function sendGmLetter() {
  if (!currentPersonalCode) {
    openAlertModal('발송 불가', '로그인 후 GM 우편을 보낼 수 있습니다.');
    return;
  }

  const receiverName = document.getElementById('mail-write-receiver-name').value.trim();
  const title = document.getElementById('mail-write-title').value.trim();
  const content = document.getElementById('mail-write-content').value.trim();
  const gmBtn = document.getElementById('mail-write-gm-btn');

  const isAllSend = receiverName === '전원';

  if (!isAllSend && !receiverName) {
    openAlertModal('입력 필요', '받는 사람 캐릭터명을 입력하거나, 전원 발송은 받는 사람에 전원을 입력해주세요.');
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

  openConfirmModal(
    isAllSend ? 'GM 전원 발송' : 'GM 우편 발송',
    isAllSend
      ? 'GM 우편을 전원에게 발송하시겠습니까?'
      : receiverName + '님에게 GM 우편을 발송하시겠습니까?',
    function () {
      sendGmLetterAfterConfirm(isAllSend, receiverName, title, content, gmBtn);
    }
  );
}

function sendGmLetterAfterConfirm(isAllSend, receiverName, title, content, gmBtn) {
  if (gmBtn) {
    gmBtn.textContent = 'GM 발송 중...';
    gmBtn.disabled = true;
  }

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'sendGmLetter',
      senderCode: currentPersonalCode,
      mode: isAllSend ? 'all' : 'single',
      receiverName: isAllSend ? '' : receiverName,
      title: title,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => {
      if (gmBtn) {
        gmBtn.textContent = 'GM 발송';
        gmBtn.disabled = false;
      }

      if (!data.success) {
        openAlertModal('GM 발송 실패', data.message || 'GM 우편을 발송하지 못했습니다.');
        return;
      }

      closeMailWriteModal();

      openAlertModal(
        'GM 발송 완료',
        'GM 우편을 발송했습니다.\n발송 수: ' + Number(data.sentCount || 0)
      );
    })
    .catch(error => {
      console.error(error);

      if (gmBtn) {
        gmBtn.textContent = 'GM 발송';
        gmBtn.disabled = false;
      }

      openAlertModal('GM 발송 오류', 'GM 우편 발송 중 오류가 발생했습니다.');
    });
}

function getMailTypeLabel(type) {
  if (type === 'SUPPLY') return '보급';
  if (type === 'PREMIUM') return '서신';
  if (type === 'GM') return 'GM';
  if (type === 'ANON') return '서신';
  return '서신';
}

function getMailTypeClass(type) {
  if (type === 'SUPPLY') return 'type-supply';
  if (type === 'PREMIUM') return 'type-premium';
  if (type === 'GM') return 'type-gm';
  return 'type-letter';
}

function openAdminGmWrite() {
  openMailWriteModal();
}

function openAdminSupplyWrite() {
  const modal = document.getElementById('supply-write-modal');
  if (!modal) return;

  const receiver = document.getElementById('supply-receiver-name');
  const title = document.getElementById('supply-title');
  const content = document.getElementById('supply-content');
  const gold = document.getElementById('supply-gold');
  const item = document.getElementById('supply-item');
const itemQuantity = document.getElementById('supply-item-quantity');

  if (receiver) receiver.value = '';
  if (title) title.value = '';
  if (content) content.value = '';
  if (gold) gold.value = '';
  if (item) item.value = '';
if (itemQuantity) itemQuantity.value = '';

  const itemSearch = document.getElementById('supply-item-search');
  const itemCandidates = document.getElementById('supply-item-candidates');

  selectedSupplyItemId = '';
  selectedSupplyItemName = '';
  selectedSupplyItems = [];

  if (itemSearch) itemSearch.value = '';
  if (itemCandidates) itemCandidates.innerHTML = '';
  renderSupplyAttachmentList();

  const receiverCandidates = document.getElementById('supply-receiver-candidates');

  selectedSupplyReceiverName = '';

  if (receiverCandidates) receiverCandidates.innerHTML = '';

  modal.style.display = 'flex';
}

function closeSupplyWriteModal() {
  const modal = document.getElementById('supply-write-modal');
  if (!modal) return;

  modal.style.display = 'none';
}

function searchSupplyReceiverCandidates() {
  const input = document.getElementById('supply-receiver-name');
  const candidates = document.getElementById('supply-receiver-candidates');

  if (!input || !candidates) return;

  const keyword = input.value.trim();
  selectedSupplyReceiverName = '';

  supplyReceiverSearchSeq++;

  if (supplyReceiverSearchTimer) {
    clearTimeout(supplyReceiverSearchTimer);
  }

  if (keyword === '전원') {
    candidates.innerHTML = '<div class="mail-receiver-selected">전원 발송으로 선택됨</div>';
    return;
  }

  if (keyword.length < 2) {
    candidates.innerHTML = '<div class="mail-receiver-hint">2글자 이상 입력하면 후보가 표시됩니다.</div>';
    return;
  }

  candidates.innerHTML = '<div class="mail-receiver-hint">입력을 멈추면 검색합니다.</div>';

  supplyReceiverSearchTimer = setTimeout(function () {
    const searchSeq = supplyReceiverSearchSeq;

    candidates.innerHTML = '<div class="mail-receiver-hint">검색 중...</div>';

    const url =
      API_URL
      + '?action=searchMailReceivers'
      + '&keyword=' + encodeURIComponent(keyword);

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (searchSeq !== supplyReceiverSearchSeq) return;

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
              onclick="selectSupplyReceiver('${escapeForAttribute(receiver.characterName)}')"
            >
              ${escapeHtml(receiver.characterName)}
            </button>
          `;
        }).join('');
      })
      .catch(error => {
        if (searchSeq !== supplyReceiverSearchSeq) return;

        console.error(error);
        candidates.innerHTML = '<div class="mail-receiver-hint">검색 중 오류가 발생했습니다.</div>';
      });
  }, 350);
}

function selectSupplyReceiver(characterName) {
  const input = document.getElementById('supply-receiver-name');
  const candidates = document.getElementById('supply-receiver-candidates');

  selectedSupplyReceiverName = characterName;

  if (input) input.value = characterName;
  if (candidates) candidates.innerHTML = '<div class="mail-receiver-selected">선택됨 : ' + escapeHtml(characterName) + '</div>';
}

function searchSupplyItemCandidates() {
  const input = document.getElementById('supply-item-search');
  const candidates = document.getElementById('supply-item-candidates');
  const itemInput = document.getElementById('supply-item');

  if (!input || !candidates || !itemInput) return;

  const keyword = input.value.trim();
  selectedSupplyItemId = '';
  selectedSupplyItemName = '';

  supplyItemSearchSeq++;

  if (supplyItemSearchTimer) {
    clearTimeout(supplyItemSearchTimer);
  }

  if (keyword.length < 1) {
    candidates.innerHTML = '<div class="mail-receiver-hint">아이템명을 입력하면 후보가 표시됩니다.</div>';
    return;
  }

  candidates.innerHTML = '<div class="mail-receiver-hint">입력을 멈추면 검색합니다.</div>';

  supplyItemSearchTimer = setTimeout(function () {
    const searchSeq = supplyItemSearchSeq;

    candidates.innerHTML = '<div class="mail-receiver-hint">검색 중...</div>';

    const url =
      API_URL
      + '?action=searchSupplyItems'
      + '&senderCode=' + encodeURIComponent(currentPersonalCode)
      + '&keyword=' + encodeURIComponent(keyword);

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (searchSeq !== supplyItemSearchSeq) return;

        if (!data.success) {
  candidates.innerHTML =
    '<div class="mail-receiver-hint">검색 실패: ' +
    escapeHtml(data.message || '알 수 없는 오류') +
    '</div>';
  return;
}

        if (!data.items || !data.items.length) {
          candidates.innerHTML = '<div class="mail-receiver-hint">일치하는 아이템이 없습니다.</div>';
          return;
        }

        candidates.innerHTML = data.items.map(item => {
          return `
            <button
              type="button"
              class="mail-receiver-candidate"
              onclick="selectSupplyItem('${escapeForAttribute(item.itemId)}', '${escapeForAttribute(item.itemName)}')"
            >
              ${escapeHtml(item.itemName)} <span style="opacity:.65;">${escapeHtml(item.itemId)}</span>
            </button>
          `;
        }).join('');
      })
      .catch(error => {
        if (searchSeq !== supplyItemSearchSeq) return;

        console.error(error);
        candidates.innerHTML = '<div class="mail-receiver-hint">검색 중 오류가 발생했습니다.</div>';
      });
  }, 350);
}

function selectSupplyItem(itemId, itemName) {
  const searchInput = document.getElementById('supply-item-search');
  const itemInput = document.getElementById('supply-item');
  const candidates = document.getElementById('supply-item-candidates');

  selectedSupplyItemId = itemId;
  selectedSupplyItemName = itemName;

  if (searchInput) searchInput.value = itemName;
  if (itemInput) itemInput.value = itemId;
  if (candidates) {
    candidates.innerHTML =
      '<div class="mail-receiver-selected">선택됨 : ' +
      escapeHtml(itemName) +
      ' / ' +
      escapeHtml(itemId) +
      '</div>';
  }
}

function addSupplyItemAttachment() {
  const quantityInput = document.getElementById('supply-item-quantity');
  const searchInput = document.getElementById('supply-item-search');
  const itemInput = document.getElementById('supply-item');
  const candidates = document.getElementById('supply-item-candidates');
  const quantity = Math.max(1, Number(quantityInput ? quantityInput.value || 1 : 1));

  if (!selectedSupplyItemId) {
    openAlertModal('첨부 불가', '첨부할 아이템을 먼저 선택해주세요.');
    return;
  }

  const existing = selectedSupplyItems.find(item => item.itemId === selectedSupplyItemId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    selectedSupplyItems.push({
      itemId: selectedSupplyItemId,
      itemName: selectedSupplyItemName || selectedSupplyItemId,
      quantity: quantity
    });
  }

  selectedSupplyItemId = '';
  selectedSupplyItemName = '';

  if (searchInput) searchInput.value = '';
  if (itemInput) itemInput.value = '';
  if (quantityInput) quantityInput.value = '';
  if (candidates) candidates.innerHTML = '';

  renderSupplyAttachmentList();
}

function removeSupplyItemAttachment(index) {
  selectedSupplyItems.splice(index, 1);
  renderSupplyAttachmentList();
}

function renderSupplyAttachmentList() {
  const list = document.getElementById('supply-attachment-list');
  if (!list) return;

  if (!selectedSupplyItems.length) {
    list.innerHTML = '<div class="supply-attachment-empty">첨부된 아이템이 없습니다.</div>';
    return;
  }

  list.innerHTML = selectedSupplyItems.map((item, index) => {
    return `
      <div class="supply-attachment-chip">
        <span>${escapeHtml(item.itemName)} x${Number(item.quantity || 1)}</span>
        <button type="button" onclick="removeSupplyItemAttachment(${index})">×</button>
      </div>
    `;
  }).join('');
}

function getSupplyItemDataForSend() {
  return selectedSupplyItems
    .filter(item => item.itemId && Number(item.quantity || 0) > 0)
    .map(item => item.itemId + ':' + Math.max(1, Number(item.quantity || 1)))
    .join(',');
}

function sendSupplyMail() {
  if (!currentPersonalCode) {
    openAlertModal('발송 불가', '로그인 후 보급 우편을 보낼 수 있습니다.');
    return;
  }

  const receiverName = document.getElementById('supply-receiver-name').value.trim();
  const title = document.getElementById('supply-title').value.trim();
  const content = document.getElementById('supply-content').value.trim();
  const goldAmount = Number(document.getElementById('supply-gold').value || 0);
  const itemData = getSupplyItemDataForSend();
  const sendBtn = document.getElementById('supply-send-btn');

  const isAllSend = receiverName === '전원';

  if (!isAllSend && !receiverName) {
    openAlertModal('입력 필요', '받는 사람 캐릭터명을 입력하거나, 전원 발송은 받는 사람에 전원을 입력해주세요.');
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

  if (title.length > 40) {
    openAlertModal('입력 오류', '제목은 40자 이내로 입력해주세요.');
    return;
  }

  if (goldAmount < 0) {
    openAlertModal('입력 오류', '골드는 0 이상으로 입력해주세요.');
    return;
  }

  if (goldAmount <= 0 && !itemData) {
    openAlertModal('입력 필요', '지급할 골드 또는 아이템을 입력해주세요.');
    return;
  }

  openConfirmModal(
    isAllSend ? '보급 전원 발송' : '보급 우편 발송',
    isAllSend
      ? '보급 우편을 전원에게 발송하시겠습니까?'
      : receiverName + '님에게 보급 우편을 발송하시겠습니까?',
    function () {
      sendSupplyMailAfterConfirm(
        isAllSend,
        receiverName,
        title,
        content,
        goldAmount,
        itemData,
        sendBtn
      );
    }
  );
}

function sendSupplyMailAfterConfirm(isAllSend, receiverName, title, content, goldAmount, itemData, sendBtn) {
  if (sendBtn) {
    sendBtn.textContent = '보급 발송 중...';
    sendBtn.disabled = true;
  }

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'sendSupplyMail',
      senderCode: currentPersonalCode,
      mode: isAllSend ? 'all' : 'single',
      receiverName: isAllSend ? '' : receiverName,
      title: title,
      content: content,
      goldAmount: goldAmount,
      itemData: itemData
    })
  })
    .then(response => response.json())
    .then(data => {
      if (sendBtn) {
        sendBtn.textContent = '보급 발송';
        sendBtn.disabled = false;
      }

      if (!data.success) {
        openAlertModal('보급 발송 실패', data.message || '보급 우편을 발송하지 못했습니다.');
        return;
      }

      closeSupplyWriteModal();

      openAlertModal(
        '보급 발송 완료',
        '보급 우편을 발송했습니다.\n발송 수: ' + Number(data.sentCount || 0)
      );
    })
    .catch(error => {
      console.error(error);

      if (sendBtn) {
        sendBtn.textContent = '보급 발송';
        sendBtn.disabled = false;
      }

      openAlertModal('보급 발송 오류', '보급 우편 발송 중 오류가 발생했습니다.');
    });
}

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  loadUserSettings();
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function applyUserSettings(settings) {
  const anonymousInput = document.getElementById('setting-anonymous-receive');
  const anonymousState = document.getElementById('setting-anonymous-receive-state');
  const safeSettings = settings || {};

  userSettingsCache = {
    anonymousReceive: safeSettings.anonymousReceive !== false
  };

  if (anonymousInput) anonymousInput.checked = userSettingsCache.anonymousReceive;
  if (anonymousState) anonymousState.textContent = userSettingsCache.anonymousReceive ? 'ON' : 'OFF';
}

function loadUserSettings() {
  if (!currentPersonalCode) {
    applyUserSettings({ anonymousReceive: true });
    return;
  }

  const url =
    API_URL
    + '?action=getUserSettings'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        applyUserSettings(data.settings);
        return;
      }

      applyUserSettings({ anonymousReceive: true });
    })
    .catch(error => {
      console.error(error);
      applyUserSettings({ anonymousReceive: true });
    });
}

function saveUserSettings() {
  if (!currentPersonalCode) return;

  const anonymousInput = document.getElementById('setting-anonymous-receive');
  const anonymousState = document.getElementById('setting-anonymous-receive-state');
  const anonymousReceive = anonymousInput ? anonymousInput.checked : true;
  const saveSeq = ++userSettingsSaveSeq;

  userSettingsCache = { anonymousReceive: anonymousReceive };
  if (anonymousState) anonymousState.textContent = anonymousReceive ? 'ON' : 'OFF';

  if (userSettingsSaveTimer) {
    clearTimeout(userSettingsSaveTimer);
  }

  userSettingsSaveTimer = setTimeout(function () {
    isSavingUserSettings = true;

    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveUserSettings',
        personalCode: currentPersonalCode,
        anonymousReceive: anonymousReceive
      })
    })
      .then(response => response.json())
      .then(data => {
        if (saveSeq !== userSettingsSaveSeq) return;

        if (!data.success) {
          openAlertModal('설정 저장 실패', data.message || '설정을 저장하지 못했습니다.');
          loadUserSettings();
        }
      })
      .catch(error => {
        if (saveSeq !== userSettingsSaveSeq) return;

        console.error(error);
        openAlertModal('설정 저장 오류', '설정 저장 중 오류가 발생했습니다.');
        loadUserSettings();
      })
      .finally(() => {
        if (saveSeq === userSettingsSaveSeq) {
          isSavingUserSettings = false;
        }
      });
  }, 250);
}

function openInventoryModal() {
  if (!currentPersonalCode) {
    openAlertModal('확인 불가', '로그인 후 인벤토리를 확인할 수 있습니다.');
    return;
  }

  const modal = document.getElementById('inventory-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  currentInventoryTab = 'all';
  updateInventoryTabs();

  if (isInventoryCacheFresh()) {
    renderInventory(inventoryCache);
  } else {
    renderInventoryLoading();
  }

  loadInventoryItems();
}

function closeInventoryModal() {
  const modal = document.getElementById('inventory-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function isInventoryCacheFresh() {
  return Array.isArray(inventoryCache)
    && Date.now() - inventoryCacheAt < INVENTORY_CACHE_TTL;
}

function setInventoryCache(items) {
  inventoryCache = Array.isArray(items) ? items : [];
  inventoryCacheAt = Date.now();
}

function getInventoryOrderStorageKey(tab) {
  return 'mythosInventoryOrder:' + (currentPersonalCode || 'guest') + ':' + (tab || currentInventoryTab || 'all');
}

function getInventoryItemKey(item) {
  return String((item && item.itemId) || '').trim();
}

function loadInventoryOrder(tab) {
  try {
    const raw = localStorage.getItem(getInventoryOrderStorageKey(tab));
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveInventoryOrder(tab, slotItems) {
  const order = (slotItems || []).map(item => item ? getInventoryItemKey(item) : '');
  localStorage.setItem(getInventoryOrderStorageKey(tab), JSON.stringify(order));
}

function arrangeInventorySlots(items) {
  const sourceItems = Array.isArray(items) ? items : [];
  const itemMap = {};

  sourceItems.forEach(item => {
    const key = getInventoryItemKey(item);
    if (key) itemMap[key] = item;
  });

  const usedKeys = {};
  const savedOrder = loadInventoryOrder(currentInventoryTab);
  const minimumSlots = Math.max(INVENTORY_SLOT_COUNT, Math.ceil(sourceItems.length / INVENTORY_SLOT_COUNT) * INVENTORY_SLOT_COUNT);
  const slots = new Array(Math.max(minimumSlots, savedOrder.length)).fill(null);

  savedOrder.forEach((key, index) => {
    if (!key || !itemMap[key] || usedKeys[key]) return;
    slots[index] = itemMap[key];
    usedKeys[key] = true;
  });

  sourceItems.forEach(item => {
    const key = getInventoryItemKey(item);
    if (!key || usedKeys[key]) return;

    let emptyIndex = slots.findIndex(slot => !slot);
    if (emptyIndex < 0) {
      emptyIndex = slots.length;
      slots.push(null);
    }

    slots[emptyIndex] = item;
    usedKeys[key] = true;
  });

  while (slots.length % INVENTORY_SLOT_COUNT !== 0) {
    slots.push(null);
  }

  return slots;
}

function renderInventoryLoading() {
  const grid = document.getElementById('inventory-grid');
  const detail = document.getElementById('inventory-detail');
  const count = document.getElementById('inventory-count');

  currentInventoryItems = [];
  currentInventoryAllItems = [];
  currentInventorySlotItems = [];
  currentInventorySelectedIndex = -1;
  currentInventoryPage = 1;

  if (count) count.textContent = '0 / ' + INVENTORY_SLOT_COUNT;
  if (grid) grid.innerHTML = '<div class="inventory-empty">인벤토리를 불러오는 중입니다.</div>';
  if (detail) detail.innerHTML = '<div class="inventory-detail-empty">아이템을 선택해주세요.</div>';
}

function loadInventoryItems() {
  if (isInventoryLoading || !currentPersonalCode) return;

  isInventoryLoading = true;

  const url =
    API_URL
    + '?action=getInventory'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success || !Array.isArray(data.items)) {
        renderInventoryError(data.message || '인벤토리를 불러오지 못했습니다.');
        return;
      }

      setInventoryCache(data.items);
      renderInventory(data.items);
    })
    .catch(error => {
      console.error(error);
      renderInventoryError('인벤토리 조회 중 오류가 발생했습니다.');
    })
    .finally(() => {
      isInventoryLoading = false;
    });
}

function renderInventoryError(message) {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="inventory-empty">' + escapeHtml(message) + '</div>';
}

function renderInventory(items) {
  const grid = document.getElementById('inventory-grid');
  const detail = document.getElementById('inventory-detail');
  const count = document.getElementById('inventory-count');
  const allItems = Array.isArray(items) ? items.filter(item => Number(item.quantity || 0) > 0) : [];
  const visibleItems = getVisibleInventoryItems(allItems);
  const slotItems = arrangeInventorySlots(visibleItems);
  const totalPages = Math.max(1, Math.ceil(slotItems.length / INVENTORY_SLOT_COUNT));

  if (currentInventoryPage > totalPages) currentInventoryPage = totalPages;
  if (currentInventoryPage < 1) currentInventoryPage = 1;

  const startIndex = (currentInventoryPage - 1) * INVENTORY_SLOT_COUNT;
  const pageItems = slotItems.slice(startIndex, startIndex + INVENTORY_SLOT_COUNT);
  const firstFilledIndex = pageItems.findIndex(Boolean);

  currentInventoryAllItems = allItems;
  currentInventorySlotItems = slotItems;
  currentInventoryItems = pageItems;
  currentInventorySelectedIndex = firstFilledIndex >= 0 ? firstFilledIndex : -1;

  if (count) {
    count.innerHTML =
      '<span>' + visibleItems.length + ' / ' + allItems.length + '</span>'
      + '<span>' + currentInventoryPage + ' / ' + totalPages + '</span>';
  }

  if (grid) {
    const slots = [];

    for (let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
      const item = pageItems[i];
      const absoluteIndex = startIndex + i;

      if (!item) {
        slots.push(`
          <button
            type="button"
            class="inventory-slot is-empty"
            aria-label="빈 슬롯"
            ondragover="handleInventoryDragOver(event)"
            ondrop="dropInventorySlot(${absoluteIndex})"
          ></button>
        `);
        continue;
      }

      const icon = item.fileName ? 'assets/icons/' + item.fileName : '';
      const selectedClass = i === currentInventorySelectedIndex ? ' selected' : '';

      slots.push(`
        <button
          type="button"
          class="inventory-slot${selectedClass}"
          title="${escapeForAttribute(item.itemName || item.itemId)}"
          draggable="true"
          onclick="selectInventoryItem(${i})"
          oncontextmenu="selectInventoryItem(${i}); return false;"
          ondragstart="dragInventorySlot(event, ${absoluteIndex})"
          ondragover="handleInventoryDragOver(event)"
          ondrop="dropInventorySlot(${absoluteIndex})"
        >
          ${icon ? '<img src="' + escapeForAttribute(icon) + '" alt="" draggable="false" oncontextmenu="return false;">' : '<span class="inventory-slot-placeholder">' + escapeHtml(String(item.itemName || '?').slice(0, 1)) + '</span>'}
          <em>${Number(item.quantity || 0)}</em>
        </button>
      `);
    }

    grid.innerHTML = slots.join('');
  }

  if (detail) {
    if (currentInventorySelectedIndex >= 0) {
      renderInventoryDetail(pageItems[currentInventorySelectedIndex]);
    } else {
      detail.innerHTML = '<div class="inventory-detail-empty">보유 중인 아이템이 없습니다.</div>';
    }
  }

  renderInventoryPageControls(totalPages);
}

function renderInventoryPageControls(totalPages) {
  const controls = document.getElementById('inventory-page-controls');
  const pageText = document.getElementById('inventory-page-text');
  const prevBtn = document.getElementById('inventory-prev-btn');
  const nextBtn = document.getElementById('inventory-next-btn');

  if (!controls || !pageText || !prevBtn || !nextBtn) return;

  controls.style.display = totalPages > 1 ? 'flex' : 'none';
  pageText.textContent = currentInventoryPage + ' / ' + totalPages;
  prevBtn.disabled = currentInventoryPage <= 1;
  nextBtn.disabled = currentInventoryPage >= totalPages;
}

function goPrevInventoryPage() {
  if (currentInventoryPage <= 1) return;
  currentInventoryPage--;
  renderInventory(isInventoryCacheFresh() ? inventoryCache : currentInventoryAllItems);
}

function goNextInventoryPage() {
  const totalPages = Math.max(1, Math.ceil(currentInventorySlotItems.length / INVENTORY_SLOT_COUNT));
  if (currentInventoryPage >= totalPages) return;
  currentInventoryPage++;
  renderInventory(isInventoryCacheFresh() ? inventoryCache : currentInventoryAllItems);
}

function dragInventorySlot(event, absoluteIndex) {
  draggedInventorySlotIndex = Number(absoluteIndex);

  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggedInventorySlotIndex));
  }
}

function handleInventoryDragOver(event) {
  if (!event) return;
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function dropInventorySlot(absoluteIndex) {
  const fromIndex = Number(draggedInventorySlotIndex);
  const toIndex = Number(absoluteIndex);

  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  if (!currentInventorySlotItems[fromIndex]) return;

  const nextSlots = currentInventorySlotItems.slice();
  const movedItem = nextSlots[fromIndex];

  nextSlots[fromIndex] = nextSlots[toIndex] || null;
  nextSlots[toIndex] = movedItem;
  currentInventorySlotItems = nextSlots;
  draggedInventorySlotIndex = -1;

  saveInventoryOrder(currentInventoryTab, currentInventorySlotItems);
  renderInventory(currentInventoryAllItems);
}

function selectInventoryTab(tab) {
  currentInventoryTab = tab || 'all';
  currentInventoryPage = 1;
  updateInventoryTabs();
  renderInventory(isInventoryCacheFresh() ? inventoryCache : currentInventoryAllItems);
}

function updateInventoryTabs() {
  ['all', 'investigation', 'food', 'consumable', 'etc'].forEach(tab => {
    const button = document.getElementById('inventory-tab-' + tab);
    if (button) button.classList.toggle('active', currentInventoryTab === tab);
  });
}

function getVisibleInventoryItems(items) {
  if (currentInventoryTab === 'all') return items;
  return items.filter(item => item.category === currentInventoryTab);
}

function selectInventoryItem(index) {
  const safeIndex = Number(index);
  const item = currentInventoryItems[safeIndex];

  if (!item) return;

  currentInventorySelectedIndex = safeIndex;

  document.querySelectorAll('.inventory-slot').forEach((slot, slotIndex) => {
    slot.classList.toggle('selected', slotIndex === safeIndex);
  });

  renderInventoryDetail(item);
}

function renderInventoryDetail(item) {
  const detail = document.getElementById('inventory-detail');
  if (!detail || !item) return;

  const icon = item.fileName ? 'assets/icons/' + item.fileName : '';
  const usableText = item.isUsable ? '사용 가능' : '사용 불가';

  detail.innerHTML = `
    <div class="inventory-detail-head">
      <div class="inventory-detail-icon">
        ${icon ? '<img src="' + escapeForAttribute(icon) + '" alt="" draggable="false" oncontextmenu="return false;">' : '<span>' + escapeHtml(String(item.itemName || '?').slice(0, 1)) + '</span>'}
      </div>
      <div>
        <h3>${escapeHtml(item.itemName || item.itemId || '아이템')}</h3>
      </div>
    </div>
    <div class="inventory-detail-row"><span>수량</span><strong>${Number(item.quantity || 0)}</strong></div>
    <div class="inventory-detail-row"><span>사용 여부</span><strong>${usableText}</strong></div>
    <div class="inventory-detail-desc">${escapeHtml(item.description || '설명이 등록되지 않은 아이템입니다.')}</div>
    <button type="button" class="inventory-use-btn" onclick="useSelectedInventoryItem()" ${item.isUsable ? '' : 'disabled'}>사용하기</button>
  `;
}

function useSelectedInventoryItem() {
  const item = currentInventoryItems[currentInventorySelectedIndex];
  if (!item) return;

  const itemId = String(item.itemId || '').toUpperCase();
  const fileName = String(item.fileName || '').toLowerCase();
  const isAnonymousLetter = fileName.indexOf('letter-anonymous') !== -1 || itemId.indexOf('ANONYMOUS') !== -1;

  if (isAnonymousLetter || itemId.indexOf('LETTER') !== -1) {
    shouldReturnToInventoryAfterMailWrite = true;
    closeInventoryModal();

    if (isAnonymousLetter) {
      openMailWriteModal('basic', { forceAnonymous: true });
      return;
    }

    if (itemId.indexOf('002') !== -1 || itemId.indexOf('PREMIUM') !== -1) {
      openMailWriteModal('premium');
      return;
    }

    openMailWriteModal('basic');
    return;
  }

  openAlertModal(
    '사용 준비 중',
    '이 아이템은 아직 사용 기능이 연결되지 않았습니다.\n아이템 효과와 소모 정책을 정한 뒤 서버에서 처리할 예정입니다.'
  );
}

function getLocalMemoStorageKey() {
  return 'mythosLocalMemos:' + (currentPersonalCode || 'guest');
}

function getServerMemoCacheKey() {
  return 'mythosServerMemoCache:' + (currentPersonalCode || 'guest');
}

function getServerMemoCacheTimeKey() {
  return 'mythosServerMemoCacheTime:' + (currentPersonalCode || 'guest');
}

function getMemoBookmarkStorageKey() {
  return 'mythosMemoBookmarks:' + (currentPersonalCode || 'guest');
}

function getCachedServerMemos() {
  try {
    return JSON.parse(localStorage.getItem(getServerMemoCacheKey()) || '[]');
  } catch (error) {
    console.error(error);
    return [];
  }
}

function setCachedServerMemos(memos) {
  localStorage.setItem(getServerMemoCacheKey(), JSON.stringify(Array.isArray(memos) ? memos : []));
  localStorage.setItem(getServerMemoCacheTimeKey(), String(Date.now()));
}

function isServerMemoCacheFresh() {
  const cachedMemos = getCachedServerMemos();
  const cachedAt = Number(localStorage.getItem(getServerMemoCacheTimeKey()) || 0);

  return cachedMemos.length > 0 && cachedAt > 0 && Date.now() - cachedAt < SERVER_MEMO_CACHE_TTL;
}

function getMemoBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(getMemoBookmarkStorageKey()) || '[]');
  } catch (error) {
    console.error(error);
    return [];
  }
}

function setMemoBookmarks(bookmarks) {
  localStorage.setItem(getMemoBookmarkStorageKey(), JSON.stringify(Array.isArray(bookmarks) ? bookmarks : []));
}

function getMemoIdentity(memo) {
  return [
    memo.time || memo.createdAt || '',
    memo.placeId || '',
    memo.placeName || '',
    memo.title || '',
    memo.content || ''
  ].join('|');
}

function getMemoTitle(memo) {
  const title = String((memo && memo.title) || '').trim();
  if (title) return title;

  const content = String((memo && memo.content) || '').trim();
  return content ? content.slice(0, 40) : '제목 없음';
}

function getCurrentGrowthStage() {
  const savedPlayerData = localStorage.getItem('mythosPlayerData');

  if (savedPlayerData) {
    try {
      const player = JSON.parse(savedPlayerData);
      const stage = Number(player.currentGrowthStage || player.growthStage || 1);

      if (stage >= 1 && stage <= 3) return stage;
    } catch (error) {
      console.error(error);
    }
  }

  return 1;
}

function getMythosEraYear() {
  const stage = getCurrentGrowthStage();
  return MYTHOS_ERA_YEAR_BY_STAGE[stage] || MYTHOS_ERA_YEAR_BY_STAGE[1];
}

function parseDateParts(value) {
  if (!value) return '';

  const text = String(value).replace('T', ' ').trim();
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s+(\d{1,2}):(\d{2})/);

  if (match) {
    return {
      month: match[2].padStart(2, '0'),
      day: match[3].padStart(2, '0'),
      hour: match[4].padStart(2, '0'),
      minute: match[5]
    };
  }

  const fallback = new Date(value);

  if (!Number.isNaN(fallback.getTime())) {
    return {
      month: String(fallback.getMonth() + 1).padStart(2, '0'),
      day: String(fallback.getDate()).padStart(2, '0'),
      hour: String(fallback.getHours()).padStart(2, '0'),
      minute: String(fallback.getMinutes()).padStart(2, '0')
    };
  }

  return null;
}

function formatMythosDateTime(value) {
  const parts = parseDateParts(value);

  if (!parts) return '';

  return '신력 ' + getMythosEraYear() + '년 '
    + Number(parts.month) + '월 ' + Number(parts.day) + '일 '
    + parts.hour + ':' + parts.minute;
}

function formatMemoDateShort(value) {
  return formatMythosDateTime(value);
}

function getMemoPlaceLabel(memo) {
  const player = getCurrentPlayerForMemo();
  const region = player.origin || '';
  const place = memo && (memo.placeName || memo.placeId) ? (memo.placeName || memo.placeId) : '';

  return [region, place].filter(Boolean).join(' · ');
}

function isMemoBookmarked(memo) {
  if (memo && (memo.isBookmarked === true || String(memo.isBookmarked).toUpperCase() === 'TRUE')) {
    return true;
  }

  return getMemoBookmarks().includes(getMemoIdentity(memo));
}

function getCurrentPlayerForMemo() {
  const savedPlayerData = localStorage.getItem('mythosPlayerData');

  if (savedPlayerData) {
    try {
      return JSON.parse(savedPlayerData);
    } catch (error) {
      console.error(error);
    }
  }

  return {
    characterName: document.getElementById('character-name')
      ? document.getElementById('character-name').textContent
      : '',
    currentPlaceId: ''
  };
}

function getLocalMemos() {
  try {
    return JSON.parse(localStorage.getItem(getLocalMemoStorageKey()) || '[]');
  } catch (error) {
    console.error(error);
    return [];
  }
}

function setLocalMemos(memos) {
  localStorage.setItem(getLocalMemoStorageKey(), JSON.stringify(memos));
}

function getInitialMemoList() {
  if (currentPersonalCode) {
    const cachedServerMemos = getCachedServerMemos();
    if (cachedServerMemos.length) return cachedServerMemos;
  }

  return getLocalMemos();
}

function setMemoSaveButtonState(isSaving) {
  const button = document.querySelector('.memo-save-btn');
  if (!button) return;

  button.disabled = isSaving;
  button.textContent = isSaving ? '저장 중...' : '메모 저장';
}

function updateMemoTabActive() {
  const allTab = document.getElementById('memo-tab-all');
  const bookmarkTab = document.getElementById('memo-tab-bookmark');
  const title = document.getElementById('memo-list-title');

  if (allTab) allTab.classList.toggle('active', currentMemoTab === 'all');
  if (bookmarkTab) bookmarkTab.classList.toggle('active', currentMemoTab === 'bookmark');
  if (title) title.textContent = currentMemoTab === 'bookmark' ? '책갈피 메모' : '기존 메모 목록';
}

function selectMemoTab(tab) {
  currentMemoTab = tab === 'bookmark' ? 'bookmark' : 'all';
  currentMemoPage = 1;
  renderLocalMemos(currentMemoRenderCache);
}

function updateMemoPageControls(totalPages) {
  const controls = document.getElementById('memo-page-controls');
  const pageText = document.getElementById('memo-page-text');

  if (!controls || !pageText) return;

  if (totalPages <= 1) {
    controls.style.display = 'none';
    return;
  }

  controls.style.display = 'flex';
  pageText.textContent = currentMemoPage + ' / ' + totalPages;
}

function goPrevMemoPage() {
  if (currentMemoPage <= 1) return;
  currentMemoPage--;
  renderLocalMemos(currentMemoRenderCache);
}

function goNextMemoPage() {
  const visibleMemos = getVisibleMemos(currentMemoRenderCache);
  const totalPages = Math.max(1, Math.ceil(visibleMemos.length / MEMO_PAGE_SIZE));

  if (currentMemoPage >= totalPages) return;

  currentMemoPage++;
  renderLocalMemos(currentMemoRenderCache);
}

function getVisibleMemos(memos) {
  const safeMemos = Array.isArray(memos) ? memos : [];

  if (currentMemoTab !== 'bookmark') {
    return safeMemos;
  }

  return safeMemos.filter(memo => isMemoBookmarked(memo));
}

function closeModalIfExists(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'none';
}

const INVESTIGATION_DEFAULT_STATE = {
  notes: 0,
  noteSources: {},
  items: {},
  flags: {}
};

const INVESTIGATION_NODES = {
  'trial-start': {
    title: '2일차 담력시험',
    path: '탈리스 · 아르카디움 피에타스',
    text: [
      '아르카디움 피에타스에서 진행되는 2일차 담력시험이다.',
      '선배들이 숨겨둔 쪽지를 모으고, 학교 곳곳에 남은 흔적을 조사해보자.',
      '물건을 숨길 만한 장소는 [도서관], [폐건물], [창고], [정원], [동상] 정도가 있을 것 같다.'
    ],
    options: [
      { label: '도서관으로 간다', target: 'library' },
      { label: '폐건물로 간다', target: 'old-building' },
      { label: '창고로 간다', target: 'storage' },
      { label: '정원으로 간다', target: 'garden' },
      { label: '동상으로 간다', target: 'statue' },
      { label: '수집한 쪽지를 맞춰본다', target: 'combine-notes', requires: { notes: 5 } }
    ]
  },
  library: {
    title: '도서관',
    path: '아르카디움 피에타스 · 도서관',
    text: [
      '학생이라면 누구나 이용할 수 있는 도서관.',
      '쉽게 찾아볼 수 없는 귀중한 서적도 많이 있으며, 서적의 대다수가 외부 기증품이다.',
      '훼손하게 될 경우 교칙에 따라 징계를 받을 수 있으므로 주의하도록 하자.',
      '도서관 내에서 물건을 숨길 만한 장소는 [열람실], [자료실], [스터디룸] 정도가 있을 것 같다.'
    ],
    options: [
      { label: '열람실을 조사한다', target: 'reading-room' },
      { label: '자료실을 조사한다', target: 'archive-room' },
      { label: '스터디룸을 조사한다', target: 'study-room' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  },
  'reading-room': {
    title: '열람실',
    path: '도서관 · 열람실',
    text: [
      '책을 읽을 수 있도록 마련되어 있는 열람실.',
      '‘다른 사람을 위해 조용히 합시다’라고 쓰여 있다.',
      '혹시 모르니 조용히 다니도록 하자.',
      '열람실에서는 [반납함], [책상], [게시판]을 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '반납함을 살펴본다', target: 'return-box' },
      { label: '책상을 살펴본다', target: 'reading-desk' },
      { label: '게시판을 살펴본다', target: 'library-board' },
      { label: '도서관으로 돌아간다', target: 'library' }
    ]
  },
  'return-box': {
    title: '반납함',
    path: '도서관 · 열람실 · 반납함',
    text: [
      '읽은 책을 반납할 수 있는 반납함.',
      '열기 위해서는 [반납함 열쇠]가 필요할 것 같다.'
    ],
    options: [
      { label: '반납함 열쇠를 사용한다', target: 'return-box-open', requires: { item: 'returnBoxKey' } },
      { label: '열람실로 돌아간다', target: 'reading-room' }
    ]
  },
  'return-box-open': {
    title: '반납함 내부',
    path: '도서관 · 열람실 · 반납함 내부',
    text: [
      '찰칵. 열쇠가 맞물리며 반납함이 열렸다.',
      '내부엔 정리되지 않은 서적이 한가득 들어 있다.',
      '이 학교에는 책을 읽는 사람이 이렇게 많이 있는 걸까?',
      '…어쩌면 책 사이에 쪽지가 들어 있을 지도 모른다.'
    ],
    options: [
      { label: '책 사이를 살펴본다', target: 'return-box-books' },
      { label: '열람실로 돌아간다', target: 'reading-room' }
    ]
  },
  'return-box-books': {
    title: '책 사이 살펴보기',
    path: '도서관 · 열람실 · 반납함 내부',
    text: [
      '쪽지 대신 신입생인 우리로서는 알아보기 힘든 내용만 가득했다.',
      '이런, 허탕인가?',
      '보관함을 몰래 열어본 것을 들키지 않으려면, 책을 다시 넣어두는 것이 좋을 것 같다….'
    ],
    options: [
      { label: '반납함으로 돌아간다', target: 'return-box-open' },
      { label: '열람실로 돌아간다', target: 'reading-room' }
    ]
  },
  'reading-desk': {
    title: '책상',
    path: '도서관 · 열람실 · 책상',
    text: [
      '책을 읽을 수 있도록 마련된 책상.',
      '조명기구가 달려 있어 사용자가 책을 읽기에 가장 편한 상태로 빛을 조절할 수 있다.',
      '[책상 위]와 [책상 아래]를 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '책상 위를 살펴본다', target: 'reading-desk-top' },
      { label: '책상 아래를 살펴본다', target: 'reading-desk-under' },
      { label: '열람실로 돌아간다', target: 'reading-room' }
    ]
  },
  'reading-desk-top': {
    title: '책상 위',
    path: '도서관 · 열람실 · 책상 위',
    text: ['강화 유리로 덮여 있는 목재 책상의 위.', '지금은 책을 읽는 사람이 없어 휑하기만 하다.'],
    options: [{ label: '책상으로 돌아간다', target: 'reading-desk' }]
  },
  'reading-desk-under': {
    title: '책상 아래',
    path: '도서관 · 열람실 · 책상 아래',
    text: ['누군가 사용한 발받침대가 고스란히 남아 있는 책상 아래.', '무언가 떨어져 있는 것 같은데…?'],
    options: [
      { label: '들어본다', target: 'sticky-trash-touch' },
      { label: '살펴본다', target: 'sticky-trash-look' },
      { label: '책상으로 돌아간다', target: 'reading-desk' }
    ]
  },
  'sticky-trash-touch': {
    title: '들어보기',
    path: '도서관 · 열람실 · 책상 아래',
    text: ['…이런! 찐득찐득한 쓰레기였다.', '뻗은 손에도 찐득함이 고스란히 묻어 어쩐지 불쾌한 기분이 든다.'],
    options: [{ label: '책상 아래로 돌아간다', target: 'reading-desk-under' }]
  },
  'sticky-trash-look': {
    title: '살펴보기',
    path: '도서관 · 열람실 · 책상 아래',
    text: ['찐득해보이는 쓰레기인 것 같다.', '누가 이곳에 버려둔 거지?', '…아무래도 치워주는 것이 좋을 것 같다.'],
    options: [{ label: '책상 아래로 돌아간다', target: 'reading-desk-under' }]
  },
  'library-board': {
    title: '게시판',
    path: '도서관 · 열람실 · 게시판',
    text: [
      '도서관 내 신규 소식을 접할 수 있는 게시판.',
      '학기 초라 그런지 다양한 소식이 많이 붙어 있다.',
      '게시판에 붙은 [종이]를 펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '종이를 펴본다', target: 'library-note-paper' },
      { label: '열람실로 돌아간다', target: 'reading-room' }
    ]
  },
  'library-note-paper': {
    title: '별모양 종이',
    path: '도서관 · 열람실 · 게시판',
    text: [
      '특이하게도 별모양으로 접혀 있는 종이.',
      '누가 접었는지는 모르겠지만, 이 상태라면 내용을 알아보기 힘들 것 같다.'
    ],
    options: [
      { label: '열어본다', target: 'library-note-get', gain: { note: 'libraryBoard' } },
      { label: '게시판으로 돌아간다', target: 'library-board' }
    ]
  },
  'library-note-get': {
    title: '쪽지',
    path: '도서관 · 열람실 · 게시판',
    text: [
      '귀여운 그림체로 귀신이 그려져 있다. 선배들이 숨겨둔 [쪽지]인 걸까?',
      '……어라? 끄트머리에 붉은 액체가 묻어 있는데, 이건 뭐지?',
      '일단 챙겨두도록 하자.'
    ],
    options: [{ label: '열람실로 돌아간다', target: 'reading-room' }]
  },
  'archive-room': {
    title: '자료실',
    path: '도서관 · 자료실',
    text: [
      '귀중한 서적을 포함해 모든 자료를 보관하고 있는 자료실.',
      '자료의 양이 방대한 만큼, 도서관 내에 있는 여타 장소보다도 거대하다.',
      '자료실에서는 [서가 A], [서가 B], [기록부]를 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '서가 A를 살펴본다', target: 'shelf-a' },
      { label: '서가 B를 살펴본다', target: 'shelf-b' },
      { label: '기록부를 살펴본다', target: 'library-ledger' },
      { label: '도서관으로 돌아간다', target: 'library' }
    ]
  },
  'shelf-a': {
    title: '서가 A',
    path: '도서관 · 자료실 · 서가 A',
    text: [
      '신학과 관련된 서적이 꽂혀 있는 서가.',
      '도서관 내에서도 가장 방대한 양을 자랑한다.',
      '[빨간색 표지의 책]과 [노란색 표지의 책]을 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '빨간색 표지의 책', target: 'red-book' },
      { label: '노란색 표지의 책', target: 'yellow-book' },
      { label: '자료실로 돌아간다', target: 'archive-room' }
    ]
  },
  'red-book': {
    title: '빨간색 표지의 책',
    path: '도서관 · 자료실 · 서가 A',
    text: [
      '교리에 관해 쓰여 있는 빨간색 표지의 책이다.',
      '‘한 눈에 보는 정말 진짜 알기 쉬운 교리’라는 제목에 걸맞게 교리를 쉽게 풀어 설명하고 있다.',
      '관심이 있다면 대여해보는 것도 나쁘지 않을 것 같다.'
    ],
    options: [{ label: '서가 A로 돌아간다', target: 'shelf-a' }]
  },
  'yellow-book': {
    title: '노란색 표지의 책',
    path: '도서관 · 자료실 · 서가 A',
    text: [
      '아기자기한 그림과 요리 레시피가 쓰여 있는 노란색 표지의 책.',
      '누군가 잘못 꽂아둔 것일까?',
      '표지에 그려진 음식이 정말 맛있어 보인다.'
    ],
    options: [{ label: '서가 A로 돌아간다', target: 'shelf-a' }]
  },
  'shelf-b': {
    title: '서가 B',
    path: '도서관 · 자료실 · 서가 B',
    text: [
      '예술과 관련된 서적이 꽂혀 있는 서가.',
      '예체능에 관심이 있다면 한 번쯤 빌려볼 법한 책이 가득하다.',
      '[파란색 표지의 책]을 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '파란색 표지의 책', target: 'blue-book' },
      { label: '자료실로 돌아간다', target: 'archive-room' }
    ]
  },
  'blue-book': {
    title: '파란색 표지의 책',
    path: '도서관 · 자료실 · 서가 B',
    text: [
      '건반 악기에 대해 쓰여 있는 파란색 표지의 책.',
      '특이하게도 악기를 만드는 방법부터 설명하고 있다.',
      '나중에 건반 악기를 만들 일이 생긴다면 빌려보도록 하자.'
    ],
    options: [{ label: '서가 B로 돌아간다', target: 'shelf-b' }]
  },
  'library-ledger': {
    title: '기록부',
    path: '도서관 · 자료실 · 기록부',
    text: [
      '학생들의 책 대출/반납 현황을 작성하는 기록부.',
      '개인정보가 담겨 있어 취급에 주의하라는 말이 쓰여 있다.',
      '…그래도 몰래 살펴볼까?'
    ],
    options: [
      { label: '살펴보기', target: 'library-ledger-denied' },
      { label: '자료실로 돌아간다', target: 'archive-room' }
    ]
  },
  'library-ledger-denied': {
    title: '허가되지 않은 기록부',
    path: '도서관 · 자료실 · 기록부',
    text: [
      '아무리 펼치려고 노력해도 기록부를 열 수 없다.',
      '아무래도 허가되지 않은 자는 살펴볼 수 없는 것 같다.'
    ],
    options: [{ label: '자료실로 돌아간다', target: 'archive-room' }]
  },
  'study-room': {
    title: '스터디룸',
    path: '도서관 · 스터디룸',
    text: [
      '공부를 위한 스터디룸. 시험 기간이 되면 빈 자리를 찾아보기 어려울 정도로 인기 있는 공부 장소다.',
      '스터디룸에서는 [책상], [칠판], [화분]을 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '책상을 살펴본다', target: 'study-desk' },
      { label: '칠판을 살펴본다', target: 'study-board' },
      { label: '화분을 살펴본다', target: 'study-pot' },
      { label: '도서관으로 돌아간다', target: 'library' }
    ]
  },
  'study-desk': {
    title: '책상',
    path: '도서관 · 스터디룸 · 책상',
    text: [
      '바로 앞에 창문이 있어 공부하며 학교의 전경을 바라볼 수 있는 책상.',
      '해가 질 무렵 이 자리에 앉으면 멋진 경관을 볼 수 있다.',
      '[책상 위]와 [책상 아래]를 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '책상 위를 살펴본다', target: 'study-desk-top' },
      { label: '책상 아래를 살펴본다', target: 'study-desk-under' },
      { label: '스터디룸으로 돌아간다', target: 'study-room' }
    ]
  },
  'study-desk-top': {
    title: '책상 위',
    path: '도서관 · 스터디룸 · 책상 위',
    text: [
      '말끔하게 정리되어 있는 책상 위.',
      '누군가 놓고 간 [수첩]이 놓여 있다.',
      '분실물인 걸까?'
    ],
    options: [
      { label: '수첩을 읽어본다', target: 'study-notebook' },
      { label: '책상으로 돌아간다', target: 'study-desk' }
    ]
  },
  'study-notebook': {
    title: '수첩',
    path: '도서관 · 스터디룸 · 책상 위',
    text: ['수첩을 열자 ‘나 공부 중. 방해 금지.’라는 문구가 빨간색으로 쓰여 있었다.', '…누구에게 남기려는 경고였을까?'],
    options: [{ label: '책상으로 돌아간다', target: 'study-desk' }]
  },
  'study-desk-under': {
    title: '책상 아래',
    path: '도서관 · 스터디룸 · 책상 아래',
    text: ['먼지 한 톨 없이 말끔히 정리되어 있는 책상 아래.', '청소를 꼼꼼하게 한 것 같다.'],
    options: [{ label: '책상으로 돌아간다', target: 'study-desk' }]
  },
  'study-board': {
    title: '칠판',
    path: '도서관 · 스터디룸 · 칠판',
    text: ['모여서 공부하는 학생들을 위해 마련되어 있는 이동식 칠판.', '오랜 시간 사용되어 칠판이 거뭇거뭇하다.', '밑 부분에 펜이 놓여 있어 작게 그림을 그릴 수 있을 것 같다.'],
    options: [{ label: '스터디룸으로 돌아간다', target: 'study-room' }]
  },
  'study-pot': {
    title: '화분',
    path: '도서관 · 스터디룸 · 화분',
    text: [
      '도서관 한 켠에 놓여 있는 화분.',
      '키우고 있는 식물은 없는 걸까?',
      '지금은 축축한 흙 밖에 없다.',
      '…어라?',
      '자세히 보니 흙 속에 무언가 있는 것 같다.'
    ],
    options: [
      { label: '흙 속을 살펴본다', target: 'return-box-key-get', gain: { item: 'returnBoxKey' } },
      { label: '스터디룸으로 돌아간다', target: 'study-room' }
    ]
  },
  'return-box-key-get': {
    title: '반납함 열쇠',
    path: '도서관 · 스터디룸 · 화분',
    text: [
      '[반납함 열쇠]를 발견했다.',
      '평소에 흙 속에 보관하고 있었던 걸까?',
      '…혹시 모르니 사용한 뒤엔 다시 묻어주는 것이 좋을 것 같다.'
    ],
    options: [{ label: '스터디룸으로 돌아간다', target: 'study-room' }]
  },
  'old-building': {
    title: '폐건물',
    path: '아르카디움 피에타스 · 폐건물',
    text: [
      '먼 옛날 연구실로 사용했다고 알려진 폐건물.',
      '오늘을 위해 특별히 개방해둔 것인지 평소와 달리 열려 있다.',
      '오랜 기간 사용되지 않은 만큼 건물 전체가 많이 낡아 있다.',
      '…무너지지는 않겠지?',
      '폐건물 내에서 물건을 숨길 만한 장소는 [실험실], [냉동 보관실], [?] 정도가 있을 것 같다.'
    ],
    options: [
      { label: '실험실을 조사한다', target: 'lab' },
      { label: '냉동 보관실을 조사한다', target: 'freezer' },
      { label: '? 장소를 조사한다', target: 'locked-room' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  },
  lab: {
    title: '실험실',
    path: '폐건물 · 실험실',
    text: [
      '지금은 사용하지 않는 오래된 실험실.',
      '방치된 물건이 꽤나 많이 있는 것 같다.',
      '세월이 지난 만큼 먼지도 많이 쌓여 있으니 살필 때는 조심하도록 하자.',
      '실험실에서는 [도구함], [폐기함], [책장]을 살펴볼 수 있을 것 같다.'
    ],
    options: [
      { label: '도구함을 살펴본다', target: 'tool-box' },
      { label: '폐기함을 살펴본다', target: 'waste-box' },
      { label: '책장을 살펴본다', target: 'lab-bookshelf' },
      { label: '폐건물로 돌아간다', target: 'old-building' }
    ]
  },
  'tool-box': {
    title: '도구함',
    path: '폐건물 · 실험실 · 도구함',
    text: ['연구용 도구를 보관해두던 도구함.', '지금은 굳건히 닫혀 있다.', '잠금장치는 따로 없어 열어보고 싶다면 열어볼 수 있을 것 같다.'],
    options: [
      { label: '열어보기', target: 'tool-box-open' },
      { label: '실험실로 돌아간다', target: 'lab' }
    ]
  },
  'tool-box-open': {
    title: '도구함 내부',
    path: '폐건물 · 실험실 · 도구함',
    text: ['콜록, 콜록!', '먼지가 피어오르며 재채기가 나기 시작했다.', '도구는 정갈하게 정리되어 있지만, 먼지가 많이 쌓여 있어 아무래도 실험에 사용하긴 어려울 것 같다.'],
    options: [{ label: '실험실로 돌아간다', target: 'lab' }]
  },
  'waste-box': {
    title: '폐기함',
    path: '폐건물 · 실험실 · 폐기함',
    text: ['사용이 끝난 연구 재료들을 모아두는 폐기함.', '어쩐지 이상한 냄새가 나는 것 같다….', '[폐기함 위]와 [폐기함 아래]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '폐기함 위를 살펴본다', target: 'waste-box-top' },
      { label: '폐기함 아래를 살펴본다', target: 'waste-box-under' },
      { label: '실험실로 돌아간다', target: 'lab' }
    ]
  },
  'waste-box-top': {
    title: '폐기함 위',
    path: '폐건물 · 실험실 · 폐기함 위',
    text: ['경고 문구가 잔뜩 쓰여 있는 폐기함 위.', '붉은 글씨로 ‘폐기함 비우는거 까먹으면 대머리’라고 쓰여 있다.', '…어쩐지 섬뜩한 경고다.'],
    options: [{ label: '폐기함으로 돌아간다', target: 'waste-box' }]
  },
  'waste-box-under': {
    title: '폐기함 아래',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: ['이상한 냄새가 나고 있는 폐기함 아래.', '아무래도 폐기함을 들춰봐야 냄새의 원인을 알 수 있을 것 같다….'],
    options: [
      { label: '들어 올리기', target: 'waste-box-lift' },
      { label: '폐기함으로 돌아간다', target: 'waste-box' }
    ]
  },
  'waste-box-lift': {
    title: '붉은 액체',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: [
      '붉은 액체가 가득 쏟아져 있었다.',
      '군데군데 나무 조각도 보이는 것 같은데…?',
      '아무래도 나무 조각이 액체와 만나 썩어버려 냄새가 나게 된 것 같다.',
      '…위험해보이니 건들이지 않는 것이 좋을 것 같다.'
    ],
    options: [
      { label: '붉은 액체를 살펴본다', target: 'red-liquid-look' },
      { label: '폐기함으로 돌아간다', target: 'waste-box' }
    ]
  },
  'red-liquid-look': {
    title: '붉은 액체를 살펴본다',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: [
      '폐기함 아래에서부터 바닥을 따라 번져 있는 붉은 액체.',
      '물감이 섞인 물처럼 보이지만, 어딘가 축축하고 불쾌한 냄새가 난다.',
      '액체는 바닥의 틈을 따라 어딘가로 이어져 있는 것 같은데…',
      '자세히 보니, 고인 액체 속에서 무언가 반짝이고 있다.',
      '액체에 거의 파묻혀 육안으로는 구분할 수 없을 것 같다.',
      '…어떻게 할까?'
    ],
    options: [
      { label: '반짝이는 것을 꺼내본다', target: 'gear-key-get', gain: { item: 'gearKey' } },
      { label: '액체의 방향을 조사한다', target: 'red-liquid-trace' },
      { label: '붉은 액체로 돌아간다', target: 'waste-box-lift' }
    ]
  },
  'gear-key-get': {
    title: '열쇠',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: [
      '손끝에 붉은 액체에 닿자 차갑고 미끈한 감촉이 전해진다.',
      '조심스럽게 안쪽을 더듬자, 단단한 물체가 손에 걸렸다.',
      '꺼내보니…',
      '붉은 액체가 묻어 있는 [열쇠]였다.',
      '…무언가 무늬가 새겨져 있는 것 같은데, 액체 때문에 확인하기가 어렵다.'
    ],
    options: [
      { label: '액체를 닦아낸다', target: 'gear-key-clean' },
      { label: '실험실로 돌아간다', target: 'lab' }
    ]
  },
  'gear-key-clean': {
    title: '톱니바퀴 열쇠',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: ['붉은 액체를 열심히 닦아냈다.', '닦아낸 천은 더러워져 당장 세탁이 필요할 것 같다.', '열쇠에는 톱니바퀴 모양이 각인되어 있는 것 같은데…', '톱니바퀴가 있는 곳이 있던가…?'],
    options: [{ label: '실험실로 돌아간다', target: 'lab' }]
  },
  'red-liquid-trace': {
    title: '액체의 방향',
    path: '폐건물 · 실험실 · 폐기함 아래',
    text: [
      '붉은 액체는 바닥의 틈과 얼룩을 따라 얇게 이어져 있다.',
      '중간중간 끊긴 부분도 있지만, 대체로 들어왔던 문 쪽으로 향하는 것 같다.',
      '액체 위에는 길게 끌린 듯한 자국이 드문드문 남아 있다.',
      '사람이 걸어간 발자국이라기엔 조금 이상한 것 같다….',
      '무언가 무거운 것이 바닥을 스치며 지나간 흔적처럼 보이는데…?',
      '자세한 것은 지금으로선 알 수 없을 것 같다.'
    ],
    options: [{ label: '붉은 액체로 돌아간다', target: 'red-liquid-look' }]
  },
  'lab-bookshelf': {
    title: '책장',
    path: '폐건물 · 실험실 · 책장',
    text: ['실험일지가 가득 꽂혀 있는 책장.', '꽤 양이 많은 것을 보아하니, 오랜 기간 실험이 진행된 것 같다.', '[실험일지]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '실험일지를 살펴본다', target: 'lab-journal' },
      { label: '실험실로 돌아간다', target: 'lab' }
    ]
  },
  'lab-journal': {
    title: '실험일지',
    path: '폐건물 · 실험실 · 책장',
    text: ['아주 오래 전 진행된 실험이 기록되어 있는 실험일지.', '에테르에 관한 실험인 것 같은데….', '먼지에 둘러싸여 자세한 내용은 파악하기는 어려울 것 같다.', '…어라?', '[책장 내부]에 무언가 있는 것 같다.'],
    options: [
      { label: '책장 내부를 살펴본다', target: 'lab-note-get', gain: { note: 'labBookshelf' } },
      { label: '책장으로 돌아간다', target: 'lab-bookshelf' }
    ]
  },
  'lab-note-get': {
    title: '책장 내부',
    path: '폐건물 · 실험실 · 책장 내부',
    text: ['고급스러운 글씨체로 ‘들켜버렸네요’라고 적혀 있는 종이였다.', '선배들이 숨겨둔 [쪽지]인 걸까?', '끄트머리에 붉은 액체가 묻어 있는데… 이건 뭐지?', '일단 챙겨두는 것이 좋을 것 같다.'],
    options: [{ label: '실험실로 돌아간다', target: 'lab' }]
  },
  freezer: {
    title: '냉동 보관실',
    path: '폐건물 · 냉동 보관실',
    text: ['폐쇄된 지금까지도 낮은 온도를 유지하고 있는 냉동 보관실.', '연구용 샘플이나 약품 등을 보관하던 장소인 것 같다.', '냉동 보관실에서는 [동결 표본관], [수동 압축 펌프], [황동 냉각 탱크]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '동결 표본관을 살펴본다', target: 'frozen-case' },
      { label: '수동 압축 펌프를 살펴본다', target: 'manual-pump' },
      { label: '황동 냉각 탱크를 살펴본다', target: 'cooling-tank' },
      { label: '폐건물로 돌아간다', target: 'old-building' }
    ]
  },
  'frozen-case': {
    title: '동결 표본관',
    path: '폐건물 · 냉동 보관실 · 동결 표본관',
    text: ['저온 상태로 실험 표본이나 조직을 보관하는 밀폐형 동결 표본관.', '핸들을 돌리면 열 수 있을 것 같은데…', '한 번 열어볼까?'],
    options: [
      { label: '열어보기', target: 'frozen-case-open' },
      { label: '냉동 보관실로 돌아간다', target: 'freezer' }
    ]
  },
  'frozen-case-open': {
    title: '동결 표본관 내부',
    path: '폐건물 · 냉동 보관실 · 동결 표본관',
    text: ['차가운 냉기가 새어나오며 금속음과 함께 표본관의 뚜껑이 열렸다.', '기대와 달리 아쉽게도 현재 보관되어 있는 표본은 없는 것 같다….'],
    options: [{ label: '냉동 보관실로 돌아간다', target: 'freezer' }]
  },
  'manual-pump': {
    title: '수동 압축 펌프',
    path: '폐건물 · 냉동 보관실 · 수동 압축 펌프',
    text: ['압력으로 냉각제를 탱크로 이동 시키는 장치.', '레버를 당겨 수동으로 압력을 만들어야 하는 것이 특징이다.', '아무래도 작동까지는 오랜 시간이 소요될 것 같은데…', '한 번 작동 시켜볼까?'],
    options: [
      { label: '작동 시켜본다', target: 'manual-pump-success', statCheck: { stat: 'strength', label: '근력', type: 'teamSum' }, failTarget: 'manual-pump-fail', gain: { flag: 'pumpOn' } },
      { label: '냉동 보관실로 돌아간다', target: 'freezer' }
    ]
  },
  'manual-pump-fail': {
    title: '작동 실패',
    path: '폐건물 · 냉동 보관실 · 수동 압축 펌프',
    text: ['힘을 주어 레버를 당겨보았지만, 녹슨 장치는 끼익거리는 소리만 낼 뿐 끝내 움직이지 않았다.', '조금 더 많은 인원이 힘을 보태야 할 것 같다.'],
    options: [
      { label: '다시 시도한다', target: 'manual-pump' },
      { label: '냉동 보관실로 돌아간다', target: 'freezer' }
    ]
  },
  'manual-pump-success': {
    title: '작동 성공',
    path: '폐건물 · 냉동 보관실 · 수동 압축 펌프',
    text: ['여럿이 힘을 모아 레버를 당기자, 녹슨 장치가 삐걱거리며 움직이기 시작했다.', '덜컹, 내부 톱니가 맞물리며 천천히 회전하고 있다.', '배관 내부를 따라 냉각제가 이동하고, 황동 냉각 탱크 표면에는 서리가 피어오르는 모습이 눈에 보인다.', '…어쩐지 보관실 내부 온도가 점점 내려가고 있는 것 같다.'],
    options: [{ label: '냉동 보관실로 돌아간다', target: 'freezer' }]
  },
  'cooling-tank': {
    title: '황동 냉각 탱크',
    path: '폐건물 · 냉동 보관실 · 황동 냉각 탱크',
    text: ['차가운 냉기를 뿜고 있는 황동 냉각 탱크.', '냉동 보관실 온도를 유지하는 용도로 사용되고 있던 것 같다.', '[온도 조절기]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '온도 조절기를 살펴본다', target: 'temperature-controller' },
      { label: '냉동 보관실로 돌아간다', target: 'freezer' }
    ]
  },
  'temperature-controller': {
    title: '온도 조절기',
    path: '폐건물 · 냉동 보관실 · 황동 냉각 탱크',
    text: function () {
      const temp = getInvestigationFlag('pumpOn') ? '-30°C' : '-15°C';
      return [
        '황동 냉각 탱크의 온도를 조절할 수 있는 온도 조절기.',
        '현재 온도는 ' + temp + '로 설정되어 있는 것 같다.',
        '온도를 조절할 수 있을 것 같은데…',
        '한 번 해볼까?'
      ];
    },
    options: [
      { label: '작동 시켜본다', target: 'temperature-controller-fail' },
      { label: '황동 냉각 탱크로 돌아간다', target: 'cooling-tank' }
    ]
  },
  'temperature-controller-fail': {
    title: '온도 조절기',
    path: '폐건물 · 냉동 보관실 · 황동 냉각 탱크',
    text: ['온도를 조절하려고 했지만, 조절기가 말을 듣지 않는다!', '고장난 건가?', '오랜 시간 냉동 보관실에 있는 것은 위험할 것 같다.', '서둘러 냉동 보관실에서 나가도록 하자. [냉동 보관실 조사 종료]'],
    options: [{ label: '폐건물로 돌아간다', target: 'old-building' }]
  },
  'locked-room': {
    title: '?',
    path: '폐건물 · 알 수 없는 방',
    text: ['표지판은 오래전에 떨어져 나간 듯, 희미한 자국만 남아 있다.', '어떤 용도로 쓰이던 방인지는 알 수 없을 것 같다.', '문고리를 돌려보면…… 철컥.', '……아무래도, 문이 잠겨서 열 수 없을 것 같다.', '낡은 잠금장치와 맞물리는 [열쇠]가 있다면 열 수 있을 것 같은데….'],
    options: [
      { label: '열쇠를 사용한다', target: 'machine-room-open', requires: { item: 'gearKey' }, gain: { flag: 'machineRoomOpen', consumeItem: 'gearKey' } },
      { label: '폐건물로 돌아간다', target: 'old-building' }
    ]
  },
  'machine-room-open': {
    title: '열쇠 사용',
    path: '폐건물 · 알 수 없는 방',
    text: ['철컥.', '열쇠가 맞물리는 소리와 함께 문이 열렸다.', '열쇠를 뽑아 챙기려고 하면…', '이런, 열쇠에 묻은 액체가 잠금장치에 엉겨 붙어 빠지지 않는다.', '…열쇠를 다시 챙기는 것은 포기해야 할 것 같다.'],
    options: [{ label: '기계실로 들어간다', target: 'machine-room' }]
  },
  'machine-room': {
    title: '기계실',
    path: '폐건물 · 기계실',
    text: ['거대한 금속 톱니가 맞물려 천천히 돌아가고 있는 기계실.', '…아무래도 이 열쇠에 그려진 톱니가 의미하는 것은 저 톱니였던 것 같다.', '기계실에서는 [거대 톱니 기관], [증기 보일러], [비상 차단 레버]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '거대 톱니 기관을 살펴본다', target: 'gear-engine' },
      { label: '증기 보일러를 살펴본다', target: 'steam-boiler' },
      { label: '비상 차단 레버를 살펴본다', target: 'emergency-lever' },
      { label: '폐건물로 돌아간다', target: 'old-building' }
    ]
  },
  'gear-engine': {
    title: '거대 톱니 기관',
    path: '폐건물 · 기계실 · 거대 톱니 기관',
    text: ['천천히 돌아가고 있는 거대 톱니 기관.', '이 폐건물 내부 설비에 동력을 공급하는 용도로 사용되던 것 같다.', '[톱니 A]와 [톱니 B]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '톱니 A를 살펴본다', target: 'gear-a' },
      { label: '톱니 B를 살펴본다', target: 'gear-b' },
      { label: '기계실로 돌아간다', target: 'machine-room' }
    ]
  },
  'gear-a': {
    title: '톱니 A',
    path: '폐건물 · 기계실 · 거대 톱니 기관',
    text: ['기관에서도 가장 거대한 톱니 A.', '중심에 위치하여 기관 전체의 동력을 분배하고 있는 것 같다.', '아무래도 인간의 힘으로는 작동을 제어하기 어려울 것 같다.'],
    options: [{ label: '거대 톱니 기관으로 돌아간다', target: 'gear-engine' }]
  },
  'gear-b': {
    title: '톱니 B',
    path: '폐건물 · 기계실 · 거대 톱니 기관',
    text: ['기관 내부에서도 유난히 빠르게 회전하고 있는 톱니 B.', '동력 전달 속도를 조절하는 역할을 맡고 있는 것 같다.', '빠른 속도로 회전하고 있어, 함부로 손 대기엔 위험할 것 같다.'],
    options: [{ label: '거대 톱니 기관으로 돌아간다', target: 'gear-engine' }]
  },
  'steam-boiler': {
    title: '증기 보일러',
    path: '폐건물 · 기계실 · 증기 보일러',
    text: ['뜨거운 열기와 함께 낮은 진동음을 내고 있는 증기 보일러.', '기계실 내부 장치에 동력을 공급하는 핵심 설비였던 것 같다.', '배관에서는 희미하게 증기가 새어나오고 있다.', '[압력계]와 [증기 배출 밸브]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '압력계를 살펴본다', target: 'pressure-gauge' },
      { label: '증기 배출 밸브를 살펴본다', target: 'steam-valve' },
      { label: '기계실로 돌아간다', target: 'machine-room' }
    ]
  },
  'pressure-gauge': {
    title: '압력계',
    path: '폐건물 · 기계실 · 증기 보일러',
    text: ['보일러 측면에 부착되어 있는 오래된 압력계.', '금이 간 유리 너머로 바늘이 불안정하게 흔들리고 있다.', '내부에 무언가 끼어 있는 것 같은데…', '압력계를 두드려볼까?'],
    options: [
      { label: '두드린다', target: 'pressure-paper' },
      { label: '증기 보일러로 돌아간다', target: 'steam-boiler' }
    ]
  },
  'pressure-paper': {
    title: '종이',
    path: '폐건물 · 기계실 · 압력계',
    text: ['툭.', '가벼운 충격과 함께 압력계 내부에 끼어 있던 [종이]가 아래로 떨어졌다.', '선배들이 숨겨둔 쪽지일까?'],
    options: [
      { label: '살펴본다', target: 'pressure-note-get', gain: { note: 'pressureGauge' } },
      { label: '증기 보일러로 돌아간다', target: 'steam-boiler' }
    ]
  },
  'pressure-note-get': {
    title: '쪽지',
    path: '폐건물 · 기계실 · 압력계',
    text: ['‘용감한 후배들이네. 그런 후배들을 위해 선배로서 조언을 하나 해주자면, 밸브를 열지 않는 것이 좋을 거야.’', '…밸브라니, 어떤 것을 말하는 걸까?', '일단 쪽지를 챙겨두는 것이 좋을 것 같다.'],
    options: [{ label: '증기 보일러로 돌아간다', target: 'steam-boiler' }]
  },
  'steam-valve': {
    title: '증기 배출 밸브',
    path: '폐건물 · 기계실 · 증기 보일러',
    text: ['고압 증기를 방출하기 위한 증기 배출 밸브.', '표면 전체가 뜨겁게 달아올라 있어 맨 손으로는 만지지 않는 것이 좋아 보인다.', '‘함부로 열지 말 것’이라고 쓰여 있다.', '…그래도 신경 쓰이는데, 한 번 밸브를 열어볼까?'],
    options: [
      { label: '열어본다', target: 'steam-valve-open' },
      { label: '증기 보일러로 돌아간다', target: 'steam-boiler' }
    ]
  },
  'steam-valve-open': {
    title: '치이익!',
    path: '폐건물 · 기계실 · 증기 배출 밸브',
    text: ['순간 거센 증기와 함께 뜨거운 김이 기계실 안을 가득 메우고 있다.', '순식간에 시야가 하얗게 흐려지고, 금속이 흔들리는 소리가 귀에 맴도는 것도 같다.', '그와 동시에 툭, 무언가 떨어지는 소리가 난 것도 같은데…?', '…뜨거운 증기 사이로 바닥에 떨어진 것이 얼핏 보이는 것만 같다.', '한 번 살펴볼까?'],
    options: [
      { label: '살펴본다', target: 'wooden-doll-trace' },
      { label: '증기 보일러로 돌아간다', target: 'steam-boiler' }
    ]
  },
  'wooden-doll-trace': {
    title: '무언가',
    path: '폐건물 · 기계실 · 증기 배출 밸브',
    text: ['……철퍽.', '붉은 액체가 스멀스멀, [무언가]로부터 새어 나오고 있다.', '…설마. 우리가 생각한 그것은 아니겠지?', '…불길함에 괜히 코 끝에 불쾌한 냄새가 맴돌기 시작했다.', '……[무언가]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '무언가를 살펴본다', target: 'wooden-doll' },
      { label: '증기 보일러로 돌아간다', target: 'steam-boiler' }
    ]
  },
  'wooden-doll': {
    title: '목각 인형',
    path: '폐건물 · 기계실 · 증기 배출 밸브',
    text: ['툭.', '그것은 손으로 건드리자 묵직하게 옆으로 밀려났다.', '딱딱한 물건 같은데….', '…그 사이, 증기가 걷혀 무엇인지 인지할 수 있었다.', '……그것은,', '나무 목각 인형이었다!', '누군가 열심히 사람의 형태로 깎아낸 것 같다.', '인형의 몸통에는 삐뚤빼뚤한 글씨가 적혀 있었다.', '‘나도 학생이야.’', '…바닥에 떨어진 액체는 붉은 물감을 풀어둔 물인 것 같다.', '선배들의 장난인 걸까?'],
    options: [{ label: '기계실로 돌아간다', target: 'machine-room' }]
  },
  'emergency-lever': {
    title: '비상 차단 레버',
    path: '폐건물 · 기계실 · 비상 차단 레버',
    text: ['붉은색 손잡이가 달려 있는 비상 차단 레버.', '기계실 전체의 동력을 긴급 정지시키기 위해 만들어진 장치인 것 같다.', '오래 방치된 탓에 표면 곳곳이 녹슬어 있고, ‘비상 상황 외 사용 금지’라고 적혀 있다.', '…그래도 궁금한데, 한 번 당겨볼까?'],
    options: [
      { label: '당겨본다', target: 'emergency-lever-pull' },
      { label: '기계실로 돌아간다', target: 'machine-room' }
    ]
  },
  'emergency-lever-pull': {
    title: '비상 차단 레버',
    path: '폐건물 · 기계실 · 비상 차단 레버',
    text: ['붉은색 손잡이를 힘껏 당겼다! 그 순간…….', '……우당탕! 붉은색 손잡이가 레버와 분리되며 순간 균형을 잃고 넘어져버렸다.', '…부딪힌 엉덩이가 아프다!'],
    options: [{ label: '기계실로 돌아간다', target: 'machine-room' }]
  },
  storage: {
    title: '창고',
    path: '아르카디움 피에타스 · 창고',
    text: ['훈련에 사용되던 장비와 각종 기자재를 보관하는 창고.', '오래된 기수의 장비부터 현재는 사용되지 않는 폐기 장비들까지 뒤섞여 내부가 상당히 어수선하다.', '어쩐지 먼지와 녹슨 냄새도 나는 것 같은데….', '창고에서는 [갑옷 거치대], [무기 보관함], [훈련용 목각 인형]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '갑옷 거치대를 살펴본다', target: 'armor-stand' },
      { label: '무기 보관함을 살펴본다', target: 'weapon-rack' },
      { label: '훈련용 목각 인형을 살펴본다', target: 'training-dolls' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  },
  'armor-stand': {
    title: '갑옷 거치대',
    path: '창고 · 갑옷 거치대',
    text: ['오래된 갑옷들이 가지런히 세워져 있는 갑옷 거치대.', '녹슨 갑옷 틈 사이로 어두운 그림자가 드리워져 있어, 멀리서 보면 사람처럼 보이기도 한다는 이야기가 있다.', '갑옷 거치대에서는 [갑옷], [녹슨 갑옷]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '갑옷을 살펴본다', target: 'clean-armor' },
      { label: '녹슨 갑옷을 살펴본다', target: 'rusty-armor' },
      { label: '창고로 돌아간다', target: 'storage' }
    ]
  },
  'clean-armor': {
    title: '갑옷',
    path: '창고 · 갑옷 거치대 · 갑옷',
    text: ['거치대에 걸려 있는 갑옷.', '관리가 잘 되어 있어 금속 표면이 희미하게 빛을 반사하고 있다.', '실제 훈련용으로 사용되는 장비인 걸까?', '…어라?', '틈새에 무언가 반짝이고 있는 것 같은데….', '살펴볼까?'],
    options: [
      { label: '살펴본다', target: 'metal-badge-step' },
      { label: '갑옷 거치대로 돌아간다', target: 'armor-stand' }
    ]
  },
  'metal-badge-step': {
    title: '갑옷 틈새',
    path: '창고 · 갑옷 거치대 · 갑옷',
    text: ['차가운 갑옷 틈새 사이로 손을 넣자 손끝에 딱딱한 감촉이 느껴진다.', '크기가 그렇게 커다란 것 같지는 않은데, 꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'metal-badge-get', gain: { item: 'metalBadge' } },
      { label: '갑옷으로 돌아간다', target: 'clean-armor' }
    ]
  },
  'metal-badge-get': {
    title: '금속 배지',
    path: '창고 · 갑옷 거치대 · 갑옷',
    text: ['조심스럽게 꺼내보면…', '붉은색으로 칠해져 있는 [금속 배지]인 것 같다.', '어디에 쓰이는 건지 알 수 없지만, 그래도 챙겨볼까?'],
    options: [{ label: '창고로 돌아간다', target: 'storage' }]
  },
  'rusty-armor': {
    title: '녹슨 갑옷',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['거치대 한쪽에 방치되어 있는 구식 녹슨 갑옷.', '표면이 붉게 부식되어 있으며, 오래전 사용된 것인지 곳곳에 긁힌 흔적이 남아 있다.', '기념용으로 남겨둔 걸까?', '[투구], [흉갑 틈새]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '투구를 살펴본다', target: 'rusty-helmet' },
      { label: '흉갑 틈새를 살펴본다', target: 'rusty-chest' },
      { label: '갑옷 거치대로 돌아간다', target: 'armor-stand' }
    ]
  },
  'rusty-helmet': {
    title: '투구',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['녹슨 투구 내부는 어둡게 그늘져 있어 잘 보이지 않는다.', '어쩐지 희미하게 금속 긁히는 소리가 들려오는 것 같기도 한데…', '아무래도 투구 안에 무언가 있는 것 같다.', '꺼내볼까?'],
    options: [
      { label: '살펴본다', target: 'rusty-helmet-bug' },
      { label: '녹슨 갑옷으로 돌아간다', target: 'rusty-armor' }
    ]
  },
  'rusty-helmet-bug': {
    title: '투구 안',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['녹슨 틈새 사이를 뒤적이는 순간, 무언가 손등 위를 스쳐 지나갔다.', '…이게 뭐지?', '깜짝 놀라 손을 빼자 검고 번들거리는 무언가가 튀어 나왔다.', '매끄러운 등껍질이 희미한 빛을 반사하며 순식간에 어둠 속으로 사라졌다.', '……어쩐지 아주 익숙한 네 글자 이름의 곤충이 떠오른다.'],
    options: [{ label: '녹슨 갑옷으로 돌아간다', target: 'rusty-armor' }]
  },
  'rusty-chest': {
    title: '흉갑 틈새',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['녹슨 앞판과 옆판 사이의 흉갑 틈새.', '오래된 먼지와 녹가루가 틈마다 엉겨 붙어 있다.', '안쪽에 무언가 납작한 것이 끼어 있는 것 같은데…', '한 번 꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'rusty-chest-leather' },
      { label: '녹슨 갑옷으로 돌아간다', target: 'rusty-armor' }
    ]
  },
  'rusty-chest-leather': {
    title: '흉갑 안쪽',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['틈새 안쪽을 조심스럽게 더듬었다.', '손끝에 닿은 것은…', '힘없이 떨어져 나간 듯한 바스러진 가죽 조각이었다.', '갑옷 안에 고정되어 있던 완충재의 일부였던 걸까…?', '아무래도 선배들이 숨겨둔 쪽지는 아닌 것 같다.', '어라?', '가죽 조각이 빠진 자리 아래로 흉갑 안쪽의 흠집이 눈에 띈다.', '…같은 방향으로 여러 번 긁힌 자국처럼 보이는데……'],
    options: [
      { label: '조금 더 자세히 살펴본다', target: 'rusty-chest-scratch' },
      { label: '녹슨 갑옷으로 돌아간다', target: 'rusty-armor' }
    ]
  },
  'rusty-chest-scratch': {
    title: '흠집',
    path: '창고 · 갑옷 거치대 · 녹슨 갑옷',
    text: ['이 흠집은, 아무래도 안쪽에서 바깥으로 긁은 흔적 같다.', '흠집은 한곳에 몰려 있지 않고, 흉갑 안쪽을 따라 짧게 이어져 있다.', '오래된 흔적은 아닌지, 자국 위로는 녹 특유의 붉은 가루가 내려앉아 있지 않다.', '…무슨 일이 있었던 걸까?', '지금은 이 이상 건드리지 않는 편이 좋을 것 같다.'],
    options: [{ label: '녹슨 갑옷으로 돌아간다', target: 'rusty-armor' }]
  },
  'weapon-rack': {
    title: '무기 보관함',
    path: '창고 · 무기 보관함',
    text: ['훈련용 무기들이 종류별로 정리되어 있는 무기 보관함.', '오래 사용하지 않은 듯 손잡이와 날 부분에 먼지가 내려앉아 있다.', '대부분은 훈련용으로 보이지만, 몇몇 무기에는 유난히 깊은 흠집이 남아 있는 것 같다.', '무기 보관함에서는 [목검], [훈련용 창], [낡은 활]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '목검을 살펴본다', target: 'wood-sword' },
      { label: '훈련용 창을 살펴본다', target: 'training-spear' },
      { label: '낡은 활을 살펴본다', target: 'old-bow' },
      { label: '창고로 돌아간다', target: 'storage' }
    ]
  },
  'wood-sword': {
    title: '목검',
    path: '창고 · 무기 보관함 · 목검',
    text: ['여러 자루의 목검 사이에 꽂혀 있던 낡은 목검.', '오래 사용한 것인지 손잡이 부분이 유난히 매끈하게 닳아 있다.', '아래 쪽엔 잔흠집들이 빼곡하게 남아 있는 것 같은데…', '한 번 꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'wood-sword-result' },
      { label: '무기 보관함으로 돌아간다', target: 'weapon-rack' }
    ]
  },
  'wood-sword-result': {
    title: '목검',
    path: '창고 · 무기 보관함 · 목검',
    text: ['목검을 조심스럽게 꺼내보았다.', '손잡이에는 수많은 손이 쥐고 놓은 흔적이 남아 있다.', '끝부분의 잔흠집은 반복된 훈련으로 인해 만들어진 것 같다.', '대충 휘두른 흔적이라기보다는, 같은 동작을 몇 번이고 되풀이한 결과처럼 보인다.', '이곳에서 훈련하던 학생들은 꽤 열심이었던 모양이다.'],
    options: [{ label: '무기 보관함으로 돌아간다', target: 'weapon-rack' }]
  },
  'training-spear': {
    title: '훈련용 창',
    path: '창고 · 무기 보관함 · 훈련용 창',
    text: ['여러 자루의 창 사이에 기대어 있던 훈련용 창.', '날이 뭉툭하게 처리되어 있어 실제 전투보다는 훈련에 사용되던 것 같다.', '창대 한가운데에는 손의 위치를 맞추기 위해 붉은 끈이 감겨 있다.', '이 창으로 연습한 사람은 자세를 바로잡으며 기본 동작을 반복하던 모양이다.'],
    options: [{ label: '무기 보관함으로 돌아간다', target: 'weapon-rack' }]
  },
  'old-bow': {
    title: '낡은 활',
    path: '창고 · 무기 보관함 · 낡은 활',
    text: ['보관함 한쪽에 걸려 있던 낡은 활.', '오래 방치된 탓인지 활대가 조금 휘어 있다.', '시위는 느슨해져 있지만, 손잡이 옆에는 작은 천 조각이 묶여 있다.', '바람의 방향이라도 확인하려고 달아둔 것일까?', '시위가 많이 느슨해 보이는데… 한 번 당겨볼까?'],
    options: [
      { label: '당겨본다', target: 'old-bow-pull' },
      { label: '무기 보관함으로 돌아간다', target: 'weapon-rack' }
    ]
  },
  'old-bow-pull': {
    title: '낡은 활',
    path: '창고 · 무기 보관함 · 낡은 활',
    text: ['낡은 활의 시위를 조심스럽게 당겨보았다.', '끼익, 하고 마른 나무가 휘는 소리가 난다.', '생각보다 쉽게 당겨진다고 생각하던 순간……', '…뚝.', '시위가 힘없이 끊어져 아래로 늘어졌다.', '……망가뜨린 걸까?', '일단… 원래 망가져 있던 것처럼 걸어두도록 하자.'],
    options: [{ label: '무기 보관함으로 돌아간다', target: 'weapon-rack' }]
  },
  'training-dolls': {
    title: '훈련용 목각 인형',
    path: '창고 · 훈련용 목각 인형',
    text: ['한쪽 벽면을 따라 줄지어 세워져 있는 훈련용 목각 인형.', '사람보다는 크리쳐의 형태를 단순하게 본떠 만든 것 같다.', '뿔이나 발톱처럼 보이는 부분은 뭉툭하게 다듬어져 있어, 실제보다 덜 위협적으로 보인다.', '오래 사용된 것인지 인형 곳곳에는 무기로 맞은 자국이 남아 있다.', '훈련용 목각 인형 중에선 [뿔 달린 인형], [갑옷을 걸친 인형], [넘어진 인형]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '뿔 달린 인형', target: 'horned-doll' },
      { label: '갑옷을 걸친 인형', target: 'armored-doll' },
      { label: '넘어진 인형', target: 'fallen-doll' },
      { label: '창고로 돌아간다', target: 'storage' }
    ]
  },
  'horned-doll': {
    title: '뿔 달린 인형',
    path: '창고 · 훈련용 목각 인형',
    text: ['머리 위로 둥글게 다듬어진 돌기가 솟아 있는 뿔 달린 인형.', '크리쳐를 본떠 만든 것 같지만, 뿔 끝은 다치지 않도록 둥글게 깎여 있다.', '몸통에는 정면에서 맞은 흔적이 많아, 돌진을 막는 훈련에 쓰였던 것 같다.', '뿔 부분이 살짝 흔들리는 것 같은데…', '눌러볼까?'],
    options: [
      { label: '눌러본다', target: 'horned-doll-press' },
      { label: '목각 인형으로 돌아간다', target: 'training-dolls' }
    ]
  },
  'horned-doll-press': {
    title: '뿔 달린 인형',
    path: '창고 · 훈련용 목각 인형',
    text: ['뿔을 조심스럽게 눌러보았다.', '달칵.', '작은 소리와 함께 인형의 몸통 안쪽에서 무언가 움직이는 소리가 난다.', '곧이어 인형의 입 부분에서 낡은 천 조각이 툭 떨어졌다.', '천 조각에는 붉은 글씨로 경고문이 적혀 있다.', '‘돌진 주의!’', '…아무래도 훈련용 경고 장치였던 모양이다.'],
    options: [{ label: '목각 인형으로 돌아간다', target: 'training-dolls' }]
  },
  'armored-doll': {
    title: '갑옷을 걸친 인형',
    path: '창고 · 훈련용 목각 인형',
    text: ['가슴 부분에 낡은 금속 조각이 덧대어져 있는 갑옷을 걸친 인형.', '크리쳐의 단단한 외피를 흉내 내려던 것인지, 가슴 부분에 금속 조각이 덧대어져 있다.', '금속 조각은 조금 헐겁게 들떠 있는 것 같은데…', '……어라?', '안 쪽에 무언가 있는 것 같다.', '꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'armored-doll-note', gain: { note: 'armoredDoll' } },
      { label: '목각 인형으로 돌아간다', target: 'training-dolls' }
    ]
  },
  'armored-doll-note': {
    title: '쪽지',
    path: '창고 · 훈련용 목각 인형',
    text: ['금속 조각 안쪽에 끼워져 있던 것은…', '선배들이 숨겨둔 [쪽지]인 것 같다!', '끄트머리에 붉은 액체가 묻어 있는 것 같은데…', '일단 챙겨두는 것이 좋을 것 같다.'],
    options: [{ label: '목각 인형으로 돌아간다', target: 'training-dolls' }]
  },
  'fallen-doll': {
    title: '넘어진 인형',
    path: '창고 · 훈련용 목각 인형',
    text: ['줄에서 벗어나 옆으로 쓰러져 있는 넘어진 인형.', '네 발로 기는 크리쳐의 형태를 본뜬 것인지, 팔다리가 낮게 벌어져 있다.', '누군가 실수로 쓰러뜨린 뒤 그대로 방치한 모양이다.', '바닥에 닿은 발톱 부분이 심하게 닳아 있는 것으로 보아, 오래전부터 이 자세로 방치되어 있던 것 같다.'],
    options: [{ label: '목각 인형으로 돌아간다', target: 'training-dolls' }]
  },
  garden: {
    title: '정원',
    path: '아르카디움 피에타스 · 정원',
    text: ['학생들이 휴식할 수 있도록 작게 꾸며진 미니 정원.', '작은 화분과 벤치들이 가지런히 놓여 있으며, 가장자리에는 낮은 관목이 둘러져 있다.', '평소에는 조용히 쉬어가기 좋은 장소지만, 밤이 되니 식물의 그림자가 유난히 길게 늘어져 보이는 것만 같다.', '바람이 불 때마다 잎사귀가 스치는 소리가 들려온다.', '미니 정원에서는 [화단], [벤치], [관리함]을 조사할 수 있을 것 같다.'],
    options: [
      { label: '화단을 살펴본다', target: 'flower-bed' },
      { label: '벤치를 살펴본다', target: 'garden-bench' },
      { label: '관리함을 살펴본다', target: 'garden-box' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  },
  'flower-bed': {
    title: '화단',
    path: '정원 · 화단',
    text: ['작은 꽃들이 낮게 심어져 있는 화단.', '겨울이라 화려하진 않지만, 시클라멘 몇 송이가 아직 선명한 색을 띠고 있다.', '화단 가장자리에 꽂혀 있는 작은 이름표들도 눈에 띈다.', '화단에서는 [시클라멘], [이름표], [흙]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '시클라멘을 살펴본다', target: 'cyclamen' },
      { label: '이름표를 읽어본다', target: 'flower-label' },
      { label: '흙을 살펴본다', target: 'flower-soil' },
      { label: '정원으로 돌아간다', target: 'garden' }
    ]
  },
  cyclamen: {
    title: '시클라멘',
    path: '정원 · 화단',
    text: ['차가운 공기 속에서도 분홍색 꽃잎을 피우고 있는 시클라멘.', '꽃잎은 작게 말려 올라가 있고, 잎은 낮게 웅크린 듯 퍼져 있다.', '밤이라 그런지 선명한 색이 조금 낯설게 느껴지는 것만 같다.'],
    options: [{ label: '화단으로 돌아간다', target: 'flower-bed' }]
  },
  'flower-label': {
    title: '이름표',
    path: '정원 · 화단',
    text: ['화단 가장자리에 꽂혀 있는 작은 이름표.', '각 식물의 이름과 관리 주기가 적혀 있는 것 같다.', '대부분 깔끔하게 정리되어 있지만, 특이하게도 시클라멘 이름표 아래쪽엔 작은 글씨가 덧붙여 있는 것 같다.', '읽어볼까?'],
    options: [
      { label: '읽어본다', target: 'flower-label-read' },
      { label: '화단으로 돌아간다', target: 'flower-bed' }
    ]
  },
  'flower-label-read': {
    title: '작은 글씨',
    path: '정원 · 화단',
    text: ['작은 글씨를 자세히 읽어보았다.', '‘살아남았다는 것은 강하다는 증거.’', '……겨울에도 피어 있는 꽃이라서 적어둔 걸까?'],
    options: [{ label: '화단으로 돌아간다', target: 'flower-bed' }]
  },
  'flower-soil': {
    title: '흙',
    path: '정원 · 화단',
    text: ['화단을 덮고 있는 어두운 흙.', '겨울이라 그런지 표면이 조금 단단하게 굳어 있다.', '시클라멘 주변의 흙은 최근에 손질한 듯 고르게 정리되어 있다.', '누군가 꾸준하게 관리하고 있는 것 같다.'],
    options: [{ label: '화단으로 돌아간다', target: 'flower-bed' }]
  },
  'garden-bench': {
    title: '벤치',
    path: '정원 · 벤치',
    text: ['미니 정원 한쪽에 놓여 있는 벤치.', '여럿이 앉을 수 있도록 길이가 긴 것이 특징으로, 평소에도 잘 관리되고 있는 것 같다.', '밤공기에 차갑게 식어 있지만 먼지는 거의 쌓여 있지 않다.', '벤치에서는 [등받이], [벤치 아래], [가로등]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '등받이를 살펴본다', target: 'bench-back' },
      { label: '벤치 아래를 살펴본다', target: 'bench-under' },
      { label: '가로등을 살펴본다', target: 'garden-lamp' },
      { label: '정원으로 돌아간다', target: 'garden' }
    ]
  },
  'bench-back': {
    title: '등받이',
    path: '정원 · 벤치',
    text: ['매끈하게 정리된 벤치의 등받이.', '표면에는 별다른 흠집이 없지만, 한쪽 끝에 무언가 작게 붙어 있는 것 같다.', '한 번 살펴볼까?'],
    options: [
      { label: '살펴본다', target: 'bench-sticker' },
      { label: '벤치로 돌아간다', target: 'garden-bench' }
    ]
  },
  'bench-sticker': {
    title: '스티커',
    path: '정원 · 벤치',
    text: ['등받이 끝에 붙어 있던 것을 자세히 살펴보았다.', '…이건, 작은 스티커인 것 같은데?', '스티커에는 웃는 얼굴이 그려져 있다.', '누군가 장난으로 붙여둔 것 같다.'],
    options: [{ label: '벤치로 돌아간다', target: 'garden-bench' }]
  },
  'bench-under': {
    title: '벤치 아래',
    path: '정원 · 벤치',
    text: ['어둑한 그림자가 드리워진 벤치 아래.', '구석에 정리되지 않은 마른 잎 몇 장이 눈에 띤다.', '잎 사이로 차가운 흙바닥만 드러나 있다.'],
    options: [{ label: '벤치로 돌아간다', target: 'garden-bench' }]
  },
  'garden-lamp': {
    title: '가로등',
    path: '정원 · 벤치',
    text: ['벤치 옆을 은은하게 밝히고 있는 작은 가로등.', '차가운 밤공기 속, 가로등이 내는 희미한 불빛이 정원 위로 번지고 있는 것이 보인다.', '불빛이 조금 깜박거리고 있는 것 같은데…', '가까이서 한 번 볼까?'],
    options: [
      { label: '본다', target: 'garden-lamp-look' },
      { label: '벤치로 돌아간다', target: 'garden-bench' }
    ]
  },
  'garden-lamp-look': {
    title: '가로등',
    path: '정원 · 벤치',
    text: ['가로등을 가까이에서 올려다보았다.', '잠깐 흔들리던 불빛은 곧 다시 일정하게 돌아왔다.', '밤공기 때문에 잠시 깜박거렸던 걸까?', '희미한 불빛만 조용히 벤치 위로 내려앉고 있다.'],
    options: [{ label: '벤치로 돌아간다', target: 'garden-bench' }]
  },
  'garden-box': {
    title: '관리함',
    path: '정원 · 관리함',
    text: ['정원 관리용 도구를 보관하기 위해 놓여 있는 관리함.', '뚜껑은 닫혀 있지만, 잠겨 있지는 않은 것 같다.', '안쪽에서는 물기가 마른 흙 냄새가 희미하게 나고 있다.', '관리함에서는 [물뿌리개], [정원 가위], [낡은 장갑]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '물뿌리개를 살펴본다', target: 'watering-can' },
      { label: '정원 가위를 살펴본다', target: 'garden-scissors' },
      { label: '낡은 장갑을 살펴본다', target: 'old-gloves' },
      { label: '정원으로 돌아간다', target: 'garden' }
    ]
  },
  'watering-can': {
    title: '물뿌리개',
    path: '정원 · 관리함',
    text: ['관리함 한쪽에 세워져 있는 물뿌리개.', '입구 주변에 물때가 조금 남아 있는 것 같다.', '안쪽에서 희미하게 물기가 맺힌 냄새가 나는데…', '한 번 확인해볼까?'],
    options: [
      { label: '확인한다', target: 'watering-can-look' },
      { label: '관리함으로 돌아간다', target: 'garden-box' }
    ]
  },
  'watering-can-look': {
    title: '물뿌리개',
    path: '정원 · 관리함',
    text: ['물뿌리개 입구 안쪽을 조심스럽게 들여다보았다.', '바닥에 젖은 나뭇잎 몇 장이 가라앉아 있었다.', '정원에 물을 주다가 들어간 걸까?', '그 외엔 특별한 것은 없는 것 같다.'],
    options: [{ label: '관리함으로 돌아간다', target: 'garden-box' }]
  },
  'garden-scissors': {
    title: '정원 가위',
    path: '정원 · 관리함',
    text: ['손잡이가 접힌 채 놓여 있는 정원 가위.', '날 부분은 깨끗하게 닦여 있지만, 끝에 마른 잎 조각이 조금 끼어 있다.', '함부로 만지면 다칠 수 있을 것 같으니 주의하자.'],
    options: [{ label: '관리함으로 돌아간다', target: 'garden-box' }]
  },
  'old-gloves': {
    title: '낡은 장갑',
    path: '정원 · 관리함',
    text: ['관리함 구석에 접혀 있는 낡은 장갑.', '손끝 부분에 흙이 묻어 있고, 손목 부분은 안쪽으로 말려 들어가 있다.', '…어라?', '안쪽에 무언가 끼어 있는 것 같은데….', '한 번 꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'glove-note-get', gain: { note: 'gardenGlove' } },
      { label: '관리함으로 돌아간다', target: 'garden-box' }
    ]
  },
  'glove-note-get': {
    title: '쪽지',
    path: '정원 · 관리함 · 낡은 장갑',
    text: ['장갑 안쪽을 조심스럽게 털어보았다.', '툭.', '네잎클로버 모양으로 접힌 종이 한 장이 떨어졌다.', '선배들이 숨겨둔 [쪽지]인 걸까?', '……어라? 끄트머리에 붉은 액체가 묻어 있는데, 이건 뭐지?', '일단 챙겨두도록 하자.'],
    options: [{ label: '정원으로 돌아간다', target: 'garden' }]
  },
  statue: {
    title: '동상',
    path: '아르카디움 피에타스 · 동상',
    text: ['아르카디움 피에타스의 상징인 산양을 본떠 만들어진 동상.', '밤이 되니 그림자가 길게 드리워져 제법 그럴듯한 분위기를 만들고 있다.', '관리되어 깨끗하지만, 세월이 남긴 작은 흠집까지는 지워지지 않는 것 같다.', '동상에서는 [동상 앞], [동상 아래], [동상 뒤]를 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '동상 앞을 살펴본다', target: 'statue-front' },
      { label: '동상 아래를 살펴본다', target: 'statue-bottom' },
      { label: '동상 뒤를 살펴본다', target: 'statue-back' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  },
  'statue-front': {
    title: '동상 앞',
    path: '동상 · 동상 앞',
    text: ['산양의 모습이 정면으로 드러나는 동상 앞.', '고개를 살짝 치켜든 모습으로 조각되어 있어, 밤하늘을 바라보는 것처럼 보인다.', '정면에서 바라보니 산양의 눈 부분이 유난히 깊게 파여 있다.', '동상 앞에서는 [산양의 눈], [굽은 뿔], [목의 장식]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '산양의 눈을 살펴본다', target: 'goat-eyes' },
      { label: '굽은 뿔을 살펴본다', target: 'goat-horns' },
      { label: '목의 장식을 살펴본다', target: 'goat-neck' },
      { label: '동상으로 돌아간다', target: 'statue' }
    ]
  },
  'goat-eyes': {
    title: '산양의 눈',
    path: '동상 · 동상 앞',
    text: ['정면을 바라보도록 깊게 파여 있는 산양의 눈.', '별다른 장식 없이 그림자만 고여 있을 뿐임에도, 시선이 마주치는 것처럼 느껴진다.', '가까이서 보니 먼지가 조금 쌓여 있다… 세월의 흔적일까?', '눈을 오래 마주 보고 있으면… 어쩐지 섬뜩한 느낌이 드는 것만 같다.'],
    options: [{ label: '동상 앞으로 돌아간다', target: 'statue-front' }]
  },
  'goat-horns': {
    title: '굽은 뿔',
    path: '동상 · 동상 앞',
    text: ['머리 양옆으로 완만하게 휘어진 굽은 뿔.', '차가운 달빛을 받아 윤곽이 또렷하게 드러나고 있다.', '끝부분은 혹여 학생들이 다치지 않도록 둥글게 다듬어져 있다.', '뿔이 드리운 그림자가 바닥 위로 길게 휘어져 있다.'],
    options: [{ label: '동상 앞으로 돌아간다', target: 'statue-front' }]
  },
  'goat-neck': {
    title: '목의 장식',
    path: '동상 · 동상 앞',
    text: function () {
      const lines = ['산양의 목 아래쪽에 새겨진 목의 장식.', '목걸이처럼 둥글게 이어진 형태로 조각되어 있다.', '가운데 부분에는 작은 홈이 하나 있는데…', '무언가 끼워져 있던 자리일까?'];
      if (getInvestigationFlag('notesCombined')) lines.push('그 형태는, 맞춰본 쪽지에서 보았던 것과 닮아 있었다.');
      return lines;
    },
    options: [
      { label: '금속 배지를 끼워본다', target: 'badge-inserted', requires: { item: 'metalBadge' }, gain: { flag: 'badgeInserted' } },
      { label: '동상 앞으로 돌아간다', target: 'statue-front' }
    ]
  },
  'badge-inserted': {
    title: '목의 장식',
    path: '동상 · 동상 앞 · 목의 장식',
    text: function () {
      const lines = ['붉은색으로 칠해진 금속 배지를 홈에 조심스럽게 맞춰보았다.', '달칵.', '배지는 이상할 정도로 꼭 맞게 끼워졌다.', '그 순간,', '목의 장식을 따라 새겨진 둥근 선이 붉게 번져 보인 것만 같았다.', '……방금, 기분 탓이었을까?'];
      if (getInvestigationFlag('notesCombined')) lines.push('그 형태는, 맞춰본 쪽지에서 보았던 것과 닮아 있었다.');
      return lines;
    },
    options: [{ label: '동상으로 돌아간다', target: 'statue' }]
  },
  'statue-bottom': {
    title: '동상 아래',
    path: '동상 · 동상 아래',
    text: ['동상의 그림자가 짙게 내려앉아 있는 동상 아래.', '넓은 받침대가 차가운 바닥 위에 단단히 고정되어 있다.', '받침대 주변의 바닥은 물이 고이지 않도록 낮게 정리되어 있다.', '동상 아래에서는 [받침대], [배수구], [바닥 틈]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '받침대를 살펴본다', target: 'statue-base' },
      { label: '배수구를 살펴본다', target: 'statue-drain' },
      { label: '바닥 틈을 살펴본다', target: 'statue-gap' },
      { label: '동상으로 돌아간다', target: 'statue' }
    ]
  },
  'statue-base': {
    title: '받침대',
    path: '동상 · 동상 아래',
    text: ['동상 아래에 넓게 놓인 받침대.', '겉면은 꾸준히 닦은 듯 깨끗하지만, 모서리 부분에는 오래된 흠집이 조금 남아 있다.', '손으로 훑어보면 차갑고 단단한 감촉이 전해질 것 같다.', '달빛이 닿은 윗면만 희미하게 밝아 보인다.'],
    options: [{ label: '동상 아래로 돌아간다', target: 'statue-bottom' }]
  },
  'statue-drain': {
    title: '배수구',
    path: '동상 · 동상 아래',
    text: ['받침대 옆 바닥에 작게 나 있는 배수구.', '낮게 파인 가장자리에는 흙먼지가 얇게 쌓여 있다.', '안쪽은 어두워 깊이를 가늠하기 어렵다.', '가까이 귀를 기울이면 물방울이 떨어지는 듯한 소리가 작게 들린다.'],
    options: [{ label: '동상 아래로 돌아간다', target: 'statue-bottom' }]
  },
  'statue-gap': {
    title: '바닥 틈',
    path: '동상 · 동상 아래',
    text: ['받침대와 맞닿은 부분에 난 바닥 틈.', '오래된 먼지과 흙이 틈 사이에 끼어 있다.', '자세히 보니, 틈 사이에 무언가 있는 것 같은데…', '한 번 꺼내볼까?'],
    options: [
      { label: '꺼내본다', target: 'statue-note-folded' },
      { label: '동상 아래로 돌아간다', target: 'statue-bottom' }
    ]
  },
  'statue-note-folded': {
    title: '쪽지',
    path: '동상 · 동상 아래 · 바닥 틈',
    text: ['바닥 틈에 걸려 있던 것을 조심스럽게 꺼냈다.', '찾은 것은 작게 접힌 [쪽지]였다.', '선배들이 숨겨둔 것일까?', '어라? 쪽지에 무언가 쓰여 있는 것 같다.', '확인해볼까?'],
    options: [
      { label: '확인해본다', target: 'statue-note-get', gain: { note: 'statueGap' } },
      { label: '동상 아래로 돌아간다', target: 'statue-bottom' }
    ]
  },
  'statue-note-get': {
    title: '산양 문양 쪽지',
    path: '동상 · 동상 아래 · 바닥 틈',
    text: ['쪽지에는 산양을 본뜬 작은 문양이 그려져 있었다.', '그러고 보니, 이 학교의 상징은 산양이었던 것 같은데…', '지금으로선 쪽지의 의미를 파악하기 어려울 것 같다.', '일단 쪽지를 챙겨볼까?'],
    options: [{ label: '동상으로 돌아간다', target: 'statue' }]
  },
  'statue-back': {
    title: '동상 뒤',
    path: '동상 · 동상 뒤',
    text: ['앞쪽에서는 잘 보이지 않는 동상 뒤.', '동상에 가려진 뒤쪽에는 그림자가 짙게 드리워져 있다.', '손이 잘 닿지 않는 곳마다 얇게 내려앉은 먼지가 눈에 띈다.', '동상 뒤에서는 [등 부분], [다리 부분], [바닥]을 살펴볼 수 있을 것 같다.'],
    options: [
      { label: '등 부분을 살펴본다', target: 'statue-backline' },
      { label: '다리 부분을 살펴본다', target: 'statue-leg' },
      { label: '바닥을 살펴본다', target: 'statue-back-floor' },
      { label: '동상으로 돌아간다', target: 'statue' }
    ]
  },
  'statue-backline': {
    title: '등 부분',
    path: '동상 · 동상 뒤',
    text: ['산양의 등선을 따라 매끈하게 다듬어진 등 부분.', '정면보다 손이 덜 닿는 위치라 그런지 먼지가 조금 남아 있다.', '표면을 따라 조각된 선이 밤빛 아래 희미하게 이어져 있는 것 같다.'],
    options: [{ label: '동상 뒤로 돌아간다', target: 'statue-back' }]
  },
  'statue-leg': {
    title: '다리 부분',
    path: '동상 · 동상 뒤',
    text: ['동상 뒤쪽에서 받침대를 딛고 있는 다리 부분.', '산양의 다리답게 가늘지만 단단한 형태로 조각되어 있다.', '다리 아래쪽에는 얕은 홈이 하나 파여 있는 것 같은데…', '한 번 눌러볼까?'],
    options: [
      { label: '눌러본다', target: 'statue-leg-press' },
      { label: '동상 뒤로 돌아간다', target: 'statue-back' }
    ]
  },
  'statue-leg-press': {
    title: '다리 부분',
    path: '동상 · 동상 뒤',
    text: ['얕은 홈 부분을 손끝으로 조심스럽게 눌러보았다.', '하지만 딱딱한 돌 표면은 조금도 움직이지 않는다….', '다만 홈 안쪽에 낀 먼지가 손끝에 조금 묻어났다.', '장식의 일부였던 모양이다.'],
    options: [{ label: '동상 뒤로 돌아간다', target: 'statue-back' }]
  },
  'statue-back-floor': {
    title: '바닥',
    path: '동상 · 동상 뒤',
    text: ['동상 뒤쪽에 낮게 가려진 바닥.', '받침대 그림자 때문에 앞쪽보다 어둡게 보인다.', '작은 돌 조각과 흙먼지가 바닥 위에 흩어져 있다.', '유난히 눈에 띄는 돌 조각이 있는데…', '발로 밀어볼까?'],
    options: [
      { label: '밀어본다', target: 'statue-stone-push' },
      { label: '동상 뒤로 돌아간다', target: 'statue-back' }
    ]
  },
  'statue-stone-push': {
    title: '돌 조각',
    path: '동상 · 동상 뒤',
    text: ['발끝으로 작은 돌 조각을 밀어보았다.', '데구르르… 퉁.', '돌 조각은 가벼운 소리를 내며 옆으로 굴러갔다.', '돌 조각이 있던 자리에는 눌린 흙자국만 희미하게 남아 있다.', '…누가 본 사람은 없겠지?', '혹시 모르니 흙자국을 지우는 편이 좋아 보인다.'],
    options: [{ label: '동상 뒤로 돌아간다', target: 'statue-back' }]
  },
  'combine-notes': {
    title: '쪽지 조합',
    path: '담력시험 · 쪽지 조합',
    text: [
      '모아둔 쪽지를 조심스럽게 펼쳐보았다.',
      '붉은 얼룩이 묻은 끄트머리들이 서로 맞물리듯 이어진다.',
      '흩어져 있던 그림과 문장 사이로 산양을 본뜬 작은 문양이 드러난다.',
      '어쩌면, 이 문양과 닮은 것을 학교 어딘가에서 본 적이 있는지도 모른다.'
    ],
    onEnter: { flag: 'notesCombined' },
    options: [
      { label: '동상으로 간다', target: 'statue' },
      { label: '처음 장소로 돌아간다', target: 'trial-start' }
    ]
  }
};

const INVESTIGATION_ITEM_LABELS = {
  returnBoxKey: '반납함 열쇠',
  gearKey: '톱니바퀴 열쇠',
  metalBadge: '붉은 금속 배지'
};

function getInvestigationStorageKey() {
  return 'mythosInvestigationTrialDay2:' + (currentPersonalCode || 'guest');
}

function cloneInvestigationDefaultState() {
  return JSON.parse(JSON.stringify(INVESTIGATION_DEFAULT_STATE));
}

function getInvestigationState() {
  if (investigationState) return investigationState;

  const saved = localStorage.getItem(getInvestigationStorageKey());
  if (saved) {
    try {
      investigationState = Object.assign(cloneInvestigationDefaultState(), JSON.parse(saved));
      investigationState.items = investigationState.items || {};
      investigationState.flags = investigationState.flags || {};
      investigationState.noteSources = investigationState.noteSources || {};
      investigationState.notes = Object.keys(investigationState.noteSources).length;
      return investigationState;
    } catch (error) {
      console.error(error);
    }
  }

  investigationState = cloneInvestigationDefaultState();
  return investigationState;
}

function saveInvestigationState() {
  const state = getInvestigationState();
  state.notes = Object.keys(state.noteSources || {}).length;
  localStorage.setItem(getInvestigationStorageKey(), JSON.stringify(state));
}

function getInvestigationFlag(flagName) {
  return !!(getInvestigationState().flags || {})[flagName];
}

function getInvestigationItem(itemId) {
  return !!(getInvestigationState().items || {})[itemId];
}

function applyInvestigationGain(gain) {
  if (!gain) return;

  const state = getInvestigationState();
  state.items = state.items || {};
  state.flags = state.flags || {};
  state.noteSources = state.noteSources || {};

  if (gain.note && !state.noteSources[gain.note]) {
    state.noteSources[gain.note] = true;
  }

  if (gain.item) {
    state.items[gain.item] = true;
  }

  if (gain.consumeItem) {
    state.items[gain.consumeItem] = false;
  }

  if (gain.flag) {
    state.flags[gain.flag] = true;
  }

  saveInvestigationState();
}

function resetInvestigationState() {
  const message = '담력시험 진행 상태를 초기화할까요?\n수집한 쪽지, 열쇠, 배지 상태가 모두 초기화됩니다.';

  if (typeof openConfirmModal === 'function') {
    openConfirmModal('진행 초기화', message, function () {
      localStorage.removeItem(getInvestigationStorageKey());
      investigationState = cloneInvestigationDefaultState();
      investigationHistory = [];
      currentInvestigationNodeId = 'trial-start';
      renderInvestigationNode();
    });
    return;
  }

  if (!confirm(message)) return;
  localStorage.removeItem(getInvestigationStorageKey());
  investigationState = cloneInvestigationDefaultState();
  investigationHistory = [];
  currentInvestigationNodeId = 'trial-start';
  renderInvestigationNode();
}

function showInvestigationPage() {
  closeModalIfExists('mail-modal');
  closeModalIfExists('letter-paper-modal');
  closeModalIfExists('mail-write-modal');
  closeModalIfExists('supply-write-modal');
  closeModalIfExists('settings-modal');
  closeModalIfExists('confirm-modal');
  closeModalIfExists('memo-write-modal');
  closeModalIfExists('memo-detail-modal');

  const mainScreen = document.querySelector('.main-screen');
  const memoPage = document.getElementById('memo-page');
  const investigationPage = document.getElementById('investigation-page');

  if (mainScreen) mainScreen.style.display = 'none';
  if (memoPage) memoPage.style.display = 'none';
  if (investigationPage) investigationPage.style.display = 'block';

  loadInvestigationStatDraft();
  if (!INVESTIGATION_NODES[currentInvestigationNodeId]) currentInvestigationNodeId = 'trial-start';
  renderInvestigationNode();
}

function hideInvestigationPage() {
  const investigationPage = document.getElementById('investigation-page');
  if (investigationPage) investigationPage.style.display = 'none';
}

function getInvestigationNodeText(node) {
  if (!node) return [];
  if (typeof node.text === 'function') return node.text();
  return Array.isArray(node.text) ? node.text : [];
}

function renderInvestigationNode() {
  const node = INVESTIGATION_NODES[currentInvestigationNodeId] || INVESTIGATION_NODES['trial-start'];
  const title = document.getElementById('investigation-title');
  const path = document.getElementById('investigation-path');
  const text = document.getElementById('investigation-text');
  const options = document.getElementById('investigation-options');

  if (node.onEnter) {
    applyInvestigationGain(node.onEnter);
  }

  if (title) title.textContent = node.title || '담력시험';
  if (path) path.textContent = node.path || '탈리스 · 아르카디움 피에타스';

  if (text) {
    text.innerHTML = getInvestigationNodeText(node)
      .map(line => '<p>' + escapeHtml(line) + '</p>')
      .join('');
  }

  if (options) {
    const optionHtml = (node.options || [])
      .map((option, index) => renderInvestigationOption(option, index))
      .join('');

    const backHtml = investigationHistory.length
      ? '<button type="button" class="investigation-option investigation-option-muted" onclick="goBackInvestigation()">이전 조사로 돌아간다</button>'
      : '';

    options.innerHTML = optionHtml + backHtml;
  }

  renderInvestigationState();
}

function renderInvestigationOption(option, index) {
  const lockedReason = getInvestigationOptionLockedReason(option);
  const className = lockedReason ? ' investigation-option-locked' : '';
  const subText = getInvestigationOptionSubText(option, lockedReason);

  return [
    '<button type="button" class="investigation-option' + className + '" onclick="selectInvestigationOption(' + index + ')">',
    '<span>' + escapeHtml(option.label || '선택지') + '</span>',
    subText ? '<em>' + escapeHtml(subText) + '</em>' : '',
    '</button>'
  ].join('');
}

function getInvestigationOptionSubText(option, lockedReason) {
  if (lockedReason) return lockedReason;

  if (option.statCheck) {
    const need = getInvestigationStrengthNeed();
    return option.statCheck.label + ' 팀합산 ' + (need > 0 ? need + ' 이상' : '필요값 미정');
  }

  if (option.requires && option.requires.notes) {
    return '쪽지 ' + option.requires.notes + '장 필요';
  }

  if (option.requires && option.requires.item) {
    return INVESTIGATION_ITEM_LABELS[option.requires.item] + ' 필요';
  }

  return '';
}

function getInvestigationOptionLockedReason(option) {
  if (!option || !option.requires) return '';

  if (option.requires.item && !getInvestigationItem(option.requires.item)) {
    return (INVESTIGATION_ITEM_LABELS[option.requires.item] || '필요 아이템') + '이 필요합니다.';
  }

  if (option.requires.notes && getInvestigationState().notes < option.requires.notes) {
    return '쪽지가 ' + (option.requires.notes - getInvestigationState().notes) + '장 더 필요합니다.';
  }

  if (option.requires.flag && !getInvestigationFlag(option.requires.flag)) {
    return '아직 조건을 만족하지 못했습니다.';
  }

  return '';
}

function selectInvestigationOption(index) {
  const node = INVESTIGATION_NODES[currentInvestigationNodeId];
  if (!node || !node.options || !node.options[index]) return;

  const option = node.options[index];
  const lockedReason = getInvestigationOptionLockedReason(option);

  if (lockedReason) {
    showInvestigationNotice(lockedReason);
    return;
  }

  let target = option.target;

  if (option.statCheck && !passInvestigationStatCheck(option.statCheck)) {
    target = option.failTarget || target;
  } else {
    applyInvestigationGain(option.gain);
  }

  if (!target || !INVESTIGATION_NODES[target]) return;

  investigationHistory.push(currentInvestigationNodeId);
  if (investigationHistory.length > 30) investigationHistory.shift();
  currentInvestigationNodeId = target;
  renderInvestigationNode();
}

function goBackInvestigation() {
  const prev = investigationHistory.pop();
  if (!prev || !INVESTIGATION_NODES[prev]) return;
  currentInvestigationNodeId = prev;
  renderInvestigationNode();
}

function showInvestigationNotice(message) {
  if (typeof openAlertModal === 'function') {
    openAlertModal('조사 조건', message);
    return;
  }

  alert(message);
}

function renderInvestigationState() {
  const state = getInvestigationState();
  const list = document.getElementById('investigation-state-list');
  const summary = document.getElementById('investigation-stat-summary');

  if (list) {
    const items = [];
    items.push('<div><span>쪽지</span><strong>' + state.notes + ' / 5</strong></div>');
    items.push('<div><span>쪽지 조합</span><strong>' + (getInvestigationFlag('notesCombined') ? '완료' : '미완료') + '</strong></div>');
    items.push('<div><span>반납함 열쇠</span><strong>' + (getInvestigationItem('returnBoxKey') ? '보유' : '-') + '</strong></div>');
    items.push('<div><span>톱니바퀴 열쇠</span><strong>' + (getInvestigationItem('gearKey') ? '보유' : (getInvestigationFlag('machineRoomOpen') ? '사용됨' : '-')) + '</strong></div>');
    items.push('<div><span>붉은 금속 배지</span><strong>' + (getInvestigationItem('metalBadge') ? '보유' : '-') + '</strong></div>');
    items.push('<div><span>수동 압축 펌프</span><strong>' + (getInvestigationFlag('pumpOn') ? '작동' : '-') + '</strong></div>');
    items.push('<div><span>목의 장식</span><strong>' + (getInvestigationFlag('badgeInserted') ? '배지 장착' : '-') + '</strong></div>');
    list.innerHTML = items.join('');
  }

  if (summary) {
    const playerStrength = getCurrentPlayerStat('strength');
    const teamTotal = getInvestigationStrengthTotal();
    const need = getInvestigationStrengthNeed();
    summary.innerHTML =
      '<div>내 근력: <strong>' + playerStrength + '</strong></div>' +
      '<div>현재 팀 합산: <strong>' + (teamTotal > 0 ? teamTotal : '미입력') + '</strong></div>' +
      '<div>필요값: <strong>' + (need > 0 ? need : '미정') + '</strong></div>';
  }
}

function getCurrentPlayerData() {
  const savedPlayerData = localStorage.getItem('mythosPlayerData');
  if (!savedPlayerData) return null;

  try {
    return JSON.parse(savedPlayerData);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function getCurrentPlayerStat(statKey) {
  const player = getCurrentPlayerData();
  if (!player) return 0;
  return Number(player[statKey] || 0);
}

function getInvestigationStatDraftKey() {
  return 'mythosInvestigationStatDraft:' + (currentPersonalCode || 'guest');
}

function loadInvestigationStatDraft() {
  const saved = localStorage.getItem(getInvestigationStatDraftKey());
  let draft = {};

  if (saved) {
    try {
      draft = JSON.parse(saved);
    } catch (error) {
      console.error(error);
    }
  }

  const strengthNeed = document.getElementById('investigation-strength-need');
  const strengthTotal = document.getElementById('investigation-strength-total');

  if (strengthNeed && draft.strengthNeed) strengthNeed.value = draft.strengthNeed;
  if (strengthTotal && draft.strengthTotal) strengthTotal.value = draft.strengthTotal;
}

function saveInvestigationStatDraft() {
  const draft = {
    strengthNeed: document.getElementById('investigation-strength-need')?.value || '',
    strengthTotal: document.getElementById('investigation-strength-total')?.value || ''
  };

  localStorage.setItem(getInvestigationStatDraftKey(), JSON.stringify(draft));
  renderInvestigationState();
}

function getInvestigationStrengthNeed() {
  const input = document.getElementById('investigation-strength-need');
  return Number(input && input.value ? input.value : 0);
}

function getInvestigationStrengthTotal() {
  const input = document.getElementById('investigation-strength-total');
  const typed = Number(input && input.value ? input.value : 0);
  return typed > 0 ? typed : getCurrentPlayerStat('strength');
}

function passInvestigationStatCheck(statCheck) {
  if (!statCheck) return true;

  if (statCheck.stat === 'strength') {
    const need = getInvestigationStrengthNeed();
    if (!need) return true;
    return getInvestigationStrengthTotal() >= need;
  }

  return true;
}

function showMemoPage() {
  closeModalIfExists('mail-modal');
  closeModalIfExists('letter-paper-modal');
  closeModalIfExists('mail-write-modal');
  closeModalIfExists('supply-write-modal');
  closeModalIfExists('settings-modal');
  closeModalIfExists('confirm-modal');
  closeModalIfExists('memo-write-modal');
  closeModalIfExists('memo-detail-modal');

  const mainScreen = document.querySelector('.main-screen');
  const memoPage = document.getElementById('memo-page');
  const investigationPage = document.getElementById('investigation-page');

  if (mainScreen) mainScreen.style.display = 'none';
  if (investigationPage) investigationPage.style.display = 'none';
  if (memoPage) memoPage.style.display = 'block';

  currentMemoTab = 'all';
  currentMemoPage = 1;
  renderLocalMemos(getInitialMemoList());

  requestAnimationFrame(function () {
    loadPersonalMemos({ silent: true });
  });
}

function showMainPage() {
  const mainScreen = document.querySelector('.main-screen');
  const memoPage = document.getElementById('memo-page');
  const investigationPage = document.getElementById('investigation-page');

  if (memoPage) memoPage.style.display = 'none';
  if (investigationPage) investigationPage.style.display = 'none';
  if (mainScreen) mainScreen.style.display = 'grid';
}

function openMemoWriteModal() {
  const modal = document.getElementById('memo-write-modal');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
  const memoTitleInput = document.getElementById('memo-title-input');
  const memoInput = document.getElementById('memo-input');
  const saveBtn = document.querySelector('.memo-save-btn');

  if (!modal) return;

  currentMemoEditIndex = -1;
  currentMemoEditId = '';
  if (modalTitle) modalTitle.textContent = '메모 작성';
  if (saveBtn) saveBtn.textContent = '메모 저장';
  if (memoTitleInput) memoTitleInput.value = '';
  if (memoInput) {
    memoInput.value = '';
    memoInput.oninput = updateMemoContentCount;
  }

  updateMemoContentCount();
  modal.style.display = 'flex';
}

function openMemoEditModal() {
  const memo = currentMemoRenderCache[currentMemoDetailMemoIndex];
  if (!memo) return;

  const modal = document.getElementById('memo-write-modal');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
  const memoTitleInput = document.getElementById('memo-title-input');
  const memoInput = document.getElementById('memo-input');
  const saveBtn = document.querySelector('.memo-save-btn');

  if (!modal || !memoTitleInput || !memoInput) return;

  currentMemoEditIndex = currentMemoDetailMemoIndex;
  currentMemoEditId = memo.memoId || '';
  if (modalTitle) modalTitle.textContent = '메모 수정';
  if (saveBtn) saveBtn.textContent = '수정 저장';
  memoTitleInput.value = getMemoTitle(memo);
  memoInput.value = memo.content || '';
  memoInput.oninput = updateMemoContentCount;
  updateMemoContentCount();
  closeMemoDetailModal();
  modal.style.display = 'flex';
}

function closeMemoWriteModal() {
  const modal = document.getElementById('memo-write-modal');
  if (!modal) return;
  modal.style.display = 'none';
  currentMemoEditIndex = -1;
  currentMemoEditId = '';
}

function updateMemoContentCount() {
  const memoInput = document.getElementById('memo-input');
  const count = document.getElementById('memo-content-count');

  if (!memoInput || !count) return;

  count.textContent = String(memoInput.value.length);
}

function saveLocalMemo() {
  if (isMemoSaving) return;

  const memoTitleInput = document.getElementById('memo-title-input');
  const memoInput = document.getElementById('memo-input');
  if (!memoInput) return;

  const title = memoTitleInput ? memoTitleInput.value.trim() : '';
  const content = memoInput.value.trim();

  if (!title) {
    openAlertModal('저장 불가', '메모 제목을 입력해주세요.');
    return;
  }

  if (title.length > 40) {
    openAlertModal('저장 불가', '메모 제목은 40자 이내로 입력해주세요.');
    return;
  }

  if (!content) {
    openAlertModal('저장 불가', '메모 내용을 입력해주세요.');
    return;
  }

  if (content.length > 10000) {
    openAlertModal('저장 불가', '메모 내용은 10000자 이내로 입력해주세요.');
    return;
  }

  if (currentMemoEditIndex >= 0) {
    updateLocalMemo(title, content);
    return;
  }

  if (currentPersonalCode) {
    isMemoSaving = true;
    setMemoSaveButtonState(true);

    const player = getCurrentPlayerForMemo();
    const optimisticMemos = [{
      title: title,
      content: content,
      createdAt: new Date().toISOString(),
      personalCode: currentPersonalCode,
      characterName: player.characterName || '',
      placeId: player.currentPlaceId || '',
      placeName: '',
      isBookmarked: false
    }].concat(getInitialMemoList());

    setCachedServerMemos(optimisticMemos);
    renderLocalMemos(optimisticMemos);

    saveServerMemo(title, content)
      .then(saved => {
        if (saved) {
          if (memoTitleInput) memoTitleInput.value = '';
          memoInput.value = '';
          closeMemoWriteModal();
          loadPersonalMemos({ silent: true, force: true });
          return;
        }

        saveLocalMemoContent(title, content);
        setCachedServerMemos([]);
        if (memoTitleInput) memoTitleInput.value = '';
        memoInput.value = '';
        closeMemoWriteModal();
        renderLocalMemos();
      })
      .finally(() => {
        isMemoSaving = false;
        setMemoSaveButtonState(false);
      });

    return;
  }

  saveLocalMemoContent(title, content);
  if (memoTitleInput) memoTitleInput.value = '';
  memoInput.value = '';
  closeMemoWriteModal();
  renderLocalMemos();
}

function saveLocalMemoContent(title, content) {
  const memos = getLocalMemos();
  const player = getCurrentPlayerForMemo();

  memos.unshift({
    title: title,
    content: content,
    createdAt: new Date().toISOString(),
    personalCode: currentPersonalCode || '',
    characterName: player.characterName || '',
    placeId: player.currentPlaceId || '',
    placeName: '',
    isBookmarked: false
  });

  setLocalMemos(memos);
}

function updateLocalMemo(title, content) {
  const targetMemo = currentMemoRenderCache[currentMemoEditIndex];
  const memoTitleInput = document.getElementById('memo-title-input');
  const memoInput = document.getElementById('memo-input');

  if (!targetMemo) return;

  if (currentPersonalCode && currentMemoEditId.indexOf('server:') === 0) {
    isMemoSaving = true;
    setMemoSaveButtonState(true);

    targetMemo.title = title;
    targetMemo.content = content;
    setCachedServerMemos(currentMemoRenderCache);
    renderLocalMemos(currentMemoRenderCache);

    updateServerMemo(currentMemoEditId, title, content)
      .then(updated => {
        if (!updated) {
          loadPersonalMemos({ silent: true, force: true });
          return;
        }

        const updatedIndex = currentMemoEditIndex;
        closeMemoWriteModal();
        openMemoDetailModal(updatedIndex);
      })
      .finally(() => {
        isMemoSaving = false;
        setMemoSaveButtonState(false);
      });

    return;
  }

  const memos = getLocalMemos();
  const safeIndex = Number(currentMemoEditIndex);

  if (Number.isNaN(safeIndex) || safeIndex < 0 || safeIndex >= memos.length) return;

  memos[safeIndex].title = title;
  memos[safeIndex].content = content;
  setLocalMemos(memos);

  if (memoTitleInput) memoTitleInput.value = '';
  if (memoInput) memoInput.value = '';
  const updatedIndex = safeIndex;
  closeMemoWriteModal();
  renderLocalMemos();
  openMemoDetailModal(updatedIndex);
}

function loadPersonalMemos(options) {
  if (isMemoLoading) return;

  if (!currentPersonalCode) {
    renderLocalMemos();
    return;
  }

  const force = !!(options && options.force);

  if (!force && isServerMemoCacheFresh()) {
    return;
  }

  isMemoLoading = true;

  loadServerMemos()
    .then(loaded => {
      if (!loaded) renderLocalMemos();
    })
    .finally(() => {
      isMemoLoading = false;
    });
}

function renderLocalMemos(memos) {
  const list = document.getElementById('memo-list');
  if (!list) return;

  const safeMemos = Array.isArray(memos) ? memos : getLocalMemos();
  currentMemoRenderCache = safeMemos;
  updateMemoTabActive();

  const visibleMemos = getVisibleMemos(safeMemos);
  const totalPages = Math.max(1, Math.ceil(visibleMemos.length / MEMO_PAGE_SIZE));

  if (currentMemoPage > totalPages) currentMemoPage = totalPages;
  if (currentMemoPage < 1) currentMemoPage = 1;

  updateMemoPageControls(totalPages);

  if (!visibleMemos.length) {
    list.innerHTML = currentMemoTab === 'bookmark'
      ? '<div class="memo-empty">책갈피한 메모가 없습니다.</div>'
      : '<div class="memo-empty">저장된 메모가 없습니다.</div>';
    return;
  }

  const startIndex = (currentMemoPage - 1) * MEMO_PAGE_SIZE;
  const pageMemos = visibleMemos.slice(startIndex, startIndex + MEMO_PAGE_SIZE);

  list.innerHTML = pageMemos.map(memo => {
    const memoIndex = safeMemos.indexOf(memo);
    const titleText = getMemoTitle(memo);
    const dateText = memo.time || memo.createdAt
      ? formatMemoDateShort(memo.time || memo.createdAt)
      : '';
    const placeText = memo.placeName || memo.placeId || '';
    const deleteArg = memo.memoId
      ? "'" + escapeForAttribute(memo.memoId) + "'"
      : String(memoIndex);
    const bookmarkKey = memo.memoId || getMemoIdentity(memo);
    const bookmarkClass = isMemoBookmarked(memo) ? ' active' : '';
    const bookmarkLabel = isMemoBookmarked(memo) ? '책갈피 해제' : '책갈피';

    return `
      <div class="memo-item">
        <button class="memo-bookmark-btn${bookmarkClass}" onclick="toggleMemoBookmark('${escapeForAttribute(bookmarkKey)}')" title="${bookmarkLabel}">★</button>
        <button class="memo-delete-btn" onclick="deleteLocalMemo(${deleteArg})">×</button>
        <button type="button" class="memo-title-btn" onclick="openMemoDetailModal(${memoIndex})">${escapeHtml(titleText)}</button>
        ${placeText ? '<div class="memo-place">' + escapeHtml(placeText) + '</div>' : ''}
        <div class="memo-date">${escapeHtml(dateText)}</div>
      </div>
    `;
  }).join('');
}

function deleteLocalMemo(memoIdOrIndex) {
  openConfirmModal(
    '메모 삭제',
    '이 메모를 정말 삭제하시겠습니까?\n삭제한 메모는 복구할 수 없습니다.',
    function () {
      deleteLocalMemoAfterConfirm(memoIdOrIndex);
    }
  );
}

function deleteLocalMemoAfterConfirm(memoIdOrIndex) {
  if (currentPersonalCode && String(memoIdOrIndex).indexOf('server:') === 0) {
    deleteServerMemo(memoIdOrIndex)
      .then(deleted => {
        if (deleted) {
          loadPersonalMemos({ force: true });
        }
      });

    return;
  }

  const memos = getLocalMemos();
  const safeIndex = Number(memoIdOrIndex);

  if (Number.isNaN(safeIndex) || safeIndex < 0 || safeIndex >= memos.length) return;

  memos.splice(safeIndex, 1);
  setLocalMemos(memos);
  removeMemoBookmark(currentMemoRenderCache[safeIndex]);
  renderLocalMemos();
}

function openMemoDetailModal(memoIndex) {
  currentMemoDetailMemoIndex = Number(memoIndex);
  const memo = currentMemoRenderCache[currentMemoDetailMemoIndex];
  if (!memo) return;

  const modal = document.getElementById('memo-detail-modal');
  const title = document.getElementById('memo-detail-title');
  const date = document.getElementById('memo-detail-date');
  const meta = document.getElementById('memo-detail-meta');

  if (!modal || !title || !date || !meta) return;

  const dateText = memo.time || memo.createdAt
    ? formatMemoDateShort(memo.time || memo.createdAt)
    : '';
  const placeText = getMemoPlaceLabel(memo);

  title.textContent = getMemoTitle(memo);
  date.textContent = [placeText, dateText].filter(Boolean).join(' · ') || '-';
  currentMemoDetailPages = splitMemoDetailPages(memo.content || '');
  currentMemoDetailPage = 1;
  currentMemoDetailBaseMeta = '';
  renderMemoDetailPage();
  updateMemoItemTabs();
  modal.style.display = 'flex';
}

function closeMemoDetailModal() {
  const modal = document.getElementById('memo-detail-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function getMemoDetailVisibleIndexes() {
  return getVisibleMemos(currentMemoRenderCache)
    .map(memo => currentMemoRenderCache.indexOf(memo))
    .filter(index => index >= 0);
}

function updateMemoItemTabs() {
  const prevBtn = document.querySelector('.memo-book-tab-prev');
  const nextBtn = document.querySelector('.memo-book-tab-next');
  const indexes = getMemoDetailVisibleIndexes();
  const position = indexes.indexOf(currentMemoDetailMemoIndex);

  if (prevBtn) prevBtn.disabled = position <= 0;
  if (nextBtn) nextBtn.disabled = position < 0 || position >= indexes.length - 1;
}

function goPrevMemoItem() {
  const indexes = getMemoDetailVisibleIndexes();
  const position = indexes.indexOf(currentMemoDetailMemoIndex);

  if (position <= 0) return;

  openMemoDetailModal(indexes[position - 1]);
}

function goNextMemoItem() {
  const indexes = getMemoDetailVisibleIndexes();
  const position = indexes.indexOf(currentMemoDetailMemoIndex);

  if (position < 0 || position >= indexes.length - 1) return;

  openMemoDetailModal(indexes[position + 1]);
}

function splitMemoDetailPages(content) {
  const text = String(content || '');
  const pages = [];
  let cursor = 0;
  let pageIndex = 0;

  while (cursor < text.length) {
    const length = pageIndex % 2 === 0
      ? MEMO_DETAIL_LEFT_LENGTH
      : MEMO_DETAIL_RIGHT_LENGTH;

    pages.push(text.slice(cursor, cursor + length));
    cursor += length;
    pageIndex++;
  }

  return pages.length ? pages : [''];
}

function renderMemoDetailPage(direction) {
  const left = document.getElementById('memo-detail-left');
  const right = document.getElementById('memo-detail-right');
  const meta = document.getElementById('memo-detail-meta');
  const book = document.querySelector('.memo-book');

  if (!left || !right) return;

  if (book) book.classList.remove('turn-next', 'turn-prev');

  if (direction) {
    void (book ? book.offsetWidth : left.offsetWidth);
    if (book) book.classList.add(direction === 'prev' ? 'turn-prev' : 'turn-next');
  }

  left.textContent = currentMemoDetailPages[currentMemoDetailPage - 1] || '';
  right.textContent = currentMemoDetailPages[currentMemoDetailPage] || '';

  if (meta) {
    const endPage = Math.min(currentMemoDetailPage + 1, currentMemoDetailPages.length);
    const pageText = currentMemoDetailPages.length > 1
      ? currentMemoDetailPage + '-' + endPage + ' / ' + currentMemoDetailPages.length
      : '';
    meta.textContent = [currentMemoDetailBaseMeta, pageText].filter(Boolean).join(' · ');
  }
}

function goPrevMemoDetailPage() {
  if (currentMemoDetailPage <= 1) return;
  currentMemoDetailPage = Math.max(1, currentMemoDetailPage - 2);
  renderMemoDetailPage('prev');
}

function goNextMemoDetailPage() {
  if (currentMemoDetailPage + 1 >= currentMemoDetailPages.length) return;
  currentMemoDetailPage = Math.min(currentMemoDetailPages.length, currentMemoDetailPage + 2);
  renderMemoDetailPage('next');
}

function removeMemoBookmark(memo) {
  if (!memo) return;

  const bookmarkKey = getMemoIdentity(memo);
  const bookmarks = getMemoBookmarks().filter(key => key !== bookmarkKey);
  setMemoBookmarks(bookmarks);
}

function toggleMemoBookmark(bookmarkKey) {
  if (currentPersonalCode && String(bookmarkKey).indexOf('server:') === 0) {
    toggleServerMemoBookmark(bookmarkKey);
    return;
  }

  const bookmarks = getMemoBookmarks();
  const index = bookmarks.indexOf(bookmarkKey);

  if (index >= 0) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.unshift(bookmarkKey);
  }

  setMemoBookmarks(bookmarks);
  renderLocalMemos(currentMemoRenderCache);
}

function toggleServerMemoBookmark(memoId) {
  const targetMemo = currentMemoRenderCache.find(memo => memo.memoId === memoId);
  if (!targetMemo) return;

  const nextValue = !isMemoBookmarked(targetMemo);
  targetMemo.isBookmarked = nextValue;
  setCachedServerMemos(currentMemoRenderCache);
  renderLocalMemos(currentMemoRenderCache);

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'togglePersonalMemoBookmark',
      personalCode: currentPersonalCode,
      memoId: memoId,
      isBookmarked: nextValue
    })
  })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        targetMemo.isBookmarked = !nextValue;
        setCachedServerMemos(currentMemoRenderCache);
        renderLocalMemos(currentMemoRenderCache);
        openAlertModal('책갈피 실패', data.message || '책갈피 상태를 변경하지 못했습니다.');
      }
    })
    .catch(error => {
      console.error(error);
      targetMemo.isBookmarked = !nextValue;
      setCachedServerMemos(currentMemoRenderCache);
      renderLocalMemos(currentMemoRenderCache);
      openAlertModal('책갈피 오류', '책갈피 변경 중 오류가 발생했습니다.');
    });
}

function updateServerMemo(memoId, title, content) {
  return fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'updatePersonalMemo',
      personalCode: currentPersonalCode,
      memoId: memoId,
      title: title,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        openAlertModal('수정 실패', data.message || '메모를 수정하지 못했습니다.');
        return false;
      }

      return true;
    })
    .catch(error => {
      console.error(error);
      openAlertModal('수정 오류', '메모 수정 중 오류가 발생했습니다.');
      return false;
    });
}

function loadServerMemos() {
  const url =
    API_URL
    + '?action=getPersonalMemos'
    + '&personalCode=' + encodeURIComponent(currentPersonalCode);

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      if (!data.success || !Array.isArray(data.memos)) {
        return false;
      }

      setCachedServerMemos(data.memos);
      renderLocalMemos(data.memos);
      return true;
    })
    .catch(error => {
      console.warn('개인 메모 서버 조회 실패, localStorage로 대체합니다.', error);
      return false;
    });
}

function saveServerMemo(title, content) {
  const player = getCurrentPlayerForMemo();

  return fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'savePersonalMemo',
      personalCode: currentPersonalCode,
      characterName: player.characterName || '',
      placeId: player.currentPlaceId || '',
      placeName: '',
      title: title,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => !!data.success)
    .catch(error => {
      console.warn('개인 메모 서버 저장 실패, localStorage로 대체합니다.', error);
      return false;
    });
}

function deleteServerMemo(memoId) {
  return fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'deletePersonalMemo',
      personalCode: currentPersonalCode,
      memoId: memoId
    })
  })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        openAlertModal('삭제 실패', data.message || '메모를 삭제하지 못했습니다.');
        return false;
      }

      return true;
    })
    .catch(error => {
      console.error(error);
      openAlertModal('삭제 오류', '메모 삭제 중 오류가 발생했습니다.');
      return false;
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
        applyAdminUi(data.player);

        const mainScreen = document.querySelector('.main-screen');
        if (mainScreen) {
          mainScreen.style.visibility = 'visible';
        }

        setSystemStatus('접속 완료');
        refreshUnreadMailCount();
        prefetchLetterPaperStatus();

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

function applyAdminUi(player) {
  const isAdmin = !!(player && player.isAdmin);

  document.body.classList.toggle('is-admin', isAdmin);
  document.body.classList.toggle('is-user', !isAdmin);

  console.log('관리자 UI 여부:', isAdmin, player ? player.role : '');
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
      const savedPlayer = JSON.parse(savedPlayerData);
      renderPlayer(savedPlayer);
      applyAdminUi(savedPlayer);

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
