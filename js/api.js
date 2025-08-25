// js/api.js
import { getSettings } from './settings.js';
import { getFavorites } from './storage.js';

let originalData = [];

// 主要的資料獲取函數 - 完全使用代理服務
export async function getParkingData(lat, lon) {
    document.getElementsByClassName('loader')[0].style.display = 'flex';
    const settings = getSettings();

    try {
        // 方案 1: 嘗試使用新的 GetParks API (通過代理)
        const parkingData = await fetchWithProxy(lat, lon);
        if (parkingData) {
            console.log('成功從新 API 獲取數據');
            const convertedData = convertNewApiFormat(parkingData);
            originalData = convertedData;
            
            const searchValue = document.getElementById('searchCards');
            document.getElementsByClassName('loader')[0].style.display = 'none';

            if (searchValue && searchValue.value) {
                return searchFilter(convertedData, searchValue.value.trim());
            } else {
                return convertedData;
            }
        }
    } catch (error) {
        console.error('新 API 失敗，嘗試舊 API:', error);
    }

    // 方案 2: 使用原本的 API 作為備用
    try {
        const fallbackData = await fetchWithOriginalAPI(lat, lon);
        if (fallbackData) {
            console.log('使用原本 API 成功');
            originalData = fallbackData;
            document.getElementsByClassName('loader')[0].style.display = 'none';
            return fallbackData;
        }
    } catch (error) {
        console.error('原本 API 也失敗:', error);
    }

    // 最後使用快取
    document.getElementsByClassName('loader')[0].style.display = 'none';
    const cachedData = getCachedParkingData();
    if (cachedData) {
        console.log('使用快取數據');
        return cachedData;
    }
    
    return [];
}

// 使用代理獲取新 API 數據
async function fetchWithProxy(lat, lon) {
    const proxyServices = [
        'https://corsproxy.io/?key=e4730777&url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://api.allorigins.win/get?url='
    ];

    for (const proxy of proxyServices) {
        try {
            const targetUrl = `https://itaipeiparking.pma.gov.taipei/w1/GetParks/${lon}/${lat}/car/5`;
            
            let url, options;
            
            if (proxy.includes('allorigins')) {
                url = proxy + encodeURIComponent(targetUrl);
                options = {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    }
                };
            } else {
                url = proxy + encodeURIComponent(targetUrl);
                options = {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Origin': window.location.origin
                    }
                };
            }

            console.log(`嘗試代理服務: ${proxy}`);
            const response = await fetch(url, options);

            if (response.ok) {
                let data = await response.json();
                
                // allorigins 會包裝在 contents 裡
                if (proxy.includes('allorigins') && data.contents) {
                    data = JSON.parse(data.contents);
                }
                
                setCachedParkingData(data);
                return data;
            }
        } catch (error) {
            console.error(`代理服務 ${proxy} 失敗:`, error);
            continue;
        }
    }
    
    return null;
}

// 使用原本的 API 作為備用
async function fetchWithOriginalAPI(lat, lon) {
    const proxyUrl = 'https://corsproxy.io/?key=e4730777&url=';
    const targetUrl = 'https://itaipeiparking.pma.gov.taipei/MapAPI/GetAllPOIData';
    const url = proxyUrl + encodeURIComponent(targetUrl);

    const payload = new URLSearchParams({
        lon: lon,
        lat: lat,
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
            setCachedParkingData(data);
            return data;
        }
    } catch (error) {
        console.error('原本 API 請求失敗:', error);
    }
    
    return null;
}

// 轉換新 API 格式為舊格式
function convertNewApiFormat(newData) {
    if (!Array.isArray(newData)) {
        console.warn('API 返回的數據格式不正確:', newData);
        return [];
    }

    return newData.map((item, index) => ({
        parkName: item.name || item.parkName || item.ParkName || `停車場${index + 1}`,
        lat: parseFloat(item.latitude || item.lat || item.Latitude || 0),
        lon: parseFloat(item.longitude || item.lon || item.Longitude || 0),
        remark: (item.availableSpaces || item.available || item.left || 0) > 0 ? '目前空格' : '目前有車停放',
        left: parseInt(item.availableSpaces || item.available || item.left || 0),
        total: parseInt(item.totalSpaces || item.total || item.capacity || 0),
        dataType: item.type || item.parkingType || 1,
        payex: item.weekdayRate || item.fee || item.payex || '收費資訊請洽現場',
        servicetime: item.holidayRate || item.hours || item.servicetime || '營業時間請洽現場',
        distance: item.distance || 0,
        address: item.address || item.location || ''
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
            // 快取 10 分鐘有效（延長時間避免頻繁請求失敗）
            if (Date.now() - timestamp < 10 * 60 * 1000) {
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
        console.log('數據已快取');
    } catch (error) {
        console.error('儲存快取失敗:', error);
    }
}

// 手動重新整理數據
export async function refreshParkingData(lat, lon) {
    // 清除快取強制重新獲取
    localStorage.removeItem('parkingDataCache');
    return await getParkingData(lat, lon);
}

// 測試連線函數
export async function testConnection() {
    try {
        const response = await fetch('https://httpbin.org/get');
        if (response.ok) {
            console.log('網路連線正常');
            return true;
        }
    } catch (error) {
        console.error('網路連線測試失敗:', error);
    }
    return false;
}
