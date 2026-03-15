# 安全与权限

## 1. 最小权限原则
- 建议使用仓库级别 token
- 仅授予 PR 评论与提交所需的最小权限
- 避免使用管理员或全局 token

## 2. 触发者控制
- 使用 `allowed_non_write_users` 控制非写权限触发
- 使用 `include_comments_by_actor` 限定触发人
- 使用 `exclude_comments_by_actor` 排除特定账号
- 生产环境建议仅允许内部成员触发

## 3. Secrets 管理
- 不在 workflow 中输出敏感变量
- 禁用或谨慎使用 `show_full_output`
- secrets 必须通过 Gitea 的 Secrets 配置注入

## 4. Fork 与不可信 PR
- 对来自 fork 的 PR 不建议注入敏感 secrets
- 如需审阅外部 PR，优先使用只读模式
- 避免使用 `pull_request_target` 搭配高权限 secrets

## 5. 提交与签名
- 需要写权限才能提交修复
- 如开启 `use_commit_signing`，请妥善保管签名密钥
- 不建议将私钥写入仓库或日志

## 6. 工具白名单
- 如启用自定义 `allowedTools`，请仅授予必要工具
- 禁止不必要的文件写入或系统命令
