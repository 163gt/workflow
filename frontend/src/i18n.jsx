import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
  zh: {
    // 通用
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    retry: '重试',
    refresh: '刷新',
    deleteOldRecords: '清理旧记录',
    success: '成功',
    failed: '失败',
    running: '运行中',
    enabled: '已启用',
    disabled: '已禁用',
    loading: '加载中...',

    // 工作空间
    workspaces: '任务空间',
    'no workspaces yet': '暂无任务空间',
    'create one to start': '创建一个开始',
    'create space': '新建',
    'space name': '空间名称',
    'enter workspace name': '请输入空间名称',
    description: '描述',
    'enter description': '请输入描述',
    create: '创建',
    'no description': '暂无描述',
    'created at': '创建于',
    'delete confirm': '删除任务空间将同时删除所有工作流和定时任务，确定要删除吗？',
    'manage workspaces': '管理工作区',

    // 工作流编辑器
    workflow: '工作流',
    back: '返回',
    'save successfully': '保存成功',
    'please save first': '请先保存工作流',
    run: '▶ 执行',
    'running...': '执行中...',
    'execution successful': '执行成功！',
    'execution failed': '执行失败',
    duration: '耗时',
    seconds: '秒',

    // 节点类型
    'http request': 'HTTP 请求',
    'data process': '数据处理',
    'condition': '条件',
    'start node': '开始节点',
    'end node': '结束节点',
    http: 'HTTP请求',
    process: '数据处理',
    start: '开始',
    end: '结束',

    // 属性面板
    name: '名称',
    'enter name': '请输入名称',
    method: '请求方法',
    url: '请求地址',
    'enter url': '请输入 URL',
    headers: '请求头',
    'enter headers': '请输入请求头',
    body: '请求体',
    'enter body': '请输入请求体',
    script: '处理脚本',
    'enter script': '请输入处理脚本',
    'hint': '提示',
    'input hint': 'input - 获取前一个节点的输出',
    'return hint': 'return - 返回处理结果给下一个节点',
    'last result': '上次执行结果',
    'not configured': '未配置',
    'write your logic': '// 在这里编写处理逻辑',
    'result variable': 'const result = input;',
    'return result': 'return result;',

    // 开始/结束节点
    'start node desc': '这是工作流的起始节点，无需配置。',
    'end node desc': '这是工作流的结束节点，无需配置。',

    // 定时任务
    schedule: '定时任务',
    'no schedules yet': '暂无定时任务',
    'schedule name': '任务名称',
    'optional name': '可选，默认为频率名称',
    frequency: '执行频率',
    'create schedule': '创建定时任务',
    'schedule created': '定时任务创建成功',
    'schedule updated': '定时任务更新成功',
    'failed to create': '创建失败',
    'failed to update': '更新失败',
    'failed to delete': '删除失败',
    on: '开启',

    // 执行记录
    'execution log': '执行记录',
    'no execution records': '暂无执行记录2',
    details: '详情',
    error: '错误',
    input: '输入',
    output: '输出',
    'node details': '节点详情',
    'no node details': '暂无节点详情',
    type: '类型',

    // 面板
    panel: '面板',
    expand: '展开面板',
    'click node edit': '点击节点可编辑属性',

    // 加载和错误
    'load failed': '加载失败',
    'check backend': '请检查后端服务是否启动',
    'workspace not found': '工作空间不存在',
    'workflow not initialized': '工作流未初始化',
  },
  en: {
    // General
    save: 'SAVE',
    cancel: 'CANCEL',
    delete: 'DELETE',
    edit: 'EDIT',
    close: 'CLOSE',
    retry: 'RETRY',
    refresh: 'REFRESH',
    deleteOldRecords: 'PRUNE OLD',
    success: 'SUCCESS',
    failed: 'FAILED',
    running: 'RUNNING',
    enabled: 'ENABLED',
    disabled: 'DISABLED',
    loading: 'LOADING...',

    // Workspaces
    workspaces: 'WORKSPACES',
    'no workspaces yet': 'NO WORKSPACES YET',
    'create one to start': 'CREATE ONE TO START',
    'create space': 'NEW',
    'space name': 'SPACE NAME',
    'enter workspace name': 'Enter workspace name...',
    description: 'DESCRIPTION',
    'enter description': 'Enter description...',
    create: 'CREATE',
    'no description': 'No description',
    'created at': 'CREATED',
    'delete confirm': 'Deleting workspace will also delete all workflows and schedules. Continue?',
    'manage workspaces': 'Manage your workspaces',

    // Workflow Editor
    workflow: 'WORKFLOW',
    back: 'BACK',
    'save successfully': 'Saved successfully',
    'please save first': 'Please save workflow first',
    run: '▶ RUN',
    'running...': 'RUNNING...',
    'execution successful': 'Execution successful!',
    'execution failed': 'Execution failed',
    duration: 'Duration',
    seconds: 's',

    // Node Types
    'http request': 'HTTP REQUEST',
    'data process': 'DATA PROCESS',
    'condition': 'CONDITION',
    'start node': 'START NODE',
    'end node': 'END NODE',
    http: 'HTTP',
    process: 'PROCESS',
    start: 'START',
    end: 'END',

    // Property Panel
    name: 'NAME',
    'enter name': 'Enter name...',
    method: 'METHOD',
    url: 'URL',
    'enter url': 'https://api.example.com',
    headers: 'HEADERS',
    'enter headers': '{"Content-Type": "application/json"}',
    body: 'BODY',
    'enter body': 'Request body...',
    script: 'SCRIPT',
    'enter script': 'Enter processing script...',
    'hint': 'HINT',
    'input hint': 'input - Get previous node output',
    'return hint': 'return - Output to next node',
    'last result': 'LAST RESULT',
    'not configured': 'Not configured',
    'write your logic': '// Write your logic here',
    'result variable': 'const result = input;',
    'return result': 'return result;',

    // Start/End Node
    'start node desc': 'This is the starting point of the workflow. No configuration needed.',
    'end node desc': 'This is the end point of the workflow. No configuration needed.',

    // Schedule
    schedule: 'SCHEDULE',
    'no schedules yet': 'NO SCHEDULES YET',
    'schedule name': 'SCHEDULE NAME',
    'optional name': 'Optional name',
    frequency: 'FREQUENCY',
    'create schedule': 'CREATE SCHEDULE',
    'schedule created': 'Schedule created',
    'schedule updated': 'Schedule updated',
    'failed to create': 'Failed to create',
    'failed to update': 'Failed to update',
    'failed to delete': 'Failed to delete',
    on: 'ON',

    // Execution Log
    'execution log': 'EXECUTION LOG',
    'no execution records': 'NO EXECUTION RECORDS',
    details: 'DETAILS',
    error: 'ERROR',
    input: 'INPUT',
    output: 'OUTPUT',
    'node details': 'NODE DETAILS',
    'no node details': 'NO NODE DETAILS',
    type: 'TYPE',

    // Panel
    panel: 'PANEL',
    expand: 'EXPAND PANEL',
    'click node edit': 'Click node to edit properties',

    // Loading and Error
    'load failed': 'Load failed',
    'check backend': 'Please check if backend is running',
    'workspace not found': 'Workspace not found',
    'workflow not initialized': 'Workflow not initialized',
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('language')
    return saved || 'zh'
  })

  useEffect(() => {
    localStorage.setItem('language', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = (key) => translations[lang][key] || key

  const toggleLang = () => {
    setLang(prev => prev === 'zh' ? 'en' : 'zh')
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
