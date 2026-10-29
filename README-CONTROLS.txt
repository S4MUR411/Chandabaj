CHANDABAJ - THE NEW CONTROLS
============================

The game now plays like a normal PC game. You do not need to learn numbers any more.

KEYBOARD + MOUSE
  W A S D  or  arrow keys    walk
  Shift                      run (uses stamina)
  Space                      jump  - hop over potholes and puddles
  E  or  LEFT MOUSE CLICK    ask for chada
                               tap   = soft ask
                               hold  = it gets tougher the longer you hold:
                                       soft ask -> demand -> beat him -> smash the shop
                               let go = it happens (the ring around the key shows how far you are)
                             Walk away or switch window while holding = nothing happens.
  F                          chai-pani (pay the police)
  Q                          hire a mastan (500 taka)
  Esc  or  P                 pause
  M                          sound on / off
  V                          voices: off / mumble / Bangla voice

  The old keys 1 2 3 4, B and H still work, if you like them.

GAME CONTROLLER (Xbox / PlayStation / most USB pads - plug in and press any button)
  Left stick or D-pad        walk (push gently to walk slowly)
  A  (PlayStation: Cross)    jump
  X  or  RT                  chada (hold = tougher)
  B                          chai-pani
  Y                          mastan
  L3 / LB / LT               run
  Start                      pause

PHONE / TABLET
  Put your thumb anywhere on the LEFT half of the screen and drag: a stick appears under it.
  Drag all the way to the edge to run.
  Big round button           chada (hold = tougher)
  Small buttons              jump, chai-pani, mastan, and the pause button at the top right.
  The buttons appear by themselves as soon as you touch the screen.

WHAT YOU SEE
  * A yellow arrow bounces over the shop you can squeeze.
  * A key cap at the bottom of the screen says which key to press. When you hold it, a ring fills
    and four dots light up (one per level). The hint always shows the key of the device you used last
    (E, "click", X on a controller, a finger on a phone).

WANT TO CHANGE THE FEEL?   (js/config.js)
  grab: { t1: 0.45, t2: 1.0, t3: 1.6 }    seconds of holding to reach "demand", "beat", "smash"
                                          (make the numbers bigger = you must hold longer)
  jump: { time: 0.62, height: 0.75, stamina: 0.06 }
                                          how long a jump lasts, how high, and how much stamina it costs
