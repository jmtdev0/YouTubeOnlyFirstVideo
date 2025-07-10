// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {

    // Function to notify all YouTube tabs about setting changes
    function notifyYouTubeTabs(settingType, value) {
        chrome.tabs.query({url: ['*://www.youtube.com/*', '*://youtube.com/*']}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SETTING_UPDATED',
                    settingType: settingType,
                    value: value
                }).catch(() => {
                    // Silent error handling - content script might not be loaded yet
                });
            });
        });
    }

    // Load settings
    chrome.storage.sync.get(['middleMouseAction', 'rightMouseAction', 'showRedDot'], function(result) {
        // Set middle mouse action dropdown
        const middleMouseSelect = document.getElementById('middleMouseAction');
        if (middleMouseSelect && result.middleMouseAction !== undefined) {
            middleMouseSelect.value = result.middleMouseAction.toString();
        } else if (middleMouseSelect) {
            // Default to "Open in new tab" (value 2)
            middleMouseSelect.value = '2';
        }
        
        // Set right mouse action dropdown
        const rightMouseSelect = document.getElementById('rightMouseAction');
        if (rightMouseSelect && result.rightMouseAction !== undefined) {
            rightMouseSelect.value = result.rightMouseAction.toString();
        } else if (rightMouseSelect) {
            // Default to "All options in submenu" (value 0)
            rightMouseSelect.value = '0';
        }
        
        // Set red dot checkbox
        const showRedDotCheckbox = document.getElementById('showRedDot');
        if (showRedDotCheckbox) {
            showRedDotCheckbox.checked = result.showRedDot !== undefined ? result.showRedDot : true;
        }
    });
    
    // Add event listener to middle mouse dropdown
    const middleMouseSelect = document.getElementById('middleMouseAction');
    if (middleMouseSelect) {
        middleMouseSelect.addEventListener('change', function() {
            const choiceValue = parseInt(this.value);
            
            // Save the new choice to storage
            chrome.storage.sync.set({'middleMouseAction': choiceValue}, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error saving middle mouse settings:', chrome.runtime.lastError);
                } else {
                    console.log('Middle mouse settings saved successfully:', choiceValue);
                }
            });
            
            // Send message to background script
            chrome.runtime.sendMessage({
                action: "updateMiddleMouseAction", 
                choice: choiceValue
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending middle mouse message to background:', chrome.runtime.lastError);
                } else {
                    console.log('Middle mouse message sent to background successfully:', response);
                }
            });
            
            // Notify all YouTube tabs
            notifyYouTubeTabs('middleMouseAction', choiceValue);
        });
    }
    
    // Add event listener to right mouse dropdown
    const rightMouseSelect = document.getElementById('rightMouseAction');
    if (rightMouseSelect) {
        rightMouseSelect.addEventListener('change', function() {
            const choiceValue = this.value === 'disabled' ? 'disabled' : parseInt(this.value);
            
            // Save the new choice to storage
            chrome.storage.sync.set({'rightMouseAction': choiceValue}, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error saving right mouse settings:', chrome.runtime.lastError);
                } else {
                    console.log('Right mouse settings saved successfully:', choiceValue);
                }
            });
            
            // Send message to background script
            chrome.runtime.sendMessage({
                action: "updateRightMouseAction", 
                choice: choiceValue
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending right mouse message to background:', chrome.runtime.lastError);
                } else {
                    console.log('Right mouse message sent to background successfully:', response);
                }
            });
            
            // Notify all YouTube tabs
            notifyYouTubeTabs('rightMouseAction', choiceValue);
        });
    }
    
    // Add event listener to red dot checkbox
    const showRedDotCheckbox = document.getElementById('showRedDot');
    if (showRedDotCheckbox) {
        showRedDotCheckbox.addEventListener('change', function() {
            const showRedDot = this.checked;
            
            // Save the new setting to storage
            chrome.storage.sync.set({'showRedDot': showRedDot}, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error saving red dot settings:', chrome.runtime.lastError);
                } else {
                    console.log('Red dot settings saved successfully:', showRedDot);
                }
            });
            
            // Send message to background script
            chrome.runtime.sendMessage({
                action: "updateShowRedDot", 
                value: showRedDot
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending red dot message to background:', chrome.runtime.lastError);
                } else {
                    console.log('Red dot message sent to background successfully:', response);
                }
            });
            
            // Notify all YouTube tabs
            notifyYouTubeTabs('showRedDot', showRedDot);
        });
    }

});