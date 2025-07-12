// Simple content script to track and mark playlist links
let observer = null;
let middleMouseAction = 2; // Default to "Open in new tab"

// Load initial settings
chrome.storage.sync.get(['middleMouseAction'], function(result) {
  if (result.middleMouseAction !== undefined) {
    middleMouseAction = result.middleMouseAction;
  }
});

// Listen for messages from background script (settings updates)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle settings updates from background script
  if (message.type === 'SETTING_UPDATED') {
    switch (message.settingType) {
      case 'middleMouseAction':
        middleMouseAction = message.value;
        break;
      case 'rightMouseAction':
        // No need to do anything here, the background script handles it
        break;
    }
    sendResponse({ success: true });
    return true;
  }
});

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

// Function to check if URL needs getCorrectVideoUrl treatment
// Only for URLs where list= appears before v= (like list=RDMM&v=...)
function needsUrlCorrection(url) {
  if (!url) return false;
  
  const normalizedUrl = url.startsWith('http') ? url : `https://www.youtube.com${url}`;
  
  // Find positions of list= and v= parameters
  const listPosition = normalizedUrl.indexOf('list=');
  const vPosition = normalizedUrl.indexOf('v=');
  
  // Only needs correction if:
  // 1. Both list= and v= exist
  // 2. list= appears before v=
  // 3. It's a watch URL
  return listPosition !== -1 && 
         vPosition !== -1 && 
         listPosition < vPosition && 
         normalizedUrl.includes('youtube.com/watch');
}

// Function to send message to background script
function sendMessageToBackground(type, url, linkElement = null) {
  if (chrome.runtime && chrome.runtime.sendMessage) {
    // Apply URL correction if needed and linkElement is provided
    let finalUrl = url;
    if (linkElement && needsUrlCorrection(url)) {
      finalUrl = getCorrectVideoUrl(linkElement, url);
    }
    
    chrome.runtime.sendMessage({
      type: type,
      url: finalUrl,
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
    
    sendMessageToBackground('PLAYLIST_HOVER_IN', fullUrl, link);
  });
  
  // Add mouseleave event (hover out)
  link.addEventListener('mouseleave', () => {
    // Get URL directly from the element
    const href = link.getAttribute('href');
    if (!href) return;
    
    const decodedHref = href.replace(/&amp;/g, '&');
    const fullUrl = decodedHref.startsWith('http') ? decodedHref : `https://www.youtube.com${decodedHref}`;
    
    sendMessageToBackground('PLAYLIST_HOVER_OUT', fullUrl, link);
  });
}

// Function to extract video ID from thumbnail URL
function extractVideoIdFromThumbnail(link) {
  // Look for thumbnail images within the link
  const thumbnailImg = link.querySelector('div[style*="background-image"]');
  if (thumbnailImg) {
    const style = thumbnailImg.getAttribute('style');
    const urlMatch = style.match(/url\(["']?(https:\/\/i\.ytimg\.com\/vi\/([^\/]+)\/)/);
    if (urlMatch && urlMatch[2]) {
      return urlMatch[2];
    }
  }
  
  // Also check for regular img tags
  const imgElement = link.querySelector('img[src*="ytimg.com/vi/"]');
  if (imgElement) {
    const src = imgElement.getAttribute('src');
    const urlMatch = src.match(/\/vi\/([^\/]+)\//);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
  }
  
  return null;
}

// Function to fix URL inconsistency between thumbnail and link
function getCorrectVideoUrl(link, originalUrl) {
  // Extract video ID from thumbnail
  const thumbnailVideoId = extractVideoIdFromThumbnail(link);
  
  if (thumbnailVideoId) {
    // Extract the current video ID from the URL
    const urlMatch = originalUrl.match(/[?&]v=([^&]+)/);
    const currentVideoId = urlMatch ? urlMatch[1] : null;
    
    // If thumbnail video ID is different from URL video ID, use the thumbnail one
    if (currentVideoId && thumbnailVideoId !== currentVideoId) {
      const correctedUrl = originalUrl.replace(/([?&]v=)[^&]+/, `$1${thumbnailVideoId}`);
      console.log(`URL corrected: ${originalUrl} -> ${correctedUrl}`);
      return correctedUrl;
    }
  }
  
  return originalUrl;
}

// Function to add middle mouse button listener
function addMiddleMouseListener(link) {
  
  link.addEventListener('mousedown', (event) => {
    // Check if it's the middle mouse button (button 1)
    if (event.button === 1) {
      // If middle mouse action is disabled, allow default behavior
      if (middleMouseAction === 'disabled') {
        return; // Don't prevent default, let browser handle it
      }
      
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
        
        // Send message to background script to handle the action (URL correction handled in sendMessageToBackground)
        sendMessageToBackground('MIDDLE_MOUSE_CLICK', fullUrl, currentTarget);
        
        console.log('Middle mouse click handled for URL:', fullUrl);
      }
      
      return false;
    }
  });
  
  // Also prevent the mouseup event to be extra sure (only if not disabled)
  link.addEventListener('mouseup', (event) => {
    if (event.button === 1 && middleMouseAction !== 'disabled') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  });
  
  // Prevent the auxclick event (fired on middle mouse button) (only if not disabled)
  link.addEventListener('auxclick', (event) => {
    if (event.button === 1 && middleMouseAction !== 'disabled') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  });
}

// Function to mark playlist links
function markPlaylistLinks() {
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
      // Fix URL inconsistency between thumbnail and link before storing only for specific format
      const correctedUrl = needsUrlCorrection(fullUrl) ? getCorrectVideoUrl(link, fullUrl) : fullUrl;
      
      // Mark the link with a data attribute
      link.setAttribute('data-playlist-link', 'true');
      link.setAttribute('data-original-url', correctedUrl);
      
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
  // Initial scan
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