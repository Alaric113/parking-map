// js/api.js
import { getSettings } from './settings.js';
import { getFavorites } from './storage.js';

let originalData = [];



// 主要的資料獲取函數
export async function getParkingData(lat,lon) {
    document.getElementsByClassName('loader')[0].style.display = 'flex'
    const settings = getSettings();

    const proxyUrl = 'https://corsproxy.io/?key=e4730777&url='; // 更換為其他代理服務
    const targetUrl = 'https://itaipeiparking.pma.gov.taipei/MapAPI/GetAllPOIData';
    const url = proxyUrl + targetUrl; // 組合 URL

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
            console.log('成功從 API 獲取數據');
            originalData = data;
            const searchValue = document.getElementById('searchCards');
            document.getElementsByClassName('loader')[0].style.display = 'none'

            if (searchValue.value) {
                return searchFilter(searchValue.value.trim());
            } else {
                return data;
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

export function searchFilter(data, text) {
    const filteredData = data.filter(item => {
        // 检查 item.parkName 是否存在且为字符串
        if (item.parkName && typeof item.parkName === 'string') {
            return item.parkName.match(text);
        }
        return false; // 如果 parkName 无效，跳过该项
    });
    return filteredData;
}

export function availableFilter(data) { 
    
    const filterdata = data.filter(item => {
        if (item.left > 0) {
            
            return item;
    
        }
        return false;
    })
    
    return filterdata;
}

//提供卡片資訊
export function unifyData(data) { 
    let noName = 0
    const result = data.reduce((acc, item) => {
        const name = item.parkName || `未命名${noName}`;
        if(name.includes('未命名')){
            acc[name] = {
                parkName: name,
                count : (item.dataType!=6)? 1:0,
                left :(item.remark ==='目前空格'&&item.dataType!=6)? 1:0,
                specialCount : (item.dataType ==6)?1:0,
                specialLeft : (item.remark ==='目前空格'&&item.dataType==6)? 1:0,
                weekdayFee: item.payex,
                holidayFee: item.servicetime,
                lat: [item.lat],
                lon: [item.lon],
            };
            noName++
            return acc
        }
        if (!acc[name]) {
            acc[name] = {
                parkName: name,
                count : 0,
                left :0,
                specialCount : 0,
                specialLeft : 0,
                weekdayFee: item.payex,
                holidayFee: item.servicetime,
                lat: [],
                lon: [],
            };
        }
        acc[name].lat.push(item.lat);
        acc[name].lon.push(item.lon);
        if(item.dataType == 6 && item.remark === '目前空格'){
            acc[name].specialCount++;
            acc[name].specialLeft++;
        }else if(item.dataType == 6 && item.remark == '目前有車停放'){
            acc[name].specialCount++;
        }
        if(item.remark === '目前空格' && item.dataType != 6){
            acc[name].count++;
            acc[name].left++;
        }else if(item.remark == '目前有車停放' && item.dataType != 6){
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

        const aLeft = a.left>0;
        const bLeft = b.left>0;
        if (aLeft && !bLeft) return -1;
        if (!aLeft && bLeft) return 1;

        const aName = a.parkName.includes('未命名')
        const bName = b.parkName.includes('未命名')

        if(aName&&!bName) return 1
        if(!aName&&bName) return -1

        return 0;
    });
    //const availableOnly = document.getElementById('showAvailableOnly').checked
    //if (availableOnly) {
      //  formattedResult = availableFilter(formattedResult);
    //}

    return formattedResult
}

export function availableForMap(data){
    return data.filter(item => item.remark === '目前空格')
}

// 獲取本地快取數據
function getCachedParkingData() {
    // 這裡可以實現從 localStorage 或其他地方獲取快取數據
    return null;
}