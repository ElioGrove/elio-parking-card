# elio-move-car

<!-- cloudflare-git-config:start -->
## Cloudflare Git 集成建议配置

核对日期：2026-10-26。

使用 **Cloudflare Pages / GitHub**，连接 `ElioGrove/elio-move-car`。

| 配置项 | 建议值 |
| --- | --- |
| Pages 项目名称 | `elio-move-car` |
| 生产分支 | `main` |
| 根目录 | `/`（仓库根目录） |
| 框架预设 | None；按下面的构建命令和产物路径填写 |
| 构建命令 | 留空（原生静态文件） |
| 构建输出目录 | `.` |
| 部署命令 | 无需填写，Pages 在构建后自动上传产物与 Functions |
| 启用预览构建 | 建议启用，非 main 分支自动生成预览 |
| 预览命令 | 无需填写；Pages 使用同一构建命令 |
| 构建监视路径 | 包含 `*`，排除项留空；确保空提交可触发验证 |

无需运行时变量、Secret 或存储绑定。

生产自定义域名：`car.thus.chat`。原有默认域名 `xiaolin-move-car.pages.dev` 保留；项目更名不会自动更换已分配的 pages.dev 子域。以自定义域名作为公开入口。

预览环境的变量、Secret 和绑定需独立配置；不要直接复制生产存储到可写的预览。

部署验证：推送 `main` 后，在 Pages → Deployments 找到同一提交 SHA，确认 build/deploy 均为 success；再访问自定义域名。可用 `git commit --allow-empty -m "chore: verify Cloudflare Git deployment"` 后 `git push origin main` 验证 Git 集成。

参考：[Pages Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)、[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)。

<!-- cloudflare-git-config:end -->
