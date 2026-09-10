/**
 * 페이즈 변경 시에 알림창
 * @param {*} title 
 * @param {*} message 
 * @param {*} round 
 * @param {*} duration 
 */
export function showPhaseAlert(title, message, round=1, duration = 800) {
  const alert = document.getElementById("phaseAlert");
  const titleEl = document.getElementById("phaseAlertTitle");
  const messageEl = document.getElementById("phaseAlertMessage");
  const codeEl = alert.querySelector(".phase-alert__code");

  const roundcode = ("0" + round).slice(-2);
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  codeEl.textContent = `ROUND // ${roundcode}`;

   // 기존 종료 타이머가 있다면 취소
  clearTimeout(alert._closeTimer);
  clearTimeout(alert._hideTimer);

  // 초기화
  alert.classList.remove("is-closing");
  alert.classList.add("is-active");

  // 표시 시간
  alert._closeTimer = setTimeout(() => {
    alert.classList.add("is-closing");

    // 닫히는 애니메이션이 끝난 뒤 실제로 숨김
    alert._hideTimer = setTimeout(() => {
      alert.classList.remove("is-active");
      alert.classList.remove("is-closing");
    }, 350);

  }, duration);
}