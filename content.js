// Simple content script to track and mark playlist links
let processedLinks = new Set();
let observer = null;
let showRedDot = false; // Default to NOT showing red dot
let settingsLoaded = false; // Track if settings are loaded

// Get initial settings from background script
chrome.runtime.sendMessage({type: 'GET_SETTINGS'}, (response) => {
  if (response && response.showRedDot !== undefined) {
    showRedDot = response.showRedDot;
  }
  settingsLoaded = true;
  // Update visibility after settings are loaded
  updateRedDotVisibility();
});

// Listen for messages from settings popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRedDotVisibility") {
    showRedDot = message.showRedDot;
    updateRedDotVisibility();
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
  const originalUrl = link.getAttribute('data-original-url');
  
  // Add mouseenter event (hover in)
  link.addEventListener('mouseenter', () => {
    sendMessageToBackground('PLAYLIST_HOVER_IN', originalUrl);
  });
  
  // Add mouseleave event (hover out)
  link.addEventListener('mouseleave', () => {
    sendMessageToBackground('PLAYLIST_HOVER_OUT', originalUrl);
  });
}

// Function to add middle mouse button listener
function addMiddleMouseListener(link) {
  const originalUrl = link.getAttribute('data-original-url');
  
  link.addEventListener('mousedown', (event) => {
    // Check if it's the middle mouse button (button 1)
    if (event.button === 1) {
      // Prevent default behavior (opening new tab)
      event.preventDefault();
      event.stopPropagation();
      
      // Send message to background script to handle the action
      sendMessageToBackground('MIDDLE_MOUSE_CLICK', originalUrl);
      
      return false;
    }
  });
  
  // Also prevent the mouseup event to be extra sure
  link.addEventListener('mouseup', (event) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });
  
  // Prevent the auxclick event (fired on middle mouse button)
  link.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
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
  
  // Find all <a> elements with href containing youtube.com/watch
  const links = document.querySelectorAll('a[href*="youtube.com/watch"], a[href*="/watch"]');
  
  let markedCount = 0;
  
  links.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Handle both relative and absolute URLs, decode HTML entities
    const decodedHref = href.replace(/&amp;/g, '&');
    const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
    
    // Check if it's a playlist link and hasn't been processed yet
    if (isPlaylistLink(fullUrl) && !processedLinks.has(fullUrl)) {
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
      
      // Add to processed set
      processedLinks.add(fullUrl);
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
    
    processedLinks.clear();
    setTimeout(startMonitoring, 1000);
  }
};

// Check for URL changes every 500ms
setInterval(checkUrlChange, 500);

// Listen for YouTube's navigation events
document.addEventListener('yt-navigate-finish', () => {
  sendMessageToBackground('CLEANUP', window.location.href);
  processedLinks.clear();
  setTimeout(startMonitoring, 1000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
  sendMessageToBackground('CLEANUP', window.location.href);
});