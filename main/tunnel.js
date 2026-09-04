// cloudflared npm 패키지(https://github.com/JacobLinCool/node-cloudflared)를 사용합니다.
// 이 패키지는 최초 실행 시 OS에 맞는 cloudflared 바이너리를 자동으로 다운로드/설치하므로
// 호스트(비개발자)는 별도로 바이너리를 설치하거나 명령어를 칠 필요가 없습니다.
const fs = require("fs");
const { bin, install, Tunnel } = require("cloudflared");

/**
 * 로컬 포트를 Cloudflare Quick Tunnel(trycloudflare.com)로 노출시키고
 * 발급된 공개 URL을 반환합니다. 계정/도메인 설정이 전혀 필요 없습니다.
 *
 * 주의: Quick Tunnel은 테스트/데모용으로, 동시 요청 200개 제한이 있고
 * 프로세스를 재시작할 때마다 URL이 바뀝니다. 소규모 캐주얼 매치에는 충분하지만,
 * 안정적인 고정 URL이 필요해지면 Cloudflare 계정 기반 Named Tunnel(withToken)로
 * 전환하는 것을 권장합니다 (설정 화면에 토큰 입력란만 추가하면 됩니다).
 */
async function startTunnel(localPort, { onLog } = {}) {
  if (!fs.existsSync(bin)) {
    onLog?.("cloudflared 바이너리를 처음 다운로드하는 중입니다...");
    await install(bin);
    onLog?.("cloudflared 설치 완료");
  }

  const tunnel = Tunnel.quick(`http://localhost:${localPort}`);

  tunnel.on("stdout", (line) => onLog?.(`[cloudflared] ${line}`));
  tunnel.on("stderr", (line) => onLog?.(`[cloudflared] ${line}`));

  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("터널 URL 발급 시간 초과 (30초)")),
      30_000
    );
    tunnel.once("url", (u) => {
      clearTimeout(timeout);
      resolve(u);
    });
    tunnel.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return { tunnel, url };
}

async function stopTunnel(handle) {
  if (handle?.tunnel) handle.tunnel.stop();
}

module.exports = { startTunnel, stopTunnel };
