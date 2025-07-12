// Script para inicializar content scripts en pestañas existentes al instalar la extensión
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        console.log("YouTube Only First Video: Initializing content scripts in existing tabs.");
        initializeContentScriptsInYouTubeTabs();
    }
});

function initializeContentScriptsInYouTubeTabs() {
    // Buscar todas las pestañas de YouTube
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
        console.log(`Found ${tabs.length} YouTube tabs to initialize`);
        
        tabs.forEach(tab => {
            executeContentScriptInTab(tab.id);
        });
    });
}

function executeContentScriptInTab(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
    }, function(result) {
        if (chrome.runtime.lastError) {
            console.error(`Error initializing content script in tab ${tabId}:`, chrome.runtime.lastError.message);
        } else {
            console.log(`Successfully initialized content script in tab ${tabId}`);
        }
    });
}