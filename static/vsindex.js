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
var ws;
let colour;
let numPlacesUser = 0;
let gameEndedFlag = false;
// let i = 0;
let timerInterval;
window.addEventListener("DOMContentLoaded", async () => {
    async function fetchGeoJSON(type) {
        const res = await fetch("/placenamegame/typemap");
        const typemap = await res.json();
        console.log(typemap);
        if (!typemap[type]) {
            console.error(`Invalid type: ${type}`);
            window.location.href = "./"; 
            return;
        }
        const filename = typemap[type].geofile;
        regionName = typemap[type].name;
        document.getElementById("h1").textContent = "VS Mode - " + regionName;
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
    function addToMap(place, colour) {
        const [x, y] = projection([
            place.longitude,
            place.latitude
        ]);

        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 3)
            .attr("fill", colour);
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

    function addToTable(username, place, county, colour){
        const name = place.name;
        const table = document.getElementById("placesTable");
        const row = table.insertRow(0);
        row.setAttribute("name", `row-${numPlaces}`);
        row.style.backgroundColor = colour;
        const cell0 = row.insertCell(0);
        cell0.textContent = username;
        const cell1 = row.insertCell(1);
        cell1.textContent = name + ", " + county;
        const tableContainer = document.getElementById("tableContainer");
        if (tableContainer.style.overflowY != "scroll" && tableContainer.offsetHeight >= parseInt(window.getComputedStyle(tableContainer).maxHeight)) {
            tableContainer.style.overflowY = "scroll";
        }
        row.addEventListener("mouseover", () => {
            highlightPlace(numPlaces, place.lat, place.lon);
        });
        row.addEventListener("mouseout", () => {
            const highlightCircle = document.getElementById(`highlight-${numPlaces}`);
            if (highlightCircle) {
                highlightCircle.remove();
            }
        });
        row.addEventListener("touchstart", () => {
            document.querySelectorAll(".highlight-circle").forEach(circle => circle.remove());
            highlightPlace(numPlaces, place.lat, place.lon);
        });
        row.addEventListener("touchend", () => {
            const highlightCircle = document.getElementById(`highlight-${numPlaces}`);
            if (highlightCircle) {
                highlightCircle.remove();
            }
        });
    }
    function addPlace(place, username, colour){
        addToMap({ latitude: place.lat, longitude: place.lon }, colour);
        numPlaces++;
        addToTable(username, place, place.county, colour);
    }


    async function init(){
        const paramsString = window.location.search;
        const searchParams = new URLSearchParams(paramsString)
        type = searchParams.get("type")|| "uk";
        roomId = searchParams.get("room_id");
        const mapSvg = document.getElementById("map");
        d3.select(mapSvg).attr("viewBox", `0 0 ${width} ${height}`);
        await drawMap();
        if (window.location.hostname == "localhost") {
            ws = new WebSocket(`ws://${window.location.host}/placenamegame/vs/room/${roomId}`);
        } else {
            ws = new WebSocket(`wss://${window.location.host}/placenamegame/vs/room/${roomId}`);
        }

        async function processPlaceInput() {
            const placeInput = document.getElementById("placeInput");
            const placeName = placeInput.value.trim();
            document.getElementById("placeInput").disabled = true;
            document.getElementById("placeSubmitButton").disabled = true;
            if (enteredPlaces.includes(placeName.toLowerCase().trim().replaceAll(" ",""))) {
                document.getElementById("message").textContent = "Place already entered!";
                document.getElementById("placeSubmitButton").disabled = false;
                document.getElementById("placeInput").disabled = false;
                return;
            }
            document.getElementById("message").textContent = "⠀";
            if (placeName.length >= 2) {
                ws.send(JSON.stringify({code: "GUESS", text: placeName, colour: colour}));
            } else {
                document.getElementById("message").textContent = "Place not found!";
                document.getElementById("placeSubmitButton").disabled = false;
                document.getElementById("placeInput").disabled = false;
            }
        }

        function switchToGameplay(){
            document.getElementById("roomInfo").style.display = "none";
            document.getElementById("game").style.display = "flex";
            document.getElementById("gameplay").style.display = "block";
            document.getElementById("results").style.display = "none";

            document.getElementById("placeInput").disabled = false;
            document.getElementById("placeSubmitButton").disabled = false;
            document.getElementById("placeInput").focus();

            
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
        }

        function switchToResults(){
            document.getElementById("roomInfo").style.display = "none";
            document.getElementById("gameplay").style.display = "none";
            document.getElementById("game").style.display = "none";
            document.getElementById("results").style.display = "flex";
        }

        function startTimer(startedAt, timeLimit) {
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now()/1000 - startedAt));
                const remaining = timeLimit*60 - elapsed;
                document.getElementById("timeRemainingMinutes").textContent = Math.max(0, Math.floor(remaining / 60));
                document.getElementById("timeRemainingSeconds").textContent = String(Math.max(0, remaining % 60)).padStart(2, '0');
                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    document.getElementById("timeRemainingMinutes").textContent = "0";
                    document.getElementById("timeRemainingSeconds").textContent = "00";
                    ws.send(JSON.stringify({code: "TIME_UP"}));
                }
            }, 100); //10th of a second accuracy
        }

        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log(`"${data.code}" message received:`, data);
            if (data.code == "INIT") {
                const playerName = data.name;
                const uid = data.uid;
                uids.push(uid);
                if (data.status == "waiting") {
                    document.getElementById("game").style.display = "flex";
                    document.getElementById("gameplay").style.display = "none";
                    document.getElementById("results").style.display = "none";
                    const playerList = document.getElementById("playerList");
                    playerList.innerHTML = "";
                    const li = document.createElement("li");
                    li.innerHTML = `<input type = "text" id="playerNameInput" placeholder = "Enter your name...">`
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
                    
                    switch (data.mode) {
                        case "normal":
                            document.getElementById("gameModeValue").textContent = "Normal";
                            document.getElementById("normalDescription").style.display = "block";
                            document.getElementById("lockoutDescription").style.display = "none";
                            document.getElementById("normalRadio").checked = true;
                            document.getElementById("lockoutRadio").checked = false;
                            break;
                        case "lockout":
                            document.getElementById("gameModeValue").textContent = "Lockout";
                            document.getElementById("normalDescription").style.display = "none";
                            document.getElementById("lockoutDescription").style.display = "block";
                            document.getElementById("normalRadio").checked = false;
                            document.getElementById("lockoutRadio").checked = true;
                            break;
                    }

                    if (data.is_host) {
                        // enable time limit slider
                        document.getElementById("timeLimitSlider").disabled = false;
                        document.getElementById("timeLimitSlider").style.display = "block";
                        document.getElementById("timeLimitSlider").value = data.time_limit;
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
                        
                        // Enable game mode radio buttons
                        document.getElementById("normalRadio").disabled = false;
                        document.getElementById("normalRadio").style.display = "inline-block";
                        document.getElementById("normalLabel").style.display = "inline-block";
                        document.getElementById("lockoutRadio").disabled = false;
                        document.getElementById("lockoutRadio").style.display = "inline-block";
                        document.getElementById("lockoutLabel").style.display = "inline-block";

                        document.getElementById("normalRadio").addEventListener("change", (event) => {
                            if (event.target.checked) {
                                document.getElementById("gameModeValue").textContent = "Normal";
                                document.getElementById("lockoutDescription").style.display = "none";
                                document.getElementById("normalDescription").style.display = "block";
                                ws.send(JSON.stringify({code: "SET_GAME_MODE", mode: "normal"}));
                            }
                        });
                        document.getElementById("lockoutRadio").addEventListener("change", (event) => {
                            if (event.target.checked) {
                                document.getElementById("gameModeValue").textContent = "Lockout";
                                document.getElementById("normalDescription").style.display = "none";
                                document.getElementById("lockoutDescription").style.display = "block";
                                ws.send(JSON.stringify({code: "SET_GAME_MODE", mode: "lockout"}));
                            }
                        });

                        // Enable start game button
                        document.getElementById("startGameButton").disabled = false;
                        document.getElementById("startGameButton").style.display = "block";
                        document.getElementById("startGameButton").addEventListener("click", () => {
                            ws.send(JSON.stringify({code: "START_GAME"}));
                        });
                    }
                } else if (data.status == "in_progress") {
                    switchToGameplay();
                    colour = data.colour;
                    const timeRemaining = data.time_limit*60 - (Math.floor((Date.now()/1000 - data.started_at)));
                    document.getElementById("timeRemainingMinutes").textContent = Math.max(0, Math.floor(timeRemaining / 60));
                    document.getElementById("timeRemainingSeconds").textContent = String(Math.max(0, timeRemaining % 60)).padStart(2, '0');
                    startTimer(data.started_at, data.time_limit);
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
            if (data.code == "SET_GAME_MODE") {
                switch (data.mode) {
                    case "normal":
                        document.getElementById("gameModeValue").textContent = "Normal";
                        document.getElementById("normalDescription").style.display = "block";
                        document.getElementById("lockoutDescription").style.display = "none";
                        break;
                    case "lockout":
                        document.getElementById("gameModeValue").textContent = "Lockout";
                        document.getElementById("normalDescription").style.display = "none";
                        document.getElementById("lockoutDescription").style.display = "block";
                        break;
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
            if (data.code == "START_GAME") {
                switchToGameplay();
                colour = data.colour;
                document.getElementById("timeRemainingMinutes").textContent = data.time_limit;
                document.getElementById("timeRemainingSeconds").textContent = "00";
                startTimer(data.started_at, data.time_limit);
            }
            if (data.code == "GUESS") {
                if (data.is_self) {
                    document.getElementById("placeInput").disabled = false;
                    document.getElementById("placeSubmitButton").disabled = false;
                }
                if (data.results.length > 0) {
                    for (const place of data.results) {
                        addPlace(place, data.name, data.colour);
                        enteredPlaces.push(place.name.toLowerCase().trim().replaceAll(" ",""));
                    }
                    if (data.is_self) {
                        document.getElementById("placeInput").value = "";
                        document.getElementById("placeInput").focus();
                        document.getElementById("message").textContent = "⠀";
                        numPlacesUser += data.results.length;
                        document.getElementById("placesHeader").textContent = `Your Places: ${numPlacesUser}`;
                    }
                } else {
                    document.getElementById("message").textContent = data.message;
                }
            }
            if (data.code == "TIME_REMAINING") {
                startTimer(data.started_at, data.time_limit);
            }
            if (data.code == "END_GAME") {
                if (gameEndedFlag) {
                    return;
                }
                gameEndedFlag = true;
                switchToResults();
                const resultsTable = document.getElementById("leaderboardTable");
                let p = 1;
                const leaderboardContainer = document.getElementById("leaderboardContainer");
                document.getElementById("h1").textContent = "Game Results - " + regionName;
                let prevCount = 9999999999;
                for (const result of data.results) {
                    if (result.count === prevCount) {
                        p--;
                    }
                    const row = resultsTable.insertRow();
                    const cell0 = row.insertCell(0);
                    cell0.textContent = p;
                    const cell1 = row.insertCell(1);
                    cell1.textContent = result.name;
                    const cell2 = row.insertCell(2);
                    cell2.textContent = result.count;
                    if (p == 1) {
                        row.style.backgroundColor = "#ffc107";
                    } else if (p == 2) {
                        row.style.backgroundColor = "#c0c0c0";
                    } else if (p == 3) {
                        row.style.backgroundColor = "#cd7f32";
                    }
                    if (result.uid == data.uid) {
                        row.style.fontWeight = "bold";
                    }
                    p++;
                    if (leaderboardContainer.style.overflowY != "scroll" && leaderboardContainer.offsetHeight >= parseInt(window.getComputedStyle(leaderboardContainer).maxHeight)) {
                        leaderboardContainer.style.overflowY = "scroll";
                    }
                    prevCount = result.count;
                }
                const yourPlacesContainer = document.getElementById("yourPlacesContainer");
                for (const place of data.places.reverse()) {
                    const placeTable = document.getElementById("yourPlacesTable");
                    const row = placeTable.insertRow();
                    const cell0 = row.insertCell(0);
                    cell0.textContent = place.name;
                    const cell1 = row.insertCell(1);
                    cell1.textContent = place.county;
                    if (yourPlacesContainer.style.overflowY != "scroll" && yourPlacesContainer.offsetHeight >= parseInt(window.getComputedStyle(yourPlacesContainer).maxHeight)) {
                        yourPlacesContainer.style.overflowY = "scroll";
                    }
                }
            }
            if (data.code == "ERROR") {
                console.error("Error from server:", data.error);
                // alert(`Error: ${data.error}`);
            }
        }
        const total = await fetch(`/placenamegame/howmany?type=${type}`);
        const totalData = await total.json();
        totalPlaces = totalData.total;
        document.getElementById("loading").style.display = "none";
        document.getElementById("main").style.display = "block";
        const tableContainer = document.getElementById("tableContainer");
        if (tableContainer.style.overflowY != "scroll" && tableContainer.offsetHeight >= parseInt(window.getComputedStyle(tableContainer).maxHeight)) {
            tableContainer.style.overflowY = "scroll";
        }
    }
    init();


});



