from fastapi import FastAPI, Cookie, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from typing import Annotated 
import sqlite3
import uuid
import json
import os
import datetime
from operator import itemgetter
import random

if not os.path.exists("gamedata"):
    os.makedirs("gamedata")

if not os.path.exists("data.db"):
    raise FileNotFoundError("data.db not found. Please ensure the database file exists.")

if not os.path.exists("typemap.json"):
    raise FileNotFoundError("typemap.json not found. Please ensure the typemap file exists.")

if not os.path.exists("static"):
    raise FileNotFoundError("static directory not found. Please ensure the static files exist.")

if not os.path.exists("templates"):
    raise FileNotFoundError("templates directory not found. Please ensure the template files exist.")


app = FastAPI(root_path="/placenamegame")

origins = [
    "http://localhost:8000",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/init")
def init(uid_json: Annotated[str | None, Cookie()] = None, type: str | None = "uk"):
    cookie = json.loads(uid_json) if uid_json else {}
    uid = cookie.get(f"uid-{type}") if cookie else None
    print(cookie)
    print("UID:", uid)
    print("Type:", type)
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    if type not in typemap:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)
    if uid is not None:
        try:
            with open(f"gamedata/{uid}.json", "r") as f:
                content = json.load(f)
                if content.get("finished") == False and content.get("type") == type:
                    response = JSONResponse(content=content)
                    return response
        except FileNotFoundError:
            print("File not found")
    
    uid = str(uuid.uuid4())
    init_content = {"uid": uid, "guesses":[], "count": 0, "name": "Anonymous", "date": "Unknown", "finished": False, "type": type}
    with open(f"gamedata/{uid}.json", "w") as f:
        json.dump(init_content, f)
    response = JSONResponse(content=init_content)
    cookie[f"uid-{type}"] = uid
    cookie_str = json.dumps(cookie)
    response.set_cookie(key="uid_json", value=cookie_str, httponly=False, samesite="lax", secure=False, max_age=99999999999)
    return response


@app.get("/query")
def query(text: str, type: str, uid_json: Annotated[str | None, Cookie()] = None):
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    typedata = typemap.get(type, [])
    if not typedata:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)
    valid_counties = typedata.get("valid-counties", [])
    if len(valid_counties) == 1:
        valid_counties.append("Penis") # fucking sqlite hates single elements in IN statements so need to add garbage
    con = sqlite3.connect("data.db")
    cur = con.cursor()
    text = text.replace(" ", "").replace("-", "").replace("'", "").replace(".", "").lower()
    cur.execute(f"SELECT name, lat, lon, county FROM data WHERE name_norm LIKE '%//{text}//%' AND county IN {tuple(valid_counties)}")

    results = cur.fetchall()
    con.close()
    response = {"results": [], "already_guessed": False}
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-{type}")
    with open(f"gamedata/{uid}.json", "r") as f:
        content = json.load(f)
    for result in results:
        res_json = {"name": result[0], "lat": result[1], "lon": result[2], "county": result[3]}
        if res_json not in content["guesses"]:
            content["guesses"].append(res_json)
            content["count"] += 1
            response["results"].append(res_json)
        else:
            response["already_guessed"] = True
    with open(f"gamedata/{uid}.json", "w") as f:
        json.dump(content, f)
    return response

@app.get("/howmany")
def get_total(type : str):
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    typedata = typemap.get(type, [])
    if not typedata:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)
    valid_counties = typedata.get("valid-counties", [])
    # print("Valid counties:", valid_counties)
    if len(valid_counties) == 1:
        valid_counties.append("Penis") # fucking sqlite hates single elements in IN statements so need to add garbage
    con = sqlite3.connect("data.db")
    cur = con.cursor()
    total = cur.execute(f"SELECT COUNT(*) FROM data WHERE county IN {tuple(valid_counties)}").fetchone()[0]
    con.close()
    return {"total": total}

@app.get("/setname")
def set_name(type: str, uid_json: Annotated[str | None, Cookie()] = None, name: str | None = "Anonymous"):
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-{type}")
    with open(f"gamedata/{uid}.json", "r") as f:
        content = json.load(f)
    content["name"] = name
    with open(f"gamedata/{uid}.json", "w") as f:
        json.dump(content, f)
    return JSONResponse(content={"message": "Name updated successfully", "name": name})

@app.get("/finish")
def finish(type: str,uid_json: Annotated[str | None, Cookie()] = None, name: str | None = "Anonymous"):
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    typedata = typemap.get(type, [])
    if not typedata:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-{type}")
    date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(f"gamedata/{uid}.json", "r") as f:
        content = json.load(f)
    content["finished"] = True
    content["name"] = name
    content["date"] = date
    high_scores = typedata.get("high-scores", [])
    if len(high_scores) < 10 or content["count"] > min(score["count"] for score in high_scores):
        high_scores.append({"uid": uid, "name": name, "count": content["count"], "date": date})
        high_scores.sort(key=lambda x: x["count"], reverse=True)
        high_scores = high_scores[:10]
        typedata["high-scores"] = high_scores
        typemap[type] = typedata
        with open("typemap.json", "w") as f:
            json.dump(typemap, f, indent=2)
    with open(f"gamedata/{uid}.json", "w") as f:
        json.dump(content, f)
    cookie.pop(f"uid-{type}", None)
    cookie_str = json.dumps(cookie)
    response = JSONResponse(content=content)
    response.set_cookie(key="uid_json", value=cookie_str, httponly=False, samesite="lax", secure=False, max_age=99999999999)
    return response

@app.get("/reset")
def reset(type: str, uid_json: Annotated[str | None, Cookie()] = None):
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-{type}")
    with open(f"gamedata/{uid}.json", "r") as f:
        content = json.load(f)
    content["guesses"] = []
    content["count"] = 0
    content["finished"] = False
    with open(f"gamedata/{uid}.json", "w") as f:
        json.dump(content, f)
    response = JSONResponse(content=content)
    return response

@app.get("/check-game-exists")
def check_game_exists(type: str, uid_json: Annotated[str | None, Cookie()] = None):
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-{type}")
    try:
        with open(f"gamedata/{uid}.json", "r") as f:
            content = json.load(f)
            if content.get("finished") == False and content.get("type") == type:
                return JSONResponse(content={"exists": True})
    except FileNotFoundError:
        pass
    return JSONResponse(content={"exists": False})

@app.get("/data/{uid}")
def get_data(uid: str):
    try:
        with open(f"gamedata/{uid}.json", "r") as f:
            content = json.load(f)
            response = JSONResponse(content=content)
            return response
    except:
        return JSONResponse(content={"error": "Data not found"}, status_code=404)

@app.get("/typemap")
def get_typemap(howmany: str | None = None):
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    if howmany:
        for type in typemap:
            count = get_total(type)["total"]
            typemap[type]["total"] = count
    return typemap

@app.get("/results")
def get_results(request: Request, uid: str):
    try:
        with open(f"gamedata/{uid}.json", "r") as f:
            content = json.load(f)
    except FileNotFoundError:
        return RedirectResponse(url="./")
    if content.get("finished") == False:
        return RedirectResponse(url="./")

    name = content.get("name", "Anonymous")
    count = content.get("count", 0)
    if count != 1:
        count = f"{count} places"
    else:
        count = f"{count} place"
    date = content.get("date", "Unknown")
    type = content.get("type")
    typemap = get_typemap()
    typedata = typemap.get(type, {})
    type_name = typedata.get("name", "Unknown")
    return templates.TemplateResponse("results.html", {"request": request, "name": name, "count": count, "date": date, "type": type_name, "uid": uid})
    
@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/game")
def game(request: Request, type: str):
    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    typedata = typemap.get(type, {})
    try:
        type_name = typedata.get("name")
        if type_name[:3] == "the":
            type_name_2 = type_name[4:]
        else:
            type_name_2 = type_name
    except KeyError:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)
    return templates.TemplateResponse("index.html", {"request": request, "type": type_name, "type2": type_name_2})


rooms = {}
COLOURS = ["rgba(255,0,0,0.5)", "rgba(0,127,0,0.5)", "rgba(0,0,255,0.5)", "rgba(0,117,220,0.5)", "rgba(153,63,0,0.5)", "rgba(76,0,92,0.5)", "rgba(0,92,49,0.5)", "rgba(128,128,128,0.5)", "rgba(157,204,0,0.5)", "rgba(194,0,136,0.5)", "rgba(0,51,128,0.5)", "rgba(255,168,187,0.5)", "rgba(0,153,143,0.5)", "rgba(255, 102, 0, 0.5)", "rgba(153,0,0,0.5)", "rgba(240,163,255,0.5)"]

@app.get("/vs")
def vs(request: Request):
    return templates.TemplateResponse("vshome.html", {"request": request})

@app.get("/vs/room/create")
def create_room(type: str, uid_json: Annotated[str | None, Cookie()] = None):
    cookie = json.loads(uid_json) if uid_json else {}

    with open("typemap.json", "r") as f:
        typemap = json.load(f)
    if type not in typemap:
        return JSONResponse(content={"error": "Invalid type"}, status_code=400)

    uid = cookie.get(f"uid-vs-{type}") if cookie else None
    if uid is None:
        uid = str(uuid.uuid4())
        cookie[f"uid-vs-{type}"] = uid
        cookie_str = json.dumps(cookie)
    else:
        cookie_str = uid_json

    room_id = str(random.randint(0, 999999)).zfill(6)

    room_data = {"type": type, "host_uid": uid, "players": {uid: {"name": "Anonymous", "websockets": [], "guesses": [], "count": 0}}, "mode": "normal", "status": "waiting", "time_limit": 5, "created_at": datetime.datetime.now().timestamp(), "started_at": None}
    rooms[room_id] = room_data
    response = JSONResponse(content={"room_id": room_id, "type": type})
    response.set_cookie(key="uid_json", value=cookie_str, httponly=False)
    return response

@app.get("/vs/room/join")
def join_room(room_id: str, name: str | None = None,  uid_json: Annotated[str | None, Cookie()] = None):
    cookie = json.loads(uid_json) if uid_json else {}

    if room_id not in rooms:
        return JSONResponse(content={"error": "Room not found"}, status_code=404)
    room_data = rooms[room_id]
    if room_data["status"] != "waiting":
        return JSONResponse(content={"error": "Room is not accepting new players"}, status_code=403)
    type = room_data["type"]
    uid = cookie.get(f"uid-vs-{type}")
    if uid is None:
        uid = str(uuid.uuid4())
        cookie[f"uid-vs-{type}"] = uid
        cookie_str = json.dumps(cookie)
    else:
        cookie_str = uid_json
    if uid not in room_data["players"]:
        room_data["players"][uid] = {"name": name if name else "Anonymous", "websockets": [], "guesses": [], "count": 0}
    rooms[room_id] = room_data
    response = JSONResponse(content={"room_id": room_id, "type": type})
    response.set_cookie(key="uid_json", value=cookie_str, httponly=False)
    return response

@app.get("/vs/room")
def room(request: Request, room_id: str, type: str, uid_json: Annotated[str | None, Cookie()] = None):
    if uid_json is None:
        return JSONResponse(content={"error": "No UID cookie"}, status_code=400)
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-vs-{type}")
    if room_id not in rooms:
        return JSONResponse(content={"error": "Room not found"}, status_code=404)
    room_data = rooms[room_id]
    if uid not in room_data["players"]:
        return JSONResponse(content={"error": "You are not a player in this room"}, status_code=403)
    typemap = get_typemap()
    typedata = typemap.get(type, {})
    type_name = typedata.get("name", "Unknown")
    if type_name[:3] == "the":
        type_name = type_name[4:]
    return templates.TemplateResponse("vsindex.html", {"request": request, "room_id": room_id, "type": type_name})

@app.websocket("/vs/room/{room_id}")
async def handle_websocket(websocket: WebSocket, room_id: str, uid_json: Annotated[str | None, Cookie()] = None):
    await websocket.accept()
    if room_id not in rooms:
        await websocket.send_json({"code": "ERROR", "error": "Room not found"})
        await websocket.close()
        return
    if uid_json is None:
        await websocket.send_json({"code": "ERROR", "error": "No UID cookie"})
        await websocket.close()
        return
    room_data = rooms[room_id]
    type = room_data["type"]
    cookie = json.loads(uid_json)
    uid = cookie.get(f"uid-vs-{type}") # uid = current player's uid
    if uid not in room_data["players"]:
        await websocket.send_json({"code": "ERROR", "error": "You are not a player in this room"})
        await websocket.close()
        return
    else:
        room_data["players"][uid]["websockets"].append(websocket)  # Initialise the player's data in the room
        if room_data["status"] == "in_progress" and room_data["mode"] == "normal":
            await websocket.send_json({"code":"INIT", "room_id": room_id, "type": room_data["type"], "is_host": room_data["host_uid"] == uid, "mode": room_data["mode"], "status": room_data["status"], "time_limit": room_data["time_limit"], "started_at": room_data["started_at"], "name": room_data["players"][uid]["name"], "uid": uid, "colour": COLOURS[0]})
        else:
            await websocket.send_json({"code":"INIT", "room_id": room_id, "type": room_data["type"], "is_host": room_data["host_uid"] == uid, "mode": room_data["mode"], "status": room_data["status"], "time_limit": room_data["time_limit"], "started_at": room_data["started_at"], "name": room_data["players"][uid]["name"], "uid": uid, "colour": COLOURS[list(room_data["players"].keys()).index(uid) % len(COLOURS)]})
        for userid in room_data["players"]:
            # Send a JOIN message to all players in the room about the new player
            for ws in room_data["players"][userid]["websockets"]:
                await ws.send_json({"code":"JOIN", "uid": uid, "name": room_data["players"][uid]["name"]})
            # Send a JOIN message to the new player about all existing players in the room
            await websocket.send_json({"code":"JOIN", "uid": userid, "name": room_data["players"][userid]["name"]})
        # Send the current state of the room to the new player
        rooms[room_id] = room_data  # Update the room data with the new ws connection
        if room_data["status"] == "in_progress":
            if room_data["mode"] == "lockout":
                for userid in room_data["players"]:
                    await websocket.send_json({"code":"GUESS", "results": room_data["players"][userid]["guesses"], "already_guessed": False, "uid": userid, "is_self": userid == uid, "colour": COLOURS[list(room_data["players"].keys()).index(userid) % len(COLOURS)], "name": room_data["players"][userid]["name"] })
            elif room_data["mode"] == "normal":
                await websocket.send_json({"code":"GUESS", "results": room_data["players"][uid]["guesses"], "already_guessed": False, "uid": uid, "is_self": True, "colour": COLOURS[0], "name": room_data["players"][uid]["name"] })
        elif room_data["status"] == "ended":
            results = []
            for userid in room_data["players"]:
                results.append({"uid": userid, "name": room_data["players"][userid]["name"], "count": room_data["players"][userid]["count"]})
            results.sort(key=itemgetter("count"), reverse=True)
            await websocket.send_json({"code":"END_GAME", "results": results, "places": room_data["players"][uid]["guesses"], "uid": uid})
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("code") == "NAME_CHANGE":
                if room_data["status"] != "waiting":
                    await websocket.send_json({"code": "ERROR", "error": "Cannot change name after game has started"})
                    continue
                new_name = data.get("name", "Anonymous")
                room_data["players"][uid]["name"] = new_name
                rooms[room_id]["players"][uid] = room_data["players"][uid]  # Update the room data with the new name
                # Broadcast the name change to all players in the room
                for userid in room_data["players"]:
                    if uid != userid:  # Don't send the name change to the player who changed their name
                        for ws in room_data["players"][userid]["websockets"]:
                            await ws.send_json({"code":"NAME_CHANGE", "uid": uid, "name": new_name})
            elif data.get("code") == "SET_TIME_LIMIT":
                if room_data["status"] != "waiting":
                    await websocket.send_json({"code": "ERROR", "error": "Cannot set time limit after game has started"})
                    continue
                if uid == room_data["host_uid"]:
                    new_time_limit = data.get("time_limit", 5)
                    room_data["time_limit"] = new_time_limit
                    rooms[room_id]["time_limit"] = new_time_limit  # Update the room data with the new time limit
                    # Broadcast the time limit change to all players in the room
                    for userid in room_data["players"]:
                        for ws in room_data["players"][userid]["websockets"]:
                            await ws.send_json({"code":"SET_TIME_LIMIT", "time_limit": new_time_limit})
            elif data.get("code") == "SET_GAME_MODE":
                if room_data["status"] != "waiting":
                    await websocket.send_json({"code": "ERROR", "error": "Cannot set game mode after game has started"})
                    continue
                if uid == room_data["host_uid"]:
                    print(data)
                    new_game_mode = data.get("mode")
                    room_data["mode"] = new_game_mode
                    rooms[room_id] = room_data  # Update the room data with the new game mode
                    # Broadcast the game mode change to all players in the room
                    for userid in room_data["players"]:
                        for ws in room_data["players"][userid]["websockets"]:
                            await ws.send_json({"code":"SET_GAME_MODE", "mode": new_game_mode})
            elif data.get("code") == "START_GAME":
                if uid == room_data["host_uid"]:
                    if room_data["status"] != "waiting":
                        await websocket.send_json({"code": "ERROR", "error": "Game has already started"})
                        continue
                    room_data["status"] = "in_progress"
                    room_data["started_at"] = datetime.datetime.now().timestamp()
                    rooms[room_id] = room_data  # Update the room data with the new status
                    # Broadcast the game start to all players in the room
                    i = 0
                    for userid in room_data["players"]:
                        if len(room_data["players"][userid]["websockets"]) == 0:
                            # If the player has no more active websockets, remove them from the room before start
                            del room_data["players"][userid]
                            rooms[room_id]["players"] = room_data["players"]  # Update the room data after removing the player
                        if room_data["mode"] == "lockout":
                            for ws in room_data["players"][userid]["websockets"]:
                                await ws.send_json({"code":"START_GAME", "started_at": room_data["started_at"], "time_limit": room_data["time_limit"], "colour": COLOURS[i % len(COLOURS)], "uid": userid})
                        else:
                            for ws in room_data["players"][userid]["websockets"]:
                                await ws.send_json({"code":"START_GAME", "started_at": room_data["started_at"], "time_limit": room_data["time_limit"], "colour": COLOURS[0], "uid": userid})
                        i += 1
            
            elif data.get("code") == "GUESS":
                if datetime.datetime.now().timestamp() - room_data["started_at"] > int(room_data["time_limit"])*60:
                    await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": False, "message": "Time's up!"})
                    continue
                text = data.get("text", "")
                colour = data.get("colour", "")
                with open("typemap.json", "r") as f:
                    typemap = json.load(f)
                typedata = typemap.get(type, [])
                if not typedata:
                    # why does this exist???
                    return JSONResponse(content={"code": "ERROR", "error": "Invalid type"}, status_code=400)
                valid_counties = typedata.get("valid-counties", [])
                if len(valid_counties) == 1:
                    valid_counties.append("Penis") # fucking sqlite hates single elements in IN statements so need to add garbage
                con = sqlite3.connect("data.db")
                cur = con.cursor()
                text = text.replace(" ", "").replace("-", "").replace("'", "").replace(".", "").lower()
                cur.execute(f"SELECT name, lat, lon, county FROM data WHERE name_norm LIKE '%//{text}//%' AND county IN {tuple(valid_counties)}")
                results = cur.fetchall()
                con.close()
                results_list = []
                already_guessed = False
                if room_data["mode"] == "normal":
                    for result in results:
                        res_json = {"name": result[0], "lat": result[1], "lon": result[2], "county": result[3]}
                        if res_json not in room_data["players"][uid]["guesses"]:
                            room_data["players"][uid]["guesses"].append(res_json)
                            room_data["players"][uid]["count"] += 1
                            results_list.append(res_json)
                        else:
                            already_guessed = True
                    rooms[room_id]["players"][uid] = room_data["players"][uid]  # Update the room data with the new guesses
                    if len(results_list) == 0 and not already_guessed:
                        await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": False, "is_self": True, "message": "Place not found!"})
                    elif len(results_list) == 0 and already_guessed:
                        await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": True, "is_self": True, "message": "Already guessed!"})
                    else:
                        for ws in room_data["players"][uid]["websockets"]:
                            await ws.send_json({"code":"GUESS", "results": results_list, "already_guessed": already_guessed, "uid": uid, "is_self": True, "colour": colour, "name": room_data["players"][uid]["name"]})
                
                elif room_data["mode"] == "lockout":
                    flag = False
                    for result in results:
                        res_json = {"name": result[0], "lat": result[1], "lon": result[2], "county": result[3]}
                        if res_json not in room_data["players"][uid]["guesses"]:
                            for userid in room_data["players"]:
                                if res_json in room_data["players"][userid]["guesses"]:
                                    flag = True
                                    break
                            if not flag:
                                room_data["players"][uid]["guesses"].append(res_json)
                                room_data["players"][uid]["count"] += 1
                                results_list.append(res_json)
                        else:
                            already_guessed = True
                    rooms[room_id]["players"][uid] = room_data["players"][uid]  # Update the room data with the new guesses
                    
                    if len(results_list) == 0 and not (already_guessed or flag):
                        await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": False, "is_self": True, "message": "Place not found!"})
                    elif len(results_list) == 0 and already_guessed:
                        await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": True, "is_self": True, "message": "Already guessed!"})
                    elif len(results_list) == 0 and flag:
                        await websocket.send_json({"code":"GUESS", "results": [], "already_guessed": False, "is_self": True, "message": "Already guessed by another player!"})
                    else:
                        for userid in room_data["players"]:
                            for ws in room_data["players"][userid]["websockets"]:
                                await ws.send_json({"code":"GUESS", "results": results_list, "already_guessed": already_guessed, "uid": uid, "is_self": userid == uid, "colour": colour, "name": room_data["players"][uid]["name"]})
                            
            elif data.get("code") == "TIME_UP":
                # server-side validation
                if (datetime.datetime.now().timestamp() - float(room_data["started_at"])) > (int(room_data["time_limit"])*60 - 0.5): #0.5s to allow for small inaccuracies
                    if room_data["status"] != "in_progress":
                        await websocket.send_json({"code": "ERROR", "error": "Game is not in progress"})
                        continue
                    results = []
                    for userid in room_data["players"]:
                        results.append({"uid": userid, "name": room_data["players"][userid]["name"], "count": room_data["players"][userid]["count"]})
                    results.sort(key=itemgetter("count"), reverse=True)
                    for userid in room_data["players"]:
                        for ws in room_data["players"][userid]["websockets"]:
                            await ws.send_json({"code":"END_GAME", "results": results, "places": room_data["players"][userid]["guesses"], "uid":userid})
                    room_data["status"] = "ended"
                    rooms[room_id] = room_data  # Update the room data with the new status
                    del rooms[room_id]  # Remove the room from the global rooms dictionary after the game ends
                else:
                    # send correct time remaining if client is out of sync
                    await websocket.send_json({"code":"TIME_REMAINING", "started_at": room_data["started_at"], "time_limit": room_data["time_limit"]}) # in seconds


    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {uid} in room {room_id}")
        # room_data = rooms[room_id]

        if uid in room_data["players"]:
            if websocket in room_data["players"][uid]["websockets"]:
                room_data["players"][uid]["websockets"].remove(websocket)
                rooms[room_id] = room_data  # Update the room data after removing the websocket
            if room_data["status"] == "waiting" and not room_data["players"][uid]["websockets"]:
                # Broadcast to all remaining players that this player has left
                for userid in room_data["players"]:
                    for ws in room_data["players"][userid]["websockets"]:
                        await ws.send_json({"code":"LEAVE", "uid": uid})
        return