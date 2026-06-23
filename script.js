const API_URL = 'https://script.google.com/macros/s/AKfycbyxk5qnVCIQSm1W4DtNz1q4C_ySGPWL_j8sUx2kbAFyGRxb7GDfLNMCWl1t_GgxePgDFw/exec';

let isRegistering = false;
let issuedPersonalCode = '';
let currentPersonalCode = '';
let CURRENT_VERSION = 'v19-7';

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
let letterPaperStatusCache = null;
let letterPaperStatusCacheAt = 0;
const LETTER_PAPER_CACHE_TTL = 30000;
let isMemoLoading = false;
let isMemoSaving = false;
let isInventoryLoading = false;
let currentInventoryAllItems = [];
let currentInventoryItems = [];
let currentInventorySelectedIndex = -1;
let currentInventoryTab = 'all';
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
const MYTHOS_ERA_YEAR_BY_STAGE = {
  1: 1412,
  2: 1418,
  3: 1424
};

console.log('MYTHOS READY v19-7');

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

function openMailWriteModal(mode) {
  const modal = document.getElementById('mail-write-modal');
  if (!modal) return;

  currentLetterMode = mode || 'basic';

  document.getElementById('mail-write-receiver-name').value = '';
  document.getElementById('mail-write-title').value = '';
  document.getElementById('mail-write-content').value = '';

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
    premiumCount: Number(data.premiumCount || 0)
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

  if (basicCount <= 0 && premiumCount <= 0) {
    openAlertModal('작성 불가', '보유한 편지지가 없어 서신을 작성할 수 없습니다.');
    return;
  }

  if (basicCount > 0 && premiumCount <= 0) {
    openMailWriteModal('basic');
    return;
  }

  if (basicCount <= 0 && premiumCount > 0) {
    openMailWriteModal('premium');
    return;
  }

  openLetterPaperModal(basicCount, premiumCount);
}

function openLetterPaperModal(basicCount, premiumCount) {
  const modal = document.getElementById('letter-paper-modal');
  const basicText = document.getElementById('basic-paper-count');
  const premiumText = document.getElementById('premium-paper-count');

  if (!modal) return;

  if (basicText) basicText.textContent = '보유 ' + Number(basicCount || 0) + '개';
  if (premiumText) premiumText.textContent = '보유 ' + Number(premiumCount || 0) + '개';

  modal.style.display = 'flex';
}

function closeLetterPaperModal() {
  const modal = document.getElementById('letter-paper-modal');
  if (!modal) return;

  modal.style.display = 'none';
}

function chooseLetterPaper(mode) {
  closeLetterPaperModal();
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

  openConfirmModal(
    '일반 서신 발송',
    receiverName + '님에게 일반 서신을 발송하시겠습니까?\n일반 편지지 1개가 소모됩니다.',
    function () {
      sendUserLetterAfterConfirm(receiverName, title, content, sendBtn);
    }
  );
}

function sendUserLetterAfterConfirm(receiverName, title, content, sendBtn) {
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
      invalidateLetterPaperStatusCache();
      prefetchLetterPaperStatus();
      openAlertModal('발송 완료', '일반 서신을 발송했습니다.');
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
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.style.display = 'none';
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

function renderInventoryLoading() {
  const grid = document.getElementById('inventory-grid');
  const detail = document.getElementById('inventory-detail');
  const count = document.getElementById('inventory-count');

  currentInventoryItems = [];
  currentInventoryAllItems = [];
  currentInventorySelectedIndex = -1;

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
  const safeItems = getVisibleInventoryItems(allItems);

  currentInventoryAllItems = allItems;
  currentInventoryItems = safeItems;
  currentInventorySelectedIndex = safeItems.length ? 0 : -1;

  if (count) count.textContent = safeItems.length + ' / ' + allItems.length;

  if (grid) {
    const slots = [];

    for (let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
      const item = safeItems[i];

      if (!item) {
        slots.push('<button type="button" class="inventory-slot is-empty" aria-label="빈 슬롯"></button>');
        continue;
      }

      const icon = item.fileName ? 'assets/icons/' + item.fileName : '';
      const selectedClass = i === currentInventorySelectedIndex ? ' selected' : '';

      slots.push(`
        <button
          type="button"
          class="inventory-slot${selectedClass}"
          title="${escapeForAttribute(item.itemName || item.itemId)}"
          onclick="selectInventoryItem(${i})"
          oncontextmenu="selectInventoryItem(${i}); return false;"
        >
          ${icon ? '<img src="' + escapeForAttribute(icon) + '" alt="">' : '<span class="inventory-slot-placeholder">' + escapeHtml(String(item.itemName || '?').slice(0, 1)) + '</span>'}
          <em>${Number(item.quantity || 0)}</em>
        </button>
      `);
    }

    grid.innerHTML = slots.join('');
  }

  if (detail) {
    if (currentInventorySelectedIndex >= 0) {
      renderInventoryDetail(safeItems[currentInventorySelectedIndex]);
    } else {
      detail.innerHTML = '<div class="inventory-detail-empty">보유 중인 아이템이 없습니다.</div>';
    }
  }
}

function selectInventoryTab(tab) {
  currentInventoryTab = tab || 'all';
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
        ${icon ? '<img src="' + escapeForAttribute(icon) + '" alt="">' : '<span>' + escapeHtml(String(item.itemName || '?').slice(0, 1)) + '</span>'}
      </div>
      <div>
        <h3>${escapeHtml(item.itemName || item.itemId || '아이템')}</h3>
      </div>
    </div>
    <div class="inventory-detail-row"><span>수량</span><strong>${Number(item.quantity || 0)}</strong></div>
    <div class="inventory-detail-row"><span>사용 여부</span><strong>${usableText}</strong></div>
    <div class="inventory-detail-desc">${escapeHtml(item.description || '설명이 등록되지 않은 아이템입니다.')}</div>
    <button type="button" class="inventory-use-btn" ${item.isUsable ? '' : 'disabled'}>사용하기</button>
  `;
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

  if (mainScreen) mainScreen.style.display = 'none';
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

  if (memoPage) memoPage.style.display = 'none';
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
