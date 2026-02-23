export class InfoPanel {
    constructor() {
        this.panel = document.getElementById('info-panel');
        this.listContainer = document.getElementById('places-list');
    }

    updatePlaces(places) {
        if (!places || places.length === 0) {
            this.panel.classList.add('hidden');
            return;
        }

        this.panel.classList.remove('hidden');
        this.listContainer.innerHTML = '';

        places.slice(0, 5).forEach(place => {
            const item = document.createElement('div');
            item.className = 'place-item';
            item.innerHTML = `
        <h4>${place.name}</h4>
        <p>⭐ ${place.rating || 'N/A'} | ${place.types[0]}</p>
        <p>${place.vicinity}</p>
      `;
            this.listContainer.appendChild(item);
        });
    }
}
