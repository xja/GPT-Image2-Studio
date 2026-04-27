# Gallery Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复瀑布画廊滚动，并增加按时间筛选和按日期分组的浏览方式。

**Architecture:** 把画廊组织逻辑抽成独立模块并先写测试；前端页面改为“筛选条 + 日期分组 + 分组内瀑布流”；用单独的高度同步逻辑保证画廊在响应式下仍然是内部滚动。

**Tech Stack:** Node.js、原生 ES Modules、原生 DOM、CSS、Node test、浏览器验证

---

### Task 1: 画廊组织逻辑

**Files:**
- Create: `lib/gallery-organizer.mjs`
- Create: `test/gallery-organizer.test.mjs`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 实现最小排序/筛选/分组逻辑**
- [ ] **Step 4: 再跑测试确认通过**

### Task 2: 画廊结构与渲染

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: 增加筛选条和分组容器**
- [ ] **Step 2: 接入筛选状态与分组渲染**
- [ ] **Step 3: 保持现有预览/灯箱/删除行为不回退**

### Task 3: 画廊滚动与样式

**Files:**
- Modify: `public/styles.css`
- Modify: `public/app.js`

- [ ] **Step 1: 单独同步画廊可用高度**
- [ ] **Step 2: 让滚动条继续绑定内部滚动区域**
- [ ] **Step 3: 补齐筛选条、分组头、分组瀑布流样式**

### Task 4: 验证

**Files:**
- Verify: `test/gallery-organizer.test.mjs`
- Verify: `public/index.html`
- Verify: `public/app.js`
- Verify: `public/styles.css`

- [ ] **Step 1: 运行针对性单测**
- [ ] **Step 2: 运行全量测试**
- [ ] **Step 3: 浏览器验证滚动和分组**
