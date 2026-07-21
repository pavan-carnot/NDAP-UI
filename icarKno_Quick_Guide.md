# icarKno™ — User Guide
**Knowledge Intelligence Platform · Powered by Carnot Research**

---

## 1. Login

Enter your username and password, then click **Sign In**.

> 📸 **[SCREENSHOT — Login page]**

---

## 2. Navigation

After login, use the **top navigation bar** to move between the three sections:

- **Knowledge Agent** — Ask questions about government datasets
- **Spatial Analytics** — View data on an interactive India map
- **Admin & Data** — Upload documents and monitor the system (admins only)

> 📸 **[SCREENSHOT — Navigation bar with all three tabs]**

---

## 3. Knowledge Agent (Chat)

This is the main feature. Type a question in the input bar at the bottom and press **Enter**.

> 📸 **[SCREENSHOT — Chat page with a question typed in the input bar]**

### What you get back:
- **Answer** with inline citation numbers `[1]`, `[2]`
- **Source chips** showing which document and page the answer came from
- Click a citation to open the source PDF on the right panel

> 📸 **[SCREENSHOT — Chat response showing answer text, citation numbers, source chips, and PDF viewer on the right]**

### Three agent modes (toggle buttons in the input bar):

| Mode | How to use | Output |
|---|---|---|
| **Standard** | Default, no toggle needed | Research answer with citations |
| **Emailing Agent** | Toggle ON before sending | Formatted email draft (Subject, Body, Signature) |
| **Generate Report** | Toggle ON before sending | Downloadable DOCX / PDF report |

> 📸 **[SCREENSHOT — Input bar showing the Emailing Agent and Generate Report toggle buttons]**

> 📸 **[SCREENSHOT — Generated report card with View Document and Download buttons]**

### Left Sidebar:
- **+ New Analysis** — Start a fresh conversation
- **Recent Queries** — Click any past question to revisit it
- **System Status** — Green dots = services healthy; Red = contact admin

> 📸 **[SCREENSHOT — Left sidebar showing New Analysis button, recent queries, and system status indicators]**

---

## 4. Spatial Analytics (Map)

Go to **Spatial Analytics** to view government data on a color-coded India state map.

- Use the **Dataset dropdown** to switch between datasets
- Use the **Palette selector** to change the color scheme
- **Hover** over any state to see its name, value, and unit

> 📸 **[SCREENSHOT — Full map view with a dataset loaded, hover tooltip visible on a state, and legend in the corner]**

---

## 5. Admin & Data (Admins Only)

Four tabs for managing the knowledge base:

### File Ingestion
Drag and drop files (PDF, DOCX, Excel, PPTX) into the upload area → click **Start Ingestion**.

> 📸 **[SCREENSHOT — File Ingestion tab with upload area and indexed files list]**

### Chunks / Tables / Logs
- **Chunks** — Inspect indexed content per document
- **Tables** — Browse raw database tables; use **Clear Stale Cache** if users get empty responses
- **Logs** — View real-time application logs

> 📸 **[SCREENSHOT — Tables tab showing the Clear Stale Cache button]**

---

## 6. Tips & Shortcuts

| Action | How |
|---|---|
| Send message | `Enter` |
| New line without sending | `Shift + Enter` |
| Adjust text size | **A⁻ / A / A⁺** buttons in the header |
| Switch language | Language selector in the header (English / Hindi) |

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Sorry, I couldn't find information" | Admin clears stale cache: **Admin → Tables → Clear Stale Cache** |
| Red system status indicator | Contact your administrator |
| PDF viewer not showing | Use a desktop browser; mobile view hides the PDF panel |
| Voice input not working | Grant microphone permission in your browser settings |
| Uploaded file shows "failed" | Check **Admin → Logs** for details; re-upload a clean, unprotected file |

---

*© 2026 Carnot Research. icarKno™ is a trademark of Carnot Research.*
