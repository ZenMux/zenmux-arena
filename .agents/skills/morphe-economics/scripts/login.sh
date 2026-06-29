#!/usr/bin/env bash
# morphe 通用登录（生产）：浏览器回调登录，拿 accessToken 持久化到 ~/.morphe/auth.json。
# 类似 `gh auth login` / `vercel login`，用户全程只在浏览器点一下，不复制粘贴 token。
#
# 流程：起本地回调 server（127.0.0.1 随机端口）→ open 浏览器到 morphe.zenmux.app/cli-auth
#   （未登录先跳登录页，支持密码 / Google）→ 用户点「授权并返回终端」→ 浏览器把 token POST 回本机
#   → 写入 ~/.morphe/auth.json。
#
# 用法：bash login.sh
# 成功打印 AUTH_OK=1。已登录（token 有效）则直接复用、跳过浏览器（除非传 --force）。
set -euo pipefail

BASE="https://morphe.zenmux.app"
AUTH_FILE="$HOME/.morphe/auth.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE="${1:-}"

# 0) 已有有效 token 则直接复用（除非 --force 强制重登）
if [ "$FORCE" != "--force" ] && [ -s "$AUTH_FILE" ]; then
  TOKEN=$(node -e "try{process.stdout.write((require('$AUTH_FILE').accessToken)||'')}catch(e){}" 2>/dev/null || true)
  if [ -n "$TOKEN" ]; then
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -H "Authorization: Bearer $TOKEN" "$BASE/api/user/me" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ]; then
      echo "已登录（token 有效），跳过浏览器。重新登录请加 --force。"
      echo "AUTH_OK=1"
      exit 0
    fi
  fi
fi

# 1) 起本地回调 server（后台），解析它打印的 port + state
CB_LOG=$(mktemp)
node "$SCRIPT_DIR/auth-callback.mjs" > "$CB_LOG" 2>&1 &
CB_PID=$!

PORT=""; STATE=""
for _ in $(seq 1 25); do
  PORT=$(grep -o 'CALLBACK_PORT=[0-9]*' "$CB_LOG" 2>/dev/null | head -1 | cut -d= -f2 || true)
  STATE=$(grep -o 'CALLBACK_STATE=[a-f0-9]*' "$CB_LOG" 2>/dev/null | head -1 | cut -d= -f2 || true)
  [ -n "$PORT" ] && [ -n "$STATE" ] && break
  sleep 0.2
done
if [ -z "$PORT" ] || [ -z "$STATE" ]; then
  echo "ERROR: 回调 server 未就绪"; kill "$CB_PID" 2>/dev/null || true; exit 1
fi

# 2) 打开浏览器到 cli-auth（带 port+state）。未登录会先被 login 守卫拦，登录后跳回本页。
AUTH_URL="$BASE/cli-auth?port=${PORT}&state=${STATE}"
echo "OPEN_AUTH=${AUTH_URL}"
open "$AUTH_URL" 2>/dev/null || echo "（无法自动打开浏览器，请手动访问：${AUTH_URL}）"

echo "请在浏览器登录并点「授权并返回终端」..."

# 3) 等回调 server 退出（收到 token 或 5 分钟超时）
if wait "$CB_PID"; then
  if [ -s "$AUTH_FILE" ]; then
    echo "AUTH_OK=1"
    echo "TOKEN_FILE=${AUTH_FILE}"
  else
    echo "ERROR: 未收到 token"; exit 1
  fi
else
  echo "ERROR: 登录回调失败或超时"; exit 1
fi
