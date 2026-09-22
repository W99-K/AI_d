/**
 * ==========================================================================
 * 바이브 카페 (Vibe Cafe) 주문서 메인 스크립트 (main.js)
 * - 실시간 금액 계산 (음료, 사이즈, 추가옵션, 수량 반영)
 * - 포장(Takeout) / 매장(For Here) 선택 지원
 * - 폼 유효성 검사 및 주문 접수 확인 메시지 표시
 * - 주문 접수 완료 시 경쾌한 색종이(Confetti) 폭죽 애니메이션 효과
 * - 다시 작성(초기화) 기능
 * - 주문 내역 엑셀(.csv) 다운로드 저장 기능
 * ==========================================================================
 */

// DOM 요소가 모두 로드된 후 스크립트 실행
document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. 주요 DOM 엘리먼트 참조 가져오기
  // ------------------------------------------------------------------------
  const orderForm = document.getElementById('order-form');
  const customerNameInput = document.getElementById('customer-name');
  const customerPhoneInput = document.getElementById('customer-phone');
  const diningTypeRadios = document.querySelectorAll('input[name="diningType"]');
  const beverageSelect = document.getElementById('beverage-select');
  const sizeRadios = document.querySelectorAll('input[name="size"]');
  const optionCheckboxes = document.querySelectorAll('input[name="option"]');
  const quantityInput = document.getElementById('quantity');
  const requestsTextarea = document.getElementById('requests');

  // 버튼 및 안내 영역 엘리먼트
  const estimatedPriceDisplay = document.getElementById('estimated-price');
  const confirmationBox = document.getElementById('order-confirmation');
  const confirmationText = document.getElementById('confirmation-text');
  const alertBox = document.getElementById('alert-box');
  const btnReset = document.getElementById('btn-reset');
  const btnExcel = document.getElementById('btn-download-excel');
  const orderCountBadge = document.getElementById('order-count-badge');
  const recentOrdersList = document.getElementById('recent-orders-list');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // 주문 내역을 저장할 배열 (로컬스토리지와 연동하여 영구 보존)
  let orderHistory = [];
  const STORAGE_KEY = 'vibe_cafe_orders';

  // 로컬 스토리지에서 기존 주문 내역 불러오기
  try {
    const savedOrders = localStorage.getItem(STORAGE_KEY);
    if (savedOrders) {
      orderHistory = JSON.parse(savedOrders);
    }
  } catch (e) {
    console.error('로컬스토리지 불러오기 오류:', e);
  }

  // ------------------------------------------------------------------------
  // 2. 실시간 예상 금액 계산 함수
  // ------------------------------------------------------------------------
  function calculateTotalPrice() {
    // 1) 음료 기본 가격 (선택되지 않은 경우 0원)
    const selectedBeveragePrice = beverageSelect.value ? parseInt(beverageSelect.value, 10) : 0;

    // 음료가 선택되지 않은 경우 예상 금액을 0원으로 안내
    if (selectedBeveragePrice === 0) {
      estimatedPriceDisplay.textContent = '예상 금액: 0원';
      return 0;
    }

    // 2) 사이즈 추가 금액 (S: 0원, M: +500원, L: +1,000원)
    let sizePrice = 0;
    sizeRadios.forEach((radio) => {
      if (radio.checked) {
        sizePrice = parseInt(radio.value, 10) || 0;
      }
    });

    // 3) 추가 옵션 금액 합산 (체크된 항목들의 가격 합)
    let optionsPrice = 0;
    optionCheckboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        optionsPrice += parseInt(checkbox.value, 10) || 0;
      }
    });

    // 4) 수량 (최소 1잔, 최대 10잔 검증)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    } else if (quantity > 10) {
      quantity = 10;
      quantityInput.value = 10;
    }

    // 1잔당 단가 = (음료 기본 가격 + 사이즈 추가금 + 옵션 추가금)
    const singleItemPrice = selectedBeveragePrice + sizePrice + optionsPrice;

    // 총 예상 금액 = 1잔당 단가 * 수량
    const total = singleItemPrice * quantity;

    // 천 단위 콤마 포맷(toLocaleString) 적용 후 화면에 출력
    estimatedPriceDisplay.textContent = `예상 금액: ${total.toLocaleString('ko-KR')}원`;

    return total;
  }

  // ------------------------------------------------------------------------
  // 3. 알림 메시지 표시 함수
  // ------------------------------------------------------------------------
  function showAlert(message) {
    alertBox.textContent = `⚠️ ${message}`;
    alertBox.classList.add('show');

    // 브라우저 기본 alert도 함께 띄워 확실하게 고지
    setTimeout(() => {
      alert(message);
    }, 10);

    // 4초 후 알림 박스 자동 숨김
    setTimeout(() => {
      alertBox.classList.remove('show');
    }, 4000);
  }

  function hideAlert() {
    alertBox.classList.remove('show');
    alertBox.textContent = '';
  }

  // ------------------------------------------------------------------------
  // 4. 주문 이력 UI 갱신 및 뱃지 업데이트
  // ------------------------------------------------------------------------
  function updateOrderHistoryUI() {
    if (orderCountBadge) {
      orderCountBadge.textContent = `${orderHistory.length}건`;
    }

    if (btnExcel) {
      btnExcel.disabled = orderHistory.length === 0;
    }

    if (recentOrdersList) {
      if (orderHistory.length === 0) {
        recentOrdersList.innerHTML = `
          <div style="padding: 16px; text-align: center; color: #9e8e81; font-size: 13px;">
            아직 접수된 주문 내역이 없습니다.
          </div>
        `;
        return;
      }

      // 최신 주문이 상단에 오도록 역순 정렬하여 렌더링
      const listHtml = orderHistory
        .slice()
        .reverse()
        .map((order) => {
          const optStr = order.optionsText ? ` (${order.optionsText})` : '';
          const diningBadge = order.diningTypeName === '포장' ? '🛍️ [포장]' : '☕ [매장]';
          return `
            <div class="recent-order-item" id="order-item-${order.id}">
              <div class="recent-order-details">
                <span class="recent-order-name">${escapeHtml(order.customerName)}님 - ${diningBadge} ${escapeHtml(order.beverageName)} ${order.sizeName}사이즈${escapeHtml(optStr)} ${order.quantity}잔</span>
                <span class="recent-order-desc">${order.timestamp} | 연락처: ${escapeHtml(order.customerPhone || '미기재')}</span>
              </div>
              <span class="recent-order-price">${order.totalPrice.toLocaleString('ko-KR')}원</span>
            </div>
          `;
        })
        .join('');

      recentOrdersList.innerHTML = listHtml;
    }
  }

  // HTML 특수문자 이스케이프 함수
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ------------------------------------------------------------------------
  // 5. 색종이 폭죽(Confetti) 애니메이션 시스템
  // ------------------------------------------------------------------------
  let confettiAnimId = null;

  function triggerConfetti() {
    if (!confettiCanvas) return;

    const ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 브라우저 창에 맞추기
    const width = (confettiCanvas.width = window.innerWidth);
    const height = (confettiCanvas.height = window.innerHeight);

    // 기존 애니메이션 실행 중이면 취소 후 새로 발사
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
    }

    // Spotify 디자인 시스템 팔레트 (Spotify Green, 화이트, 블루, 오렌지, 레드 등)
    const colors = [
      '#1ed760', // Spotify Green
      '#ffffff', // White
      '#1db954', // Spotify Green Variant
      '#539df5', // Announcement Blue
      '#ffa42b', // Warning Orange
      '#f3727f', // Negative Red
      '#b3b3b3', // Silver
    ];

    // 색종이 조각 100개 생성
    const particleCount = 100;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width * (0.2 + Math.random() * 0.6), // 화면 중앙 부근에서 폭죽처럼 발사
        y: height * 0.45,
        w: Math.random() * 8 + 6,
        h: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 14,
        vy: -(Math.random() * 12 + 6), // 위로 솟구치며 발사
        gravity: 0.35,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: Math.random() * 0.005 + 0.008,
      });
    }

    function renderConfetti() {
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.opacity <= 0 || p.y > height + 20) {
          continue;
        }

        activeParticles++;

        // 물리 연산 (중력, 속도, 회전)
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        // 드로잉
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (activeParticles > 0) {
        confettiAnimId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, width, height);
        confettiAnimId = null;
      }
    }

    renderConfetti();
  }

  // 창 크기 조절 시 캔버스 반응
  window.addEventListener('resize', () => {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });

  // ------------------------------------------------------------------------
  // 6. 실시간 이벤트 리스너 등록 (음료, 사이즈, 옵션, 수량 변경 감지)
  // ------------------------------------------------------------------------
  // 음료 드롭다운 선택 시
  beverageSelect.addEventListener('change', () => {
    hideAlert();
    calculateTotalPrice();
  });

  // 사이즈 라디오 버튼 변경 시
  sizeRadios.forEach((radio) => {
    radio.addEventListener('change', calculateTotalPrice);
  });

  // 추가 옵션 체크박스 변경 시
  optionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', calculateTotalPrice);
  });

  // 수량 변경 시 (input 및 change 모두 감지)
  quantityInput.addEventListener('input', calculateTotalPrice);
  quantityInput.addEventListener('change', calculateTotalPrice);

  // 이름 입력 시 오류 알림 자동 숨김
  customerNameInput.addEventListener('input', hideAlert);

  // ------------------------------------------------------------------------
  // 7. 주문하기 (Submit) 처리
  // ------------------------------------------------------------------------
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault(); // 기본 폼 전송 방지

    const customerName = customerNameInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const selectedBeverageValue = beverageSelect.value;

    // [유효성 검사 1] 이름이 비어있으면 알림
    if (!customerName) {
      showAlert('이름을 입력해주세요');
      customerNameInput.focus();
      return;
    }

    // [유효성 검사 2] 음료를 선택하지 않았으면 알림
    if (!selectedBeverageValue) {
      showAlert('음료를 선택해주세요');
      beverageSelect.focus();
      return;
    }

    hideAlert();

    // 1) 포장/매장 선택 여부 수집
    let diningTypeName = '포장';
    diningTypeRadios.forEach((radio) => {
      if (radio.checked) {
        diningTypeName = radio.getAttribute('data-name') || '포장';
      }
    });

    // 2) 선택된 항목들의 라벨 텍스트 수집
    const selectedBeverageText = beverageSelect.options[beverageSelect.selectedIndex].getAttribute('data-name');
    
    // 3) 선택된 사이즈 확인
    let selectedSizeName = 'M';
    sizeRadios.forEach((radio) => {
      if (radio.checked) {
        selectedSizeName = radio.getAttribute('data-name');
      }
    });

    // 4) 선택된 옵션 목록 수집
    const selectedOptionNames = [];
    optionCheckboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        selectedOptionNames.push(checkbox.getAttribute('data-name'));
      }
    });

    const quantity = parseInt(quantityInput.value, 10) || 1;
    const totalPrice = calculateTotalPrice();
    const requests = requestsTextarea.value.trim();

    // 옵션 텍스트 형식화: 예) "(샷 추가)" 또는 "(샷 추가, 크림 추가)"
    const optionsText = selectedOptionNames.length > 0 ? selectedOptionNames.join(', ') : '';
    const optionsDisplay = optionsText ? ` (${optionsText})` : '';

    // 주문 확인 메시지 조합
    // 예) "홍길동님 [포장], 카페라떼 M사이즈 (샷 추가) 1잔, 총 5,000원 주문이 접수되었습니다!"
    const formattedMessage = `${customerName}님 [${diningTypeName}], ${selectedBeverageText} ${selectedSizeName}사이즈${optionsDisplay} ${quantity}잔, 총 ${totalPrice.toLocaleString('ko-KR')}원 주문이 접수되었습니다!`;

    // 화면 하단 주문 확인 박스에 메시지 출력 및 표시
    confirmationText.textContent = formattedMessage;
    confirmationBox.classList.add('show');

    // ★ 주문 완료 시 화려한 색종이 폭죽 애니메이션 발사!
    triggerConfetti();

    // 주문 확인 박스로 스크롤 부드럽게 이동
    confirmationBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 신규 주문 객체 생성 및 배열에 추가
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newOrder = {
      id: Date.now(),
      timestamp,
      customerName,
      customerPhone,
      diningTypeName, // 포장 또는 매장
      beverageName: selectedBeverageText,
      sizeName: selectedSizeName,
      optionsText,
      quantity,
      totalPrice,
      requests,
    };

    orderHistory.push(newOrder);

    // 로컬 스토리지에 저장
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orderHistory));
    } catch (e) {
      console.error('로컬스토리지 저장 실패:', e);
    }

    // 주문 이력 목록 갱신
    updateOrderHistoryUI();
  });

  // ------------------------------------------------------------------------
  // 8. 다시 작성 (초기화) 버튼 처리
  // ------------------------------------------------------------------------
  btnReset.addEventListener('click', () => {
    // 폼 기본 초기화
    orderForm.reset();

    // 1) 포장 기본 선택 명시적 재설정
    const defaultDiningRadio = document.getElementById('dining-takeout');
    if (defaultDiningRadio) {
      defaultDiningRadio.checked = true;
    }

    // 2) 음료 기본값: "음료를 선택해주세요"
    beverageSelect.selectedIndex = 0;
    
    // 3) 사이즈 기본값: M사이즈 (+500원) 선택
    const defaultSizeRadio = document.getElementById('size-m');
    if (defaultSizeRadio) {
      defaultSizeRadio.checked = true;
    }

    // 4) 옵션 체크박스 전부 해제
    optionCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // 5) 수량 기본값 1
    quantityInput.value = 1;

    // 예상 금액 초기화 (음료 미선택 상태이므로 0원)
    calculateTotalPrice();

    // 알림 및 주문 확인 메시지 숨기기
    hideAlert();
    confirmationBox.classList.remove('show');
    confirmationText.textContent = '';

    // 이름 입력칸으로 포커스
    customerNameInput.focus();
  });

  // ------------------------------------------------------------------------
  // 9. 엑셀로 주문 내역 저장받기 (UTF-8 BOM CSV 파일 다운로드)
  // ------------------------------------------------------------------------
  function downloadOrdersAsExcel() {
    if (orderHistory.length === 0) {
      alert('저장할 주문 내역이 없습니다. 먼저 주문을 접수해주세요!');
      return;
    }

    // 엑셀(Excel)에서 한글이 깨지지 않도록 UTF-8 BOM 식별자 선언
    const BOM = '\uFEFF';

    // CSV 헤더 컬럼 정의 (이용방식 포함)
    const headers = [
      '주문번호',
      '주문일시',
      '고객명',
      '전화번호',
      '이용방식',
      '주문음료',
      '사이즈',
      '추가옵션',
      '수량',
      '총금액(원)',
      '요청사항',
    ];

    // 행 데이터 생성 (쉼표 및 큰따옴표 이스케이프 처리)
    const rows = orderHistory.map((order, index) => {
      return [
        index + 1,
        `"${order.timestamp}"`,
        `"${order.customerName.replace(/"/g, '""')}"`,
        `"${(order.customerPhone || '').replace(/"/g, '""')}"`,
        `"${order.diningTypeName || '포장'}"`,
        `"${order.beverageName.replace(/"/g, '""')}"`,
        `"${order.sizeName}"`,
        `"${order.optionsText ? order.optionsText.replace(/"/g, '""') : '없음'}"`,
        order.quantity,
        order.totalPrice,
        `"${(order.requests || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    // 전체 CSV 문자열 조립
    const csvContent = BOM + [headers.join(','), ...rows].join('\r\n');

    // Blob 객체 생성 (Excel 호환 CSV MIME 타입)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 다운로드용 <a> 태그 동적 생성 및 실행
    const downloadLink = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    
    downloadLink.href = url;
    downloadLink.setAttribute('download', `바이브카페_주문내역_${dateStr}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // 생성된 임시 요소 및 URL 정리
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }

  // 엑셀 다운로드 버튼에 클릭 이벤트 바인딩
  if (btnExcel) {
    btnExcel.addEventListener('click', downloadOrdersAsExcel);
  }

  // ------------------------------------------------------------------------
  // 10. 초기 구동 실행
  // ------------------------------------------------------------------------
  calculateTotalPrice(); // 초기 금액 계산 (0원)
  updateOrderHistoryUI(); // 저장된 주문 내역 UI 반영
});
