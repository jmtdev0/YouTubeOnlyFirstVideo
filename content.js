// Simple content script to track and mark playlist links
let observer = null;
let showRedDot = false; // Default to NOT showing red dot
let settingsLoaded = false; // Track if settings are loaded

// Get initial settings directly from chrome.storage
chrome.storage.sync.get(['showRedDot'], (result) => {
  showRedDot = result.showRedDot !== undefined ? result.showRedDot : false;
  settingsLoaded = true;
  // Update visibility after settings are loaded
  updateRedDotVisibility();
  // Also trigger initial scan now that settings are loaded
  markPlaylistLinks();
});

// Listen for messages from background script (settings updates)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle direct settings updates from popup
  if (message.action === "updateRedDotVisibility") {
    showRedDot = message.showRedDot;
    updateRedDotVisibility();
    sendResponse({ success: true });
    return true;
  }
  
  // Handle settings updates from background script
  if (message.type === 'SETTING_UPDATED') {
    switch (message.settingType) {
      case 'showRedDot':
        showRedDot = message.value;
        updateRedDotVisibility();
        break;
      case 'middleMouseAction':
        // No need to do anything here, the background script handles it
        break;
      case 'rightMouseAction':
        // No need to do anything here, the background script handles it
        break;
    }
    sendResponse({ success: true });
    return true;
  }
});

// Function to update red dot visibility
function updateRedDotVisibility() {
  const markers = document.querySelectorAll('.playlist-marker');
  markers.forEach(marker => {
    marker.style.display = showRedDot ? 'inline-block' : 'none';
  });
}

// Function to check if a link is a YouTube playlist link
function isPlaylistLink(url) {
  if (!url) return false;
  
  // Handle both relative and absolute URLs
  const normalizedUrl = url.startsWith('http') ? url : `https://www.youtube.com${url}`;
  
  // Check for both encoded and unencoded list parameter
  const hasWatch = normalizedUrl.includes('youtube.com/watch');
  const hasList = normalizedUrl.includes('list=') || normalizedUrl.includes('list%3D');
  
  return hasWatch && hasList;
}

// Function to send message to background script
function sendMessageToBackground(type, url) {
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: type,
      url: url,
      timestamp: Date.now()
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Silent error handling
      }
    });
  }
}

// Function to add hover listeners to a link
function addHoverListeners(link) {
  
  // Add mouseenter event (hover in)
  link.addEventListener('mouseenter', () => {
    // Get URL directly from the element
    const href = link.getAttribute('href');
    if (!href) return;
    
    const decodedHref = href.replace(/&amp;/g, '&');
    const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
    
    sendMessageToBackground('PLAYLIST_HOVER_IN', fullUrl);
  });
  
  // Add mouseleave event (hover out)
  link.addEventListener('mouseleave', () => {
    // Get URL directly from the element
    const href = link.getAttribute('href');
    if (!href) return;
    
    const decodedHref = href.replace(/&amp;/g, '&');
    const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
    
    sendMessageToBackground('PLAYLIST_HOVER_OUT', fullUrl);
  });
}

// Function to add middle mouse button listener
function addMiddleMouseListener(link) {
  
  link.addEventListener('mousedown', (event) => {
    // Check if it's the middle mouse button (button 1)
    if (event.button === 1) {
      // Obtain URL directly from the clicked element
      const currentTarget = event.currentTarget;
      const href = currentTarget.getAttribute('href');
      
      if (!href) {
        console.warn('No href found on clicked element');
        return;
      }
      
      // Process the URL the same way as in markPlaylistLinks
      const decodedHref = href.replace(/&amp;/g, '&');
      const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
      
      // Verify it's still a playlist link
      if (isPlaylistLink(fullUrl)) {
        // Prevent default behavior (opening new tab)
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Send message to background script to handle the action
        sendMessageToBackground('MIDDLE_MOUSE_CLICK', fullUrl);
        
        console.log('Middle mouse click handled for URL:', fullUrl);
      }
      
      return false;
    }
  });
  
  // Also prevent the mouseup event to be extra sure
  link.addEventListener('mouseup', (event) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  });
  
  // Prevent the auxclick event (fired on middle mouse button)
  link.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  });
}

// Function to mark playlist links
function markPlaylistLinks() {
  // Don't mark links until settings are loaded
  if (!settingsLoaded) {
    return;
  }
  
  // Find all <a> elements with href containing youtube.com/watch that haven't been processed yet
  const links = document.querySelectorAll('a[href*="youtube.com/watch"]:not([data-playlist-link]), a[href*="/watch"]:not([data-playlist-link])');
  
  let markedCount = 0;
  
  links.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Handle both relative and absolute URLs, decode HTML entities
    const decodedHref = href.replace(/&amp;/g, '&');
    const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
    
    // Check if it's a playlist link
    if (isPlaylistLink(fullUrl)) {
      // Mark the link with a data attribute
      link.setAttribute('data-playlist-link', 'true');
      link.setAttribute('data-original-url', fullUrl);
      
      // Add visual indicator only if user wants to see it
      if (!link.querySelector('.playlist-marker')) {
        const marker = document.createElement('span');
        marker.className = 'playlist-marker';
        marker.style.cssText = `
          display: ${showRedDot ? 'inline-block' : 'none'};
          width: 6px;
          height: 6px;
          background: #ff0000;
          border-radius: 50%;
          margin-left: 5px;
          vertical-align: middle;
        `;
        marker.title = 'Playlist link detected';
        link.appendChild(marker);
      }
      
      // Add hover listeners
      addHoverListeners(link);
      
      // Add middle mouse button listener
      addMiddleMouseListener(link);
      
      markedCount++;
    }
  });
}

// Function to start monitoring for new links
function startMonitoring() {
  // Initial scan (will only work if settings are loaded)
  markPlaylistLinks();
  
  // Set up observer for dynamic content
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if new node contains links or is a link
            if (node.tagName === 'A' || node.querySelector('a')) {
              shouldScan = true;
            }
          }
        });
      }
    });
    
    if (shouldScan) {
      setTimeout(markPlaylistLinks, 100);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
  startMonitoring();
}

// Handle YouTube's SPA navigation
let currentUrl = window.location.href;
const checkUrlChange = () => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    
    // Clean up context menu when navigating
    sendMessageToBackground('CLEANUP', currentUrl);
    
    setTimeout(startMonitoring, 1000);
  }
};

// Check for URL changes every 500ms
setInterval(checkUrlChange, 500);

// Listen for YouTube's navigation events
document.addEventListener('yt-navigate-finish', () => {
  sendMessageToBackground('CLEANUP', window.location.href);
  setTimeout(startMonitoring, 1000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
  sendMessageToBackground('CLEANUP', window.location.href);
});