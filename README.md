# The Place Name Game
How many place names do you know in each region of the UK?  
Try now at https://the.piggypiggyyoinkyoink.website/placenamegame/  

Note: Due to financial constraints, this is currently hosted on a potato. Latency may be... less than ideal.  

## Game Modes
**Solo**: See how many places you can name in the selected region. No time limit, no pressure. Upon ending the game, you can copy a permanent link to your results.  

**VS**: Create or join rooms with your friends to see who knows the most place names.  
- Normal: *Coming Soon!*  
- Lockout: Once one player has entered a place name, noone else can! The player with the most places named within the time limit wins.  

Note: Places that share a name with each other DO count as multiple places in all modes.

## Regions
- Whole UK (30k+ places)
- England
- Scotland
- Wales
- Northern Ireland
- Each of the Ceremonial Counties of England\*
- Each of the Principal Areas of Wales\*\*
- Each of the Scottish Council Areas\*\*\*
- Each of the Counties of Northern Ireland

\* excludes Bristol as it is its own county, containing only itself. "Name the one place in Bristol" doesn't make a very interesting game.  
\*\* excludes Cardiff for similar reasons to Bristol.  
\*\*\* excludes Glasgow City, Dundee City and Aberdeen City, again for the same reason. Aberdeen City has been merged into Aberdeenshire for the purposes of this game, whereas Glasgow and Dundee are only present on the Scotland map.
I am an ignorant Englishman with little knowledge of Scottish politics and history so if you think there is a better way of handling this, feel free to create an [issue](https://github.com/piggypiggyyoinkyoink/place-name-game/issues/new).

## Data
The place name data used in the game comes from open-source OpenStreetMap data with over 30000 places, and as such I am not able to manually check that everything is correct. If you notice any inaccuracies or missing places while playing the game, make an [issue](https://github.com/piggypiggyyoinkyoink/place-name-game/issues/new) and I will make any necessary updates to the database.

## Running the game server yourself
To run the game server on your own machine, make sure you have Python 3.11 installed. This can be downloaded from:  
- [here](https://www.python.org/downloads/windows/#:~:text=3.11.4%20cannot%20be%20used%20on%20Windows%207%20or%20earlier.-,Download%20Windows%20installer%20(64%2Dbit),-Download%20Windows%20installer%20(32%2Dbit)) for Windows  
- [here](https://www.python.org/downloads/macos/#:~:text=June%206%2C%202023-,Download%20macOS%2064%2Dbit%20universal2%20installer,-Python%203.10.11%20%2D%20April) for MacOS  
- [here](https://www.python.org/downloads/source/#:~:text=Python%203.11.4%20%2D%20June,compressed%20source%20tarball) for Linux  

### Setup
- Clone this repository.  
- Ensure your terminal is in the root directory of the cloned repository (`place-name-game`).  
- Create and activate a Python Virtual Environment.
- Run `pip install -r requirements.txt`. Ensure the installed version of Starlette is 0.x.x NOT 1.x.x as version 1.0.0 introduced breaking changes.  
- Run `python init_create_db.py` to build the SQLite database used by the game from the placenames and counties GEOJSON files. This may take some time. The database itself is less than 5MB.  
- Run `python init_game_types.py` to build the map GEOJSON files for each game mode, and the `typemap.json` used by both the frontend and backend for identifying gamemodes.
- Run `fastapi run main.py` to start the server at `localhost:8000`.
