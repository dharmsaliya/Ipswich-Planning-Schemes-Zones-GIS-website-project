/* ======================= *
 *      GLOBAL SETUP       *
 * ======================= */

// Leaflet map instance
var map = L.map('map', {
    attributionControl: false,
    zoomControl: false,
    preferCanvas: true
}).setView([-27.47797134354353, 152.7799987792969], 10);

// Control variables and constants
let currentFillOpacity = 0.6;
let highlightedLayer = null;

// Generate a random color
const getRandomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

// GeoJSON-based zone names and color mapping
const zoneNames = getUniqueNamesSet(data);
const zoneColors = {};
zoneNames.forEach(name => {
    zoneColors[name] = getRandomColor();
});

// Style definitions
const highlightStyle = {
    weight: 4,
    fillOpacity: () => Math.min(currentFillOpacity + 0.2, 1)
};

const defaultStyle = feature => ({
    color: '#000',
    weight: 1,
    fillColor: zoneColors[feature.properties.NAME],
    fillOpacity: currentFillOpacity
});

/* ======================= *
 *    MAP INITIALIZATION    *
 * ======================= */

// Add zoom controls and base tile layer
L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Debug message
console.log("Hello World..");

/* ======================= *
 *   HELPER FUNCTIONS       *
 * ======================= */

// Extract unique zone names from GeoJSON
function getUniqueNamesSet(geojson) {
    const uniqueNames = new Set();
    geojson.features.forEach(feature => {
        if (feature.properties && feature.properties.NAME) {
            uniqueNames.add(feature.properties.NAME);
        }
    });
    return Array.from(uniqueNames);
}

// Execute search functionality
function performSearch() {
    var searchInput = document.getElementById('search-input');
    var searchMessage = document.getElementById('search-message');
    var searchTerm = searchInput.value.trim().toUpperCase();
    searchMessage.textContent = '';

    if (!searchTerm) {
        searchMessage.textContent = 'Please enter a search term.';
        return;
    }

    var foundFeature = null;

    geoJsonLayer.eachLayer(function (layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.CODE) {
            var featureCode = layer.feature.properties.CODE.toUpperCase();
            if (featureCode.includes(searchTerm)) {
                foundFeature = layer;
                return;
            }
        }
    });

    if (foundFeature) {
        if (foundFeature.getBounds) {
            map.once('moveend', function () {
                if (foundFeature.getPopup()) {
                    foundFeature.openPopup();
                }
            });
            map.flyToBounds(foundFeature.getBounds(), {
                padding: [0.1, 0.1],
                duration: 3
            });
        } else if (foundFeature.getLatLng) {
            map.once('moveend', function () {
                if (foundFeature.getPopup()) {
                    foundFeature.openPopup();
                }
            });
            map.flyTo(foundFeature.getLatLng(), 15, { duration: 3 });
        }
    } else {
        searchMessage.textContent = 'Zone "' + searchTerm + '" not found.';
    }
}

// Renders the toolbar based on the selected mode
function renderToolbarContent(type) {
    const content = document.getElementById('dynamic-toolbar-placeholder');
    if (!content) return;

    if (type === 'search') {
        content.innerHTML = `
            <input type="text" id="search-input" class="form-control d-inline-block" style="width:160px;" placeholder="Search by code">
            <button id="search-button" class="btn btn-primary ms-2">Search</button>
            <button id="close-search" class="btn btn-outline-secondary ms-2">✖</button>
            <span id="search-message" class="ms-2 text-danger small"></span>
        `;
        document.getElementById('search-button').onclick = performSearch;
        document.getElementById('search-input').onkeypress = function (e) {
            if (e.key === 'Enter') performSearch();
        };
        document.getElementById('close-search').onclick = function () {
            renderToolbarContent(null);
        };

    } else if (type === 'zones') {
        content.innerHTML = `
            <select id="location-select" class="form-select d-inline-block" style="width:180px; max-width:250px;">
                <option value="">-- Show All Zones --</option>
                ${zoneNames.map(name => `<option value="${name}">${name}</option>`).join('')}
            </select>
            <button id="close-zones" class="btn btn-outline-secondary ms-2">✖</button>
        `;
        document.getElementById('location-select').onchange = function () {
            const selected = this.value;
            geoJsonLayer.clearLayers();
            if (!selected) {
                geoJsonLayer.addData(data);
            } else {
                const filtered = {
                    ...data,
                    features: data.features.filter(f => f.properties.NAME === selected)
                };
                geoJsonLayer.addData(filtered);
            }
        };
        document.getElementById('close-zones').onclick = function () {
            renderToolbarContent(null);
            geoJsonLayer.clearLayers();
            geoJsonLayer.addData(data);
        };

    } else if (type === 'transparency') {
        content.innerHTML = `
            <label for="opacity-slider" style="margin-right:8px;">Transparency:</label>
            <input type="range" id="opacity-slider" min="0" max="1" step="0.01" value="${currentFillOpacity}" style="width:120px;">
            <span id="opacity-value">${currentFillOpacity}</span>
            <button id="close-transparency" class="btn btn-outline-secondary ms-2">✖</button>
        `;
        document.getElementById('opacity-slider').oninput = function () {
            currentFillOpacity = parseFloat(this.value);
            document.getElementById('opacity-value').textContent = currentFillOpacity;
            geoJsonLayer.setStyle(function (feature) {
                if (highlightedLayer && highlightedLayer.feature === feature) {
                    return {
                        ...highlightStyle,
                        fillOpacity: Math.min(currentFillOpacity + 0.2, 1)
                    };
                }
                return defaultStyle(feature);
            });
        };
        document.getElementById('close-transparency').onclick = function () {
            renderToolbarContent(null);
        };
    } else {
        content.innerHTML = '';
    }
}

/* ======================= *
 *      LAYER SETUP         *
 * ======================= */

// Add GeoJSON data layer to the map
let geoJsonLayer = L.geoJSON(data, {
    style: defaultStyle,
    onEachFeature: (feature, layer) => {
        layer.on('click', function (e) {
            var area = turf.area(feature);
            var areaAcres = area * 0.000247105;

            layer.setPopupContent(`
                <strong>${feature.properties.NAME}</strong><br>
                <u>Zone Code:</u> ${feature.properties.NAME}<br>
                <u>Area: </u> ${areaAcres.toFixed(2)} sq meters<br>
                <u>Description:</u> ${feature.properties.DETAILS}
            `);

            if (highlightedLayer) {
                geoJsonLayer.resetStyle(highlightedLayer);
            }

            layer.setStyle(highlightStyle);
            highlightedLayer = layer;
            e.originalEvent.stopPropagation();
        });

        layer.bindPopup(`
            <strong>${feature.properties.NAME}</strong><br>
            <u>Zone Code:</u> ${feature.properties.NAME}<br>
            <u>Description:</u> ${feature.properties.DETAILS}
        `);
    }
}).addTo(map);

// Reset highlight on map click
map.on('click', function () {
    if (highlightedLayer) {
        geoJsonLayer.resetStyle(highlightedLayer);
        highlightedLayer = null;
    }
});

/* ======================= *
 *         LEGEND           *
 * ======================= */

const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    zoneNames.slice(0, 5).forEach(name => {
        div.innerHTML += `<i style="background:${zoneColors[name]}; width: 12px; height: 12px; display:inline-block; margin-right:5px;"></i>${name}<br>`;
    });
    div.innerHTML += '<small>Showing 5 of 55 zones</small>';
    return div;
};

legend.addTo(map);

/* ======================= *
 *     TOOLBAR BUTTONS      *
 * ======================= */

document.getElementById('show-search').onclick = function () {
    renderToolbarContent('search');
};

document.getElementById('show-zones').onclick = function () {
    renderToolbarContent('zones');
};

document.getElementById('show-transparency').onclick = function () {
    renderToolbarContent('transparency');
};
