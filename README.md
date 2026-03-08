# film-web-nas

README.md

# 胶片底片档案库 · 私有 NAS 版
> 胶片摄影专用｜底片/扫描件管理｜帧号/冲扫信息｜Docker 一键部署

![](cover.png)

[![](https://img.shields.io/badge/版本-最终版-F9E8C9?style=flat-square&color=F9E8C9&labelColor=4A3520)]()
[![](https://img.shields.io/badge/部署-Docker-2d3748?style=flat-square&color=2d3748&labelColor=eeeeee)]()
[![](https://img.shields.io/badge/协议-MIT-lightgrey?style=flat-square)]()
[![](https://img.shields.io/badge/适配-飞牛NAS-E87939?style=flat-square&color=E87939&labelColor=eeeeee)]()

## ✨ 介绍
专为胶片摄影爱好者打造的**私有底片档案管理系统**，一键部署在 NAS，数据本地存储、安全私密。
支持底片 ↔ 扫描件绑定、帧号管理、冲扫信息记录、批量上传与一键备份。

## 🎞️ 功能
- 胶卷信息管理：品牌 / 型号 / ISO / 相机
- 底片帧号管理（1–36）
- 冲扫信息记录：冲扫店、扫描设备、日期
- 底片 ↔ 扫描件双向绑定
- 批量上传、预览、重命名、删除、导出
- 管理员登录
- 一键备份 / 恢复数据

## 🚀 部署
```bash
docker-compose up -d
🌐 访问
http://NAS_IP:3980
🔐 默认密钥
film_2026_nas
📁 结构
film-web-nas/
├── docker-compose.yml
├── README.md
├── server/
└── web/
🧩 技术栈
前端：HTML / CSS / JS
后端：Node.js + Express
数据库：SQLite
部署：Docker
