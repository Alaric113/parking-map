// js/settings.js

const DEFAULT_SETTINGS = {
    refreshInterval: 10, // seconds
    defaultLat: 25.142349463010277,
    defaultLon: 121.4937824851125,
    mapZoom: 15,
    showAvailableOnly: false
};

// Initialize settings
export function initSettings() {
    const settings = getSettings();
    
    // Initialize form values
    document.getElementById('refresh-interval').value = settings.refreshInterval;
    document.getElementById('default-lat').value = settings.defaultLat;
    document.getElementById('default-lon').value = settings.defaultLon;
    document.getElementById('showAvailableOnly').checked = settings.showAvailableOnly;

    // Add event listeners
    document.getElementById('refresh-interval').addEventListener('change', handleSettingChange);
    document.getElementById('default-lat').addEventListener('change', handleSettingChange);
    document.getElementById('default-lon').addEventListener('change', handleSettingChange);
    document.getElementById('showAvailableOnly').addEventListener('change', handleSettingChange);
}

// Get current settings
export function getSettings() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem('parking-settings'));
        return { ...DEFAULT_SETTINGS, ...savedSettings };
    } catch (error) {
        console.error('Error reading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Save settings
export function saveSettings(newSettings) {
    try {
        const currentSettings = getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        localStorage.setItem('parking-settings', JSON.stringify(updatedSettings));
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Handle setting changes
function handleSettingChange(event) {
    const setting = {};
    
    switch (event.target.id) {
        case 'refresh-interval':
            setting.refreshInterval = parseInt(event.target.value, 10);
            break;
        case 'default-lat':
            setting.defaultLat = parseFloat(event.target.value);
            break;
        case 'default-lon':
            setting.defaultLon = parseFloat(event.target.value);
            break;
        case 'showAvailableOnly':
            setting.showAvailableOnly = event.target.checked;
            break;
    }
    
    saveSettings(setting);
    
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('settingsChanged', {
        detail: { setting }
    }));
}