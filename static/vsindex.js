const width = 600;
const height = 750;

const svg = d3.select("#map");
let projection;
let enteredPlaces = [];
let numPlaces = 0;
let totalPlaces;
let type;
let regionName;
let uids = [];
window.addEventListener("DOMContentLoaded", async () => {
    async function fetchGeoJSON(type) {
        const res = await fetch("/placenamegame/typemap");
        const typemap = await res.json();
        console.log(typemap);
        if (!typemap[type]) {
            throw new Error(`Invalid type: ${type}`);
            window.location.href = "./"; 
            return;
        }
        const filename = typemap[type].geofile;
        regionName = typemap[type].name;
        document.getElementById("h1").textContent = "How many places can you name in " + regionName + "?";
        const response = await fetch(`/placenamegame/static/geo/${filename}`);
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
            const response = await fetch(`/placenamegame/query?text=${encodeURIComponent(placeName)}&type=${type}`, { credentials: 'include' });
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
        roomId = searchParams.get("room_id");
        await drawMap();
        // const response = await fetch(`/placenamegame/init?type=${type}`, { credentials: 'include' });
        // if (!response.ok) {
        //     console.error("Failed to initialize session");
        //     return;
        // }
        // const data = await response.json();
        // for (const place of data.guesses) {
        //     addPlace(place);
        //     enteredPlaces.push(place.name.toLowerCase().trim().replaceAll(" ",""));
        // }
        // if (data.name && data.name.trim() !== "Anonymous") {
        //     document.getElementById("nameInput").value = data.name || "";
        // }
        var ws = new WebSocket(`ws://${window.location.host}/placenamegame/vs/room/${roomId}`);
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log(`"${data.code}" message received:`, data);
            if (data.code == "INIT") {
                const playerName = data.name;
                const uid = data.uid;
                uids.push(uid);
                const playerList = document.getElementById("playerList");
                playerList.innerHTML = "";
                const li = document.createElement("li");
                li.innerHTML = `<input type = "text" id="playerNameInput" value="${playerName}">`
                playerList.appendChild(li);
                li.addEventListener("input", async (event) => {
                    const newName = event.target.value.trim();
                    ws.send(JSON.stringify({code: "NAME_CHANGE", name: newName}));
                });
                document.getElementById("leaveRoomLink").addEventListener("click", () => {
                    ws.close();
                });
                
                document.getElementById("timeLimitValue").textContent = data.time_limit;
                    if (data.time_limit == 1) {
                        document.getElementById("timeLimitPlural").textContent = "";
                    } else {
                        document.getElementById("timeLimitPlural").textContent = "s";
                    }

                if (data.is_host) {
                    document.getElementById("timeLimitSlider").disabled = false;
                    document.getElementById("timeLimitSlider").style.display = "block";
                    document.getElementById("timeLimitSlider").addEventListener("input", (event) => {
                        const timeLimit = event.target.value;
                        document.getElementById("timeLimitValue").textContent = timeLimit;
                        if (timeLimit == 1) {
                            document.getElementById("timeLimitPlural").textContent = "";
                        } else {
                            document.getElementById("timeLimitPlural").textContent = "s";
                        }
                    });
                    document.getElementById("timeLimitSlider").addEventListener("change", async (event) => {
                        const timeLimit = event.target.value;
                        document.getElementById("timeLimitValue").textContent = timeLimit;
                        if (timeLimit == 1) {
                            document.getElementById("timeLimitPlural").textContent = "";
                        } else {
                            document.getElementById("timeLimitPlural").textContent = "s";
                        }
                        // only send the message once the user has finished adjusting the slider (on change event)
                        ws.send(JSON.stringify({code: "SET_TIME_LIMIT", time_limit: timeLimit}));
                    });

                    document.getElementById("startGameButton").disabled = false;
                    document.getElementById("startGameButton").style.display = "block";
                    document.getElementById("startGameButton").addEventListener("click", () => {
                        ws.send(JSON.stringify({code: "START_GAME"}));
                    });
                }
            }
            if (data.code == "NAME_CHANGE") {
                const li = document.getElementById(`player-${data.uid}`);
                if (li) {
                    li.textContent = data.name;
                } else{
                    console.warn(`Player with uid ${data.uid} not found in the list.`);
                }
            }
            if (data.code == "SET_TIME_LIMIT") {
                document.getElementById("timeLimitSlider").value = data.time_limit;
                document.getElementById("timeLimitValue").textContent = data.time_limit;
                if (data.time_limit == 1) {
                    document.getElementById("timeLimitPlural").textContent = "";
                } else {
                    document.getElementById("timeLimitPlural").textContent = "s";
                }
            }
            if (data.code == "JOIN") {
                if (!uids.includes(data.uid)) {
                    const playerList = document.getElementById("playerList");
                    const li = document.createElement("li");
                    li.id = `player-${data.uid}`;
                    li.textContent = data.name;
                    playerList.appendChild(li);
                    uids.push(data.uid);
                }
            }
            if (data.code == "LEAVE") {
                const li = document.getElementById(`player-${data.uid}`);
                if (li) {
                    li.remove();
                    uids = uids.filter(uid => uid !== data.uid);
                }
            }
        }
        // ws.send(JSON.stringify({type: "JOIN", name: document.getElementById("nameInput").value.trim() || "Anonymous"}));
        const total = await fetch(`/placenamegame/howmany?type=${type}`);
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
            const response = await fetch(`/placenamegame/setname?type=${type}&name=${encodeURIComponent(name)}`, { credentials: 'include' });
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
        const response = await fetch(`/placenamegame/finish?type=${type}&name=${encodeURIComponent(name)}`, { credentials: 'include' });
        if (!response.ok) {
            console.error("Failed to finish game");
            window.location.reload();
            return;
        }
        const data = await response.json();
        console.log(data);
        window.location.href = `/placenamegame/results?uid=${data.uid}`;
    });
    
    document.getElementById("resetButton").addEventListener("click", async () => {
        const response = await fetch(`/placenamegame/reset?type=${type}`, { credentials: 'include' });
        if (!response.ok) {
            console.error("Failed to reset game");
            return;
        }
        const data = await response.json();
        console.log(data);
        window.location.href = `/placenamegame/game?type=${type}`;
    });

});



