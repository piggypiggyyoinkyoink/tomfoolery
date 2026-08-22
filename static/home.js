let projection;
let resizeTimer;
let typemap;

window.addEventListener("DOMContentLoaded", async () => {
    async function fetchGeoJSON(type) {
        // const res = await fetch("/typemap");
        // const typemap = await res.json();
        // console.log(typemap);
        if (!typemap[type]) {
            console.error(`Invalid type: ${type}`);
            window.location.href = "./"; 
            return;
        }
        const filename = typemap[type].geofile;
        regionName = typemap[type].name;
        const response = await fetch(`./static/geo/${filename}`);
        const geoData = await response.json();
        return geoData;
    }
        
    async function drawMap(width, type){
        let height = width; // Set height equal to width for a square map
        let svg = d3.select(`#map-container-${type}`)
        .append("svg")
        .attr("id", `map-${type}`)
        .attr("width", width)
        .attr("height", height);
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

    async function createCard(type, data, category){
        const card = document.createElement("div");
        // card.setAttribute("style", " margin: 10px;");
        card.setAttribute("class", "crd col-11 col-sm-6 col-md-4 col-lg-3");
        card.setAttribute("id", `card-${type}`);
        const cardInner = document.createElement("div");
        cardInner.setAttribute("class", "card-body");
        card.appendChild(cardInner);
        const mapContainer = document.createElement("div");
        mapContainer.setAttribute("id", `map-container-${type}`);
        mapContainer.setAttribute("style", "width: 100%;");
        cardInner.appendChild(mapContainer);
        cardInner.appendChild(document.createElement("hr"));
        const cardTitle = document.createElement("h5");
        cardTitle.setAttribute("class", "card-title");
        if (data.name.startsWith("the")) {
            data.name = data.name.slice(4); // Remove "the " from the beginning of the name
        }
        cardTitle.textContent = data.name;
        cardInner.appendChild(cardTitle);
        // const res = await fetch(`/howmany?type=${type}`);
        // const howmany = await res.json();
        const total = data.total;
        const cardText = document.createElement("p");
        cardText.setAttribute("class", "card-text");
        cardText.textContent = `${total} places`;
        cardInner.appendChild(cardText);
        // console.log(howmany);
        document.getElementById(`${category}-card-container`).appendChild(card);
        // const containerElem = document.getElementById(`map-container-${type}`);
        // let width = window.getComputedStyle(containerElem).width;
        // let height = window.getComputedStyle(containerElem).height;
        // width = parseInt(width);
        // await drawMap(width, type);
        document.getElementById(`card-${type}`).addEventListener("click", () => {
            window.location.href = `./game?type=${type}`;
        });
    }

    async function init_home(){
        const res = await fetch("./typemap?howmany=true");
        typemap = await res.json();
        const countryTypes = ["uk", "england", "scotland", "wales", "ni"];
        const englandCountyTypes = ['greaterlondon', 'suffolk', 'essex', 'wiltshire', 'eastsussex', 'staffordshire', 'cambridgeshire', 'somerset', 'cheshire', 'lincolnshire', 'surrey', 'hampshire', 'westsussex', 'hertfordshire', 'westyorkshire', 'westmidlands', 'norfolk', 'cumbria', 'isleofwight', 'cornwall', 'devon', 'oxfordshire', 'berkshire', 'buckinghamshire', 'gloucestershire', 'bedfordshire', 'dorset', 'leicestershire', 'warwickshire', 'northamptonshire', 'worcestershire', 'northumberland', 'kent', 'northyorkshire', 'eastridingofyorkshire', 'tyneandwear', 'herefordshire', 'southyorkshire', 'rutland', 'derbyshire', 'durham', 'shropshire', 'merseyside', 'lancashire', 'nottinghamshire', 'greatermanchester'].sort();
        const scotlandCountyTypes = ['southlanarkshire', 'highland', 'midlothian', 'eastlothian', 'northlanarkshire', 'angus', 'fife', 'moray', 'scottishborders', 'westdunbartonshire', 'renfrewshire', 'northayrshire', 'argyllandbute', 'clackmannanshire', 'westlothian', 'falkirk', 'eastayrshire', 'inverclyde', 'westernisles', 'orkney', 'shetlandislands', 'stirling', 'perthandkinross', 'aberdeenshire', 'cityofedinburgh', 'eastdunbartonshire', 'southayrshire', 'dumfriesandgalloway', 'eastrenfrewshire'].sort();
        const walesCountyTypes = ['pembrokeshire', 'monmouthshire', 'ceredigion', 'gwynedd', 'swansea', 'torfaen', 'blaenaugwent', 'caerphilly', 'rhonddacynontaf', 'valeofglamorgan', 'bridgend', 'neathporttalbot', 'powys', 'denbighshire', 'conwy', 'anglesey', 'merthyrtydfil', 'carmarthenshire', 'flintshire', 'wrexham', 'newport'].sort();
        const niCountyTypes = ['fermanagh', 'down', 'antrim', 'londonderry', 'tyrone', 'armagh'].sort()
        const alltypes = countryTypes.concat(englandCountyTypes, scotlandCountyTypes, walesCountyTypes, niCountyTypes);
        for (const type of countryTypes){
            const data = typemap[type];
            await createCard(type, data, "country");
        }
        for (const type of englandCountyTypes){
            const data = typemap[type];
            await createCard(type, data, "england");
        }
        for (const type of scotlandCountyTypes){
            const data = typemap[type];
            await createCard(type, data, "scotland");
        }
        for (const type of walesCountyTypes){
            const data = typemap[type];
            await createCard(type, data, "wales");
        }
        for (const type of niCountyTypes){
            const data = typemap[type];
            await createCard(type, data, "ni");
        }
        document.getElementById("loading").style.display = "none";
        document.getElementById("main").style.display = "block";
        for (const type of alltypes){
            const containerElem = document.getElementById(`map-container-${type}`);
            let width = window.getComputedStyle(containerElem).width;
            width = parseInt(width);
            await drawMap(width, type);
        }
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const svgs = document.querySelectorAll("svg");
                svgs.forEach(async (svg) => {
                    svg.remove();
                    const type = svg.id.split("-")[1];
                    const containerElem = document.getElementById(`map-container-${type}`);
                    let width = window.getComputedStyle(containerElem).width;
                    width = parseInt(width);
                    await drawMap(width, type);
                });
            }, 250);
        });
    }
    init_home();

});

