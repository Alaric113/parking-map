// js/app.js
import { initMap, updateMap, createPopupContent } from './map.js';
import { initStorage, getFavorites, addToFavorites, removeFromFavorites } from './storage.js';
import { initSettings, getSettings, saveSettings } from './settings.js';
import { getParkingData, enhanceParkingData } from './api.js';


let map, currentPosition;
let updateInterval;

// Initialize application
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

// Setup navigation
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

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function updateNavActiveState(activeId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const itemId = item.getAttribute('href').substring(1);
        item.classList.toggle('active', itemId === activeId);
    });
}

// Location tracking
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

// Data updates
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

async function updateParkingData() {
    try {
        const data = await getParkingData();
        if (!data) return;

        // Update map
        updateMap(data, map);

        // Update cards
        updateParkingCards(data);

        // Update last refresh time
        document.getElementById('refresh-time').textContent =
            `${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Failed to update parking data:', error);
    }
}

// Render parking cards with fee info and favorite functionality
function updateParkingCards(parkingData) {
    const container = document.getElementById('parkingCards');
    const favorites = getFavorites();

    // Clear the container
    container.innerHTML = '';

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
        parkName.textContent = spot.parkName;

        const status = document.createElement('p');
        status.className = 'status';
        status.textContent = `${spot.availableSpaces}`;

        // Append elements to cardHeader
        cardHeader.appendChild(favoriteBtn);

        const headText = document.createElement('div');
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
        holidayFee.textContent = `假日：${spot.holidayFee || '尚無資料'}`;

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


function filterData(){
    updateParkingCards(enhanceParkingData())
    updateMap(enhanceParkingData(), map)

}

document.getElementById('showAvailableOnly').addEventListener('change', filterData);

// Favorite toggle handler
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
    updateParkingCards(enhanceParkingData())
};

// Initialize app
document.addEventListener('DOMContentLoaded', initApp);

export { updateParkingData };