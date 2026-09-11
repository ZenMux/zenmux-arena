---
name: vibe-references
description: >-
  按用户给定的 Git 仓库列表下载或更新本地参考源码，统一放在当前项目的
  .context/vibe-references/，并在该目录维护 .gitignore，避免参考仓库被主项目追踪。
  用于拉取参考项目、同步 references、准备竞品或依赖源码；默认只取远端默认分支的浅历史。
---

# Vibe References

把用户指定的参考仓库同步到 `<project-dir>/.context/vibe-references/<仓库名>/`。
脚本使用 TypeScript 与 Node.js 内置模块，需 Node.js 20+、npm 与 Git；通过 `npx --yes tsx` 运行，
不依赖安装 skill 的项目包。

## 确定项目与列表

`<skill-dir>` 是本文件所在目录。`<project-dir>` 优先取用户指定的项目，否则用当前工作目录所在的
Git 根目录（`git rev-parse --show-toplevel`）；非 Git 项目直接用当前目录。

- 用户已给列表文件：直接用 `--list`，相对路径按项目根解析。
- 用户在对话里给出链接：保存到 `.context/vibe-references/references-list.txt`，每行一个仓库。
  已有列表时保留现有项，按这次要求增补或替换，不擅自加入项目。
- 用户只说同步已有 references：读取该默认列表。列表不存在时先定位用户提供的材料；没有来源才询问。

列表支持 HTTPS、SSH（包括 `git@host:owner/repo.git`）和 `file://` Git 地址，忽略空行、首尾空白及
以 `#` 开头的注释。不要在 URL 中嵌入访问令牌；私有仓库沿用用户现有 Git/SSH 认证。
默认以去掉 `.git` 后的仓库名作为目录名；同名仓库可显式指定不同别名：

```text
# 一行一个地址；需要别名时写「目录名 地址」
https://github.com/example/project.git
another-project git@example.org:team/project.git
```

## 执行

```bash
npx --yes tsx <skill-dir>/scripts/update_references.ts --project-dir <project-dir>
# 或使用用户给定的列表
npx --yes tsx <skill-dir>/scripts/update_references.ts --project-dir <project-dir> --list <列表文件>
# 只预览解析结果，不建目录、不联网
npx --yes tsx <skill-dir>/scripts/update_references.ts --project-dir <project-dir> --list <列表文件> --dry-run
```

脚本先检查列表格式和目录名冲突，再逐个同步：

- 首次克隆使用 `--depth 1 --single-branch --no-tags`，只取远端默认分支。
- 已有仓库通过远端 `HEAD` 获取当前默认分支，仅浅抓取该分支；既有其他分支、标签及历史不自动清理。
- 先在 `.context/vibe-references/.gitignore` 追加 `/<目录名>/`，再克隆。保留已有规则且重复运行不重复写入；
  `.gitignore` 与列表本身仍可提交。主项目根 `.gitignore` 不增加逐仓库条目。
- 工作区有改动（含未跟踪文件）、本地提交与原跟踪分支不同、同名目录不是独立仓库、origin 与列表不符时，
  跳过并报告，避免覆盖用户的临时工作。已跟踪的引用目录会报错，不自动 `git rm --cached`。
- 单仓库失败后继续处理其他仓库，最后分别报告成功、跳过、失败；退出码为 `0` 全部成功、`1` 有失败、
  `2` 仅有跳过。不要把“循环结束”当成全部同步成功。

完成后给出存放路径、成功数量及需处理的仓库。只拉取源码，不自动执行参考仓库脚本、安装依赖或推送远端。
从列表移除仓库不会删除磁盘副本或撤掉它的忽略规则。
