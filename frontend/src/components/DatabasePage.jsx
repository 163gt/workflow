import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from './Toast'
import { useLanguage } from '../i18n'

export default function DatabasePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [dbInfo, setDbInfo] = useState(null)

  const loadBackups = async () => {
    try {
      const res = await fetch('/api/db/backups')
      const data = await res.json()
      setBackups(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Load backups failed:', error)
    }
  }

  const loadDbInfo = async () => {
    try {
      const res = await fetch('/api/db/info')
      const data = await res.json()
      setDbInfo(data)
    } catch (error) {
      console.error('Load db info failed:', error)
    }
  }

  useEffect(() => {
    const load = async () => {
      await Promise.all([loadBackups(), loadDbInfo()])
      setLoading(false)
    }
    load()
  }, [])

  const handleBackup = async () => {
    setBacking(true)
    try {
      const res = await fetch('/api/db/backup', { method: 'POST' })
      const result = await res.json()

      if (result.status === 'success') {
        toast.success(t('backup successful') || '备份成功')
        loadBackups()
        loadDbInfo()
      } else {
        toast.error(`${t('backup failed') || '备份失败'}: ${result.error}`)
      }
    } catch (error) {
      toast.error(`${t('backup failed') || '备份失败'}: ${error.message}`)
    } finally {
      setBacking(false)
    }
  }

  const handleDownload = async (filename) => {
    try {
      const res = await fetch(`/api/db/backup/${filename}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error(`${t('download failed') || '下载失败'}: ${error.message}`)
    }
  }

  const handleDelete = async (filename) => {
    if (!window.confirm(t('confirm delete') || '确定删除备份文件？')) return

    try {
      const res = await fetch(`/api/db/backup/${filename}`, { method: 'DELETE' })
      const result = await res.json()

      if (result.status === 'success') {
        toast.success(t('delete successful') || '删除成功')
        loadBackups()
        loadDbInfo()
      } else {
        toast.error(`${t('delete failed') || '删除失败'}: ${result.error}`)
      }
    } catch (error) {
      toast.error(`${t('delete failed') || '删除失败'}: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <span style={{ color: '#888' }}>Loading...</span>
      </div>
    )
  }

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px'
  }

  const titleStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e8e8e8',
    marginBottom: '16px',
    letterSpacing: '1px'
  }

  const infoStyle = {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: '1.8'
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 数据库信息 */}
      <div style={cardStyle}>
        <div style={titleStyle}>数据库信息</div>
        {dbInfo ? (
          <div style={infoStyle}>
            <div>路径：{dbInfo.path}</div>
            <div>大小：{formatBytes(dbInfo.size)}</div>
            <div>表数量：{dbInfo.tables}</div>
          </div>
        ) : (
          <div style={{ color: '#666' }}>加载中...</div>
        )}
      </div>

      {/* 备份操作 */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={titleStyle}>手动备份</div>
          <button
            onClick={handleBackup}
            disabled={backing}
            style={{
              padding: '10px 20px',
              background: backing ? 'rgba(100, 100, 255, 0.3)' : 'rgba(100, 100, 255, 0.6)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              cursor: backing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {backing ? '备份中...' : '立即备份'}
          </button>
        </div>
        <div style={infoStyle}>
          备份文件将保存在 backups 文件夹中，可下载到本地保存
        </div>
      </div>

      {/* 备份列表 */}
      <div style={cardStyle}>
        <div style={titleStyle}>备份列表</div>
        {backups.length === 0 ? (
          <div style={{ color: '#666', fontSize: '13px' }}>暂无备份</div>
        ) : (
          <div>
            {backups.map((backup) => (
              <div
                key={backup.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}
              >
                <div>
                  <div style={{ color: '#e8e8e8', fontSize: '13px' }}>{backup.name}</div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                    {formatBytes(backup.size)} · {backup.time}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleDownload(backup.name)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(100, 100, 255, 0.3)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    下载
                  </button>
                  <button
                    onClick={() => handleDelete(backup.name)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255, 100, 100, 0.3)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
