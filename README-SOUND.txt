CHANDABAJ - SOUND UPDATE
========================

WHAT IS NEW
- Every bus, CNG and rickshaw near you has its OWN engine sound that follows it: louder when it comes closer, quieter when it leaves,
  heard from the left or right, and the pitch changes when it drives past you. Horns and bells come from the vehicle that blows them.
- A bazaar around you: crowd noise, traffic hum, chatter from the real people on the footpath, and shop sounds by shop name
  (frying in hotels and sweet shops, spoons in tea stalls, tinny phone music in mobile shops, sewing machines at tailors, a cleaver at the fish shop,
  the air hose at the tyre shop) and crows on the roofs.
- Funny Bangla lines (meme / natok / Dhallywood / bus-helper style): everybody speaks, and so do you (when you demand money, get hit, fall in a hole, get beaten ...).
  Every line is shown as a bubble AND spoken from where the speaker stands.

KEYS (new)
  M  = sound off / on
  V  = voices: off / babble / real Bengali speech (only if your phone or computer has a Bengali voice)
  P  = pause (the street goes quiet while paused)

FILES YOU MAY WANT TO EDIT (any text editor)
  js/fx/lines.js      all sentences. Change, add or delete lines. Nothing else has to change.
  js/fx/audio.js      top of the file: VOLUME = how loud each kind of sound is (0 = silent, 1 = normal)
  js/fx/engines.js    top of the file: SPEC = how loud / how far each vehicle type can be heard
  audio/voice/        put your own recordings here (see README.txt in that folder)

TRY THE SOUNDS WITHOUT PLAYING: open  sound-test.html  (same folder). Sliders for every volume, buttons for every sound,
a play button for every line. Tell me the numbers you like.

NOTE: browsers only start sound after a click, so the game is silent on the start screen until you press the button.
If you put the game online, the new files must be uploaded too (the whole folder, as before).
