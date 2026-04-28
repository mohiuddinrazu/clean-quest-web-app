# CleanQuest - House Cleaning Tracker

A modern, mobile-optimized web app for tracking house cleaning tasks with **real-time Firebase sync** and gamification. Perfect for households to coordinate cleaning schedules with live updates!

## New Features (Latest Version)

### **Real-Time Firebase Sync**
- All changes sync instantly across all devices
- No more confusion about what's been done
- See live updates when housemates complete tasks

### **Multi-User Competition**
- Each person sets their name
- Individual points tracked for each user
- **Team vs Dirt Monster**: Combined household score competes against the monster
- Monthly leaderboard shows who's contributing most

### **Backdate Completions**
- Mark tasks complete with any date
- Perfect for when you forget to update the app
- Edit or delete completion history

### **Improved Task Management**
- Click checkbox to mark complete (shows date picker)
- Unmark tasks if clicked by mistake
- View complete history with user names and dates
- Edit last completion date

---

## Core Features

### Task Management
- ** Mobile-First Design**: Optimized for smartphones
- ** Fresh, energetic color scheme  
- ** Pre-configured Rooms**: Kitchen, Bathroom, Bedroom, Living Room, Laundry
- ** Custom Rooms**: Add your own with emoji icons
- ** Smart Scheduling**: Tasks show Fresh, Due Soon, or Overdue
- ** Interactive Stats**: Click stats to highlight matching tasks
- ** Auto-Save**: All data synced to Firebase

### Task Features
- ** Custom Frequencies**: Daily to quarterly, or any custom number of days
- ** Progress Bars**: Visual indicators showing task status
- ** Days Counter**: Shows days left or days overdue
- ** Cleaning History**: Full history with dates and user names
- ** Backdate Support**: Mark tasks complete for past dates

### The Monthly Competition
- ** Team Score**: Combined points from all household members
- ** Dirt Monster**: Monster progresses steadily each day
- ** Individual Leaderboard**: See who's cleaning the most
- ** Victory Conditions**: Defeat the monster by month's end
- ** Auto-Reset**: Competition resets automatically each month
- ** Live Updates**: See teammates' progress in real-time

---

## Quick Start

### Option 1: Firebase Hosting (Recommended for Households)

**Pros**: Real-time sync, live updates, works on all devices
**Best for**: Households who want seamless collaboration

### Option 2: GitHub Pages (No Sync)

**Pros**: Simple, free hosting, no setup
**Cons**: Each device has separate data (no sync)
**Best for**: Single users or testing

1. Create a new **public** repository on GitHub
2. Upload the 3 files (index.html, app.js, README.md)
3. Go to Settings → Pages
4. Select "Deploy from a branch" and choose `main` + `/root`
5. Your app will be live at `https://[username].github.io/[repo-name]/`

---

## How to Use

### First Time Setup

1. **Open the app** on your device using the Firebase/GitHub URL
2. **Create Account (Firebase) & Set your name**: Click the user badge (👤) next to CleanQuest title
3. **Start completing tasks!**

### Basic Operations

**Marking Tasks Complete**
1. Click the checkbox next to any task
2. Choose the completion date (defaults to today)
3. Click "Mark Complete"
4. You'll earn a point and see a celebration!

**Unmarking Tasks**
- Click the checkbox again
- Confirm you want to unmark it
- Your point will be removed

**Viewing Task History**
- Click anywhere on a task card (except buttons/checkbox)
- See all completion dates and who completed them
- Edit or delete the last completion if needed

**Filtering Tasks**
- Click **Clean**, **Soon**, or **Overdue** stats to highlight tasks
- Matching tasks pulse with blue outline
- Click again to clear filter

**The Competition**
- Click the dust counter in the header
- View team score vs dirt monster
- See individual leaderboard
- Check days remaining in month

### Managing Rooms & Tasks

**Adding New Rooms**
1. Click **"+ Add New Room"**
2. Enter room name
3. Choose an emoji icon
4. Click **Create Room**

**Adding Tasks**
1. Click **"+ Add Task"** under any room
2. Enter task name
3. Choose frequency (or select Custom)
4. Click **Save Task**

**Editing Tasks**
- Click ⚙️ icon next to task
- Update name or frequency
- Click **Save Task**

**Deleting**
- Tasks: Click X icon next to task
- Rooms: Click X icon next to room name

---

## Understanding Task Status

### Visual Indicators
- ** Blue (Fresh)**: Recently completed, in first 70% of cycle
- ** Orange (Due Soon)**: Approaching due date (70%+ of cycle)
- ** Red (Overdue)**: Past due date

### Progress Bars
Each task shows a progress bar:
- **0%**: Just completed
- **70%**: Enters "Due Soon" status
- **100%**: Becomes "Overdue"

### Status Messages
- **" 5d left"**: Fresh, 5 days until due soon
- **" 2d left"**: Due soon, 2 days until overdue
- **" 3d overdue"**: Overdue by 3 days
- **" Never done"**: New task, never completed

---

## The Competition Explained

### How It Works

**Team Score**
- Every household member earns points by completing tasks
- Points are added to team total
- Everyone can see who's contributing

**Dirt Monster**
- Progresses steadily each day
- Progress based on: (current day / days in month) × total possible cleanings
- Same for everyone - a fair opponent!

**Victory**
- Have more points than the monster by month's end
- Resets automatically on the 1st of each month
- Previous month's winner is announced

### Strategy Tips
- Complete tasks early in the month
- Don't let tasks go overdue
- Coordinate with housemates on the leaderboard
- Regular, consistent cleaning beats the monster!

---

## Real-Time Sync Features

When using Firebase:
-  Task completions appear instantly for everyone
-  New tasks and rooms sync immediately
-  Competition scores update live
-  User names visible to all
-  History shows who completed what and when
-  No need to refresh - updates are automatic

---

##  Data & Privacy

### What's Stored
- Room configurations
- All tasks and completion status
- Task history with dates and user IDs
- User names and points
- Competition progress
- UI preferences (collapsed rooms)

### Firebase Setup
- Stored in Firebase Realtime Database
- Real-time sync across all devices/ accounts
- Accessible only to people with URL
- Authentication required by default

### Privacy
- User names are chosen by each person
- Emails not visible to other users
- No external tracking or analytics
- Data stays within your Firebase project
- Only people with your URL can access

---

##  Troubleshooting

### Tasks Not Syncing?
1. Check you're using Firebase (not GitHub Pages)
2. Verify Firebase config in app.js
3. Check browser console (F12) for errors
4. Confirm database rules allow read/write

### Checkbox Not Working?
- Fixed in this version!
- Make sure you're using the latest app.js
- Should show date picker when you click checkbox

### Competition Not Updating?
- Refresh the page
- Check that user names are set
- Verify task completions are being recorded

### Lost Data?
- With Firebase, data is stored in the cloud
- Check Firebase Console → Realtime Database
- Ensure you're using the same Firebase project

### Performance Issues?
- Clear browser cache
- Check internet connection
- Try a different browser

---

##  Customization

### Changing Colors
Edit CSS variables in `index.html`:
```css
:root {
    --accent-orange: #ff9933;
    --accent-blue: #3399ff;
    --accent-dirty: #FF6B6B;
}
```

### Adding More Emojis
Edit `EMOJI_OPTIONS` array in `app.js`

### Changing Competition Rules
Edit `updateCompetitionProgress()` function in `app.js`

---

##  Browser Compatibility

Tested and working on:
-  Chrome (Mobile & Desktop)
-  Safari (Mobile & Desktop)  
-  Firefox (Mobile & Desktop)
-  Edge (Desktop)

---

##  Firebase Costs

Free tier includes:
- **Hosting**: 10 GB storage, 360 MB/day transfer
- **Realtime Database**: 1 GB storage, 10 GB/month download

A household cleaning app will stay well within these limits!

---


---

**Made with ❤️ for clean homes and happy households!**

Enjoy CleanQuest
