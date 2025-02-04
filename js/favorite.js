// js/favorite.js
import { getFavorites } from './storage.js';


export function updateFavCards(parkingData) {
    const container = document.getElementById('favCards');
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