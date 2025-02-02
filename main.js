// 地圖中心點
const lon = 121.4937824851125;
const lat = 25.142349463010277;

// 初始化地圖
const map = L.map('map').setView([lat, lon], 15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 新增全域變數來保存原始數據
let originalData = [];

// 發送 HTTP POST 請求
async function getParkingData() {
    const proxyUrl = 'https://corsproxy.io/'; // 更換為其他代理服務
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
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Request failed:', error);
        return null;
    }
}

// 解析 WKT 格式的座標
function parseWKT(wkt) {
    const coords = wkt.replace('POLYGON ((', '').replace('))', '').trim();
    return coords.split(',').map((cord) => {
        const [lon, lat] = cord.trim().split(' ').map(parseFloat);
        return [lat, lon];
    });
}

// 計算多邊形的中心點
function getPolygonCenter(coords) {
    let latSum = 0;
    let lonSum = 0;
    coords.forEach(([lat, lon]) => {
        latSum += lat;
        lonSum += lon;
    });
    return [latSum / coords.length, lonSum / coords.length];
}

// 更新停車場資訊列表
function updateParkingList(data) {
    const parkingCards = document.getElementById('parkingCards');
    parkingCards.innerHTML = ''; // 清空舊的內容

    data.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'parking-card';
        card.innerHTML = `
            <h3>${item.parkName}</h3>
            <p><strong>ID:</strong> ${item.parkId}</p>
            <p><strong>狀態:</strong> ${item.remark}</p>
        `;

        // 為卡片添加點擊事件
        card.addEventListener('click', () => {
            // 解析停車場的 WKT 座標
            const coords = parseWKT(item.wkt);

            // 計算多邊形的中心點
            const center = getPolygonCenter(coords);

            // 移動地圖到該停車場的中心點
            map.setView(center, 17);

            // 彈出 Popup
            L.popup()
                .setLatLng(center)
                .setContent(`${item.parkName} (ID: ${item.parkId})`)
                .openOn(map);
        });

        parkingCards.appendChild(card);
    });

    // 如果沒有數據時顯示提示
    if (data.length === 0) {
        parkingCards.innerHTML = '<p style="text-align:center;width:100%;color:#666;">沒有符合條件的停車場</p>';
    }
}

// 新增過濾和渲染函數
function filterAndRenderParkingData() {
    // 獲取開關狀態
    const showAvailableOnly = document.getElementById('showAvailableOnly').checked;

    // 過濾數據
    let filteredData = showAvailableOnly 
        ? originalData.filter(item => item.remark === '目前空格') 
        : originalData;

    // 排序：目前空格的放前面
    filteredData.sort((a, b) => {
        if (a.remark === '目前空格' && b.remark !== '目前空格') return -1;
        if (a.remark !== '目前空格' && b.remark === '目前空格') return 1;
        return 0;
    });

    // 清除舊的多邊形
    map.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });

    // 添加新的多邊形
    filteredData.forEach((item) => {
        if (item.remark === '目前空格' || item.remark === '目前有車停放') {
            const coords = parseWKT(item.wkt);
            const color = item.remark === '目前空格' ? 'blue' : 'red';
            const fillColor = item.remark === '目前空格' ? 'lightblue' : 'pink';

            L.polygon(coords, {
                color: color,
                weight: 2,
                fillColor: fillColor,
                fillOpacity: 0.5
            }).addTo(map).bindPopup(`${item.parkName} (ID: ${item.parkId})`);
        }
    });

    // 更新停車場資訊列表
    updateParkingList(filteredData);

    // 更新最後更新時間
    document.getElementById('time').textContent = new Date().toLocaleString();
}

// 修改 displayParkingData 函數
async function displayParkingData() {
    try {
        const data = await getParkingData();
        if (!data || !Array.isArray(data)) {
            console.log('No parking data available.');
            return;
        }

        // 保存原始數據
        originalData = data;

        // 初次渲染
        filterAndRenderParkingData();
    } catch (error) {
        console.error('Error displaying parking data:', error);
    }
}

// 為開關添加事件監聽
document.getElementById('showAvailableOnly').addEventListener('change', filterAndRenderParkingData);

// 主程式
displayParkingData(); // 初始加載數據

// 每 10 秒更新一次數據
setInterval(() => {
    displayParkingData();
}, 10000); // 10 秒