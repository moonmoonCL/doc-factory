# Skill 评估

这里分开记录辅助程序测试、宿主 Agent 执行和评审判断。测试通过不会自动认证文档语义。实际记录见 [2026-09-04 结果](results/2026-09-04/review.md)，包含真实提案、证据、diff、冲突和最终文档。

## 可重复输入

在 doc-factory 仓库运行：

```sh
npm ci --ignore-scripts
npm test
npm run eval:prepare
```

[prepare.ts](prepare.ts) 返回一个 `.eval-work/run-*` 目录，内含四个独立 Git 仓库。它只生成输入源码、测试、配置及部分已有文档，没有标准答案生成器。Git 提交仅用于构造评估输入；doc-factory 的文档工作流不提交。输入哈希和评估快照放在各目标仓库外，不属于产品的跨次状态。

| 输入 | 要验证的信息需求 | 后续变化 |
| --- | --- | --- |
| small-library | 单一公开函数、边界与运行测试的方法 | 语义等价的局部变量重构 |
| monorepo | parser 与 worker 的依赖方向、身份传递、失败传播 | 已提交的 ID 规范化行为变化 |
| application | 请求处理、配置、CI、容器配置的关系 | 暂存的默认端口变化、未暂存的响应字段变化 |
| partial-docs | 复用已有 README/配置文档、保留 AGENTS 规则、纠正过时 TTL | 新增 size API，并注入并发人工编辑 |

## 给宿主的任务

将整个 `skills/doc-factory/` 安装到宿主支持的 Skill 目录。也可在能显式加载本地 Skill 的宿主中指定本仓库的 SKILL.md。替换下列请求中的绝对路径，不向 Agent 提供预定文件清单或标准答案：

```text
使用 doc-factory init，目标为 <run-root>/<case>。先 dry-run，提供真实候选内容和检查结果。
使用 doc-factory init，目标为 <run-root>/<case>。直接写入并报告依据。
再次使用 doc-factory init 检查同一项目；准确的现有内容保持不变。
```

真实产品调用只需要 init 或 update；这里分开执行 dry-run 是评估零写入行为，不是要求用户审批文档清单。评估者用文件哈希、mtime 和目录快照比较 dry-run 前后，再进行写入评估。`verify.ts` 捕获文档字节及 mtime；完整文件快照可由外部评估器补充。

```sh
npm run eval:verify -- <run-root> --capture after-init
npm run eval:verify -- <run-root> --compare after-init
npm run eval:mutate -- <run-root>
```

capture 应在首次 init 后执行，compare 在重复 init 后执行。只对新准备的已初始化输入执行一次 mutate。[mutate.ts](mutate.ts) 校验原始输入后修改指定业务文件：monorepo 提交两个输入文件，application 仅暂存配置源码，其他变化留在工作区。它保存业务文件、HEAD 和 index 的基线，以检查之后文档工作流有没有越界。

然后分别调用：

```text
使用 doc-factory update --root <run-root>/small-library。
使用 doc-factory update --range HEAD~1..HEAD --root <run-root>/monorepo。
使用 doc-factory update --root <run-root>/application。
使用 doc-factory update --root <run-root>/partial-docs。
```

在 partial-docs 的提案已经起草、尚未 apply 的评估阶段，由外部评估器执行 `node --import tsx evals/concurrent-edit.ts <run-root>`。旧提案应被拒绝；Agent 必须重新读取和判断后保留新增备注，不能只替换哈希。这是故意插入竞争的测试步骤，正常产品不需要用户暂停操作。

```sh
npm run eval:verify -- <run-root> --capture after-update
npm run eval:verify -- <run-root> --compare after-update
```

capture 在更新完成后执行；再次让宿主检查相同范围后运行 compare。此时代码 diff 仍可能存在，正确结果仍应是无需改写。不要提交文档来人为消除 diff。

## 评审与检索任务

评估者核对实际源码、测试和最终文档，记录结论的依据。不要只判断文件是否存在，也不要因结构检查通过就记作语义满分。

- 小型库应解释真实规范化与异常边界；只出现局部变量的重构不应重写正文。
- Monorepo 应说明真实依赖和失败传播；ID 变化后应修正其事实所有者，保留人工备注。
- 应用应同步配置默认值和 API 字段；Docker 的 EXPOSE 未变，不能一起批量替换。没有生产发布依据时应报告缺口。
- 部分文档应纠正 1000/5000 的差异并保留有效内容、AGENTS 规则；新 size API 应解释过期 key 仍计数，保留并发备注和无关文件。
- 所有变更页应可从入口到达，内部链接有效；重复运行的内容和 mtime 均应稳定。

检索评估请另开一个干净宿主会话，先只给项目入口和任务，例如“改变任务 ID 规范化要改哪里、看哪些测试？”或“size 是否只包含未过期条目？”。记录实际阅读顺序、答案证据、遗漏和读取量，不把拥有完整历史上下文的回答计作盲测。当前记录只完成了同会话检索演练。

路径逃逸、忽略规则、符号/硬链接、秘密检测、历史范围、Git index 保护和多文件 I/O 故障由 [测试](../tests/proposal.test.ts) 等覆盖。这部分是程序测试；尚未声称完成独立 Agent 的对抗性路径安全评估。
