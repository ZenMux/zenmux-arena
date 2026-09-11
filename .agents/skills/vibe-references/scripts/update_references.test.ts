/** 用本地 Git 远端验证同步与数据保护，不访问真实仓库。 */
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, git, main, readRepositories } from "./update_references.ts";

function fixture(t: TestContext) {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "vibe-references-")),
  );
  const environment = {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_AUTHOR_NAME: "测试",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "测试",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  const previous = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(base, { recursive: true, force: true });
  });
  const project = path.join(base, "project with spaces");
  fs.mkdirSync(project);
  git(project, ["init", "-q"]);
  const remote = path.join(base, "remote.git");
  fs.mkdirSync(remote);
  git(remote, ["init", "-q", "-b", "main"]);
  function commit(text: string, directory = remote): string {
    fs.writeFileSync(path.join(directory, "sample.txt"), text);
    git(directory, ["add", "sample.txt"]);
    git(directory, ["commit", "-qm", text]);
    return git(directory, ["rev-parse", "HEAD"]).stdout;
  }
  commit("first");
  commit("second");
  git(remote, ["branch", "other"]);
  git(remote, ["tag", "v1"]);
  const list = path.join(project, "list.txt");
  const url = pathToFileURL(remote).href;
  fs.writeFileSync(list, "\uFEFF  # 注释\r\n\r\n " + url + "  ");
  const root = path.join(project, ROOT);
  const target = path.join(root, "remote");
  function run(expected = 0, ...extra: string[]): string {
    const lines: string[] = [];
    const output = {
      log: (text: string) => lines.push(text),
      error: (text: string) => lines.push(text),
    };
    const result = main(
      ["--project-dir", project, "--list", "list.txt", ...extra],
      output,
    );
    assert.equal(result, expected, lines.join("\n"));
    return lines.join("\n");
  }
  return { base, project, remote, commit, list, url, root, target, run };
}

test("只浅克隆默认分支；局部忽略规则保留原内容且重复执行不变", (t) => {
  const f = fixture(t);
  const rootIgnore = path.join(f.project, ".gitignore");
  fs.writeFileSync(rootIgnore, "# 原有内容\n");
  const ignore = path.join(f.root, ".gitignore");
  fs.mkdirSync(f.root, { recursive: true });
  fs.writeFileSync(ignore, "# 用户规则没有末尾换行");
  f.run();
  assert.equal(
    git(f.target, ["rev-parse", "--is-shallow-repository"]).stdout.trim(),
    "true",
  );
  assert.equal(
    git(f.target, ["rev-list", "--count", "HEAD"]).stdout.trim(),
    "1",
  );
  assert.equal(git(f.target, ["tag"]).stdout, "");
  assert.ok(!git(f.target, ["branch", "-r"]).stdout.includes("origin/other"));
  assert.equal(git(f.project, ["check-ignore", "-q", f.target]).status, 0);
  assert.equal(git(f.project, ["check-ignore", "-q", ignore], false).status, 1);
  const before = fs.readFileSync(ignore, "utf8");
  f.run();
  assert.equal(fs.readFileSync(ignore, "utf8"), before);
  assert.ok(before.startsWith("# 用户规则没有末尾换行\n"));
  assert.equal(fs.readFileSync(rootIgnore, "utf8"), "# 原有内容\n");
});

test("更新最新快照并跟随远端默认分支变化", (t) => {
  const f = fixture(t);
  f.run();
  let latest = f.commit("third");
  f.run();
  assert.equal(git(f.target, ["rev-parse", "HEAD"]).stdout, latest);
  assert.equal(
    git(f.target, ["rev-list", "--count", "HEAD"]).stdout.trim(),
    "1",
  );
  git(f.remote, ["checkout", "-qb", "trunk"]);
  latest = f.commit("new default");
  f.run();
  assert.equal(
    git(f.target, ["branch", "--show-current"]).stdout.trim(),
    "trunk",
  );
  assert.equal(git(f.target, ["rev-parse", "HEAD"]).stdout, latest);
  assert.equal(
    git(f.target, ["config", "--get-all", "remote.origin.fetch"]).stdout.trim(),
    "+refs/heads/trunk:refs/remotes/origin/trunk",
  );
});

test("保留未跟踪文件和本地提交", (t) => {
  const f = fixture(t);
  f.run();
  const untracked = path.join(f.target, "untracked.txt");
  fs.writeFileSync(untracked, "保留");
  f.run(2);
  assert.equal(fs.readFileSync(untracked, "utf8"), "保留");
  fs.unlinkSync(untracked);
  const localHead = f.commit("local", f.target);
  f.run(2);
  assert.equal(git(f.target, ["rev-parse", "HEAD"]).stdout, localHead);
});

test("跳过同名非仓库目录和 origin 不匹配的仓库", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.target, { recursive: true });
  const keep = path.join(f.target, "keep.txt");
  fs.writeFileSync(keep, "保留");
  f.run(2);
  assert.ok(!fs.existsSync(path.join(f.target, ".git")));
  fs.unlinkSync(keep);
  fs.rmdirSync(f.target);
  f.run();
  git(f.target, [
    "remote",
    "set-url",
    "origin",
    "https://example.invalid/other.git",
  ]);
  f.run(2);
});

test("单个仓库失败后继续同步，支持指定别名", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    f.list,
    "missing " +
      pathToFileURL(path.join(f.base, "missing.git")).href +
      "\ncopy " +
      f.url,
  );
  assert.ok(f.run(1).includes("成功 1"));
  assert.ok(fs.statSync(path.join(f.root, "copy/.git")).isDirectory());
});

test("预览、目录名冲突和缺少列表时不创建参考目录", (t) => {
  const f = fixture(t);
  f.run(0, "--dry-run");
  assert.ok(!fs.existsSync(f.root));
  fs.writeFileSync(f.list, f.url + "\nhttps://example.invalid/remote.git");
  f.run(1);
  assert.ok(!fs.existsSync(f.root));
  fs.unlinkSync(f.list);
  f.run(1);
});

test("已跟踪的参考文件不会被隐式取消跟踪", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.target, { recursive: true });
  fs.writeFileSync(path.join(f.target, "keep.txt"), "保留");
  git(f.project, ["add", f.target]);
  f.run(1);
  assert.ok(git(f.project, ["ls-files"]).stdout.includes("keep.txt"));
});

test("列表解析支持 SSH、HTTPS 和中文别名，并拒绝带凭据的地址", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    f.list,
    "git@example.org:team/ssh-project.git\n参考 https://example.org/team/web.git",
  );
  assert.deepEqual(
    [...readRepositories(f.list).keys()],
    ["ssh-project", "参考"],
  );
  fs.writeFileSync(f.list, "https://secret@example.org/team/web.git");
  assert.throws(() => readRepositories(f.list), /含认证信息/u);
});
