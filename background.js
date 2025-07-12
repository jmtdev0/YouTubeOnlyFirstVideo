importScripts('start_scripts.js');

// Background script for YouTube Direct Video extension
let currentPlaylistUrl = null;
let contextMenuId = null;
let middleMouseAction = 2; // Default to "Open in new tab"
let rightMouseAction = 0; // Default to "All options in submenu"

// Load user preferences on startup
chrome.storage.sync.get(['middleMouseAction', 'rightMouseAction'], function(result) {
    middleMouseAction = result.middleMouseAction !== undefined ? result.middleMouseAction : 2;
    rightMouseAction = result.rightMouseAction !== undefined ? result.rightMouseAction : 0;
    console.log('Loaded user preferences:', { middleMouseAction, rightMouseAction });
});

// Listen for messages from settings and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle settings updates from settings.js
    if (message.action === "updateMiddleMouseAction") {
        middleMouseAction = message.choice;
        console.log('Updated middle mouse action:', middleMouseAction);
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === "updateRightMouseAction") {
        rightMouseAction = message.choice;
        console.log('Updated right mouse action:', rightMouseAction);
        // Recreate menus if they exist
        if (contextMenuId && currentPlaylistUrl) {
            removeContextMenu();
            createContextMenu(currentPlaylistUrl);
        }
        sendResponse({ success: true });
        return true;
    }
    
    // Handle content script messages
    switch (message.type) {
        case 'PLAYLIST_HOVER_IN':
            if (rightMouseAction !== 'disabled') {
                createContextMenu(message.url);
            }
            sendResponse({ success: true, action: 'menu_created' });
            break;
            
        case 'PLAYLIST_HOVER_OUT':
            removeContextMenu();
            sendResponse({ success: true, action: 'menu_removed' });
            break;
            
        case 'CLEANUP':
            removeContextMenu();
            sendResponse({ success: true, action: 'cleanup_done' });
            break;
            
        case 'MIDDLE_MOUSE_CLICK':
            handleMiddleMouseClick(message.url);
            sendResponse({ success: true, action: 'middle_click_handled' });
            break;
            
        case 'GET_SETTINGS':
            // Query chrome.storage directly instead of using local variables
            chrome.storage.sync.get(['middleMouseAction', 'rightMouseAction'], function(result) {
                sendResponse({ 
                    middleMouseAction: result.middleMouseAction !== undefined ? result.middleMouseAction : 2,
                    rightMouseAction: result.rightMouseAction !== undefined ? result.rightMouseAction : 0
                });
            });
            return true; // Keep the message channel open for async response
            
        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true;
});

// Handle middle mouse click based on user preference
function handleMiddleMouseClick(playlistUrl) {
    const videoId = extractVideoId(playlistUrl);
    if (!videoId) return;
    
    const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs[0]) return;
        
        switch (middleMouseAction) {
            case 1: // Open in this tab
                chrome.tabs.update(tabs[0].id, {
                    url: directUrl
                });
                break;
                
            case 2: // Open in new tab
                chrome.tabs.create({
                    url: directUrl,
                    active: false,
                    index: tabs[0].index + 1
                });
                break;
                
            case 3: // Open in new tab and switch
                chrome.tabs.create({
                    url: directUrl,
                    active: true,
                    index: tabs[0].index + 1
                });
                break;
                
            case 4: // Open in new window
                chrome.windows.create({
                    url: directUrl,
                    focused: true
                });
                break;
                
            case 5: // Open in incognito window
                chrome.windows.create({
                    url: directUrl,
                    incognito: true,
                    focused: true
                });
                break;
        }
    });
}

// Create context menu based on user preferences
function createContextMenu(playlistUrl) {
    // Remove existing menus if any
    if (contextMenuId) {
        chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
                // Silent error handling
            }
        });
    }
    
    switch (rightMouseAction) {
        case 0: // All options in a submenu
            createSubmenuWithAllOptions();
            break;
        case 1: // Only 'Open in this tab'
            createSingleOption('open-current-tab', 'Open Direct Video in This Tab');
            break;
        case 2: // Only 'Open in a new tab'
            createSingleOption('open-new-tab', 'Open Direct Video in New Tab');
            break;
        case 3: // Only 'Open in a new tab and switch to it'
            createSingleOption('open-new-tab-switch', 'Open Direct Video in New Tab');
            break;
        case 4: // Only 'Open in a new window'
            createSingleOption('open-new-window', 'Open Direct Video in New Window');
            break;
        case 5: // Only 'Open in a new incognito window'
            createSingleOption('open-incognito', 'Open Direct Video in Incognito Window');
            break;
        case 'disabled': // Disabled - don't create menu
            return;
        default:
            createSubmenuWithAllOptions();
    }
    
    contextMenuId = 'direct-video-menus';
    currentPlaylistUrl = playlistUrl;
}

// Create submenu with all options
function createSubmenuWithAllOptions() {
    const parentMenuId = chrome.contextMenus.create({
        id: 'youtube-direct-video',
        title: 'YouTube Direct Video',
        contexts: ['link'],
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
    
    chrome.contextMenus.create({
        id: 'open-current-tab',
        title: 'Open in This Tab',
        contexts: ['link'],
        parentId: parentMenuId,
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
    
    chrome.contextMenus.create({
        id: 'open-new-tab',
        title: 'Open in New Tab',
        contexts: ['link'],
        parentId: parentMenuId,
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
    
    chrome.contextMenus.create({
        id: 'open-new-tab-switch',
        title: 'Open in New Tab and Switch to It',
        contexts: ['link'],
        parentId: parentMenuId,
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
    
    chrome.contextMenus.create({
        id: 'open-new-window',
        title: 'Open in New Window',
        contexts: ['link'],
        parentId: parentMenuId,
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
    
    chrome.contextMenus.create({
        id: 'open-incognito',
        title: 'Open in Incognito Window',
        contexts: ['link'],
        parentId: parentMenuId,
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
}

// Create single option menu
function createSingleOption(id, title) {
    chrome.contextMenus.create({
        id: id,
        title: title,
        contexts: ['link'],
        targetUrlPatterns: ['*://www.youtube.com/watch*']
    });
}

// Remove context menu when not hovering playlist links
function removeContextMenu() {
    if (contextMenuId) {
        chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
                // Silent error handling
            }
        });
        contextMenuId = null;
        currentPlaylistUrl = null;
    }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!currentPlaylistUrl) return;
    
    // Extract video ID from the playlist URL
    const videoId = extractVideoId(currentPlaylistUrl);
    if (!videoId) return;
    
    // Create direct video URL (without playlist parameter)
    const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    switch (info.menuItemId) {
        case 'open-new-tab':
            chrome.tabs.create({
                url: directUrl,
                active: false, // Open in background
                index: tab.index + 1 // Open next to current tab
            });
            break;
            
        case 'open-new-tab-switch':
            chrome.tabs.create({
                url: directUrl,
                active: true, // Switch to new tab
                index: tab.index + 1 // Open next to current tab
            });
            break;
            
        case 'open-current-tab':
            chrome.tabs.update(tab.id, {
                url: directUrl
            });
            break;
            
        case 'open-new-window':
            chrome.windows.create({
                url: directUrl,
                focused: true
            });
            break;
            
        case 'open-incognito':
            chrome.windows.create({
                url: directUrl,
                incognito: true,
                focused: true
            });
            break;
    }
});

// Function to extract video ID from YouTube URL
function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
    } catch (error) {
        return null;
    }
}

// Clean up on startup
chrome.runtime.onStartup.addListener(() => {
    removeContextMenu();
    // Reload user preferences
    chrome.storage.sync.get(['middleMouseAction', 'rightMouseAction'], function(result) {
        middleMouseAction = result.middleMouseAction !== undefined ? result.middleMouseAction : 2;
        rightMouseAction = result.rightMouseAction !== undefined ? result.rightMouseAction : 0;
    });
});

// Clean up on extension install/update
chrome.runtime.onInstalled.addListener(() => {
    removeContextMenu();
    // Set default options if not set
    chrome.storage.sync.get(['middleMouseAction', 'rightMouseAction'], function(result) {
        const updates = {};
        
        if (result.middleMouseAction === undefined) {
            updates.middleMouseAction = 2; // Default to "Open in new tab"
        }
        
        if (result.rightMouseAction === undefined) {
            updates.rightMouseAction = 0; // Default to "All options in submenu"
        }
        
        if (Object.keys(updates).length > 0) {
            chrome.storage.sync.set(updates, function() {
                middleMouseAction = result.middleMouseAction !== undefined ? result.middleMouseAction : 2;
                rightMouseAction = result.rightMouseAction !== undefined ? result.rightMouseAction : 0;
            });
        } else {
            middleMouseAction = result.middleMouseAction;
            rightMouseAction = result.rightMouseAction;
        }
    });
});

// Handle tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url && !tab.url.includes('youtube.com')) {
        // User navigated away from YouTube, clean up
        removeContextMenu();
    }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // Clean up when tab is closed
    removeContextMenu();
});