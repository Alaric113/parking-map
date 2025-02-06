// js/app.js
import { initMap, updateMap, createPopupContent } from './map.js';
import { initStorage, getFavorites, addToFavorites, removeFromFavorites } from './storage.js';
import { initSettings, getSettings, saveSettings } from './settings.js';
import { getParkingData, searchFilter,unifyData} from './api.js';
import { updateFavCards } from './favorite.js';

// Service Worker Configuration
let odata = [];
let CACHE_VERSION;

// Initialize and manage Service Worker functionality
function initServiceWorker() {
    const currentVersionElements = document.getElementsByClassName('current-version');
    const checkUpdateButton = document.getElementById('check-update-btn');
    const updateStatusElement = document.getElementById('update-status');

    if ('serviceWorker' in navigator) {
        // Register Service Worker
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker 註冊成功:', registration);

                    // 監聽更新
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        
                        newWorker.addEventListener('statechange', () => {
                            // 當新的 Service Worker 狀態改變時
                            if (newWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    const answer = window.confirm('發現新版本，是否立即更新？');
                                    if (answer) {
                                        window.location.reload();
                                    }
                                }
                            }
                        });
                    });

                    // 定期檢查更新
                    setInterval(() => {
                        registration.update();
                    }, 1800000); // 每30分鐘檢查一次
                })
                .catch(error => {
                    console.error('Service Worker 註冊失敗:', error);
                });
        });

        // 監聽來自 Service Worker 的訊息
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.version) {
                Array.from(currentVersionElements).forEach(element => {
                    element.innerHTML = event.data.version;
                    CACHE_VERSION = event.data.version;
                });
            }
        });

        // 檢查版本
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('get-version');
        }

        // 設置更新檢查按鈕
        checkUpdateButton.addEventListener('click', () => {
            updateStatusElement.textContent = '檢查更新中...';
            checkForUpdates(updateStatusElement);
        });
    }
}

// Check for updates
function checkForUpdates(updateStatusElement) {
    fetch('/sw.js')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(scriptText => {
            const versionMatch = scriptText.match(/const CACHE_VERSION = '(.+?)';/);
            if (versionMatch && versionMatch[1] !== CACHE_VERSION) {
                updateStatusElement.textContent = '發現新版本，請刷新頁面以更新';
                if (confirm('發現新版本，是否立即更新？')) {
                    window.location.reload();
                }
            } else {
                updateStatusElement.textContent = '已是最新版本';
            }
        })
        .catch(error => {
            console.error('檢查更新時發生錯誤:', error);
            updateStatusElement.textContent = '檢查更新失敗';
        });
}

// Clear caches on installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        })
    );
});

let map, currentPosition;
let updateInterval;

//程式初始化
async function initApp() {
    // Initialize storage and settings
    await initStorage();
    await initSettings();

    // Get saved settings
    const settings = getSettings();

    // Initialize map
    map = initMap(settings.defaultLat, settings.defaultLon);

    // Setup page navigation
    setupNavigation();

    // Start data updates
    startDataUpdates(settings.refreshInterval);
    

    // Initialize location tracking
    initLocationTracking();
}
// 設定定位
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.getAttribute('href').substring(1);
            showPage(target);
            updateNavActiveState(target);
        });
    });
}
//頁面導航
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}
//更新頁面導航圖標
function updateNavActiveState(activeId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const itemId = item.getAttribute('href').substring(1);
        item.classList.toggle('active', itemId === activeId);
    });
}
// 定位初始化
function initLocationTracking() {
    const locateButton = document.getElementById('locate-me');
    locateButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    map.setView([currentPosition.lat, currentPosition.lng], 17);
                },
                error => {
                    console.error('Error getting location:', error);
                    alert('無法取得位置資訊');
                }
            );
        }
    });
}

// 資料更新迴圈預設10秒
async function startDataUpdates(interval) {
    // Initial update
    await fetchingParkingData();

    // Clear existing interval if any
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    // Start new interval
    updateInterval = setInterval(fetchingParkingData, interval * 1000);
}
//定時資料獲取分發
async function fetchingParkingData(){
    try {
        const data = await getParkingData();
        if (!data) return;
        odata = data;
        updateParkingData();
         // Update last refresh time
        document.getElementById('refresh-time').textContent =
        `${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Failed to update parking data:', error);
    }
}
        // Update map
function updateParkingData() {  
    let data = odata
    const searchValue = document.getElementById('searchCards').value.trim()

    const unifedData = unifyData(data)

    if (searchValue) {

        // Update cards
        
            
        updateMap(searchFilter(data,searchValue), map);
        updateParkingCards(searchFilter(unifedData,searchValue));
            
    } else {
        updateMap(data, map);
        updateParkingCards(unifedData);
        updateFavCards(unifedData);
    }
   
    
}

// 主頁面停車場卡片更新
function updateParkingCards(parkingData) {
    
    const container = document.getElementById('parkingCards');
    const favorites = getFavorites();

    // Clear the container
    container.innerHTML = '';


    if (parkingData.length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = '無資料';
        noDataMessage.className = 'no-data'; // Optional: Add a class for styling
        container.appendChild(noDataMessage);
        return; // Exit the function if no data
    }

    parkingData.forEach(spot => {
        if(spot.count === 0&&spot.specialCount === 0){
            return;
        }
        const lat = parseFloat(spot.lat);
        const lon = parseFloat(spot.lon);
   
        const isFavorite = favorites.some((existName) =>
            existName === spot.parkName
        );
       

        // Create elements
        const parkingCard = document.createElement('div');
        parkingCard.className = 'parking-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';

        const favoriteBtn = document.createElement('button');
        favoriteBtn.className = `favorite-btn ${isFavorite ? 'active' : ''}`;

        const favoriteIcon = document.createElement('i');
        favoriteIcon.className = isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
        favoriteBtn.onclick = (event) => {
            event.stopPropagation();
            toggleFavorite(spot.parkName, favoriteIcon);
        };
        favoriteBtn.appendChild(favoriteIcon);

        const parkName = document.createElement('h3');
        parkName.textContent = `${spot.parkName || '沒有資訊'}`;

        const status = document.createElement('p');
        status.className = 'status';
        status.textContent = `${spot.left}/${spot.count}`;
        if(spot.left > 0){
            status.classList.add('available');
        }else{
            status.classList.add('unavailable');
        }

        // Append elements to cardHeader
        cardHeader.appendChild(favoriteBtn);

        const headText = document.createElement('div');
        headText.className = 'textHeader';
        headText.appendChild(parkName);
       
        cardHeader.appendChild(headText);

        const feeInfo = document.createElement('div');
        feeInfo.className = 'fee-info';

    

        const weekdayFee = document.createElement('p');
        weekdayFee.textContent = `收費:${spot.weekdayFee || '尚無資料'}  時間:${spot.holidayFee || '尚無資料'}`;

        

        // Append elements to feeInfo
        
        feeInfo.appendChild(weekdayFee);
        headText.appendChild(feeInfo);

        // Append cardHeader and feeInfo to parkingCard
        parkingCard.appendChild(cardHeader);

        // Add click event to center map on the parking spot
        parkingCard.addEventListener('click', () => {
            const center = [lat, lon];
            map.setView(center, 16);
            L.popup()
                .setLatLng(center)
                .setContent(createPopupContent(spot))
                .openOn(map);
        });
        parkingCard.appendChild(status);
        // Append the parkingCard to the container
        container.appendChild(parkingCard);
    });
}
// 搜索框(是否保留?)
document.getElementById('searchCards').addEventListener('input', (event) => {
    console.log('typing')
    updateParkingData();
})

//只顯示停車slider 監聽器
document.getElementById('showAvailableOnly').addEventListener('change', updateParkingData);

// 收藏圖標toggle收藏圖標toggle
window.toggleFavorite = function (parkName, favoriteIcon) {
    const favorites = getFavorites();
    const isFavorite = favorites.includes(parkName);
    console.log(isFavorite)

    if (isFavorite) {
        removeFromFavorites(parkName);
        favoriteIcon.className = 'fa-regular fa-star';
    } else {
        addToFavorites(parkName);
        favoriteIcon.className = 'fa-solid fa-star';
    }
    updateParkingData()
};
//通知權限
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                console.log('通知授權');
            } else {
                console.log('通知未授權');
            }
        });
    } else {
        console.log('當前瀏覽器不支持通知');
    }
}
//通知
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/icons/icon-192x192.png', // 替换为你的图标路径
        });
    }
}

// 全域初始化
document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    initApp();
});
    

export { updateParkingData };