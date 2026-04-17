# 工作流编辑器项目

基于 ReactFlow 的前端工作流编辑器 + Node.js 后端服务

## 项目结构

```
workflow/
├── backend/          # 后端服务 (Node.js + Express)
│   ├── src/
│   │   ├── index.js      # 服务入口
│   │   └── routes/
│   │       └── workflow.js  # 工作流 API
│   └── package.json
│
└── frontend/         # 前端服务 (React + Vite + ReactFlow)
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   └── components/
    │       ├── InputNode.jsx
    │       ├── ProcessNode.jsx
    │       └── OutputNode.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 启动方式

### 后端服务

```bash
cd backend
npm install
npm start
```

后端运行在 http://localhost:3001

### 前端服务

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:5173

## API 接口

- `GET /api/workflow` - 获取所有工作流
- `GET /api/workflow/:id` - 获取单个工作流
- `POST /api/workflow` - 创建工作流
- `PUT /api/workflow/:id` - 更新工作流
- `DELETE /api/workflow/:id` - 删除工作流
- `GET /api/health` - 健康检查