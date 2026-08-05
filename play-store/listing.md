# Google Play listing — Mytronome

Copy for the Play Console store listing, kept here so it versions with the app
rather than living only in the Console. Character limits are Play's.

The privacy claims below are lifted from [`web/public/privacy.html`](../web/public/privacy.html).
Change one and change the other — a store listing that contradicts the policy or
the Data safety form is a common rejection.

---

## App details

| Field          | Value                                    |
| -------------- | ---------------------------------------- |
| App name (30)  | `Mytronome`                              |
| Package name   | `ca.dovall.mytronome`                    |
| Category       | Music & Audio                            |
| Contact email  | contact@mytronome.dovall.ca              |
| Website        | https://mytronome.dovall.ca              |
| Privacy policy | https://mytronome.dovall.ca/privacy.html |

---

## Short description (80)

```
A precise metronome with presets, custom accents, and automatic tempo training.
```

79 characters.

---

## Full description (4000)

```
Mytronome is a metronome built for practising, not just for keeping time.

The click is scheduled against the audio clock rather than a screen timer, so it
holds steady while you play — no drift, no stutter when the device gets busy.

PRACTISE UP TO SPEED
Set the tempo ramp to add a few BPM every few bars and work a passage up to
tempo without stopping to change anything. The display pulses through the bar
before each increase, so a change never catches you out.

THE METER THE MUSIC NEEDS
Any time signature, simple or compound — 4/4, 7/8, 12/8. Tap any beat to accent
it, mute it, or leave it plain, and build the pattern the piece actually asks
for. Subdivide the beat into eighths, triplets, or sixteenths.

THREE WAYS TO SEE IT
A classic readout and slider, a vertical tower, or a swinging pendulum whose
weight you drag to set the tempo. The same metronome, in whichever shape you
read fastest.

SAVE WHAT WORKS
Save any setup as a named preset — tempo, meter, accents, subdivision, and the
ramp if you were using one. Keep them on your device, or connect Google Drive to
carry them between your phone, your desktop, and the web app.

MAKE IT YOURS
Light, dark, or follow the system. Pick any accent colour you like.

PRIVATE BY DESIGN
No account. No analytics, no tracking, no advertising. The metronome runs
entirely on your device. If you connect Google Drive, presets go to a private
app-only folder inside your own Drive — the app talks straight to Google, and
there is no Mytronome server involved. It cannot see any of your other Drive
files.

Mytronome is also available in any browser at mytronome.dovall.ca, and as a
desktop app.
```

---

## Release notes — 1.3.0 (500)

```
Tempo ramp: speed up automatically while you practise. Set how much to add and
how many bars between increases, and the display pulses through the bar before
each change. Ramp settings save with your presets, and any preset carrying one
is marked in the list.
```

---

## Data safety form

Answer the form from these facts — they're what the app does, not a
recommendation. Confirm each against the Console's current wording.

- **No data is collected or shared with the developer.** There is no Mytronome
  server in the shipped Android build; nothing is transmitted to us.
- **No analytics, telemetry, tracking, or advertising SDKs.**
- **Google Drive is optional and user-initiated.** Presets go to the
  `appDataFolder` — a private, app-scoped folder in the user's own Drive. The
  scope requested is `drive.appdata` only, so the app cannot read any other
  file in the account.
- **Access tokens on Android are session-only.** No refresh token is stored on
  the device.
- **No location, contacts, photos, microphone, or file access.**
- **Data is encrypted in transit** (HTTPS to Google's APIs).
- **Account deletion:** the app creates no account, so there is nothing to
  delete. Presets are removed by deleting them in-app or by revoking the app's
  Drive access in the Google account settings.

The only permission in the manifest is `INTERNET`.

---

## Content rating

Music metronome, no user-generated content, no ads, no in-app purchases, no
social features. Expect "Everyone" across the IARC boards, but the
questionnaire has to be filled in regardless — it's a release blocker.

---

## Assets still needed

None of these are in the repo yet.

| Asset              | Spec                                     |
| ------------------ | ---------------------------------------- |
| App icon           | 512×512 PNG, 32-bit, no alpha            |
| Feature graphic    | 1024×500 PNG or JPG, no alpha            |
| Phone screenshots  | ≥2 (up to 8), 16:9 or 9:16, min 1080px   |
| Tablet screenshots | only if a tablet form factor is declared |

Screenshot suggestions, one per idea so the set reads as a tour:

1. Classic layout, playing, beat indicator lit
2. Pendulum layout mid-swing
3. Ramp panel open with the trigger showing `+5/4`
4. Presets drawer with a ramp-badged preset
5. Settings modal, dark theme, non-default accent

Do not declare the Android TV form factor. The manifest carries Tauri's default
`LEANBACK_LAUNCHER` category, so the app is technically eligible, but opting in
pulls in a separate TV review with its own asset requirements.
