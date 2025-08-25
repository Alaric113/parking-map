// js/api.js
import { getSettings } from './settings.js';
import { getFavorites } from './storage.js';

let originalData = [];

// CSRF token 和會話管理
let csrfToken = null;
let sessionInitialized = false;

// 初始化會話並獲取 CSRF token
async function initializeSession() {
    try {
        const response = await fetch('https://itaipeiparking.pma.gov.taipei', {
            credentials: 'include',
        });
        
        const html = await response.text();
        
        // 嘗試從 HTML 中提取 CSRF token
        const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
        if (tokenMatch) {
            csrfToken = tokenMatch[1];
            sessionInitialized = true;
            console.log('會話初始化成功');
            return true;
        }
        
        return false;
    } catch (err) {
        console.error('初始化會話失敗:', err);
        return false;
    }
}

// 主要的資料獲取函數
export async function getParkingData(lat, lon) {
    document.getElementsByClassName('loader')[0].style.display = 'flex';
    const settings = getSettings();

    try {
        // 如果會話未初始化，先初始化
        if (!sessionInitialized) {
            const initialized = await initializeSession();
            if (!initialized) {
                throw new Error('無法初始化會話');
            }
        }

        // 使用 GetParks API (半徑設為 5 公里)
        const url = `https://itaipeiparking.pma.gov.taipei/w1/GetParks/${lon}/${lat}/car/5`;
        
        const headers = {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
            'content-type': 'application/json',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
        };

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            console.log('成功從 API 獲取數據');
            
            // 轉換新 API 格式為舊格式，保持相容性
            const convertedData = convertApiFormat(data);
            originalData = convertedData;
            
            const searchValue = document.getElementById('searchCards');
            document.getElementsByClassName('loader')[0].style.display = 'none';

            if (searchValue && searchValue.value) {
                return searchFilter(convertedData, searchValue.value.trim());
            } else {
                return convertedData;
            }
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('API 請求失敗:', error);
        
        // 嘗試使用代理服務作為備案
        return await fallbackWithProxy(lat, lon);
    }
}

// 備用：使用代理服務
async function fallbackWithProxy(lat, lon) {
    try {
        console.log('嘗試使用代理服務...');
        
        const proxyUrl = 'https://corsproxy.io/?key=e4730777&url=';
        const targetUrl = `https://itaipeiparking.pma.gov.taipei/w1/GetParks/${lon}/${lat}/car/5`;
        const url = proxyUrl + encodeURIComponent(targetUrl);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('代理服務獲取數據成功');
            const convertedData = convertApiFormat(data);
            originalData = convertedData;
            
            document.getElementsByClassName('loader')[0].style.display = 'none';
            return convertedData;
        }
    } catch (proxyError) {
        console.error('代理服務也失敗:', proxyError);
    }

    // 最後使用快取數據
    document.getElementsByClassName('loader')[0].style.display = 'none';
    const cachedData = getCachedParkingData();
    if (cachedData) {
        console.log('使用快取數據');
        return cachedData;
    }
    
    return [];
}

// 轉換新 API 格式為舊格式
function convertApiFormat(newData) {
    if (!Array.isArray(newData)) {
        console.warn('API 返回的數據格式不正確');
        return [];
    }

    return newData.map(item => ({
        parkName: item.name || item.parkName || '未命名停車場',
        lat: parseFloat(item.latitude || item.lat || 0),
        lon: parseFloat(item.longitude || item.lon || 0),
        remark: item.availableSpaces > 0 ? '目前空格' : '目前有車停放',
        left: parseInt(item.availableSpaces || item.left || 0),
        total: parseInt(item.totalSpaces || item.total || 0),
        dataType: item.type || 1, // 預設為一般停車格
        payex: item.weekdayRate || item.payex || '收費資訊請洽現場',
        servicetime: item.holidayRate || item.servicetime || '營業時間請洽現場',
        distance: item.distance || 0,
        address: item.address || ''
    }));
}

// 搜尋過濾函數
export function searchFilter(data, text) {
    const filteredData = data.filter(item => {
        if (item.parkName && typeof item.parkName === 'string') {
            return item.parkName.toLowerCase().includes(text.toLowerCase()) ||
                   (item.address && item.address.toLowerCase().includes(text.toLowerCase()));
        }
        return false;
    });
    return filteredData;
}

// 有空位過濾函數
export function availableFilter(data) { 
    const filterdata = data.filter(item => {
        if (item.left > 0) {
            return item;
        }
        return false;
    });
    
    return filterdata;
}

// 統一數據格式（保持原有邏輯）
export function unifyData(data) { 
    let noName = 0;
    const result = data.reduce((acc, item) => {
        const name = item.parkName || `未命名${noName}`;
        
        if (name.includes('未命名')) {
            acc[name] = {
                parkName: name,
                count: (item.dataType != 6) ? 1 : 0,
                left: (item.remark === '目前空格' && item.dataType != 6) ? 1 : 0,
                specialCount: (item.dataType == 6) ? 1 : 0,
                specialLeft: (item.remark === '目前空格' && item.dataType == 6) ? 1 : 0,
                weekdayFee: item.payex,
                holidayFee: item.servicetime,
                lat: [item.lat],
                lon: [item.lon],
                address: item.address || '',
                distance: item.distance || 0
            };
            noName++;
            return acc;
        }
        
        if (!acc[name]) {
            acc[name] = {
                parkName: name,
                count: 0,
                left: 0,
                specialCount: 0,
                specialLeft: 0,
                weekdayFee: item.payex,
                holidayFee: item.servicetime,
                lat: [],
                lon: [],
                address: item.address || '',
                distance: item.distance || 0
            };
        }
        
        acc[name].lat.push(item.lat);
        acc[name].lon.push(item.lon);
        
        if (item.dataType == 6 && item.remark === '目前空格') {
            acc[name].specialCount++;
            acc[name].specialLeft++;
        } else if (item.dataType == 6 && item.remark == '目前有車停放') {
            acc[name].specialCount++;
        }
        
        if (item.remark === '目前空格' && item.dataType != 6) {
            acc[name].count++;
            acc[name].left++;
        } else if (item.remark == '目前有車停放' && item.dataType != 6) {
            acc[name].count++;
        }
        
        return acc;
    }, {});
    
    let formattedResult = Object.values(result); 

    // 排序邏輯保持不變
    formattedResult.sort((a, b) => {
        const favorites = getFavorites();

        const aIsFavorite = favorites.some((existName) =>
            existName === a.parkName
        );
        const bIsFavorite = favorites.some((existName) =>
            existName === b.parkName
        );
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;

        const aLeft = a.left > 0;
        const bLeft = b.left > 0;
        if (aLeft && !bLeft) return -1;
        if (!aLeft && bLeft) return 1;

        const aName = a.parkName.includes('未命名');
        const bName = b.parkName.includes('未命名');

        if (aName && !bName) return 1;
        if (!aName && bName) return -1;

        // 按距離排序（如果有距離資訊）
        if (a.distance && b.distance) {
            return a.distance - b.distance;
        }

        return 0;
    });

    return formattedResult;
}

// 地圖顯示可用停車位
export function availableForMap(data) {
    return data.filter(item => item.remark === '目前空格');
}

// 獲取本地快取數據
function getCachedParkingData() {
    try {
        const cached = localStorage.getItem('parkingDataCache');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // 快取 5 分鐘有效
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                return data;
            }
        }
    } catch (error) {
        console.error('讀取快取失敗:', error);
    }
    return null;
}

// 儲存快取數據
function setCachedParkingData(data) {
    try {
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem('parkingDataCache', JSON.stringify(cacheData));
    } catch (error) {
        console.error('儲存快取失敗:', error);
    }
}

// 清除會話（供重新初始化使用）
export function clearSession() {
    csrfToken = null;
    sessionInitialized = false;
}

// 手動重新整理數據
export async function refreshParkingData(lat, lon) {
    clearSession();
    return await getParkingData(lat, lon);
}
