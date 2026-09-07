# doc-factory

doc-factory 是一个面向编码 Agent 的项目文档 Skill。它读取当前项目，自动选择合适的文档结构、生成有依据的内容，并在代码变化后修正失效描述。主要产物是下一次 Agent 能找到、理解和核实的项目知识。

模型由宿主提供，无需模型 API。TypeScript 工具只负责扫描、受保护的读取、Git 差异、结构检查与文件写入，不自行调用模型。文档数量由信息需求决定，没有复杂度等级或固定文件清单。

## 安装

运行需要 Node.js 22+；update 需要 Git。仓库内已经包含编译好的独立脚本，因此安装 Skill 不需要在目标项目安装 npm 依赖。

把 [skills/doc-factory](skills/doc-factory/SKILL.md) 的整个目录复制到宿主支持的 Skill 目录，目录名保持 `doc-factory`。例如支持项目级 `.agents/skills` 的宿主，可以复制到目标项目的 `.agents/skills/doc-factory`；其他宿主使用其文档规定的目录。不要只复制 SKILL.md，也不必添加供应商专用配置。

在本工具仓库开发或重新打包：

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm pack
```

压缩包的 `package/skills/doc-factory/` 是可复制的 Skill 目录。`npm pack` 只生成本地压缩包，不发布。本项目未发布到 npm，请勿把同名远程包当作本交付物。

## 调用

在宿主 Agent 中发出这些请求；宿主支持的 Skill 选择语法可能不同：

```text
使用 doc-factory init 初始化当前项目文档，直接执行。
使用 doc-factory init --dry-run 展示候选文档内容和 diff。
使用 doc-factory update 检查当前未提交改动并维护文档。
使用 doc-factory update --base main 检查 main 到当前工作区的变化。
使用 doc-factory update --range HEAD~1..HEAD 检查最近一次提交。
使用 doc-factory update --base main --dry-run 预览更新。
```

可传 `--root <仓库路径>`。用户无需决定文档清单、复杂度或逐项确认。默认实际写入；dry-run 完成同样的分析与起草，但不修改目标文件。

**没有跨次状态。** 默认 update 检查 HEAD 到工作区，包括暂存、未暂存和未跟踪文件，不隐含已提交历史。`--base` 包含指定基线后的已提交及未提交变化。`--range` 只检查两个提交；历史末端或相关工作区不一致时仅允许 dry-run。无效 ref 不回退、不自动 fetch。非 Git 项目可 init，但不能 update。

重复执行时，准确的正文保持原字节。内部重构可以产生“检查完成、无需修改”的结果。没有后台监听、自动 hooks、commit、push 或发布。

## 文档与辅助程序

- [Skill 入口](skills/doc-factory/SKILL.md)：init/update 的宿主执行指令。
- [文档组织原则](skills/doc-factory/references/organization.md)：按 Agent 的任务组织知识与入口。
- [AI 时代项目调研](skills/doc-factory/references/research-ai.md)：Open Design、DeepSeek Harness、Pi、llmdoc 的来源与取舍。
- [传统项目对照](skills/doc-factory/references/research-traditional.md)：Django、Pydantic、GitHub CLI、Grafana。
- [工具协议](skills/doc-factory/references/tool-protocol.md)：JSON 提案、哈希、范围与返回状态。
- [校验与限制](skills/doc-factory/references/validation.md)：语义验证、支持范围、并发与秘密检测限制。
- [评估说明](evals/README.md)：可重复场景与实际执行记录。
- [完成报告](REPORT.md)：关键决策、实现文件、验证结果和未覆盖项。

辅助脚本可以单独检查事实，但不会单独生成语义文档：

```sh
node skills/doc-factory/scripts/doc-factory.mjs --help
node skills/doc-factory/scripts/doc-factory.mjs scan --root /path/to/repo
node skills/doc-factory/scripts/doc-factory.mjs read --root /path/to/repo README.md src/index.ts
node skills/doc-factory/scripts/doc-factory.mjs diff --root /path/to/repo --summary
node skills/doc-factory/scripts/doc-factory.mjs check --root /path/to/repo
```

所有辅助输出为 JSON。提案通过 stdin 传递，正常工作流不留下维护数据库或清单。程序检查结构和快照，宿主核实语义；不能把链接检查通过当作所有描述都正确。

## 修改保护

写入限定为普通项目文档及少量已识别静态导航配置。程序拒绝业务源码、运行时提示词、Skill 资产、归档记录、符号链接、硬链接、忽略文件及可识别生成文档。已知秘密路径不读取，疑似秘密内容不输出。未识别的嵌入式秘密仍是静态检测限制。

文档和证据哈希在写入前复核。冲突需重新阅读与判断；无关修改和 Git index 保持原状。多文件 I/O 失败可能留下已完成的部分写入，结果会列出，不做破坏性回退。便携 Node 文件接口无法完全消除任意外部进程在最后检查与替换之间制造的竞争；细节见校验与限制。
