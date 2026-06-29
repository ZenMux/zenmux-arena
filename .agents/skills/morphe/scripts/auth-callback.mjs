// 本地回调接收器：起一个临时 HTTP server 监听 127.0.0.1 随机端口，
// 等浏览器登录后把 accessToken POST 回来，写到 ~/.morphe/auth.json（{accessToken}）后退出。
//
// 用法：node auth-callback.mjs
// stdout 打印：CALLBACK_PORT=<port> 和 CALLBACK_STATE=<state>，供调用方拼登录 URL。
// 拿到 token 后写入 ~/.morphe/auth.json（权限 600）并退出码 0；超时（5 分钟）退出码 1。
//
// 与 deploy-to-fc 的同名脚本同源，差异：固定写 ~/.morphe/auth.json（持久、跨会话），
// 而非临时 /tmp 文件。CORS 放行任意来源（仅本机端口、且有 state 校验，安全）。
import http from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AUTH_DIR = join(homedir(), '.morphe');
const AUTH_FILE = join(AUTH_DIR, 'auth.json');

const state = randomBytes(16).toString('hex');
const TIMEOUT_MS = 5 * 60 * 1000;

/** 写 token 进 ~/.morphe/auth.json，保留文件里已有的其它键，权限 600。 */
function persistToken(accessToken) {
  mkdirSync(AUTH_DIR, { recursive: true });
  let data = {};
  if (existsSync(AUTH_FILE)) {
    try {
      data = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) || {};
    } catch {
      data = {};
    }
  }
  data.accessToken = accessToken;
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

const server = http.createServer((req, res) => {
  // 允许浏览器页面（morphe.zenmux.app / localhost）跨域 POST 回本机
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/callback') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        // 校验 state，防止其它页面乱发
        if (data.state !== state) {
          res.writeHead(403);
          res.end(JSON.stringify({ ok: false, error: 'state 不匹配' }));
          return;
        }
        if (!data.accessToken) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: '缺少 accessToken' }));
          return;
        }
        persistToken(data.accessToken);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        // 收到即可关闭
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 100);
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'bad json' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

// 监听随机空闲端口，仅本机
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`CALLBACK_PORT=${port}`);
  console.log(`CALLBACK_STATE=${state}`);
});

setTimeout(() => {
  console.error('回调超时（5 分钟内未收到 token）');
  server.close();
  process.exit(1);
}, TIMEOUT_MS);
