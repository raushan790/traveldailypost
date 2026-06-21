import subprocess
import time
import json
import sys

def get_target_tabs():
    script = """
    set output to ""
    tell application "Google Chrome" to activate
    delay 0.5
    tell application "Google Chrome"
        set allWindowIds to id of every window
    end tell
    
    repeat with wId in allWindowIds
        tell application "Google Chrome"
            set index of window id wId to 1
        end tell
        delay 0.5
        
        set isActiveProfile to false
        tell application "System Events"
            tell process "Google Chrome"
                repeat with m in menu items of menu 1 of menu bar item "Profiles" of menu bar 1
                    try
                        if value of attribute "AXMenuItemMarkChar" of m is not missing value then
                            set profileName to name of m
                            if profileName is "RAM EKWAL" or profileName is "Ram Ekwal" or profileName is "Raushan" then
                                set isActiveProfile to true
                            end if
                            exit repeat
                        end if
                    end try
                end repeat
            end tell
        end tell
        
        if isActiveProfile then
            tell application "Google Chrome"
                set w to window id wId
                repeat with t in tabs of w
                    set theUrl to URL of t
                    if theUrl contains "travelandtourworld.com/news/article/" or theUrl contains "simpleflying.com/" then
                        set tId to id of t
                        set output to output & wId & "," & tId & "," & theUrl & "\\n"
                    end if
                end repeat
            end tell
        end if
    end repeat
    return output
    """
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    tabs = []
    seen_urls = set()
    for line in result.stdout.strip().split("\n"):
        if line.strip():
            parts = line.split(",", 2)
            if len(parts) >= 3:
                url = parts[2]
                if url not in seen_urls:
                    seen_urls.add(url)
                    tabs.append((parts[0], parts[1], url))
    return tabs

def read_tab(win_id, tab_id):
    subprocess.run("pbcopy < /dev/null", shell=True)
    
    script = f"""
    tell application "Google Chrome"
        activate
        try
            set index of window id {win_id} to 1
            set targetIdx to 0
            set idx to 1
            repeat with t in tabs of window id {win_id}
                if (id of t as string) is "{tab_id}" then
                    set targetIdx to idx
                    exit repeat
                end if
                set idx to idx + 1
            end repeat
            
            if targetIdx > 0 then
                set active tab index of window id {win_id} to targetIdx
            end if
        end try
        delay 0.5
    end tell
    
    tell application "System Events"
        -- ensure Chrome is the frontmost app
        set frontmost of process "Google Chrome" to true
        delay 0.5
        keystroke "a" using command down
        delay 0.5
        keystroke "c" using command down
        delay 0.8
    end tell
    """
    subprocess.run(["osascript", "-e", script])
    time.sleep(0.5)
    clip = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
    return clip

tabs = get_target_tabs()
print(f"Found {len(tabs)} tabs")

# Read the existing scraped_tabs if any to skip the ones already successfully scraped
try:
    with open("scratch/scraped_tabs.json", "r") as f:
        existing_data = json.load(f)
except Exception:
    existing_data = []

existing_urls = {item["url"] for item in existing_data if len(item.get("text", "")) > 400}

data = existing_data.copy()

for w, t, url in tabs:
    if url in existing_urls:
        print(f"Skipping already scraped: {url}")
        continue
        
    print(f"Reading {url}")
    text = read_tab(w, t)
    
    if len(text.strip()) > 400:
        print(" -> Success")
        data.append({"url": url, "text": text})
    else:
        print(" -> Failed to capture correct text. Retrying...")
        time.sleep(1)
        text = read_tab(w, t)
        if len(text.strip()) > 400:
             print(" -> Success on retry")
        else:
             print(" -> Still failed")
        data.append({"url": url, "text": text})

with open("scratch/scraped_tabs.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"Done. Total items in file: {len(data)}")
