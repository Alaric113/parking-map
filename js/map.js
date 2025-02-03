// js/map.js
import { getFavorites } from './storage.js';

let markers = [];

export function initMap(defaultLat, defaultLon) {
    const map = L.map('map').setView([defaultLat, defaultLon], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 24
    }).addTo(map);

    // Add user location marker if available
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            L.marker([position.coords.latitude, position.coords.longitude], {
                icon: createCustomIcon('location')
            })
            .addTo(map)
            .bindPopup('你的位置');
        });
    }

    return map;
}

export function updateMap(parkingData, map) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add new markers
    parkingData.forEach(spot => {
        let center;

        // Check if WKT data is available
        if (spot.wkt) {
            const coords = parseWKT(spot.wkt);
            center = getPolygonCenter(coords);
        } else if (spot.lat && spot.lon) {
            // Fallback to lat/lon if WKT is not available
            center = [spot.lat, spot.lon];
        } else {
            console.error('Invalid coordinates for spot:', spot);
            return; // Skip this spot if no valid coordinates are found
        }

        
        

        // Add polygon if WKT data is available
        if (spot.wkt) {
            const coords = parseWKT(spot.wkt);
            const polygon = L.polygon(coords, {
                color: spot.remark == '目前空格' ? '#4465c6' : '#F44336',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.3
            }).addTo(map).bindPopup(createPopupContent(spot));
            
            markers.push(polygon);
        }
    });
}

function createCustomIcon(type) {
    // 暫時使用 Leaflet 的預設圖標，直到我們有自己的圖標
    return L.divIcon({
        className: `custom-icon ${type}`,
        html: type === 'location' ? 
            '<i class="fa-solid fa-circle-dot" style="color:blue"></i>' : 
            type === 'available' ? 
                '<i class="fas fa-parking" style="color: #4CAF50;"></i>' : 
                '<i class="fas fa-parking" style="color: #F44336;"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

export function createPopupContent(spot) {
    const favorites = getFavorites();
    const isFavorite = favorites.some(([favoriteLat, favoriteLon]) =>
        favoriteLat === spot.lat && favoriteLon === spot.lon
    );

    // Create the main popup container
    const popupDiv = document.createElement('div');
    popupDiv.className = 'parking-popup';

    // Create and append the park name
    const parkName = document.createElement('h3');
    parkName.textContent = spot.parkName;
    popupDiv.appendChild(parkName);

    // Create the favorite button
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'favorite-btn';
    
    
    // Create the star icon
    const starIcon = document.createElement('i');
    starIcon.className = `${isFavorite ? 'fa-solid' : 'fa-regular'} fa-star`;

    favoriteBtn.onclick = (event) => {
        event.stopPropagation(); // Prevent the map click event
        window.toggleFavorite([spot.lat, spot.lon], starIcon)(spot.parkId);
    };
    favoriteBtn.appendChild(starIcon);

    // Append the favorite button to the popup
    popupDiv.appendChild(favoriteBtn);

    // Create and append the status
    const status = document.createElement('p');
    status.textContent = `目前狀態: ${spot.remark}`;
    popupDiv.appendChild(status);

    // Create fee info container
    const feeInfoDiv = document.createElement('div');
    feeInfoDiv.className = 'fee-info';

    // Create and append weekday fee
    const weekdayFee = document.createElement('p');
    weekdayFee.textContent = `收費資訊: ${spot.weekdayFee || '尚無資料'}`;
    feeInfoDiv.appendChild(weekdayFee);

    // Create and append holiday fee
    const holidayFee = document.createElement('p');
    holidayFee.textContent = `收費時間: ${spot.holidayFee || '尚無資料'}`;
    feeInfoDiv.appendChild(holidayFee);

    // Append fee info to the main popup
    popupDiv.appendChild(feeInfoDiv);

    return popupDiv; // Return the constructed popup element
}

function parseWKT(wkt) {
    
    if(wkt){
        const coords = wkt.replace('POLYGON ((', '').replace('))', '').trim();
        return coords.split(',').map((cord) => {
            const [lon, lat] = cord.trim().split(' ').map(parseFloat);
            return [lat, lon];
        });
    }
    return [];
    
}

function getPolygonCenter(coords) {
    let latSum = 0;
    let lonSum = 0;
    coords.forEach(([lat, lon]) => {
        latSum += lat;
        lonSum += lon;
    });
    return [latSum / coords.length, lonSum / coords.length];
};