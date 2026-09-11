#!/usr/bin/env -S npx --yes tsx
/** 同步参考源码快照，同时保护参考目录里的本地工作。 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = ".context/vibe-references";
type Status = "成功" | "跳过" | "失败";
type SyncResult = { status: Status; message: string };
type Output = Pick<Console, "log" | "error">;

export function git(directory: string, args: string[], required = true) {
  const result = spawnSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Git 操作被信号 ${result.signal} 中断`);
  if (required && result.status !== 0) {
    throw new Error(result.stderr.trim() || "Git 操作失败");
  }
  return result;
}

function identity(url: string): string {
  return url.replace(/\/+$/u, "").replace(/\.git$/u, "");
}

function isSymlink(file: string): boolean {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function readRepositories(file: string): Map<string, string> {
  const entries = new Map<string, string>();
  const lines = fs
    .readFileSync(file, "utf8")
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u);
  for (const [index, raw] of lines.entries()) {
    const number = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/u);
    if (parts.length !== 1 && parts.length !== 2) {
      throw new Error(`列表第 ${number} 行应为仓库地址，或「目录名 地址」`);
    }
    const url = parts[parts.length - 1];
    let repoPath: string;
    if (url.includes("://")) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`列表第 ${number} 行不是有效的 Git 地址`);
      }
      if (
        !["https:", "http:", "ssh:", "git:", "file:"].includes(parsed.protocol)
      ) {
        throw new Error(`列表第 ${number} 行不是受支持的 Git 地址`);
      }
      if (
        parsed.password ||
        (["https:", "http:"].includes(parsed.protocol) && parsed.username)
      ) {
        throw new Error(`列表第 ${number} 行含认证信息，请使用 Git 凭据管理`);
      }
      if (
        parsed.search ||
        parsed.hash ||
        !parsed.pathname.replace(/\/+$/u, "")
      ) {
        throw new Error(`列表第 ${number} 行需要仓库根地址`);
      }
      repoPath = parsed.pathname;
    } else {
      const match = /^[^\s/:]+@[^\s/:]+:(.+)$/u.exec(url);
      if (!match) throw new Error(`列表第 ${number} 行不是 Git URL`);
      repoPath = match[1];
    }
    const name =
      parts.length === 2
        ? parts[0]
        : path.posix
            .basename(repoPath.replace(/\/+$/u, ""))
            .replace(/\.git$/u, "");
    // 限定为单层名字，也避免名字被解释成 Git 参数或 gitignore 通配符。
    if (
      !/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(name) ||
      name === "references-list.txt"
    ) {
      throw new Error(`列表第 ${number} 行目录名无效，请显式提供别名`);
    }
    const previous = entries.get(name);
    if (previous && identity(previous) !== identity(url)) {
      throw new Error(`目录名冲突：${name}，请为不同仓库指定不同别名`);
    }
    entries.set(name, url);
  }
  if (!entries.size) throw new Error("列表中没有仓库");
  return entries;
}

function prepareIgnore(project: string, root: string, name: string): void {
  const relative = `${ROOT}/${name}`;
  if (git(project, ["ls-files", "-z", "--", relative], false).stdout) {
    throw new Error("目录已经被主项目跟踪，.gitignore 无法自动取消跟踪");
  }
  const file = path.join(root, ".gitignore");
  if (isSymlink(file)) throw new Error("参考目录的 .gitignore 是符号链接");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const rule = `/${name}/`;
  if (!before.split(/\r?\n/u).includes(rule)) {
    fs.appendFileSync(
      file,
      (before && !before.endsWith("\n") ? "\n" : "") + rule + "\n",
      "utf8",
    );
  }
  if (git(project, ["rev-parse", "--show-toplevel"], false).status === 0) {
    if (
      git(project, ["check-ignore", "-q", "--", relative + "/"], false)
        .status !== 0
    ) {
      throw new Error("忽略规则未生效，请检查已有否定规则");
    }
  }
}

function localSnapshot(directory: string, branch: string): boolean {
  const local = git(
    directory,
    ["rev-parse", "--verify", `refs/heads/${branch}`],
    false,
  );
  const remote = git(
    directory,
    ["rev-parse", "--verify", `refs/remotes/origin/${branch}`],
    false,
  );
  return (
    local.status === 0 && remote.status === 0 && local.stdout === remote.stdout
  );
}

function syncRepository(root: string, name: string, url: string): SyncResult {
  const target = path.join(root, name);
  const skip = (message: string): SyncResult => ({ status: "跳过", message });
  if (isSymlink(target)) return skip("目标目录是符号链接");
  if (!fs.existsSync(target)) {
    git(root, [
      "clone",
      "--depth",
      "1",
      "--single-branch",
      "--no-tags",
      "--",
      url,
      target,
    ]);
    return { status: "成功", message: "已浅克隆默认分支" };
  }
  if (!fs.statSync(target).isDirectory()) return skip("同名路径不是目录");
  const top = git(target, ["rev-parse", "--show-toplevel"], false);
  if (
    top.status !== 0 ||
    fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(target)
  ) {
    return skip("同名路径不是独立 Git 工作区");
  }
  const origin = git(target, ["remote", "get-url", "origin"]).stdout.trim();
  if (identity(origin) !== identity(url)) return skip("origin 与列表不一致");
  if (git(target, ["status", "--porcelain"]).stdout)
    return skip("存在本地改动或未跟踪文件");
  const branch = git(
    target,
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    false,
  );
  if (branch.status !== 0 || !localSnapshot(target, branch.stdout.trim())) {
    return skip("当前分支有本地提交、缺少原跟踪快照或处于 detached HEAD");
  }
  const refs = git(target, ["ls-remote", "--symref", "origin", "HEAD"]).stdout;
  const match = /^ref: refs\/heads\/(.+)\tHEAD$/mu.exec(refs);
  if (!match) throw new Error("无法确定远端默认分支");
  const defaultBranch = match[1];
  const exists = git(
    target,
    ["show-ref", "--verify", "--quiet", `refs/heads/${defaultBranch}`],
    false,
  );
  if (exists.status === 0 && !localSnapshot(target, defaultBranch)) {
    return skip("默认分支的本地提交与原跟踪快照不同");
  }
  git(target, ["remote", "set-branches", "origin", defaultBranch]);
  git(target, [
    "fetch",
    "--depth",
    "1",
    "--no-tags",
    "origin",
    `+refs/heads/${defaultBranch}:refs/remotes/origin/${defaultBranch}`,
  ]);
  // 浅 fetch 不能依赖旧提交祖先关系；只有验证过本地快照后才允许更新分支指针。
  git(target, [
    "checkout",
    "--no-overwrite-ignore",
    "-B",
    defaultBranch,
    `refs/remotes/origin/${defaultBranch}`,
  ]);
  git(target, ["remote", "set-head", "origin", defaultBranch]);
  return { status: "成功", message: `已同步默认分支 ${defaultBranch}` };
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function main(
  argv = process.argv.slice(2),
  output: Output = console,
): number {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        "project-dir": { type: "string" },
        list: { type: "string" },
        "dry-run": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: false,
    });
    if (values.help) {
      output.log(
        "用法：npx --yes tsx update_references.ts [--project-dir 项目根] [--list 列表文件] [--dry-run]",
      );
      output.log(
        "默认使用当前 Git 根或当前目录；列表相对路径按项目根解析；--dry-run 只解析列表，不写文件、不联网。",
      );
      return 0;
    }
    const detected = git(
      process.cwd(),
      ["rev-parse", "--show-toplevel"],
      false,
    );
    const project = fs.realpathSync(
      path.resolve(
        values["project-dir"] ??
          (detected.status === 0 ? detected.stdout.trim() : process.cwd()),
      ),
    );
    if (!fs.statSync(project).isDirectory()) throw new Error("项目目录不存在");
    const root = path.join(project, ROOT);
    // 不跟随用户放在固定产出路径上的链接，避免把参考仓库写到项目外。
    if (isSymlink(path.join(project, ".context")) || isSymlink(root)) {
      throw new Error("参考目录或 .context 不能是符号链接");
    }
    const entries = readRepositories(
      values.list
        ? path.resolve(project, values.list)
        : path.join(root, "references-list.txt"),
    );
    if (values["dry-run"]) {
      for (const name of entries.keys())
        output.log(`待同步：${path.join(root, name)}`);
      return 0;
    }
    fs.mkdirSync(root, { recursive: true });
    const counts: Record<Status, number> = { 成功: 0, 跳过: 0, 失败: 0 };
    for (const [name, url] of entries) {
      let result: SyncResult;
      try {
        prepareIgnore(project, root, name);
        result = syncRepository(root, name, url);
      } catch (error) {
        result = { status: "失败", message: errorMessage(error) };
      }
      counts[result.status]++;
      output.log(`${result.status} ${name}：${result.message}`);
    }
    output.log(
      Object.entries(counts)
        .map(([status, count]) => `${status} ${count}`)
        .join("；"),
    );
    output.log(`参考目录：${root}`);
    return counts.失败 ? 1 : counts.跳过 ? 2 : 0;
  } catch (error) {
    output.error(`错误：${errorMessage(error)}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main();
}
