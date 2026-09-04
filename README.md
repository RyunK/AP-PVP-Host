# PVP Game Host

호스트(비개발자)가 더블클릭 한 번으로 실행하는 3:3(가변) RPG PVP 서버 + 관리자 앱.
플레이어는 설치 없이 브라우저 링크만 열면 참가할 수 있습니다.

## 구조

```
main/               Electron 메인 프로세스 + 게임 서버
  main.js           앱 진입점: 서버/터널 자동 시작, 관리자 창 생성
  server.js         Express + Socket.io (방/캐릭터/팀/턴 처리)
  tunnel.js         Cloudflare Quick Tunnel 자동 실행 및 URL 발급
  store.js          로컬 설정 저장 (electron-store)
  rooms/roomManager.js   방/플레이어/캐릭터/턴 상태 관리 (핵심 로직)
  engine/
    damageCalc.js       데미지/회복 계산 (기존 엔진을 여기로 마이그레이션)
    formulaLoader.js    파라미터/수식을 로컬 캐시에서 읽는 로더
    sheetSync.js        구글 시트 → 로컬 캐시 동기화

renderer/           호스트가 보는 관리자 UI (Electron 창)
client/             플레이어가 브라우저로 여는 페이지 (서버가 정적 서빙)
```

## 개발 중 실행

```bash
npm install
npm start
```

앱이 뜨면 자동으로 로컬 서버(기본 포트 4000)와 Cloudflare Quick Tunnel이 실행되고,
관리자 창 대시보드에 공유 링크가 표시됩니다. 그 링크를 플레이어에게 전달하면 됩니다.

## 배포용 패키징 (비개발자에게 나눠줄 설치파일 만들기)

```bash
npm run build:win     # Windows용 .exe 설치파일
npm run build:mac     # macOS용 .dmg
npm run build:linux   # Linux용 AppImage
```

`electron-builder`가 Node.js 런타임까지 통째로 묶은 단일 설치파일을 만들어줍니다.
받는 사람은 Node.js나 git을 설치할 필요가 전혀 없습니다.

- **Windows**: 서명 인증서가 없으면 SmartScreen 경고가 뜰 수 있습니다. "추가 정보 → 실행" 안내를
  설치 가이드에 넣어두세요.
- **macOS**: 마찬가지로 미서명 앱은 Gatekeeper 경고가 뜹니다. "시스템 설정 → 개인정보 보호 및 보안"에서
  허용하도록 안내하세요.

## 수식(밸런스) 동기화용 구글 시트 형식

관리자 UI의 "수식 동기화" 탭에 시트 링크를 붙여넣으면 아래 형식을 읽어갑니다.
시트는 **[공유] → "링크가 있는 모든 사용자 - 뷰어"** 로 설정되어 있어야 합니다.

| key | type | value |
|---|---|---|
| atkMultiplier | param | 1.5 |
| defMultiplier | param | 0.8 |
| critChance | param | 0.15 |
| critMultiplier | param | 1.5 |
| physicalDamage | expression | max(1, atk*atkMultiplier - def*defMultiplier) |
| healAmount | power * 1.2 | expression |

- `param` 행: 숫자 하나만 바뀌는 배율/계수. `engine/damageCalc.js`의 함수들이 이 값을 그대로 가져다 씁니다.
- `expression` 행: 공식의 형태 자체를 시트에서 자유롭게 바꿀 수 있는 수식 문자열입니다.
  `mathjs` 문법을 따르며, `engine/formulaLoader.js`의 `evalExpression(name, scope)`로 평가됩니다.

## 다음에 채워야 할 부분

- `main/engine/` 안에 기존 구글 시트 계산 로직을 실제 규칙에 맞게 이식
- `main/rooms/roomManager.js`의 `resolveAction` 연동부를 실제 전투 규칙(스킬, 상태이상, 턴 순서 등)에 맞게 확장
- 필요 시 Cloudflare Named Tunnel(계정 기반, 고정 URL)로 전환 — `main/tunnel.js`에 `Tunnel.withToken()` 경로 추가
