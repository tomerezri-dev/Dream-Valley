# Email templates (Supabase → Authentication → Emails → Templates)

On iPhone, a link in an email opens in Safari, not in the home-screen app, so the
email also contains a code to type into the app. Paste the same template into
**both** "Magic Link" and "Confirm signup".

**Subject**

```
קוד הכניסה שלך לרשימות
```

**Body** (switch the editor to Source/HTML if it offers one)

```html
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">
  <h2 style="margin:0 0 12px">כניסה לרשימות</h2>
  <p>הקוד שלך:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:8px 0" dir="ltr">{{ .Token }}</p>
  <p>או <a href="{{ .ConfirmationURL }}">לחצו כאן כדי להיכנס</a>.</p>
  <p style="color:#888;font-size:13px">אם לא ביקשתם להיכנס, אפשר להתעלם מהמייל הזה.</p>
</div>
```
