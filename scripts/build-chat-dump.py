#!/usr/bin/env python3
"""Build chat feature dump for Claude review."""
import os

ROOT = "/Users/phil/REWIND"
OUT = os.path.join(ROOT, "REWIND-CHAT-FEATURE.txt")

FILES = [
    ("src/components/AdminChatPanel.jsx", "src/components/AdminChatPanel.jsx"),
    ("src/components/ChatBubble.jsx", "src/components/ChatBubble.jsx"),
    ("api/server.js (chat routes only)", "api/server.js"),
    ("api/chat-routes.js", "api/chat-routes.js"),
]

PROMPT = """================================================================================
  REWIND STORE — COMPLETE CHAT FEATURE FOR CLAUDE REVIEW
================================================================================

Below is the complete chat feature code for a vintage streetwear e-commerce store
called REWIND. It has two parts:

1. **AdminChatPanel.jsx** — Admin panel chat tab where admins see customer sessions
   and reply to messages (server-side rendered chat).
2. **ChatBubble.jsx** — Client-side floating chat bubble that appears on every page.
   Customers can start a chat, send messages, and get email verification for access.
3. **api/server.js** — The backend routes for chat (lines 980-1065).
4. **api/chat-routes.js** — Separate chat route module.

The chat system works like this:
- Customer clicks the chat bubble on any page
- They enter their email to start chatting
- A session is created, and messages are stored in Supabase
- Admin sees sessions in the admin chat tab and can reply
- Admin can block users by email or IP
- Polling interval: every 8 seconds

CURRENT BEHAVIOR / KNOWN ISSUES (already addressed):
- Admin chat polling runs every 8 seconds
- Chat sessions are listed in creation order (newest first for admin)
- Copy email button shows "Copied" inline feedback instead of alert()
- Blocked emails/IPs are checked before allowing chat
- Rate limiting on verify-code endpoint (10 attempts per 5 minutes per email)

IMPORTANT: DO NOT re-suggest adding these — they are already implemented:
- Message timestamps shown
- Session list sorted by most recent message
- Unread message count / badge
- Auto-scroll to latest message
- Typing indicator
- Email verification flow
- Block email/lP buttons work

PLEASE REVIEW THIS CHAT FEATURE AND SUGGEST IMPROVEMENTS:

Here are specific areas the user wants your feedback on:

### 1. Admin closes a chat (required feature)
When admin closes a chat session, the customer should:
- See a message in the chat: "Admin has closed this chat."
- Two buttons appear below that message:
  1. "Start new chat" — creates a fresh session
  2. "Continue anyway" — reopens the closed session

### 2. Security review
- Can a customer spoof another customer's email?
- Is the rate limiting adequate for all endpoints?
- Is the email verification code generation secure?
- Can an attacker flood the chat system?
- Admin session hijacking risks in chat context?

### 3. UX improvements
- Are loading states adequate?
- What happens when the server is down?
- Is mobile responsiveness good?
- Are error messages clear enough?
- Is the first-time user experience good?

### 4. Feature gaps
- Agent name/identification in admin replies?
- Pre-written quick replies for common questions?
- File/image sharing in chat?
- Chat history search for admin?
- Auto-close inactive sessions after N hours?

### 5. Backend issues
- Are there race conditions in message handling?
- Is the Supabase query efficient?
- Are delete/mark-as-read operations safe?

Provide findings as:
  P0 = Critical — fix immediately
  P1 = Important — fix soon
  P2 = Nice-to-have — when time permits

For each finding include:
  - Severity (P0/P1/P2)
  - Category
  - File:line
  - Description
  - Specific code fix

================================================================================
  SOURCE FILES
================================================================================

"""

with open(OUT, 'w') as f:
    f.write(PROMPT)

for label, relpath in FILES:
    fullpath = os.path.join(ROOT, relpath)
    try:
        with open(fullpath) as fh:
            content = fh.read()
        lines = content.count('\n')
        
        # For server.js, only extract chat-related lines
        if 'server.js' in relpath:
            chat_start = content.find('// ── Chat verification')
            if chat_start < 0:
                chat_start = content.find('/api/chat/')
            if chat_start < 0:
                chat_start = content.find('verify-code')
            if chat_start >= 0:
                # Get from that point to ~200 lines after
                content = content[chat_start:chat_start + 15000]
                lines = content.count('\n')
        
        with open(OUT, 'a') as f:
            f.write(f"\nFILE: {label}  ({lines} lines)\n")
            f.write("=" * 80 + "\n\n")
            f.write(content)
            f.write("\n")
    except FileNotFoundError:
        with open(OUT, 'a') as f:
            f.write(f"\nFILE: {label}  [NOT FOUND]\n")

size = os.path.getsize(OUT)
with open(OUT) as f:
    total_lines = f.read().count('\n')
print(f"Written: {OUT}")
print(f"Size: {size/1024:.0f} KB")
print(f"Lines: {total_lines}")
