# 代码与安全审查（2026-10-22）

## 范围与结论

审查全部四份原有文件：`index.html`、`info.html`、`qrcode.min.js`、`electric-car-charging.svg`，以及 GitHub 上现有 Cloudflare Pages 发布检查和生产静态响应。没有发现可确认的远程代码执行、DOM XSS、任意协议拨号或仓库密钥泄露。

项目是无构建步骤的静态网站，没有 package.json、npm 依赖树、PHP、服务端业务代码、数据库或定时任务。不能用 npm audit 的结果描述此项目的依赖安全性。

## 已修复

| 问题 | 修复 |
| --- | --- |
| QRCode.js 自动把含手机号的 URL 写入 title；清空后仍可悬浮读取旧号码 | 生成和清空时移除 title |
| 二维码库加载失败或地址超出容量时抛异常，预览/下载却已经启用，且同一输入不能重试 | 仅在生成成功后提交链接状态；失败禁用操作、提供提示并允许重试 |
| 导出优先选择异步 img，可能尚无有效图片或失败后永久等待 | 优先使用同步 canvas，图片回退通过带失败处理的加载函数读取 |
| 下载异常没有反馈，异步导出期间修改输入可能下载过时内容 | 捕获导出异常、恢复按钮，并检查导出对应的链接是否仍有效 |
| 将 208 像素二维码放大三倍导出，丢失细节 | 直接生成 624 像素二维码，保持预览尺寸和 1080 像素卡片版式 |
| 超长车牌被截为合法前缀，可能生成错误车辆信息 | 不再静默截断，交给原有长度校验拒绝 |
| 扫码页不校验车牌，任意长文本可破坏布局，缺失车牌却显示示例车辆 | 与生成页保持相同的格式归一化和车牌校验，异常时显示“车牌无效”；有效号码的呼叫能力保留 |
| URL 含手机号，缺少 Referrer 保护和搜索收录限制 | 两页增加 no-referrer，扫码页增加 noindex/nofollow，预览链接增加 noreferrer，Pages 增加对应响应头 |
| 禁用链接仅用视觉样式，仍带有 href | 无效时移除 href，补充 aria-disabled；状态区增加 role=status |
| 第三方压缩库缺少许可证和来源记录 | 补充 THIRD_PARTY_NOTICES.md、MIT 许可证及 SHA-256 |

占位提示改为 textContent，避免今后将动态文本拼进 HTML。保留原来的业务校验规则、输入法处理、链接参数、拨号协议和有效输入缓存，未引入框架或新依赖。

## 依赖与 2026-10-21 安全公告

- 本地二维码库与 https://github.com/davidshimjs/qrcodejs 的官方 qrcode.min.js 逐字比较一致（忽略首尾空白）。本地 SHA-256 为 `c541ef06327885a8415bca8df6071e14189b4855336def4f36db54bde8484f36`。
- 检查时，上游 https://github.com/davidshimjs/qrcodejs/security 无公开安全公告；GitHub Advisory Database 的 npm/qrcodejs 查询返回空数组。这不等于保证没有未知漏洞。该库较旧，后续应继续关注维护情况；没有安全修复依据时，不更换二维码算法和兼容层。
- PHP 官方 2026-10-21 公告确认 CVE-2026-109618 / CVE-2026-109619 为严重 RCE：https://www.php.net/archive/2026.php#2026-10-21-5 。本项目不运行 PHP，因此不适用。不能仅按公告日期把其他技术栈的漏洞归因到本项目。

## Cloudflare 审查

- 现有发布为 Cloudflare Pages Git 集成；保留该方式，没有迁移为 Workers，也没有新增运行时兼容标记。
- 仓库没有 functions/、_worker.js、Wrangler 配置、D1/R2/KV/Access Bindings、SQL 或 Cron Triggers，因此代码侧没有相应的权限调用、数据库事务、定时重入或 Worker CPU 限额问题。
- _headers 位于静态发布根目录，按官方 Pages 规则配置 Referrer-Policy 和 X-Content-Type-Options：https://developers.cloudflare.com/pages/configuration/headers/ 。未增加可能影响旧浏览器或外部集成的 CSP/iframe 限制。
- 生产站会把 /info.html 规范化为 /info；隐私元信息放在 HTML 内，两种路径均能生效，旧二维码格式保持兼容。
- 控制台级 Access 策略、Bindings、日志保留和账号权限未通过 Cloudflare 管理 API 直接审计；仓库和公开响应不能证明所有控制台设置。项目代码没有使用这些服务。

## 验证

- `node --test tests/regression.test.mjs`：8 项通过，覆盖有效输入、过长输入、清空、二维码生成异常及重试、中文输入法、下载异常及过时导出、旧链接和恶意参数。
- 两页内联 JavaScript 编译语法检查、`git diff --check` 通过。
- 真实 Chromium 浏览器：页面 canvas 和导出 PNG 均经 BarcodeDetector 成功解码；实际 HTTP 下载得到 move-car-qrcode.png（1080×1080），并目视检查导出文件。
- 生成页 320/375/600/760/1280 像素宽度无横向溢出；扫码页有效旧链接生成正确 tel: 地址。
- 浏览器整页截图接口超时，因此没有完成整页截图对比；布局验证依据实际 DOM 尺寸和页面状态。未做微信/iOS 真机拨号和打印实测。
- 这是直接发布静态文件的项目，没有独立打包构建命令；以脚本检查、回归测试、浏览器验证和 Pages 发布检查验证可用性。

## 仍需关注

手机号保留在二维码 URL 查询参数中，持有二维码的人、扫码软件、浏览器历史和可能的访问日志仍可读取。Referrer 策略和 noindex 只能减少被动泄露，不是加密或鉴权。彻底匿名需要后端令牌或电话转接服务，会改变架构和成本，应另行确认后实施。现有已打印二维码继续有效。
