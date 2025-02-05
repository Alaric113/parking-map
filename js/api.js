// js/api.js
import { getSettings } from './settings.js';
import { getFavorites } from './storage.js';

let originalData = [];



// 主要的資料獲取函數
export async function getParkingData() {
    const settings = getSettings();

    const proxyUrl = 'https://corsproxy.io/'; // 更換為其他代理服務
    const targetUrl = 'https://itaipeiparking.pma.gov.taipei/MapAPI/GetAllPOIData';
    const url = proxyUrl + targetUrl; // 組合 URL

    const payload = new URLSearchParams({
        lon: settings.defaultLon,
        lat: settings.defaultLat,
        catagory: 'car',
        type: 1
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: payload
        });

        if (response.ok) {
            const data = await response.json();
            console.log('成功從 API 獲取數據');
            originalData = data;
            const searchValue = document.getElementById('searchCards');
            if (searchValue.value) {
                return serachFilter(searchValue.value.trim());
            } else {
                return enhanceParkingData();
            }
        }
    } catch (error) {
        console.error('Request failed:', error);
        return null;
    }

    // 如果所有 API 嘗試都失敗，使用本地快取
    const cachedData = getCachedParkingData();
    if (cachedData) {
        console.log('使用快取數據');
        return cachedData;
    }
}

// 增強停車場數據
export function enhanceParkingData() {

    const showAvailableOnly = document.getElementById('showAvailableOnly').checked;
    const favorites = getFavorites();

    // 過濾數據
    let filteredData = showAvailableOnly
        ? originalData.filter(item => item.remark === '目前空格')
        : originalData;

    // 排序邏輯
    filteredData.sort((a, b) => {
        const aLat = parseFloat(a.lat);
        const aLon = parseFloat(a.lon);
        const bLat = parseFloat(b.lat);
        const bLon = parseFloat(b.lon);

        // 檢查是否為收藏
        const aIsFavorite = favorites.some(([favoriteLat, favoriteLon]) =>
            favoriteLat === aLat && favoriteLon === aLon
        );
        const bIsFavorite = favorites.some(([favoriteLat, favoriteLon]) =>
            favoriteLat === bLat && favoriteLon === bLon
        );

        // 優先顯示收藏
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;

        // 其次顯示目前空格
        const aIsAvailable = a.remark === '目前空格';
        const bIsAvailable = b.remark === '目前空格';
        if (aIsAvailable && !bIsAvailable) return -1;
        if (!aIsAvailable && bIsAvailable) return 1;

        // 最後處理無效數據（null 或 undefined）
        if (!a.remark && b.remark) return 1;
        if (a.remark && !b.remark) return -1;

        return 0;
    });

    return filteredData.map(item => ({
        ...item,
        availableSpaces: item.remark || '尚無資料',
        weekdayFee: item.payex || '尚無資料',
        holidayFee: item.servicetime || '尚無資料'
    }));
}

export function serachFilter(text) {
    const filteredData = enhanceParkingData().filter(item => {
        // 检查 item.parkName 是否存在且为字符串
        if (item.parkName && typeof item.parkName === 'string') {
            return item.parkName.match(text);
        }
        return false; // 如果 parkName 无效，跳过该项
    });
    return filteredData;
}
//提供卡片資訊
export function unifyData(data) { 
    
    return data.map(item => ({
        id: item.id,
        parkName: item.name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        availableSpaces: item.empty_lots,
        weekdayFee: item.weekday_fee,
        holidayFee: item.holiday_fee
    }));
}

// 獲取本地快取數據
function getCachedParkingData() {
    // 這裡可以實現從 localStorage 或其他地方獲取快取數據
    return null;
}