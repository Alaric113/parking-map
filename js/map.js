// js/map.js
import { getFavorites } from './storage.js';
import { availableForMap } from './api.js';

let markers = [];

export function initMap(defaultLat, defaultLon) {
    const map = L.map('map').setView([defaultLat, defaultLon], 15);

    addTileLayer(map);
    addUserLocationMarker(map);
    return map;
}

function addTileLayer(map) {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: false,
        maxZoom: 24
    }).addTo(map);
}

function addUserLocationMarker(map) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            L.marker([position.coords.latitude, position.coords.longitude], {
                icon: createCustomIcon('location')
            })
            .addTo(map)
            .bindPopup('你的位置');
        });
    }
}

export function updateMap(parkingData, map) {
    clearExistingMarkers(map);
    const availableOnly = document.getElementById('showAvailableOnly').checked
        if (availableOnly) {
            
            parkingData = availableForMap(parkingData);
        
        
        }
    addNewMarkers(parkingData, map);
}

function clearExistingMarkers(map) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function addNewMarkers(parkingData, map) {
    parkingData.forEach(spot => {
        const center = getSpotCenter(spot);
        if (!center) return;

        if (spot.wkt) {
            addPolygonMarker(spot, map);
        }
    });
}

function getSpotCenter(spot) {
    if (spot.wkt) {
        const coords = parseWKT(spot.wkt);
        return getPolygonCenter(coords);
    } else if (spot.lat && spot.lon) {
        return [spot.lat, spot.lon];
    } else {
        console.error('Invalid coordinates for spot:', spot);
        return null;
    }
}

function addPolygonMarker(spot, map) {
    const coords = parseWKT(spot.wkt);
    const polygon = L.polygon(coords, {
        color : (spot.dataType == 6 && spot.remark === '目前空格') ? '#3b67f7' :
                  (spot.remark === '目前空格') ? '#6eff66' : 
                  '#F44336',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.3
    }).addTo(map).bindPopup(createPopupContent(spot));

    markers.push(polygon);
}

function createCustomIcon(type) {
    return L.divIcon({
        className: `custom-icon ${type}`,
        html: getIconHtml(type),
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function getIconHtml(type) {
    switch (type) {
        case 'location':
            return '<i class="fa-solid fa-circle-dot  currentLocation" style="color:blue"></i>';
        case 'available':
            return '<i class="fas fa-parking" style="color: #4CAF50;"></i>';
        default:
            return '<i class="fas fa-parking" style="color: #F44336;"></i>';
    }
}

export function createPopupContent(spot) {
    const popupDiv = document.createElement('div');
    popupDiv.className = 'parking-popup';

    const isFavorite = checkIfFavorite(spot);
    const cardHeader = document.createElement('div');
    cardHeader.className = 'pop-header';
    popupDiv.appendChild(createFavoriteButton(spot, isFavorite));
    cardHeader.appendChild(createParkName(spot.parkName));
    cardHeader.appendChild(createStatus(spot.remark,spot.count,spot.left));
    popupDiv.appendChild(cardHeader);

    appendToPopup(popupDiv, [
        
        createFeeInfo(spot)
    ]);

    return popupDiv;
}

function checkIfFavorite(spot) {
    const favorites = getFavorites();
    return favorites.some((existName) =>
        existName === spot.parkName
    );
}

function appendToPopup(popupDiv, elements) {
    elements.forEach(element => popupDiv.appendChild(element));
}

function createFavoriteButton(spot, isFavorite) {
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'favorite-btn';

    const starIcon = document.createElement('i');
    starIcon.className = `${isFavorite ? 'fa-solid' : 'fa-regular'} fa-star`;

    favoriteBtn.onclick = (event) => {
        event.stopPropagation();
        toggleFavorite(spot.parkName, starIcon);
    };
    favoriteBtn.appendChild(starIcon);

    return favoriteBtn;
}

function createParkName(name) {
    const parkName = document.createElement('h3');
    parkName.textContent = name;
    return parkName;
}

function createStatus(remark, count, left) {
    const status = document.createElement('p');
    status.textContent = remark ? `狀態: ${remark}` : `狀態: ${left}/${count}`;
    return status;
  }

function createFeeInfo(spot, count, left) {
    const feeInfoDiv = document.createElement('div');
    feeInfoDiv.className = 'fee-info-pop';

    const weekdayFeeP = document.createElement('p');
    weekdayFeeP.textContent = `收費: ${spot.weekdayFee ||spot.payex|| '尚無'}`;
    feeInfoDiv.appendChild(weekdayFeeP);

    const holidayFeeP = document.createElement('p');
    holidayFeeP.textContent = `時間: ${spot.serviceTime||spot.holidayFee|| '尚無'}`;
    feeInfoDiv.appendChild(holidayFeeP);

    const parkType = document.createElement('p');
    if(spot.dataType == 6){
        var typeText = '身障';
    } 
    parkType.textContent = `類型: ${typeText || '一般'}`;
    feeInfoDiv.appendChild(parkType);


    return feeInfoDiv;
}

function parseWKT(wkt) {
    if (wkt) {
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
}