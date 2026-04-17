// 生产环境禁用 console（必须放在最顶部）
if (import.meta.env.PROD) {
  ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
    console[method] = () => {};
  });
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)