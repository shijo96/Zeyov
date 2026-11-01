#!/usr/bin/env python3
"""
Auto Git Sync Daemon for Zeyov Shopify Theme
Monitors local repository changes and automatically commits & pushes to GitHub.
Also integrates remote changes (e.g. from Shopify admin) via pull --rebase.
"""

import os
import sys
import time
import subprocess
import argparse
from datetime import datetime

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK_INTERVAL_SECONDS = 10
DEBOUNCE_SECONDS = 8

def log(msg):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

def run_cmd(cmd, cwd=REPO_DIR):
    result = subprocess.run(cmd, cwd=cwd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def get_current_branch():
    code, stdout, _ = run_cmd("git rev-parse --abbrev-ref HEAD")
    return stdout if code == 0 else "main"

def get_changed_files():
    code, stdout, _ = run_cmd("git status --porcelain")
    if code != 0 or not stdout:
        return []
    lines = stdout.splitlines()
    files = []
    for line in lines:
        parts = line.strip().split(maxsplit=1)
        if len(parts) == 2:
            files.append(parts[1])
    return files

def sync_repository(changed_files):
    branch = get_current_branch()
    log(f"Detected {len(changed_files)} changed file(s): {', '.join(changed_files[:5])}{'...' if len(changed_files) > 5 else ''}")
    
    # 1. Fetch remote to check for any remote updates (e.g., from Shopify online store editor)
    log("Checking remote for updates...")
    run_cmd(f"git fetch origin {branch}")
    
    # 2. Check if we need to rebase remote changes
    code, behind_count, _ = run_cmd(f"git rev-list --count HEAD..origin/{branch}")
    if code == 0 and behind_count.isdigit() and int(behind_count) > 0:
        log(f"Remote has {behind_count} new commit(s). Rebasing onto origin/{branch}...")
        # Stash untracked/unstaged changes before rebase
        run_cmd("git stash -u")
        rebase_code, _, rebase_err = run_cmd(f"git pull --rebase origin {branch}")
        run_cmd("git stash pop")
        if rebase_code != 0:
            log(f"Rebase warning: {rebase_err}. Attempting to proceed...")

    # 3. Stage all changes
    log("Staging changes...")
    add_code, _, add_err = run_cmd("git add -A")
    if add_code != 0:
        log(f"Error staging files: {add_err}")
        return False

    # Check if there are still staged changes
    code, diff_staged, _ = run_cmd("git diff --staged --name-only")
    if not diff_staged:
        log("No staged changes to commit.")
        return True

    file_names = diff_staged.splitlines()
    summary = ", ".join(os.path.basename(f) for f in file_names[:4])
    if len(file_names) > 4:
        summary += f" (+{len(file_names) - 4} more)"
    
    commit_msg = f"Auto-sync: update {summary}"
    log(f"Committing: {commit_msg}")
    commit_code, _, commit_err = run_cmd(f'git commit -m "{commit_msg}"')
    if commit_code != 0:
        log(f"Error committing: {commit_err}")
        return False

    # 4. Push to remote
    log(f"Pushing to origin {branch}...")
    push_code, push_out, push_err = run_cmd(f"git push origin {branch}")
    if push_code == 0:
        log(f"Successfully pushed updates to GitHub origin/{branch}!")
        return True
    else:
        log(f"Error pushing to origin: {push_err or push_out}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Zeyov Auto Git Sync")
    parser.add_argument("--once", action="store_true", help="Run sync once and exit")
    args = parser.parse_args()

    log(f"Auto Git Sync started for repository: {REPO_DIR}")

    if args.once:
        changed = get_changed_files()
        if changed:
            sync_repository(changed)
        else:
            log("No local changes detected.")
        return

    log(f"Monitoring changes every {CHECK_INTERVAL_SECONDS}s (debounce {DEBOUNCE_SECONDS}s)...")
    try:
        while True:
            changed = get_changed_files()
            if changed:
                # Wait debounce seconds to allow user/editor to finish writing
                time.sleep(DEBOUNCE_SECONDS)
                # Re-check after debounce
                rechecked = get_changed_files()
                if rechecked:
                    sync_repository(rechecked)
            time.sleep(CHECK_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        log("Auto Git Sync stopped by user.")
    except Exception as e:
        log(f"Unexpected error: {e}")

if __name__ == "__main__":
    main()
