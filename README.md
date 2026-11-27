# דקות ראשונות · First Minutes

מדריך עזרה ראשונה שעובד בלי אינטרנט, לדקות שלפני שהעזרה מגיעה.
An offline first-aid guide for the minutes before help arrives.

רוב האנשים שנמצאים ליד מקרה חירום רפואי רוצים לעזור ולא יודעים מה לעשות.
האפליקציה נותנת הוראות קצרות וברורות, בעברית ובאנגלית, לעשרה מצבים:

| | |
|---|---|
| 🫀 לא מגיב ולא נושם (החייאה + מטרונום 110 בדקה) | 🐝 תגובה אלרגית קשה |
| 😮 חנק | ⚡ פרכוס |
| 🩸 דימום קשה | 🔥 כוויה |
| 🧠 חשד לשבץ | 🛌 מחוסר הכרה אבל נושם |
| 💔 חשד להתקף לב | ☠️ הרעלה או מנת יתר |

## Features

- Works offline after the first visit (service worker) and installs to the home screen (PWA).
- One-tap call button; the emergency number is guessed from the time zone and can be changed in ⚙.
- CPR metronome: audible beep and visual pulse at 110/min, 1–30 count, timer, a reminder to swap rescuers every 2 minutes, and the screen stays awake.
- Read-aloud of the steps where the browser has a matching voice.
- Hebrew (RTL) and English, light and dark mode, large touch targets.
- No build step, no dependencies, no tracking, no network requests.

## Run

Static files only. Serve the folder with any web server:

```sh
python3 -m http.server 8000
```

To publish, enable GitHub Pages for this repository (Settings → Pages → deploy from branch, root folder).

## Content and disclaimer

The instructions follow widely accepted lay-rescuer guidance (ILCOR, European Resuscitation
Council, American Heart Association, Red Cross), including the 2025 updates (for example,
no two-finger compressions for infants). They have **not** been reviewed by a medical
professional for this project. This is not a substitute for a first-aid course, for medical
advice, or for the instructions of an emergency dispatcher. In an emergency, always call first.

All content lives in the `TOPICS` and `UI` objects in `index.html`; adding a language means
adding one more key next to `he` and `en`.

---

# קו · Kav (transit app) — `transit/`

A public transit app for iPhone, in the same no-build style: plan trips by bus, train and light
rail, see live departures at any stop, and follow step-by-step guidance that tells you when to
get off. Hebrew (RTL) and English, light and dark mode.

**Install on iPhone:** open `https://<your-pages-site>/transit/` in Safari → Share → *Add to Home Screen*.
It then opens full-screen like a native app and can use your location.

## Features

- **Map** with your location and every stop around you (zoom in to see them); tap a stop for departures.
- **Trip planner**: search places, addresses or stops, or drop a pin on the map; leave now, depart at, or arrive by.
  Results show line badges, walking minutes, transfers and when the first vehicle leaves.
- **Itinerary** drawn on the map, with every stop along each ride.
- **Live guidance** (▶ Start): walk-to-stop distance, countdown to the bus, "get off in N stops",
  and a spoken alert one stop before yours. Times refresh every 30 s; the screen stays awake.
- **Stop departures** refresh every 30 s, with real-time and delay labels where the operator publishes them.
- **Line view**: the whole trip with passed stops greyed out.
- **Home, Work, saved stops and recent searches**, kept on the device.

## Data

Routing, stops and live times come from [Transitous](https://transitous.org), a free,
community-run [MOTIS](https://github.com/motis-project/motis) server built on open GTFS feeds
(including Israel's Ministry of Transport feed) and OpenStreetMap. No API key is needed.
Transitous is a volunteer service meant for non-commercial use; read its
[usage policy](https://transitous.org/api/) before publishing the app widely.
Map tiles: © OpenStreetMap contributors, © CARTO. Map library: Leaflet 1.9.4 (vendored in `transit/vendor/`).
