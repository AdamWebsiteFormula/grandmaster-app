# Upshot guide

Upshot is a meeting notepad for Mac, Windows and Linux. It records your calls without a bot joining, then writes clear notes. It's free, with no account and no API key.

**Download:** https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest (always the newest build)

**Contents**

1. [What you need](#1-what-you-need)
2. [Download the right file](#2-download-the-right-file)
3. [Install](#3-install)
4. [First run](#4-first-run)
5. [Record your first meeting](#5-record-your-first-meeting)
6. [After the meeting](#6-after-the-meeting)
7. [The meeting popup](#7-the-meeting-popup)
8. [Calendar (Mac)](#8-calendar-mac)
9. [Templates](#9-templates)
10. [Chat](#10-chat)
11. [Folders, search and locked notes](#11-folders-search-and-locked-notes)
12. [Copy, share and export](#12-copy-share-and-export)
13. [Import from Granola](#13-import-from-granola)
14. [Try Pro (test card, no real money)](#14-try-pro-test-card-no-real-money)
15. [Settings at a glance](#15-settings-at-a-glance)
16. [Keyboard shortcuts](#16-keyboard-shortcuts)
17. [Update Upshot](#17-update-upshot)
18. [Uninstall](#18-uninstall)
19. [Troubleshooting](#19-troubleshooting)
20. [Where your data lives](#20-where-your-data-lives)
21. [What's different from Granola](#21-whats-different-from-granola)
22. [Credits](#22-credits)

## 1. What you need

- One of these computers:
  - A Mac with macOS 15 or later. Apple silicon and Intel both work.
  - A 64-bit PC with Windows 10 or 11.
  - A 64-bit PC with Linux. Upshot is tested on Ubuntu 24.04.
- An internet connection. Transcription and notes run on Upshot's servers. On a Mac with Apple silicon, you can transcribe on the Mac instead.

You don't need an account or an API key.

## 2. Download the right file

Open the [download page](https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest). Under **Assets**, click the file for your computer.

| Your computer | File |
|---|---|
| Mac with Apple silicon (M1 or newer) | `Upshot_1.0.0_aarch64.dmg` |
| Mac with an Intel chip | `Upshot_1.0.0_x64.dmg` |
| Windows 10 or 11 | `Upshot_1.0.0_x64-setup.exe` |
| Ubuntu or Debian | `Upshot_1.0.0_amd64.deb` |
| Other Linux | `Upshot_1.0.0_amd64.AppImage` |

**Which Mac do I have?** Choose Apple menu › **About This Mac**. If you see **Chip** with "Apple M1" or newer, you have Apple silicon. If you see **Processor** with "Intel", you have an Intel Mac.

**Check the download (optional).** `SHA256SUMS.txt` on the same page lists a checksum for each file. On a Mac or Linux, run `shasum -a 256 <file name>`. On Windows, run `certutil -hashfile <file name> SHA256`. Then compare.

## 3. Install

### Mac

1. Open the DMG from your Downloads folder.
2. Drag **Upshot** onto **Applications**.
3. Open **Applications** and double-click **Upshot**.
4. macOS says it can't check Upshot for malware, because Upshot isn't notarized yet. Click **Done**.
5. Open **System Settings** › **Privacy & Security**. Scroll down to **Security**, then click **Open Anyway** next to Upshot.
6. Click **Open Anyway** (or **Open**) in the next window. If macOS asks, enter your Mac password.

You do this once. If you don't see **Open Anyway**, double-click Upshot again first. The button shows for about an hour after you try to open the app.

### Windows

1. Open `Upshot_1.0.0_x64-setup.exe` from your Downloads folder.
2. If you see "Windows protected your PC", click **More info**, then click **Run anyway**. Windows shows this because the installer isn't signed yet.
3. Follow the installer to the end.
4. Open **Upshot** from the Start menu.

### Linux

**Ubuntu or Debian:**

1. Open a terminal in the folder with the file, for example `cd ~/Downloads`.
2. Run `sudo apt install ./Upshot_1.0.0_amd64.deb`.
3. Open **Upshot** from your apps.

**Other Linux (AppImage):**

1. Open a terminal in the folder with the file.
2. Run `chmod +x Upshot_1.0.0_amd64.AppImage`.
3. Run `./Upshot_1.0.0_amd64.AppImage`.

If the AppImage doesn't start on Ubuntu, install FUSE 2 first. On Ubuntu 24.04, run `sudo apt install libfuse2t64`. On Ubuntu 22.04, run `sudo apt install libfuse2`.

## 4. First run

### Mac

Upshot walks you through a short setup.

1. **Start with permissions.**
   1. Click **Help Upshot listen to you**, then allow the microphone.
   2. Click **Help Upshot listen to others**, then allow system audio. This lets Upshot hear the other people on your call.
   3. Optional: click **Help Upshot read meeting details**, then allow Accessibility. Upshot uses it to read meeting titles and names.
   4. Click **Continue**.
2. **Set up transcription.** Upshot checks your Mac and gets transcription ready. When it's ready, click **Continue**.
3. **Connect calendar.** Click **Connect calendar** and allow access, or click **Skip**.
4. **Bring your meeting history.** This step shows only if Upshot finds another meeting notes app, such as Granola. Import your meetings, or click **Skip for now**.
5. **Ready to go.** Click **Open Upshot**.

If you click **Set up later**, Upshot can't record until both are on. You can turn them on later in **Settings** › **General**.

### Windows and Linux

Setup is shorter. If Upshot finds another meeting notes app, it offers to import your meetings. Click **Skip for now** to skip it. Then click **Open Upshot**.

On Windows, make sure desktop apps can use the microphone: **Settings** › **Privacy & security** › **Microphone** › **Let desktop apps access your microphone**.

## 5. Record your first meeting

1. Join your call in Zoom, Google Meet, Microsoft Teams, Slack or any other app.
2. Start recording in one of these ways:
   - Click **Take notes** on the popup that shows when the call starts. See [The meeting popup](#7-the-meeting-popup).
   - Click the orange **New note** button at the top right.
   - Press ⌘N on a Mac, or Ctrl+N on Windows and Linux.
3. Optional: type notes as you talk. Upshot uses them to shape the summary.
4. Watch the recording bar at the bottom. **You** moves when you talk. **Them** moves when the other people talk.
5. When the meeting ends, click **Stop**.

To open a note without recording, press ⇧⌘N on a Mac, or Ctrl+Shift+N on Windows and Linux.

## 6. After the meeting

**The summary.** Upshot writes it after you click **Stop**, when it heard about 30 words or more. That's about 10 to 15 seconds of normal talk. If it heard less, you see "No summary yet." Click **Generate summary** to write one from what's there, including your typed notes.

**Change the template.** At the top of the summary, click the template name. Pick another template, and Upshot rewrites the summary with it.

**The transcript.** Click **Transcript** at the bottom of the note. You see who said what, with times. Click any word to hear that moment. To go back, click **Summary**, or **My notes** if there's no summary yet.

**Keep recording.** Click **Resume** to record more in the same note.

**Ask about the meeting.** Click **Ask anything** at the bottom, or press ⌘J (Ctrl+J on Windows and Linux). Type your question.

**Follow-up email.** Click **Draft follow-up email** at the bottom of the note.

## 7. The meeting popup

When an app starts using your microphone, Upshot shows a popup with the Upshot logo. The title says **Meeting detected**, and the popup names the app. It says **Call detected** for FaceTime and WhatsApp, and **Huddle detected** for Slack.

- Click **Take notes** to start recording.
- Click **Ignore** to stop Upshot from asking about that app.

After a popup, Upshot asks about the same app again only after that app's microphone has been off for a minute. This way a new call gets a popup, and a quick rejoin doesn't.

To change the popup, go to **Settings** › **Notifications**:

- **Microphone detection** turns the popup on or off.
- **Detection delay** sets how long the microphone must be on before Upshot asks. The default is 1 second.
- **Exclude apps from detection** lists the apps Upshot never asks about. Remove an app here to undo **Ignore**.
- **Respect Do Not Disturb** (Mac) hides the popup while a Focus is on.

## 8. Calendar (Mac)

Upshot reads the calendars on your Mac: Google, Outlook, iCloud and others.

1. Go to **Settings** › **Calendar**.
2. Under **Calendar access**, click **Allow access**. If you said no before, click **Open System Settings** and turn on Upshot there.
3. Optional: to add a Google or Outlook account, click **Add account**. This opens **Internet Accounts** in System Settings, where you sign in.

Home then shows **Coming up**. Click **Record** next to a meeting to start its note. You also get reminders before meetings start.

Windows and Linux don't have a calendar in Upshot 1.0. Google and Outlook sign-in on every computer is on the [roadmap](ROADMAP.md).

## 9. Templates

A template sets the shape of the summary. Upshot comes with 9, including general meeting, 1:1, sales call and interview.

- **Pick one for a note:** at the top of the summary, click the template name, then pick a template.
- **See all templates:** in the same menu, click **All templates…**.
- **Make your own:** in the same menu, click **New template**.

## 10. Chat

Ask questions about your meetings in plain words.

- **Across all meetings:** type in the chat box on **Home**, or click **Chat** in the sidebar. The Chat page keeps your recent chats and has ready-made recipes.
- **About one meeting:** open the note and click **Ask anything** (⌘J or Ctrl+J).

The model menu in each chat box says **Auto**. Auto uses Claude Sonnet 5.5. To pick a different model, see [Try Pro](#14-try-pro-test-card-no-real-money).

## 11. Folders, search and locked notes

**Make a folder.**

1. In the sidebar, next to **Folders**, click **+** (**New folder**).
2. Type a name, then press Return (Enter on Windows and Linux).

**Add a note to a folder.** Right-click the note in the list, then click **Add to folder…**. Or open the note and click **Add to folder** under its title.

**Rename or delete a folder.** Open the folder, click **Folder actions** (⋯), then click **Rename** or **Delete**.

**Search.** Press ⌘K (Ctrl+K on Windows and Linux), or click **Search** in the sidebar. Search looks inside your notes and your settings.

**Lock a note.** Right-click the note in the list, then click **Lock note**. A locked note never goes to chat, MCP or export. To turn the lock off, right-click the note again.

## 12. Copy, share and export

- **Copy the transcript:** in the transcript, click **Copy transcript**.
- **Copy the notes:** click **Share** at the top of the note, then click **Copy notes**.
- **Export:** click **Share**, then click **Export…**. Pick PDF, text (.txt), Markdown (.md) or Org (.org).

## 13. Import from Granola

Bring your Granola meetings into Upshot. You sign in to Granola. You don't need an Upshot account.

1. Go to **Settings** › **Connectors**. Find **Imports**.
2. Next to Granola, click **Connect**, then sign in to Granola in your browser.
3. Click **Sync now**.

## 14. Try Pro (test card, no real money)

Everyone starts on Free. Free already gives you recording, transcripts, summaries and chat. Pro adds one thing: you pick the chat model from this week's models from Anthropic, OpenAI and Google.

Pro runs in Stripe's test mode, so nobody is charged. The prices show what Pro will cost: $11 a month billed yearly ($132), or $14 billed monthly.

1. Go to **Settings** › **Plan**, then click **Upgrade to Pro**. Or click **Auto ⌄** in a chat box, then click **Upgrade to pick a model**.
2. Enter an **Email** and a **Password** with 8 or more characters. Click **Create account and continue**. You don't need to confirm the email.
3. Checkout opens in your browser. Enter the test card `4242 4242 4242 4242`, any future date, any 3-digit CVC, and any name and ZIP code. Click **Subscribe**.
4. Go back to Upshot. When the payment goes through, you see **You're on Upshot Pro**.
5. Click **Auto ⌄** in any chat box and pick a model.

**Manage or cancel:** **Settings** › **Plan** › **Manage subscription**. This opens Stripe's billing page.

**Sign out:** click **Sign out** at the bottom of the Settings sidebar.

**Delete your account:** **Settings** › **Profile** › **Delete account…**. This cancels the subscription and removes the account. Your notes stay on your computer.

## 15. Settings at a glance

Open Settings from the sidebar. On a Mac, you can also press ⌘,.

| Page | What's there |
|---|---|
| **General** | Main language, theme (Light, Dark, or match your computer), privacy and permissions |
| **Profile** | Your contact card, meeting stats, and your Pro account if you have one |
| **Plan** | Free or Pro, **Upgrade to Pro**, **Manage subscription** |
| **Meetings** | **Start when meeting begins**, **Stop when meeting ends**, **Show floating bar**, and **Audio file retention** (from **Don't save** to **Forever**) |
| **Transcription** | Which engine transcribes your meetings |
| **Calendar** (Mac) | Calendar access and accounts |
| **Notifications** | The meeting popup and other alerts |
| **Connectors** | Imports, plus MCP, the Upshot CLI and webhooks for developers |

## 16. Keyboard shortcuts

| Action | Mac | Windows and Linux |
|---|---|---|
| New note and start recording | ⌘N | Ctrl+N |
| Blank note, no recording | ⇧⌘N | Ctrl+Shift+N |
| Search notes and settings | ⌘K | Ctrl+K |
| Ask about this note | ⌘J | Ctrl+J |
| Open Settings | ⌘, | None |

## 17. Update Upshot

Upshot doesn't update itself yet. To get the newest build, download it again from the [download page](https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest). Your notes stay.

- **Mac:** quit Upshot (⌘Q). Open the new DMG and drag **Upshot** onto **Applications**. Click **Replace**. macOS may ask you to click **Open Anyway** again. If macOS asks for your password so Upshot can use its keychain items, enter it and click **Always Allow**.
- **Windows:** run the new installer and follow it to the end.
- **Ubuntu or Debian:** run `sudo apt install --reinstall ./Upshot_1.0.0_amd64.deb`.
- **AppImage:** replace the old file with the new one.

## 18. Uninstall

- **Mac:** quit Upshot, then drag **Upshot** from **Applications** to the Trash.
- **Windows:** **Settings** › **Apps** › **Installed apps**. Find **Upshot**, click **⋯**, then click **Uninstall**.
- **Ubuntu or Debian:** run `sudo apt remove upshot`.
- **AppImage:** delete the file.

Uninstalling keeps your notes. To delete them too, delete the `anarlog` folder listed in [Where your data lives](#20-where-your-data-lives). This can't be undone.

## 19. Troubleshooting

**macOS says "Upshot" Not Opened, or Apple could not verify Upshot.** Follow the [Mac install steps](#mac) to click **Open Anyway**.

**Windows says "Windows protected your PC".** Click **More info**, then click **Run anyway**.

**The AppImage doesn't start.** Install FUSE 2 (see [Linux](#linux)), or use the `.deb` file on Ubuntu or Debian.

**The recording bar says "Can't hear the other side. Check the system audio permission."** (Mac)

1. Open **System Settings** › **Privacy & Security** › **Screen & System Audio Recording**.
2. Under **System Audio Recording Only**, turn on **Upshot**.
3. If macOS asks, click **Quit & Reopen**.

**The recording bar says "Can't hear the other side. Check your computer's sound output."** (Windows and Linux) Play the call through this computer's speakers or headphones. A call on your phone can't reach Upshot.

**The You meter doesn't move.** Check the microphone permission. On a Mac: **System Settings** › **Privacy & Security** › **Microphone** › turn on **Upshot**. On Windows: **Settings** › **Privacy & security** › **Microphone**.

**No summary after Stop.** Upshot heard fewer than about 30 words. Click **Generate summary**.

**No popup when a call starts.**

- Check that **Microphone detection** is on in **Settings** › **Notifications**.
- Check that the app isn't in **Exclude apps from detection**.
- On a Mac, a Focus hides the popup while **Respect Do Not Disturb** is on.
- After a popup, Upshot waits until that app's microphone has been off for a minute before it asks again.
- You can always press ⌘N (Ctrl+N) to record.

**"Upshot AI is busy. Try again in a minute."** Many people are using Upshot AI right now. Wait a minute, then try again.

**"Upshot AI is out of credit for now. Try again later."** Upshot's AI budget ran out for now. Try again later.

**"This meeting is too long for Upshot AI."** The meeting is longer than Upshot AI can summarize in one go.


## 20. Where your data lives

Your notes, transcripts and recordings stay on your computer, in the `anarlog` folder:

- Mac: `~/Library/Application Support/anarlog/`
- Windows: `%APPDATA%\anarlog\`
- Linux: `~/.local/share/anarlog/`

While you record, audio passes through Upshot's proxy to Deepgram for the transcript, and nothing is stored. Summaries and chat send the note text through Upshot's proxy to OpenRouter. Pro keeps only your email and your Stripe customer ID. The [README](README.md) has the full details.

## 21. What's different from Granola

- Upshot keeps your audio, so you can click any word to hear it. You can also edit the transcript.
- It runs on Linux too.
- It works with no account and no key. Transcription uses Deepgram Nova 3, and summaries use Claude Sonnet 5.5.
- It warns you during the call if it can't hear the other side.
- On a Mac, it reads all your calendars at once: Google, Outlook and iCloud.
- It can import your Granola meetings.

## 22. Credits

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) by Fastrepl (MIT). It ships [sqlite-sync](https://github.com/sqliteai/sqlite-sync) unmodified (Elastic License 2.0). Fonts: Geist and Bricolage Grotesque (SIL Open Font License).

Sources for these steps: Apple Support, "Safely open apps on your Mac"; AppImage documentation, "FUSE"; Upshot's own screens. The steps follow Google's developer documentation style guide for procedures.
