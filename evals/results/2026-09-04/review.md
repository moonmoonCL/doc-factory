# 2026-09-04 实际执行结果

本次由实现 doc-factory 的同一宿主 Agent 读取 Skill，检查四个独立项目，语义起草提案，并调用打包后的脚本执行。没有用模板程序预填答案，也没有额外模型 API。宿主同时知道评估输入，因此这是同会话实跑，不是独立盲测或跨模型基准。

审查材料：[完整执行记录](execution.json)、[初始化 diff](init.patch)、[语义更新 diff](update.patch)、[检索演练](retrieval.json)。源码输入可由 [prepare.ts](../../prepare.ts) 重建，更新输入由 [mutate.ts](../../mutate.ts) 构造。

## 结果

| 项目 | init 实际写入 | update 实际结果 | 保留情况 |
| --- | --- | --- | --- |
| small-library | 新建 README.md | 内部重构，0 文件写入 | 原文和 mtime 不变 |
| monorepo | 更新 README.md，新建 docs/job-flow.md | 只更新 job-flow 的 ID 及测试描述 | README 人工备注不变 |
| application | 新建 README.md、docs/service.md | 只更新 service 的响应字段、默认端口及容器差异说明 | Docker 源文件及 EXPOSE 3000 保持原状 |
| partial-docs | 更新 README.md、docs/configuration.md | 只补充配置页中的 size 语义 | 既有规则、备注、并发备注、无关文件均保留 |

初始化共写入 7 份文档（4 新建、3 更新），语义更新写入其中 3 份。已有 AGENTS.md 没有改变。初始化后的再次 init、更新后的再次 update 均为四个项目无改动，文档字节和 mtime 比较通过。更新时保留原 Git diff，未依赖提交或持久化维护基线制造无变化结果。

初始化 dry-run 对四个目标做了完整文件内容和 mtime 快照比较，没有写入。更新 dry-run 的文档快照、源码哈希、HEAD 和 index 检查通过。所有 apply 返回的结构检查和写后检查没有发现错误。

范围：monorepo 用显式 `HEAD~1..HEAD`，只考虑两个提交；其他三个用默认 HEAD → 工作区。应用的配置修改在暂存区，响应字段与测试在未暂存区；工具同时检查最终工作树。提交 ID 和完整分层 diff 记录在 execution.json。

并发评估先起草 size API 更新，再由评估器向现有文档追加备注。旧提案返回 `scope_conflict`，未写入；Agent 重新读取文档、源码、测试及范围，保留备注后重试一次成功。没有强行刷新旧稿哈希。

初始化前执行输入项目测试 8 项，更新后执行 9 项，全部通过；仅执行了已经阅读的 Node 测试。输入源码及 Git 变化由评估器构造，文档工具没有改动业务文件、HEAD 或 index。

## 语义评审与局限

实际源码支持：库的空白规范化；parser 到 worker 的 ID/载荷和异常传播；应用的 URL 路由、配置读取及 CI/容器文件；缓存的严格过期边界和 size 计数。文档没有编造设计动机、生产主机或发布流程。应用报告了缺少生产证据，也明确函数测试不证明 HTTP socket 行为。

两次检索演练均按 README → 所属文档 → 实现/测试阅读，找到了 ID 规范化所有者及过期 key 计数证据。它们具有先验上下文，只验证路由可用，不证明新 Agent 的成功率或 token 节省。

尚未执行：独立全新会话、其他宿主的自动发现与加载、跨供应商/模型对照、MDX/reST 或站点真实渲染、Docker 构建、线上部署、大型仓库性能、Linux/Windows/Node 22 实际运行。当前运行环境是 macOS、Node 25.2.1。路径限制和故障注入有辅助程序测试，但未做独立 Agent 对抗评估。便携文件 API 的最终检查/替换竞争限制见 [校验说明](../../../skills/doc-factory/references/validation.md)。
