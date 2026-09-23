# AP PVP Game Host

개인적으로 타 플랫폼을 이용해 즐겼던 PVP 게임 룰을, 온라인 상에서 지인과 함께 플레이할 수 있도록 개발한 호스트 앱입니다.

호스트 한 명이 데스크톱 앱을 실행하면 로컬 서버와 공개 링크가 자동으로 발급되고, 플레이어들은 그 링크를 브라우저로 열기만 하면 설치 없이 참가할 수 있습니다. 캐릭터의 스킬/크리티컬 수식은 구글 시트와 동기화해서 관리하며, 라운드제(선공·후공·정산) 전투를 실시간으로 진행합니다.

## 주요 기능

- **설치 없는 참가**: 호스트만 앱을 실행하면 되고, 플레이어는 링크만 열면 됩니다 (Cloudflare Quick Tunnel 자동 발급)
- **구글 시트 연동**: 스킬표·크리티컬표를 시트에서 동기화해 전투 계산에 반영, 여러 시트를 프리셋으로 저장
- **라운드제 전투**: 선공/후공 페이즈, 팀별 최고 민첩(동률 시 주사위)으로 선공 결정, 페이즈별 제한시간과 자동 진행
- **실시간 액션 공유**: 같은 팀끼리는 행동 선언을 실시간으로, 상대 팀에게는 확정된 행동만 공개
- **관전 모드**: 소유 캐릭터가 없는 참가자는 자동으로 관전자로 전환되어 양 팀의 행동을 모두 볼 수 있음
- **채팅**: 닉네임 또는 보유 캐릭터 이름으로 발언 가능
- **비밀번호 보호**: 호스트가 설정한 비밀번호로 입장 제한
- **전투 기록 저장**: 라운드별 판정/정산 로그와 최종 결과를 텍스트 파일로 내보내기

## 빠른 시작

### 요구사항

- [Node.js](https://nodejs.org/) 18 이상
- npm

### 설치 및 실행

```bash
# 저장소 클론 (또는 압축 해제한 폴더로 이동)
git clone https://github.com/RyunK/AP-PVP-Host.git
cd AP-PVP-Host

# 의존성 설치
npm install
```

`.env` 파일을 프로젝트 루트에 만들고, 구글 시트 API 키를 넣어주세요.

```env
API_KEY=여기에_발급받은_키
```

개발 모드로 실행합니다.

```bash
npm start
```

앱이 뜨면 자동으로 로컬 서버와 공개 링크가 발급되고, 대시보드에서 그 링크를 확인할 수 있습니다. 해당 링크를 플레이어에게 공유하면 바로 참가 화면으로 접속됩니다.

### 빌드 유의사항

[위키 바로가기](https://github.com/RyunK/AP-PVP-Host/wiki/%EB%B9%8C%EB%93%9C-%EC%9C%A0%EC%9D%98%EC%82%AC%ED%95%AD)


## 프로젝트 구조

```
game-host-app/
├── main/                      # Electron 메인 프로세스 + 게임 서버
│   ├── main.js                 # 앱 진입점 (서버/터널 자동 시작, 관리자 창 생성)
│   ├── preload.js               # 렌더러 ↔ 메인 프로세스 IPC 브릿지
│   ├── server.js                 # Express + Socket.io (소켓 이벤트 처리)
│   ├── tunnel.js                  # Cloudflare Quick Tunnel 자동 실행
│   ├── store.js                    # 로컬 설정 저장 (electron-store)
│   ├── rooms/                       # 방/플레이어/캐릭터/팀 상태, 전투 상태 관리
│   └── engine/                      # 수식을 읽어오고, 실제 행동을 계산함
│
├── renderer/                  # 호스트가 보는 관리자 UI (Electron 창)
│
├── client/                    # 플레이어가 브라우저로 여는 페이지
│   ├── index.html               # 라우터 진입점
│   ├── styles.css               # 전체 화면에 대한 css 파일
│   ├── js/                       # 화면 공통 모듈 (소켓, 상태, 채팅, 플레이어 목록 등)
│   ├── modals/                    # 전투 중 페이즈 알림 모달 
│   └── screens/                   # 화면별 HTML + JS (entry / lobby / battle / summary)
│
├── build/                      # 앱 아이콘 (icon.ico / icon.icns / icon.png)
├── .env                          # 구글 API 키 (커밋하지 않음)
└── package.json
```

## 사용된 기술

![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)

## 게임 흐름

1. 호스트가 앱을 실행하면 방이 자동으로 생성되고 공개 링크가 발급됩니다.
2. 플레이어들이 링크로 입장해 닉네임을 정하고, 캐릭터(포지션/스킬/스탯)를 등록합니다.
3. 캐릭터를 팀에 배정하고, 전원이 준비를 완료하면 호스트가 전투를 시작합니다.
4. 각 라운드는 **선공 확인 → 선공 선언 → 후공 선언 → 정산** 순서로 진행되며, 페이즈마다 제한시간이 지나면 서버가 자동으로 다음 단계로 넘깁니다.
5. 정산 결과는 시트에서 동기화한 스킬표를 기준으로 서버가 직접 계산하며, 라운드가 끝날 때마다 선후공이 교환됩니다.
6. 한쪽 팀이 전멸하면 전투가 종료되고, 정산 요약과 전체 로그를 확인·저장할 수 있습니다.
7. 호스트가 재시작하면 참가자 목록은 유지한 채 캐릭터/팀/전투 기록만 초기화되어 바로 다음 판을 시작할 수 있습니다.

## 라이선스

MIT 라이선스를 따르고 있습니다.
