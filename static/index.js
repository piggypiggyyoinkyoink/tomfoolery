const width = 600;
const height = 750;

const svg = d3.select("#map");
let projection;
let enteredPlaces = [];
let numPlaces = 0;
let totalPlaces;
let type;
let regionName;
window.addEventListener("DOMContentLoaded", async () => {
    async function fetchGeoJSON(type) {
        const res = await fetch("./typemap");
        const typemap = await res.json();
        console.log(typemap);
        if (!typemap[type]) {
            console.error(`Invalid type: ${type}`);
            window.location.href = "./"; 
            return;
        }
        const filename = typemap[type].geofile;
        regionName = typemap[type].name;
        document.getElementById("h1").textContent = "How many places can you name in " + regionName + "?";
        const response = await fetch(`./static/geo/${filename}`);
        const geoData = await response.json();
        return geoData;
    }
        
    async function drawMap(){
        let geoData = await fetchGeoJSON(type);
        // Create projection
        projection = d3.geoConicConformal()
            .fitSize([width, height], geoData);

        // Create path generator
        const path = d3.geoPath()
            .projection(projection);

        // Draw all features
        svg.selectAll("path")
            .data(geoData.features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", "#eeeeee")
            .attr("stroke", "#444")
            .attr("stroke-width", 0.5);

        }
    function addToMap(place) {

        const [x, y] = projection([
            place.longitude,
            place.latitude
        ]);

        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 3)
            .attr("fill", "rgba(255, 0, 0, 0.5)");
    }
    
    function highlightPlace(id,lat, lon){
        const [x, y] = projection([
            lon,
            lat
        ]);
        svg.append("circle")
            .attr("id", `highlight-${id}`)
            .attr("class", "highlight-circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 4)
            .attr("fill", "rgb(7, 163, 7)");
    }

    function addToTable(place, county){
        const name = place.name;
        const table = document.getElementById("placesTable");
        const row = table.insertRow(0);
        row.setAttribute("id", `row-${numPlaces}`);
        const cell0 = row.insertCell(0);
        cell0.textContent = numPlaces;
        const cell1 = row.insertCell(1);
        cell1.textContent = name + ", " + county;
        const tableContainer = document.getElementById("tableContainer");
        if (tableContainer.style.overflowY != "scroll" && tableContainer.offsetHeight >= parseInt(window.getComputedStyle(tableContainer).maxHeight)) {
            tableContainer.style.overflowY = "scroll";
        }
        document.getElementById(`row-${numPlaces}`).addEventListener("mouseover", () => {
            highlightPlace(numPlaces, place.lat, place.lon);
        });
        document.getElementById(`row-${numPlaces}`).addEventListener("mouseout", () => {
            const highlightCircle = document.getElementById(`highlight-${numPlaces}`);
            if (highlightCircle) {
                highlightCircle.remove();
            }
        });
        document.getElementById(`row-${numPlaces}`).addEventListener("touchstart", () => {
            document.querySelectorAll(".highlight-circle").forEach(circle => circle.remove());
            highlightPlace(numPlaces, place.lat, place.lon);
        });
        document.getElementById(`row-${numPlaces}`).addEventListener("touchend", () => {
            const highlightCircle = document.getElementById(`highlight-${numPlaces}`);
            if (highlightCircle) {
                highlightCircle.remove();
            }
        });
    }
    function addPlace(place){
        addToMap({ latitude: place.lat, longitude: place.lon });
        numPlaces++;
        addToTable(place, place.county);
    }

    async function processPlaceInput() {
        const placeInput = document.getElementById("placeInput");
        const placeName = placeInput.value.trim();
        if (enteredPlaces.includes(placeName.toLowerCase().trim().replaceAll(" ",""))) {
            document.getElementById("message").textContent = "Place already entered!";
            return;
        }
        document.getElementById("message").textContent = "⠀";
        if (placeName.length >= 2) {
            const response = await fetch(`./query?text=${encodeURIComponent(placeName)}&type=${type}`, { credentials: 'include' });
            if (!response.ok) {
                console.error("Failed to query place");
                return;
            }
            const places = await response.json();
            console.log(places);
            if (!places.results || places.results.length === 0) {
                document.getElementById("message").textContent = "Place not found!";
            }
            if (places.results.length > 0) {
                // console.log("beep");
                for (const place of places.results) {
                    addPlace(place);
                    document.getElementById("placesHeader").textContent = `Places Entered: ${numPlaces} / ${totalPlaces}`;
                }
                enteredPlaces.push(placeName.toLowerCase().trim().replaceAll(" ",""));
                placeInput.value = "";
            } else if (places.already_guessed) {
                document.getElementById("message").textContent = "Place already entered!";
            }
        } else {
            document.getElementById("message").textContent = "Place not found!";
        }
    }

    document.getElementById("placeInput").addEventListener("keypress", async (event) => {
        if (event.key !== "Enter") return;
        document.getElementById("placeInput").disabled = true;
        await processPlaceInput();
        document.getElementById("placeInput").disabled = false;
        document.getElementById("placeInput").focus();

    });
    document.getElementById("placeSubmitButton").addEventListener("click", async () => {
        document.getElementById("placeInput").disabled = true;
        await processPlaceInput();
        document.getElementById("placeInput").disabled = false;
        document.getElementById("placeInput").focus();
    });


    async function init(){
        const paramsString = window.location.search;
        const searchParams = new URLSearchParams(paramsString)
        type = searchParams.get("type")|| "uk";
        await drawMap();
        const response = await fetch(`./init?type=${type}`, { credentials: 'include' });
        if (!response.ok) {
            console.error("Failed to initialize session");
            return;
        }
        const data = await response.json();
        for (const place of data.guesses) {
            addPlace(place);
            enteredPlaces.push(place.name.toLowerCase().trim().replaceAll(" ",""));
        }
        if (data.name && data.name.trim() !== "Anonymous") {
            document.getElementById("nameInput").value = data.name || "";
        }
        const total = await fetch(`./howmany?type=${type}`);
        const totalData = await total.json();
        totalPlaces = totalData.total;
        document.getElementById("placesHeader").textContent = `Places Entered: ${numPlaces} / ${totalPlaces}`;
        // console.log(data);
        document.getElementById("loading").style.display = "none";
        document.getElementById("main").style.display = "block";
        const tableContainer = document.getElementById("tableContainer");
        if (tableContainer.style.overflowY != "scroll" && tableContainer.offsetHeight >= parseInt(window.getComputedStyle(tableContainer).maxHeight)) {
            tableContainer.style.overflowY = "scroll";
        }
    }
    init();

    document.getElementById("nameInput").addEventListener("blur", async (event) => {
        const name = event.target.value.trim();
        if (name) {
            const response = await fetch(`./setname?type=${type}&name=${encodeURIComponent(name)}`, { credentials: 'include' });
            if (!response.ok) {
                console.error("Failed to set name");
                return;
            }
            const data = await response.json();
            console.log(data);
        }
    });

    document.getElementById("finishButton").addEventListener("click", async () => {
        const name = document.getElementById("nameInput").value.trim() || "Anonymous";
        const response = await fetch(`./finish?type=${type}&name=${encodeURIComponent(name)}`, { credentials: 'include' });
        if (!response.ok) {
            console.error("Failed to finish game");
            window.location.reload();
            return;
        }
        const data = await response.json();
        console.log(data);
        window.location.href = `./results?uid=${data.uid}`;
    });
    
    document.getElementById("resetButton").addEventListener("click", async () => {
        const response = await fetch(`./reset?type=${type}`, { credentials: 'include' });
        if (!response.ok) {
            console.error("Failed to reset game");
            return;
        }
        const data = await response.json();
        console.log(data);
        window.location.href = `./game?type=${type}`;
    });

});



