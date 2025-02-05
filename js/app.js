// js/app.js
import { initMap, updateMap, createPopupContent } from './map.js';
import { initStorage, getFavorites, addToFavorites, removeFromFavorites } from './storage.js';
import { initSettings, getSettings, saveSettings } from './settings.js';
import { getParkingData, enhanceParkingData, serachFilter,unifyData} from './api.js';
import { updateFavCards } from './favorite.js';



// 获取版本信息和检查更新按钮
const currentVersionElement = document.getElementsByClassName('current-version');
const checkUpdateButton = document.getElementById('check-update-btn');
const updateStatusElement = document.getElementById('update-status');


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker 註冊成功:', registration);
  
          // 检查是否有新版本
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('新版本已準備好，請刷新頁面以更新');
                  // 提示用户刷新页面
                } else {
                  console.log('Service Worker 已安裝');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('Service Worker 註冊失敗:', error);
        });
    });
  }
// 获取当前版本
function getCurrentVersion() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('get-version');
    } else {
        currentVersionElement.textContent = '未啟用 Service Worker';
    }
}
// 检查更新
function checkForUpdates() {
    updateStatusElement.textContent = '檢查更新中...';
    fetch('./sw.js')
        .then((response) => response.text())
        .then((scriptText) => {
            const versionMatch = scriptText.match(/const CACHE_VERSION = '(.+?)';/);
            if (versionMatch && versionMatch[1] !== CACHE_VERSION) {
                updateStatusElement.textContent = '發現新版本，請刷新頁面以更新';
            } else {
                updateStatusElement.textContent = '已是最新版本';
            }
        })
        .catch(() => {
            updateStatusElement.textContent = '檢查更新失敗';
        });
}
// 监听 Service Worker 的消息
if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.version) {
            for(let i of currentVersionElement){
                i.innerHTML = event.data.version
            }
    
        }
    });
}
// sw初始化
document.addEventListener('DOMContentLoaded', () => {
    getCurrentVersion();
    checkUpdateButton.addEventListener('click', checkForUpdates);
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
    await updateParkingData();

    // Clear existing interval if any
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    // Start new interval
    updateInterval = setInterval(updateParkingData, interval * 1000);
}
//定時資料獲取分發
async function updateParkingData() {
    try {
        const data = await getParkingData();
        if (!data) return;
        

        // Update map
        updateMap(data, map);

        // Update cards
        updateParkingCards(data);
        updateFavCards(data)

        // Update last refresh time
        document.getElementById('refresh-time').textContent =
            `${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Failed to update parking data:', error);
    }
}

// 主頁面停車場卡片更新
function updateParkingCards(parkingData) {
    console.log(parkingData);
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
        const lat = parseFloat(spot.lat);
        const lon = parseFloat(spot.lon);
        const isFavorite = favorites.some(([favoriteLat, favoriteLon]) =>
            favoriteLat === lat && favoriteLon === lon
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
            toggleFavorite([lat, lon], favoriteIcon);
        };
        favoriteBtn.appendChild(favoriteIcon);

        const parkName = document.createElement('h3');
        parkName.textContent = `${spot.parkName || '沒有資訊'}`;

        const status = document.createElement('p');
        status.className = 'status';
        status.textContent = `${spot.availableSpaces}`;
        if(spot.availableSpaces === '目前空格'){
            status.classList.add('available');
        }else if(spot.availableSpaces === '目前有車停放'){
            status.classList.add('unavailable');
        }

        // Append elements to cardHeader
        cardHeader.appendChild(favoriteBtn);

        const headText = document.createElement('div');
        headText.className = 'textHeader';
        headText.appendChild(parkName);
        headText.appendChild(status);
        cardHeader.appendChild(headText);

        const feeInfo = document.createElement('div');
        feeInfo.className = 'fee-info';

        const feeHeading = document.createElement('h4');
        feeHeading.textContent = '收費資訊';

        const weekdayFee = document.createElement('p');
        weekdayFee.textContent = `平日：${spot.weekdayFee || '尚無資料'}`;

        const holidayFee = document.createElement('p');
        holidayFee.textContent = `時間：${spot.holidayFee || '尚無資料'}`;

        // Append elements to feeInfo
        feeInfo.appendChild(feeHeading);
        feeInfo.appendChild(weekdayFee);
        feeInfo.appendChild(holidayFee);

        // Append cardHeader and feeInfo to parkingCard
        parkingCard.appendChild(cardHeader);
        parkingCard.appendChild(feeInfo);

        // Add click event to center map on the parking spot
        parkingCard.addEventListener('click', () => {
            const center = [lat, lon];
            map.setView(center, 17);
            L.popup()
                .setLatLng(center)
                .setContent(createPopupContent(spot))
                .openOn(map);
        });

        // Append the parkingCard to the container
        container.appendChild(parkingCard);
    });
}
// 搜索框(是否保留?)
document.getElementById('searchCards').addEventListener('input', (event) => {
    const searchValue = document.getElementById('searchCards').value.trim();
    if (searchValue) {
        updateParkingCards(serachFilter(searchValue));
    } else {
        updateParkingCards(enhanceParkingData());
    }
})
//過濾資料(是否保留?)
function filterData(){
    const searchValue = document.getElementById('searchCards').value.trim();
    if (searchValue) {
        updateParkingCards(serachFilter(searchValue));
    } else {
        updateParkingCards(enhanceParkingData());
    }
    updateParkingCards(serachFilter(searchValue))
    updateMap(enhanceParkingData(), map)

}
//只顯示停車slider 監聽器
document.getElementById('showAvailableOnly').addEventListener('change', filterData);

// 收藏圖標toggle收藏圖標toggle
window.toggleFavorite = function (geo, favoriteIcon) {
    const favorites = getFavorites();
    const isFavorite = favorites.some(([favoriteLat, favoriteLon]) =>
        favoriteLat === geo[0] && favoriteLon === geo[1]
    );

    if (isFavorite) {
        removeFromFavorites(geo[0], geo[1]);
        favoriteIcon.className = 'fa-regular fa-star';
    } else {
        addToFavorites(geo[0], geo[1]);
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
document.addEventListener('DOMContentLoaded', ()=>{
    initApp()
    requestNotificationPermission();
});
    

export { updateParkingData };