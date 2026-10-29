RECORDINGS FOR THE FUNNY LINES
==============================

Every sentence in the game can be spoken by a REAL voice instead of the made-up babble voice.
You (or a friend) record the sentence, and the game plays your recording at the place where the person stands.

HOW
---
1. Pick a line from the list below and record it (phone voice recorder is fine, one short sentence, about 1-3 seconds, no long silence at the start).
2. Save it as an MP3 file in THIS folder, named exactly like the code in front of the line.
   Example: the line  mob-3  must be saved as  mob-3.mp3
3. Open js/fx/lines.js, scroll to the bottom and write the code in the list RECORDED, like this:
       export const RECORDED = ["mob-3", "cop-2", "victim-8"];
4. Reload the game. That line now uses your recording. A line without a recording still uses the babble voice, so you can add them one by one.

If you change the ORDER of lines in lines.js the numbers change too - so only add new lines at the END of a list, and the numbers stay the same.

Only use recordings that you made yourself or that you have the right to use (do not copy clips from films, TV or other people without permission, especially if you put the game online).

THE LINES
---------

[chat]
chat-1            দাম আবার বাড়ছে…
chat-2            আজ জ্যামে দুই ঘণ্টা গেল
chat-3            ইলিশের কেজি এখন কত?
chat-4            নেতার নতুন পোস্টার দেখছেন?
chat-5            কালকের ম্যাচ দেখছেন?
chat-6            গ্যাসের লাইন আবার নাই
chat-7            এই রাস্তা কবে ঠিক হবে?
chat-8            ভাই, চা খাবেন?
chat-9            শুনলাম এলাকায় নতুন চাঁদাবাজ এসেছে…
chat-10           বৃষ্টি হলেই হাঁটুপানি!
chat-11           ভাই, জ্যামে আটকে আছি… না না, রাস্তায় না, জীবনে!
chat-12           ডিমের দাম শুনছেন? এখন ডিম দেখলে সালাম দিতে ইচ্ছা করে!
chat-13           বিসিএস দিয়া দিয়া আমার বয়স পার হইয়া গেল রে ভাই!
chat-14           নেটওয়ার্ক নাই ভাই, ফেসবুকও চলে না, জীবনও চলে না!
chat-15           ঢাকায় আসছিলাম স্বপ্ন নিয়া, রাস্তায় পাইলাম গর্ত!
chat-16           এই শহরে হাঁটতে গেলেও বীমা লাগে!
chat-17           এক কাপ চায়ে জীবন বদলায় না, কিন্তু মেজাজ ঠান্ডা হয়!
chat-18           এই গরমে ফ্যান ঘুরে, কিন্তু বাতাস আসে না!
chat-19           বিয়ের দাওয়াতে গেলাম, বিরিয়ানি আগেই শেষ — এই দুঃখ রাখব কই!

[shop]
shop-1            আসেন আসেন, সস্তা!
shop-2            ভাই, ভালো মাল আছে!
shop-3            আজ বাকি নাই!
shop-4            টাটকা জিনিস, টাটকা!
shop-5            আসেন ভাই আসেন, দেখতে তো পয়সা লাগে না!
shop-6            একদাম, একদাম! দরদাম করে লজ্জা দিবেন না!
shop-7            বাকির খাতা আজ বন্ধ, ভাই!
shop-8            গরম গরম! খাইলে মন জুড়াইবো, না খাইলে মন পুড়বো!
shop-9            সেল সেল! আগে দাম বাড়াইয়া এখন কমাইছি!
shop-10           একদম অরিজিনাল ভাই — এক নম্বর কপি!

[seen]
seen-1            ওই যে চাঁদাবাজ!
seen-2            আমি দেখছি, ও টাকা নিল!
seen-3            এই লোকটাই!
seen-4            পুলিশ ডাকো!
seen-5            ছবি তোল ছবি!
seen-6            সবাই চেহারাটা দেখে রাখেন!
seen-7            লাইভে আসছি ভাই, সবাই দেখেন — চাঁদাবাজ ধরা!
seen-8            ভিডিও করেন ভিডিও, আজ ভাইরাল হবে!
seen-9            হায় হায়, দিনদুপুরে চাঁদা তোলে!
seen-10           আরে! এই তো সেই টিভির খবরের লোক!

[gossip]
gossip-1          শুনছেন? চাঁদাবাজ ঘুরছে!
gossip-2          মুদি দোকানে নাকি টাকা নিছে…
gossip-3          সাবধান থাকেন ভাই
gossip-4          দোকানদাররে মারছে!
gossip-5          আমার ভাইয়ের বন্ধুর শালা বলল, ও নাকি বড় নেতার লোক!
gossip-6          কানে কানে শুনলাম, ও নাকি ডিমের দোকানেও চাঁদা নিছে!
gossip-7          পাশের গলিতে ওর নামে নাকি মামলা আছে!

[victim]
victim-1          আমার সর্বনাশ হইল!
victim-2          টাকা নিয়া গেল!
victim-3          আল্লাহ, বিচার চাই!
victim-4          আমি তো শেষ!
victim-5          ও ভাই, এ কী করলেন?
victim-6          এই দিন দেখার আগে আমার মরণ হইল না কেন!
victim-7          আমার সংসার ভাইঙ্গা দিলা গো!
victim-8          ছেড়ে দে মা, কেঁদে বাঁচি!
victim-9          ভাই, আমার বাচ্চার স্কুলের ফি দিমু কেমনে!
victim-10         পুলিশ ডাকতাম, কিন্তু পুলিশও তো আপনার বন্ধু!

[mob]
mob-1             ধর ধর!
mob-2             মার! মার!
mob-3             চাঁদাবাজ পালায়!
mob-4             আজ আর ছাড়ুম না!
mob-5             লাঠি আন লাঠি!
mob-6             আজ তোর একদিন কি আমার একদিন!
mob-7             ধর ওরে, টিভিতে নিউজ হবে!
mob-8             আগে ধর, পরে কথা!
mob-9             দাঁড়া ব্যাটা, তোর চাঁদার হিসাব নিমু!
mob-10            আজকে তোরে ঢাকা শহর চিনাইমু!

[beat]
beat-1            এই নে!
beat-2            আর করবি?
beat-3            চাঁদা তুলবি আর?
beat-4            নে, শিক্ষা নে!
beat-5            এই নে তোর কমিশন!
beat-6            ডিসকাউন্ট নাই, পুরাটাই নে!
beat-7            মাইরের ওপর ওষুধ নাই!
beat-8            নে, সালামি নে!

[calm]
calm-1            ঠিক হইছে, চল।
calm-2            এবার শিক্ষা হইছে।
calm-3            চল, কাজে যাই।
calm-4            যাক, মনটা ঠান্ডা হইল।
calm-5            চল চা খাই, মাথা গরম হইয়া গেছিল।

[cop]
cop-1             থামুন! থামুন!
cop-2             ধরো ওকে!
cop-3             পুলিশ! দাঁড়ান!
cop-4             আইন নিজের হাতে নিও না — ওইটা আমার কাজ!
cop-5             দাঁড়াও! তোমার নামে আগেই মামলা রেডি!
cop-6             চা-পানি না দিলে থানায় চল!

[bribe]
bribe-1           ঠিক আছে… বিষয়টা মিটমাট করে ফেলি।
bribe-2           আজকের মতো ছাড়, তবে সালাম পৌঁছে দিও!
bribe-3           চা-পানিটা ভালোই ছিল!

[arrest]
arrest-1          ধরা পড়েছ! এবার থানায় বিরিয়ানি খাওয়াব!
arrest-2          আইন তার নিজের গতিতে চলে — আজ একটু দ্রুত!

[rickshaw]
rickshaw-1        মামা সরেন!
rickshaw-2        ও ভাই, পথ ছাড়েন!
rickshaw-3        ঢং ঢং! সরেন!
rickshaw-4        মামা, এটা রাস্তা, আপনার ড্রয়িংরুম না!
rickshaw-5        ও ভাই, ব্রেক নাই, দোয়া করেন!

[cng]
cng-1             এই! সামনে থেকে সর!
cng-2             পিঁ পিঁ! মরবি নাকি?
cng-3             ভাই সরেন, গাড়ি আসতাছে!
cng-4             ভাই সরেন, আমার গাড়ির কাগজ ঠিক নাই!
cng-5             মিটারে যামু না, সামনে থেকে সরেন!

[bus]
bus-1             হর্ন শুনতে পান না?
bus-2             বাস আসছে, সরেন!
bus-3             পঁ-পঁ-পঁ!
bus-4             আগে বাড়েন মামা, আগে বাড়েন!
bus-5             ফার্মগেট ফার্মগেট! দুই সিট খালি!
bus-6             গুলিস্তান! গুলিস্তান! উঠেন উঠেন!

[runover]
runover-1         আরে বাস!
runover-2         রিকশা! রিকশা!
runover-3         ওরে বাবা!
runover-4         ঢাকা শহরে হাঁটতে হইলে ডানে-বামে তাকাইতে হয়!
runover-5         ওরে মা গো, আমার কোমর!
runover-6         জেব্রা ক্রসিং ব্যবহার করুন — কে শোনে!

[demand0]
demand0-1         ভাই, একটু সালামি দিবেন?
demand0-2         অনুদান দিলে দোয়া করুম!

[demand1]
demand1-1         টাকা দিবি নাকি দোকান ভাঙবো?
demand1-2         বসের সালাম নিবি!

[demand2]
demand2-1         কথা না বাড়াইয়া ক্যাশ খোল!
demand2-2         এই বাজারে থাকতে হলে সালামি মাস্ট!

[demand3]
demand3-1         দেখ কী হয় দোকান না দিলে!
demand3-2         আজ সব ভাঙমু!

[hurt_bus]
hurt_bus-1        ওরে বাবারে! আমার কোমর!
hurt_bus-2        বাস না, ডাইনোসর!
hurt_bus-3        ড্রাইভার ভাই, চোখে দেখেন না?

[hurt_cng]
hurt_cng-1        সিএনজি! আমার ঠ্যাং!
hurt_cng-2        এইটা কি রাস্তা নাকি রেসকোর্স?
hurt_cng-3        ভাই, মিটার ফেলে আমাকে চাপা দিলেন!

[hurt_rickshaw]
hurt_rickshaw-1   রিকশাওয়ালা মামা, ঘণ্টা বাজান, চাপা দিয়েন না!
hurt_rickshaw-2   রিকশার ধাক্কাও কম না!
hurt_rickshaw-3   এইটা কি ট্যাংক নাকি?

[pothole]
pothole-1         ধুর! এই রাস্তা কবে ঠিক হইব?
pothole-2         এটা রাস্তা না, চাঁদের পৃষ্ঠ!
pothole-3         গর্তে পড়ে গেলাম, ক্ষতিপূরণ চাই!

[puddle]
puddle-1          ছিঃ! কাদা!
puddle-2          রাস্তা না সুইমিং পুল!
puddle-3          এক ফোঁটা বৃষ্টিতেই এই অবস্থা!

[mud]
mud-1             আমার জামা! কাদা ছিটাইল!
mud-2             দেখে চালান ভাই, দেখে চালান!

[beaten]
beaten-1          আর করুম না ভাই, আর করুম না!
beaten-2          আম্মা গো!
beaten-3          ভাই, আমি তো শুধু সালাম নিতে আসছিলাম!
beaten-4          আমি নির্দোষ, আমি ডাব খাইতে আসছিলাম!
beaten-5          ছবি তুইলেন না প্লিজ, মা দেখলে মারবে!
