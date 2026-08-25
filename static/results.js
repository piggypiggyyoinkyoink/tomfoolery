let width = 600;
let height = 750;

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
        document.getElementById("h1").textContent = "Game Results for " + regionName;
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

    async function init(){
        const paramsString = window.location.search;
        const searchParams = new URLSearchParams(paramsString)
        const uid = searchParams.get("uid");
        const response = await fetch(`./data/${uid}`);
        const data = await response.json();
        const name = data.name || "Anonymous";
        type = data.type;
        const mapSvg = document.getElementById("map");
        d3.select(mapSvg).attr("viewBox", `0 0 ${width} ${height}`);
        await drawMap();
        const date = new Date(data.date);
        document.getElementById("details").innerHTML = `Submitted by <b>${name}</b> on ${date.toLocaleString()}. &nbsp;&nbsp; `;
        document.getElementById("details").innerHTML += `<a id="copyLink" href="#">Copy results link to clipboard</a>`
        document.getElementById("copyLink").addEventListener("click", (event) => {
            event.preventDefault();
            window.navigator.clipboard.writeText(window.location.href).then(() => {
                alert("Results link copied to clipboard!");
            })
        });
        for (const place of data.guesses) {
            addPlace(place);
            enteredPlaces.push(place.name.toLowerCase().trim().replaceAll(" ",""));
        }
        const total = await fetch(`./howmany?type=${type}`);
        const totalData = await total.json();
        totalPlaces = totalData.total;
        document.getElementById("placesHeader").textContent = `Places Entered: ${numPlaces} / ${totalPlaces}`;
        const gameExistsRes = await fetch(`./check-game-exists?type=${type}`);
        const gameExistsData = await gameExistsRes.json();
        if (!gameExistsData.exists) {
            document.getElementById("newGameButton").textContent = `Start new ${regionName} game`;
        } else {
            document.getElementById("newGameButton").textContent = `Resume your ${regionName} game`;
        }
        document.getElementById("newGameButton").addEventListener("click", async () => {
            window.location.href = `./game?type=${type}`;
        });
        // console.log(data);
        document.getElementById("loading").style.display = "none";
        document.getElementById("main").style.display = "block";
        const tableContainer = document.getElementById("tableContainer");
        if (tableContainer.style.overflowY != "scroll" && tableContainer.offsetHeight >= parseInt(window.getComputedStyle(tableContainer).maxHeight)) {
            tableContainer.style.overflowY = "scroll";
        }
    }
    init();

});



