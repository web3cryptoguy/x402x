// 静默处理 MetaMask SDK 的自动连接错误（当使用其他钱包时）
(function() {
  const handleUnhandledRejection = function(event) {
    if (!event || !event.reason) return;
    
    var reason = event.reason;
    var errorMessage = '';
    
    // 尝试多种方式提取错误信息
    if (typeof reason === 'string') {
      errorMessage = reason;
    } else if (reason && reason.message) {
      errorMessage = reason.message;
    } else if (reason && reason.toString) {
      errorMessage = reason.toString();
    } else if (reason && reason.error && reason.error.message) {
      errorMessage = reason.error.message;
    }
    
    var errorString = errorMessage.toLowerCase();
    var stackString = (reason && reason.stack ? reason.stack : '').toLowerCase();
    
    // 静默处理 MetaMask SDK 的自动连接错误
    if (
      errorString.indexOf('failed to connect to metamask') !== -1 ||
      errorString.indexOf('metamask extension not found') !== -1 ||
      errorString.indexOf('metamask') !== -1 ||
      stackString.indexOf('inpage.js') !== -1 ||
      stackString.indexOf('metamask') !== -1
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };
  
  const handleError = function(event) {
    if (!event) return;
    
    var errorMessage = (event.message || (event.error && event.error.message) || '').toLowerCase();
    var filename = (event.filename || '').toLowerCase();
    
    // 静默处理 MetaMask SDK 相关的错误
    if (
      errorMessage.indexOf('failed to connect to metamask') !== -1 ||
      errorMessage.indexOf('metamask extension not found') !== -1 ||
      filename.indexOf('inpage.js') !== -1 ||
      filename.indexOf('metamask') !== -1
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };
  
  // 立即设置错误处理（在页面加载的最早阶段）
  if (window.addEventListener) {
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    window.addEventListener('error', handleError, true);
  } else if (window.attachEvent) {
    window.attachEvent('onerror', handleError);
  }
})();

