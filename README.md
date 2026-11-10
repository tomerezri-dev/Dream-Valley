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
Council, American Heart Association, Red Cross). They have **not** been reviewed by a medical
professional for this project. This is not a substitute for a first-aid course, for medical
advice, or for the instructions of an emergency dispatcher. In an emergency, always call first.

All content lives in the `TOPICS` and `UI` objects in `index.html`; adding a language means
adding one more key next to `he` and `en`.
