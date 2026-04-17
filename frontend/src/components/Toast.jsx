import { useState, useEffect, useCallback } from 'react'

let toastId = 0
let addToastFn = null

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    addToastFn = (message, type = 'info', duration = 4000) => {
      const id = ++toastId
      setToasts(prev => [...prev, { id, message, type }])

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration)
      }

      return id
    }

    return () => {
      addToastFn = null
    }
  }, [removeToast])

  const getTypeStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          border: '1px solid rgba(82, 196, 26, 0.4)',
          background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.15) 0%, rgba(82, 196, 26, 0.05) 100%)',
          color: '#52c41a',
          icon: '✓'
        }
      case 'error':
        return {
          border: '1px solid rgba(255, 77, 79, 0.4)',
          background: 'linear-gradient(135deg, rgba(255, 77, 79, 0.15) 0%, rgba(255, 77, 79, 0.05) 100%)',
          color: '#ff4d4f',
          icon: '✕'
        }
      case 'warning':
        return {
          border: '1px solid rgba(250, 173, 20, 0.4)',
          background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.15) 0%, rgba(250, 173, 20, 0.05) 100%)',
          color: '#faad14',
          icon: '!'
        }
      default:
        return {
          border: '1px solid rgba(24, 144, 255, 0.4)',
          background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.15) 0%, rgba(24, 144, 255, 0.05) 100%)',
          color: '#1890ff',
          icon: 'i'
        }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '380px'
    }}>
      {toasts.map(toast => {
        const styles = getTypeStyles(toast.type)
        return (
          <div
            key={toast.id}
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              border: styles.border,
              background: styles.background,
              color: styles.color,
              fontSize: '13px',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slideIn 0.3s ease-out',
              cursor: 'pointer'
            }}
            onClick={() => removeToast(toast.id)}
          >
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: styles.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              {styles.icon}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
          </div>
        )
      })}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export function toast(message, type = 'info', duration = 4000) {
  if (addToastFn) {
    return addToastFn(message, type, duration)
  }
}

toast.success = (message, duration) => toast(message, 'success', duration)
toast.error = (message, duration) => toast(message, 'error', duration)
toast.warning = (message, duration) => toast(message, 'warning', duration)
toast.info = (message, duration) => toast(message, 'info', duration)