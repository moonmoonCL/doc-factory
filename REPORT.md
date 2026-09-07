# doc-factory 实现与验收报告

交付日期：2026-09-04。V1 已实现可安装的开放格式 Skill、TypeScript 辅助工具、按需研究资料和可重复评估。主要文档读者是编码 Agent；宿主模型负责理解、结构选择和语义更新。

## Review 入口

- [SKILL.md](skills/doc-factory/SKILL.md)：宿主执行契约及 init/update 路由。
- [使用说明](README.md)：安装、调用、dry-run、范围与限制。
- [AI 项目研究](skills/doc-factory/references/research-ai.md)：Open Design、DeepSeek Harness、Pi、llmdoc 的实际文件、固定提交链接和采用条件。
- [成熟项目对照](skills/doc-factory/references/research-traditional.md)：Django、Pydantic、GitHub CLI、Grafana 的导航、所有权和维护机制。
- [实际执行结果](evals/results/2026-09-04/review.md)：生成/修改的文档、依据、差异和未覆盖项。
- [完整机器记录](evals/results/2026-09-04/execution.json)：实读证据、提案、dry-run、写入、冲突与重复运行输出。

## 关键决策及落点

| 决策 | 依据与实现 |
| --- | --- |
| 按 Agent 任务组织，入口保持短小 | 借鉴 Open Design/Pi 的条件阅读路由；[组织原则](skills/doc-factory/references/organization.md) 要求独立检索需要才新增页面，不套项目等级模板 |
| 每项事实由合适的文档所有者维护 | 借鉴 Harness 的事实所有权；复用模块 README 或现有 docs，其他入口链接引用，保留已有规则与历史状态 |
| 宿主负责语义，程序只提供事实与检查 | [CLI](src/cli.ts) 没有模型后端，也没有伪装为模型的模板生成命令；init/update 由 Skill 驱动 |
| 变化是检查信号，准确内容可保持不变 | 借鉴 llmdoc 的语义更新；[update](skills/doc-factory/references/update.md) 明确检查实际实现和测试，允许空变更提案 |
| 不保存跨次维护状态 | 不引入 llmdoc 式独立文档树和修订账本；每次读取当前资料和明确 Git 范围，代价是需显式提供已提交变化的基线 |
| 所有目标写入都受保护 | [提案与写入](src/proposal.ts) 校验文档及证据哈希、范围指纹和导航；保留无关改动，不删除、不提交、不改 index |
| 不把检查通过当作语义正确 | [Markdown 校验](src/markdown.ts) 检查链接、锚点和可达性；未知渲染格式明确标记，宿主另做事实评审 |

研究用于组织原则，不意味着这些仓库完全由 AI 编写。没有复制它们的大型目录、厂商专属运行环境、双语文件要求或全套门禁。

## 交付文件

Skill 包包含一个 SKILL.md、七份按需 references、独立 JavaScript 脚本及依赖许可说明。分发脚本从 TypeScript 编译，复制整个 Skill 目录即可运行，不需要在目标项目安装依赖或配置模型 API。

辅助代码分为 [仓库读取](src/repository.ts)、[Git 差异](src/git.ts)、[Markdown 检查](src/markdown.ts)、[提案与写入](src/proposal.ts)、[类型](src/types.ts) 和 [CLI](src/cli.ts)。[构建脚本](scripts/build.ts) 打包依赖并收集第三方许可文本。

新建了测试与评估工具、安装说明、本报告和研究资料。本仓库原先没有实现文件。四个评估目标中，init 写入 7 份文档（4 新建、3 更新），update 只修改 3 份已有文档；完整文件清单与每项理由见实际执行结果。原有 AGENTS 规则和人工备注保留。

## 校验结果

| 检查 | 结果及证据 |
| --- | --- |
| TypeScript | `npm run typecheck` 通过 |
| 辅助程序及分发测试 | `npm test` 27 项通过，涵盖范围、路径/忽略/秘密保护、链接/锚点/导航、冲突、部分 I/O 失败、清理失败及字节/mtime 幂等 |
| 独立分发脚本 | 从无 node_modules 的临时安装目录执行 scan、YAML 文档 dry-run、真实 apply 和 check，通过 |
| Skill 格式 | 基于当前开放规范验证 name/description/compatibility、目录匹配、长度和所有按需引用，通过 |
| 本仓库文档 | 内部链接检查无错误；Skill references 的打包与相对链接另有独立测试 |
| 真实宿主 init/update | 四个场景已实跑；8 项初始输入测试、9 项更新输入测试通过 |
| 重复运行 | 四个项目的重复 init 和重复 update 均无文档字节或 mtime 变化 |
| 并发与无关修改 | 过期提案被拒绝，重读后保留备注并完成；业务文件、HEAD、index 和无关文件检查通过 |

本机附带的 `quick_validate.py` 也执行了，但它的旧字段白名单拒绝 `compatibility`。该字段在[当前 Agent Skills 规范](https://agentskills.io/specification)中明确允许，因此保留标准字段，并用仓库内的 [Skill 格式测试](tests/skill.test.ts) 验证；没有修改宿主校验器或把这次拒绝记作通过。

实跑中发现并修复了 ESM 打包后 YAML 依赖加载失败；因此分发测试直接运行复制出的 bundle。也修复了非 Git 忽略目录被内部反向规则绕过，以及文件已经创建但清理失败时遗漏部分写入记录的问题。

## 已知限制和未覆盖项

当前真实执行来自同一宿主会话，包含宿主语义起草，不是独立盲测。独立新 Agent、其他宿主自动加载、跨模型比较和大型仓库性能尚未验证。实际环境是 macOS / Node 25.2.1；Node 22 是构建目标和声明的最低环境，未在本次运行该版本。Linux/Windows 未验证。

MDX/reST、HTML 属性链接和动态站点导航没有运行真实渲染器；它们不会得到“完整验证通过”的声明。未执行目标 Docker 构建、HTTP socket 集成验证或生产部署，也没有凭配置文件编造上线流程。

写入使用快照检查、合作式排他锁和逐文件替换。无法对任意外部进程在最终检查与替换间的变化提供原子比较交换保证；多文件失败可能部分完成，会报告已写路径及未清理文件，不回滚无关内容。静态秘密检测也不是全覆盖扫描器。详细边界见[校验与限制](skills/doc-factory/references/validation.md)。

没有安装后台任务或 hook，没有自动删除文档、commit、push 或发布。持续维护通过用户调用 init/update 或宿主自行编排实现；V1 没有后台监听服务。
