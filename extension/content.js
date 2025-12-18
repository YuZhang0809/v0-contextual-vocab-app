// content.js - Podwise Transcript Parser
// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    // 基础 URL（不带 locate 参数）
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.delete('locate'); // 先移除现有的 locate 参数
    
    let locateIndex = null;
    let timestampSeconds = null;
    
    if (selection.rangeCount > 0) {
      // 获取选中区域的起始节点
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      
      // 如果是文本节点，获取其父元素
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
      }
      
      // 策略 1: 直接检查当前元素是否是 Podwise 的 transcript sentence span
      // Podwise 的 span 结构: <span id="transcript-sentence-X-Y" data-seconds="..." data-index="...">
      let transcriptSpan = findTranscriptSpan(node);
      
      if (transcriptSpan) {
        // 找到了！提取 data-index 作为 locate 参数
        locateIndex = transcriptSpan.getAttribute('data-index');
        timestampSeconds = transcriptSpan.getAttribute('data-seconds');
        
        console.log('[ContextVocab] Found transcript span:', {
          id: transcriptSpan.id,
          index: locateIndex,
          seconds: timestampSeconds
        });
      } else {
        // 策略 2: 如果没找到，尝试在选中区域内查找任何 transcript span
        const container = range.commonAncestorContainer;
        const parentEl = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
        
        // 在选中区域的父元素中查找所有 transcript span
        const spans = parentEl.querySelectorAll ? 
          parentEl.querySelectorAll('span[data-index][data-seconds]') : [];
        
        if (spans.length > 0) {
          // 使用第一个找到的 span
          transcriptSpan = spans[0];
          locateIndex = transcriptSpan.getAttribute('data-index');
          timestampSeconds = transcriptSpan.getAttribute('data-seconds');
          
          console.log('[ContextVocab] Found transcript span in container:', {
            id: transcriptSpan.id,
            index: locateIndex,
            seconds: timestampSeconds
          });
        }
      }
    }
    
    // 构造最终 URL
    // locate 参数使用 data-seconds（时间戳），取整数
    let finalUrl = urlObj.toString();
    if (timestampSeconds !== null) {
      const locateValue = Math.floor(parseFloat(timestampSeconds));
      urlObj.searchParams.set('locate', locateValue.toString());
      finalUrl = urlObj.toString();
    }
    
    // 格式化时间戳为 MM:SS 格式（用于显示）
    let formattedTime = null;
    if (timestampSeconds !== null) {
      const totalSeconds = Math.floor(parseFloat(timestampSeconds));
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      formattedTime = `${mins}:${String(secs).padStart(2, '0')}`;
    }

    sendResponse({
      text: text,
      url: finalUrl,
      title: document.title,
      locateIndex: locateIndex,
      timestampSeconds: timestampSeconds,
      formattedTime: formattedTime
    });
  }
});

/**
 * 向上查找最近的 Podwise transcript span 元素
 * Podwise 的句子 span 具有 data-index 和 data-seconds 属性
 */
function findTranscriptSpan(element) {
  let current = element;
  let depth = 0;
  const maxDepth = 10; // 最多向上查找 10 层
  
  while (current && depth < maxDepth) {
    // 检查当前元素是否是 transcript span
    if (current.nodeType === Node.ELEMENT_NODE) {
      // 检查是否有 data-index 属性（Podwise transcript 的标志）
      if (current.hasAttribute && current.hasAttribute('data-index') && current.hasAttribute('data-seconds')) {
        return current;
      }
      
      // 检查 ID 是否匹配 Podwise 的 transcript-sentence 格式
      if (current.id && current.id.startsWith('transcript-sentence-')) {
        return current;
      }
    }
    
    current = current.parentNode;
    depth++;
  }
  
  return null;
}

// 可选：监听页面上的选择变化，提供即时反馈
// document.addEventListener('selectionchange', () => {
//   const selection = window.getSelection();
//   if (selection.toString().trim().length > 0) {
//     console.log('[ContextVocab] Text selected:', selection.toString().substring(0, 50) + '...');
//   }
// });
