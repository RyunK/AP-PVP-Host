const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
require("dotenv").config();

const JavaScriptObfuscator = require("javascript-obfuscator");

const ROOT = path.join(__dirname, "..");
const BUILD_DIR = path.join(ROOT, ".build-src");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // if (entry.name === "node_modules") continue; 
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

// 1) 깨끗한 빌드 폴더 준비
execSync(`node -e "require('rimraf').sync('${BUILD_DIR}')"`, { stdio: "inherit" });
copyDir(path.join(ROOT, "main"), path.join(BUILD_DIR, "main"));
copyDir(path.join(ROOT, "renderer"), path.join(BUILD_DIR, "renderer"));
copyDir(path.join(ROOT, "client"), path.join(BUILD_DIR, "client"));
copyDir(path.join(ROOT, "config"), path.join(BUILD_DIR, "config"));
fs.copyFileSync(path.join(ROOT, "package.json"), path.join(BUILD_DIR, "package.json"));
if (fs.existsSync(path.join(ROOT, "build"))) copyDir(path.join(ROOT, "build"), path.join(BUILD_DIR, "build"));


// 2) .env 값을 실제 코드에 치환
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error(".env에 API_KEY 없습니다.");

for (const file of walkJsFiles(BUILD_DIR)) {
  let content = fs.readFileSync(file, "utf-8");
  if (content.includes("__GOOGLE_API_KEY__")) {
    content = content.replaceAll("__GOOGLE_API_KEY__", apiKey);
    fs.writeFileSync(file, content);
  }
}

// 3) 난독화 (main/renderer/client의 모든 js)
for (const file of walkJsFiles(BUILD_DIR)) {
  const source = fs.readFileSync(file, "utf-8");
  const obfuscated = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false, // Electron/Node 전역(require, module 등) 깨지는 것 방지
    selfDefending: false,
  }).getObfuscatedCode();
  fs.writeFileSync(file, obfuscated);
}

// 4) node_modules 설치 (프로덕션 의존성만)
execSync("npm install --omit=dev", { cwd: BUILD_DIR, stdio: "inherit" });

// 5) electron-builder로 패키징
execSync("npx electron-builder", { cwd: BUILD_DIR, stdio: "inherit" });

// execSync("npx electron-builder --win", { cwd: BUILD_DIR, stdio: "inherit" }); // --win 추가
console.log("빌드 완료: .build-src/dist 폴더를 확인하세요.");