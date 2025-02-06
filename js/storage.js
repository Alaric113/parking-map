// js/storage.js
const STORAGE_KEYS = {
    FAVORITES: 'parking-favorites', // 使用新的 key 避免与旧数据冲突
    SETTINGS: 'parking-settings'
};

// 精度控制到小数点后6位（约0.1米精度）
const GEO_PRECISION = 6;



// 初始化存储
export async function initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.FAVORITES)) {
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([]));
    }
}

// 获取收藏列表
export function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
    } catch (error) {
        console.error('Error reading favorites:', error);
        return [];
    }
}

// 添加收藏
export function addToFavorites(parkName) {
    try {
       
        const favorites = getFavorites();

        // 检查是否已存在
        const exists = favorites.some((existName) =>
            existName === parkName
        );

        if (!exists) {
            favorites.push(parkName);
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
            console.log(`[${parkName}] added to favorites`);
        } else {
            console.log(`[${parkName}] is already in favorites`);
        }
        return true;
    } catch (error) {
        console.error('Error adding favorite:', error);
        return false;
    }
}

// 移除收藏
export function removeFromFavorites(parkName) {
    try {
        
        let favorites = getFavorites();
        // 过滤掉匹配的经纬度
        favorites = favorites.filter(existName =>
            existName !== parkName
        );
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
        console.log(`[${parkName}] removed from favorites`);
        return true;
    } catch (error) {
        console.error('Error removing favorite:', error);
        return false;
    }
}

// 获取收藏的停车点数据
export function getFavoriteParkingSpots(allParkingData) {
    const favorites = getFavorites();
    return allParkingData.filter(spot => {
        const spotGeo = normalizeGeo(spot.lat, spot.lon);
        return favorites.some(([favoriteLat, favoriteLon]) =>
            favoriteLat === spotGeo[0] && favoriteLon === spotGeo[1]
        );
    });
}