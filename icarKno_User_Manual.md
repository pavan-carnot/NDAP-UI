# icarKno™ — User Manual
### Knowledge Intelligence Platform · Powered by Carnot Research

---

> **Document Version:** 1.0
> **Last Updated:** July 2026
> **Audience:** End Users & System Administrators

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started — Login](#2-getting-started--login)
3. [Application Layout & Navigation](#3-application-layout--navigation)
4. [Knowledge Agent (Chat Interface)](#4-knowledge-agent-chat-interface)
   - 4.1 [Asking a Question](#41-asking-a-question)
   - 4.2 [Understanding the Response](#42-understanding-the-response)
   - 4.3 [Working with Citations & PDF Viewer](#43-working-with-citations--pdf-viewer)
   - 4.4 [Emailing Agent](#44-emailing-agent)
   - 4.5 [Report Generation Agent](#45-report-generation-agent)
   - 4.6 [Voice Input](#46-voice-input)
   - 4.7 [Recent Queries & New Analysis](#47-recent-queries--new-analysis)
   - 4.8 [System Status Panel](#48-system-status-panel)
5. [Spatial Analytics (Map View)](#5-spatial-analytics-map-view)
6. [Admin & Data Management](#6-admin--data-management)
   - 6.1 [File Ingestion](#61-file-ingestion)
   - 6.2 [Chunks / Elasticsearch Viewer](#62-chunks--elasticsearch-viewer)
   - 6.3 [Tables / PostgreSQL Viewer](#63-tables--postgresql-viewer)
   - 6.4 [Logs Viewer](#64-logs-viewer)
7. [Settings & Personalization](#7-settings--personalization)
8. [Keyboard Shortcuts & Tips](#8-keyboard-shortcuts--tips)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)
10. [Glossary](#10-glossary)

---

## 1. Introduction

**icarKno™** (Knowledge Intelligence Platform) is an AI-powered research tool designed to help policy analysts, researchers, and government officials query large collections of government datasets through natural language. Instead of manually searching through hundreds of reports, you simply type your question and icarKno retrieves, synthesizes, and presents grounded answers — with full source citations.

### What can you do with icarKno?

| Capability | Description |
|---|---|
| **Question & Answer** | Ask any question in plain English about indexed datasets (Census, PLFS, NFHS, AQI, TB, Dengue, etc.) |
| **Draft Emails** | Generate policy or formal emails grounded in data with one toggle |
| **Generate Reports** | Create downloadable DOCX/PDF reports synthesizing multiple sources |
| **Spatial Analytics** | Visualize government data on an interactive India state map |
| **Admin & Ingestion** | Upload new documents, monitor system health, and inspect the knowledge base |

---

> 📸 **[SCREENSHOT — Place here: Full application overview or landing/homepage after login showing all three navigation tabs and chat interface]**

---

## 2. Getting Started — Login

When you first open icarKno, you will be presented with the **Login Page**.

### Steps to Log In

1. Open your browser and navigate to the icarKno application URL.
2. On the login screen, enter your **Username** (email address) in the first field.
3. Enter your **Password** in the second field.
   - Click the **eye icon** on the right side of the password field to toggle password visibility.
4. Click the **"Sign In"** button.
5. If credentials are correct, you will be redirected to the **Knowledge Agent** (chat) page.

---

> 📸 **[SCREENSHOT — Place here: Login page with username/password fields highlighted and the Sign In button visible]**

---

### Login Errors

If you see a red error message below the form:
- Double-check your username and password for typos.
- Ensure Caps Lock is not enabled.
- Contact your system administrator if the issue persists.

> **Note:** icarKno uses secure session-based authentication. Your session is maintained in your browser. Closing the browser tab will require you to log in again.

---

## 3. Application Layout & Navigation

After logging in, the application is divided into three main areas:

### 3.1 Header Bar (Top)

The top bar is always visible and contains:

| Element | Location | Purpose |
|---|---|---|
| **icarKno™ Logo & Name** | Top-left | Brand identity and home indicator |
| **Tagline** | Below logo | "Knowledge Intelligence Platform · Powered by Carnot Research" |
| **Language Selector** | Top-right | Switch between English and Hindi |
| **Font Size Controls** | Top-right | A⁻ (small) · A (normal) · A⁺ (large) — adjusts text size globally |
| **User Avatar & Name** | Top-right | Displays your logged-in username initial |
| **Logout Button** | Top-right | Ends your session and returns to login |

---

> 📸 **[SCREENSHOT — Place here: Close-up of the header bar showing the logo, language selector, font size buttons, user avatar, and logout button]**

---

### 3.2 Navigation Tab Bar

Below the header is a **dark navy navigation bar** with three tabs:

| Tab | Route | Description |
|---|---|---|
| **Knowledge Agent** | `/chat` | Main conversational AI interface |
| **Spatial Analytics** | `/map` | Interactive India state map |
| **Admin & Data** | `/admin` | File management and system monitoring |

Click any tab to navigate between sections. The active tab is indicated by a **white underline**.

---

> 📸 **[SCREENSHOT — Place here: Navigation tab bar with all three tabs visible, highlighting the active tab with white underline]**

---

## 4. Knowledge Agent (Chat Interface)

The **Knowledge Agent** is the core feature of icarKno. It allows you to ask questions in natural language and receive AI-generated answers backed by indexed government documents.

The chat page is divided into three panels:

```
+------------------+---------------------------+------------------+
|                  |                           |                  |
|   LEFT SIDEBAR   |      MAIN CHAT AREA       |   PDF VIEWER     |
|  (Recent/Status) |  (Messages & Input Bar)   | (Desktop Only)   |
|                  |                           |                  |
+------------------+---------------------------+------------------+
```

---

> 📸 **[SCREENSHOT — Place here: Full chat page showing all three panels — sidebar on left, main chat in center, and PDF viewer panel on right (desktop view)]**

---

### 4.1 Asking a Question

#### Starting from the Empty State

When you first open the chat or start a new analysis, you will see five **sample questions** in the center. Click any of them to immediately run that query.

**Sample topics include:**
- India's renewable energy capacity and progress
- Skill development programs and enrollment data
- Government portal usage statistics
- And more from the indexed dataset collection

---

> 📸 **[SCREENSHOT — Place here: Empty chat state showing the five sample question cards in the center of the chat area]**

---

#### Typing Your Own Question

1. Click the **text input bar** at the bottom of the chat area.
2. Type your question in plain English. For example:
   - *"What is the current solar energy installed capacity in India?"*
   - *"Compare TB incidence rates across states in 2022."*
   - *"Show PM2.5 levels in Delhi for the last 3 years."*
3. Press **Enter** to send (or click the **blue send button** on the right).
   > **Tip:** Press **Shift + Enter** to add a new line without sending.

---

> 📸 **[SCREENSHOT — Place here: Chat input bar with a sample question typed in, highlighting the send button and the agent toggle buttons]**

---

### 4.2 Understanding the Response

After submitting a question, the following happens:

#### Live Processing Trace

A **progress bar** appears showing the 8-step AI pipeline in real time:
1. Query received
2. Context retrieval
3. Document ranking
4. Chunk extraction
5. Context assembly
6. Answer generation
7. Citation mapping
8. Response ready

---

> 📸 **[SCREENSHOT — Place here: The live pipeline trace progress bar visible while a response is being generated]**

---

#### The Response Card

Once processing is complete, the response appears as a **white card** with:

| Element | Description |
|---|---|
| **Answer Text** | The AI-generated answer in formatted markdown |
| **Inline Citations** | Superscript numbers `[1]`, `[2]` etc. linking to source documents |
| **Source Chips** | Colored tags below the answer showing document name and page/sheet number |
| **Map Widget** | Auto-appears if the answer contains geospatial data (expandable) |

---

> 📸 **[SCREENSHOT — Place here: A full AI response card showing the answer text, inline citation numbers, source chips at the bottom, and optionally an inline map]**

---

#### Agent Trace Accordion

Below the response, you can click the **"Agent Trace"** section to expand it and inspect three tabs:

- **Steps** — Numbered execution log showing each retrieval and generation step
- **Performance** — Timing (ms), token counts, cache hit/miss status, and calculation logs
- **Chunks** — The actual document chunks retrieved, showing text preview, page number, relevance score, and search type

---

> 📸 **[SCREENSHOT — Place here: The expanded agent trace accordion showing the Steps tab with numbered pipeline steps]**

> 📸 **[SCREENSHOT — Place here: The Performance tab inside agent trace showing timing, token counts, and cache status]**

> 📸 **[SCREENSHOT — Place here: The Chunks tab showing retrieved document chunks with score, page number, and text preview]**

---

### 4.3 Working with Citations & PDF Viewer

icarKno provides **full source transparency**. Every claim in an answer can be traced to its source document.

#### How Citations Work

- Numbers like `[1]`, `[2]` appear inline within the answer text.
- Below the answer, **source chips** show the document name and exact page or sheet.
- Clicking a citation opens the source document in the **PDF Viewer panel** on the right side (desktop), and automatically navigates to the cited page.
- The relevant section is **highlighted in green** for approximately 7 seconds to help you locate it quickly.

---

> 📸 **[SCREENSHOT — Place here: Answer text with citation numbers highlighted, and the PDF viewer panel on the right showing the cited page with green highlight]**

---

#### PDF Viewer Panel (Desktop)

On desktop, the right panel shows:
- The PDF document with the cited page loaded automatically
- Navigation controls to browse other pages
- Zoom controls

> **Note:** The PDF viewer is only available on desktop/laptop screens. On mobile, clicking a citation will navigate you to the document view.

---

### 4.4 Emailing Agent

The **Emailing Agent** mode generates a ready-to-send formal email grounded in the indexed data.

#### How to Use

1. In the input bar, click the **"Emailing Agent"** toggle button (it will highlight when active).
2. Type your email request. For example:
   - *"Draft an email to the Secretary, MNRE, regarding the delay in solar rooftop targets."*
   - *"Write an email summarizing India's EV adoption progress for quarterly review."*
3. Press **Enter** to submit.

The response will contain a fully structured email with:
- **Subject:** line
- **Salutation**
- **Body paragraphs** with data-backed content
- **Closing & Signature**

---

> 📸 **[SCREENSHOT — Place here: Chat input bar with the "Emailing Agent" toggle button highlighted/active, and a sample email draft response visible in the chat]**

---

> **Tip:** The emailing agent omits inline citation numbers for a cleaner email format, but the answer is still grounded in indexed documents.

---

### 4.5 Report Generation Agent

The **Report Generation Agent** creates a downloadable structured report (DOCX/PDF) synthesizing multiple sources.

#### How to Use

1. In the input bar, click the **"Generate Report"** toggle button (it will highlight when active).
2. Type your report request. For example:
   - *"Generate a report on India's renewable energy capacity as of 2024."*
   - *"Create a summary report on PLFS employment data across states."*
3. Press **Enter** to submit.

#### Working with the Generated Report

After processing, the response shows a **yellow document card** with:

| Button | Action |
|---|---|
| **View Document** | Opens the report in a full-screen modal preview (HTML-rendered DOCX) |
| **Download ▾** | Opens a dropdown with two options: **DOCX** format or **PDF** format |

---

> 📸 **[SCREENSHOT — Place here: A generated report card (yellow/amber card) in the chat with "View Document" and "Download" buttons visible]**

> 📸 **[SCREENSHOT — Place here: The full-screen document preview modal showing the rendered report content]**

---

### 4.6 Voice Input

You can speak your question instead of typing it.

1. Click the **microphone icon** in the input bar.
2. Speak your question clearly. The app uses your device's microphone.
3. The recognized text will appear in the input field automatically.
4. Review and press **Enter** to send.

> **Note:** Voice input uses the browser's built-in Web Speech API and is optimized for **Indian English (en-IN)**. Ensure your browser has microphone permission granted.

---

> 📸 **[SCREENSHOT — Place here: Input bar with the microphone icon highlighted/active and text being populated from voice input]**

---

### 4.7 Recent Queries & New Analysis

#### Left Sidebar

The left sidebar (collapsible on desktop) keeps track of your session history.

**Recent Queries Panel:**
- Displays your past questions with timestamps
- Click any previous query to jump back to that conversation context

**New Analysis Button:**
- Located at the top of the sidebar
- Click **"+ New Analysis"** to clear the current conversation and start a fresh session with a new Session ID

---

> 📸 **[SCREENSHOT — Place here: Left sidebar showing the "New Analysis" button at the top and recent query history items with timestamps below it]**

---

> **Tip:** The **Session ID** is shown near the input bar. Each session maintains its own conversation context. Starting a New Analysis generates a fresh Session ID.

---

### 4.8 System Status Panel

At the bottom of the left sidebar, the **System Status** panel shows real-time health of backend services:

| Indicator | What it Means |
|---|---|
| 🟢 **PostgreSQL** | Relational database is connected and healthy |
| 🟢 **Elasticsearch** | Search index is connected and healthy |
| **Total Docs** | Number of ingested documents in the knowledge base |
| **Total Chunks** | Number of indexed text segments available for retrieval |
| **Visual Assets** | Number of charts/images extracted from documents |
| **Timeseries Points** | Structured data points available for analysis |

If any indicator shows 🔴 red, contact your system administrator.

---

> 📸 **[SCREENSHOT — Place here: System status panel at the bottom of the left sidebar showing green indicators for PostgreSQL and Elasticsearch along with statistics]**

---

## 5. Spatial Analytics (Map View)

The **Spatial Analytics** page provides an interactive full-screen map of India where government dataset values are displayed as a **choropleth** (color-intensity) overlay across all states.

### Accessing the Map

Click **"Spatial Analytics"** in the navigation tab bar.

---

> 📸 **[SCREENSHOT — Place here: Full-screen spatial analytics page showing the India state map with color-coded data and the legend visible]**

---

### Using the Map

#### Dataset Selector

In the top-left corner, use the **dropdown menu** to choose which dataset to visualize. Available datasets include various government metrics (renewable energy, health, employment, air quality, etc.).

---

> 📸 **[SCREENSHOT — Place here: The dataset selector dropdown open, showing available datasets to select from]**

---

#### Color Palette

Use the **palette selector** to choose how data is colored:

| Palette | Color |
|---|---|
| Red | Light pink → Deep red |
| Indigo | Light blue → Deep indigo |
| Green | Light green → Dark green |
| Orange | Light orange → Deep orange |
| Purple | Light purple → Deep purple |
| Teal | Light teal → Dark teal |

The legend in the corner updates to reflect the selected palette.

---

> 📸 **[SCREENSHOT — Place here: Map with a specific dataset loaded showing the color palette selector and the intensity legend in the corner]**

---

#### Interacting with States

- **Hover** over any state to see a tooltip showing:
  - State Name
  - Metric Value
  - Unit of measurement
- States are colored by value intensity — **darker color = higher value**, **lighter color = lower value**

---

> 📸 **[SCREENSHOT — Place here: Map with hover tooltip visible on a state showing the state name, value, and unit]**

---

#### Inline Maps in Chat

When the Knowledge Agent detects that your question has a geographic/spatial dimension, it will **automatically insert a map widget** inside the chat response. You can:
- Click **"Expand"** to see the full map
- Click **"Collapse"** to minimize it back into the chat card

---

> 📸 **[SCREENSHOT — Place here: A chat response showing an inline map widget with the expand/collapse button]**

---

## 6. Admin & Data Management

The **Admin & Data** page is designed for system administrators to manage the knowledge base, monitor data ingestion, and inspect indexed content.

> ⚠️ **This section is intended for administrators only.** Changes made here affect the knowledge base used by all users.

Navigate to Admin by clicking **"Admin & Data"** in the navigation bar.

The page is divided into **4 tabs** with a status bar at the top.

---

> 📸 **[SCREENSHOT — Place here: Admin page overview showing the status bar at the top and the four tab options: File Ingestion, Chunks, Tables, Logs]**

---

### 6.1 File Ingestion

Use this tab to upload new documents into the icarKno knowledge base.

#### Step-by-Step: Uploading Documents

1. Navigate to **Admin & Data → File Ingestion** tab.
2. (Optional) Configure processing options:
   - ☑ **Extract charts** — Enables vision-based chart extraction from PDFs and PPTX files
   - ☑ **Enrich table rows via LLM Structurer** — Uses AI to semantically enrich table data
3. **Drag and drop** your files onto the upload area, or click the area to **browse files**.
   - Supported formats: **PDF, DOCX, Excel (.xlsx/.xls), PPTX**
4. Click **"Start Ingestion"** to begin processing.
5. Monitor the **status** for each file:
   - **Uploading** — File is being transmitted
   - **Processing** — Indexing in progress
   - **Done** ✅ — Successfully indexed
   - **Error** ❌ — Processing failed (check logs)

---

> 📸 **[SCREENSHOT — Place here: File Ingestion tab with the drag-and-drop upload area, processing options checkboxes, and Start Ingestion button]**

> 📸 **[SCREENSHOT — Place here: Indexed files list showing multiple files with their status badges (active, processing), chunk counts, and delete icons]**

---

#### Managing Indexed Files

Below the upload area, the **Indexed Files List** shows all documents currently in the knowledge base:

| Column | Description |
|---|---|
| **File Name** | Document name |
| **Status** | active / processing / failed |
| **Chunks** | Number of indexed segments |
| **OCR** | Whether OCR was applied (scanned documents) |
| **Images** | Whether image/chart assets were extracted |
| **Actions** | Delete button (with confirmation dialog) |

Click **Refresh** to update the list after new uploads.

---

### 6.2 Chunks / Elasticsearch Viewer

Inspect the indexed content of any specific document at the chunk level.

1. Go to **Admin & Data → Chunks** tab.
2. Select a document from the **dropdown menu**.
3. The viewer loads all indexed chunks for that document.
4. Click any chunk to **expand** it and see:
   - Chunk index number
   - Page number in the source document
   - Chunk subtype: `text`, `table`, or `image`
   - Full text content
   - Structured data JSON (if applicable for tables)

---

> 📸 **[SCREENSHOT — Place here: Chunks tab with a document selected from the dropdown and several expanded chunks showing their details (index, page, type, text)]**

---

### 6.3 Tables / PostgreSQL Viewer

Browse the raw database tables that power icarKno's backend.

1. Go to **Admin & Data → Tables** tab.
2. Select a table from the dropdown:

| Table Name | Contents |
|---|---|
| `documents` | Metadata for all ingested files |
| `chunks` | All indexed text chunks |
| `query_cache` | Cached query results for performance |
| `visual_assets` | Extracted charts and images |
| `visual_timeseries` | Time-series structured data |
| `visual_facts` | Key facts extracted from visual content |

3. Use the **Row Limit slider** (10–200 rows, step 10) to control how many records are shown.
4. Click **Refresh** to reload the table data.

---

> 📸 **[SCREENSHOT — Place here: Tables tab with a database table selected, the row limit slider, and a few rows of data visible in the table grid]**

---

#### Clearing Stale Cache

If users are seeing "sorry, I couldn't find information" for queries that should have valid answers, stale cache entries may be responsible.

1. In the **Tables** tab, scroll to the **Query Cache Management** section.
2. Click **"Clear Stale Cache"**.
3. A green success message will confirm the cache has been cleared.
4. Users can now re-submit those queries for fresh retrieval.

---

> 📸 **[SCREENSHOT — Place here: The Query Cache Management section at the bottom of the Tables tab with the "Clear Stale Cache" button and a success confirmation message]**

---

### 6.4 Logs Viewer

Monitor application and pipeline logs in real time.

1. Go to **Admin & Data → Logs** tab.
2. Select a **log file** from the dropdown.
3. The log content loads in a dark terminal-style viewer.
4. Scroll through the content to inspect errors, warnings, or processing details.

---

> 📸 **[SCREENSHOT — Place here: Logs viewer tab with a log file selected and terminal-style dark background content showing log entries]**

---

## 7. Settings & Personalization

### Language

Click the **language selector** in the top-right header to switch the interface language.

- **English** — Fully supported
- **Hindi (हिंदी)** — Supported
- *Other languages* — Listed but not yet activated in the current version

---

> 📸 **[SCREENSHOT — Place here: Language selector dropdown open in the header, showing English and Hindi as available options]**

---

### Font Size

Use the **font size buttons** in the top-right header to adjust text size globally:

| Button | Effect |
|---|---|
| **A⁻** | Smaller text |
| **A** | Normal/default size |
| **A⁺** | Larger text |

This is useful for accessibility or readability preferences.

---

### Sidebar (Chat Page)

On the chat page:
- The **left sidebar** is visible by default on large screens.
- Click the **sidebar toggle button** (hamburger icon) in the navigation bar to show or hide it.
- On mobile, the sidebar is hidden by default to maximize chat space.

---

## 8. Keyboard Shortcuts & Tips

| Shortcut | Action |
|---|---|
| `Enter` | Send the typed message |
| `Shift + Enter` | Add a new line in the input without sending |
| Click sample question | Auto-fill and send that question |
| Click citation `[n]` | Jump to that source in the PDF viewer |
| Click "Expand" on map | Open the inline map to full size |

### Pro Tips

- Use **specific timeframes** in your questions for more precise answers (e.g., "in 2023" or "between 2020 and 2023").
- Combine **two topics** in one question to get comparative answers (e.g., "Compare solar and wind capacity across states").
- If a response seems incomplete, click **"New Analysis"** and rephrase your question more specifically.
- Use the **Emailing Agent** when you need a polished formal draft; use the standard agent for raw research.
- Use the **Report Agent** when you need a synthesized multi-section output you can download and share.

---

## 9. Troubleshooting & FAQs

### Q: I see a red error card instead of an answer.

**A:** The backend may be temporarily unavailable. Check the **System Status** panel in the sidebar. If PostgreSQL or Elasticsearch shows a red indicator, contact your system administrator.

---

### Q: My question returned a "sorry, I couldn't find information" response.

**A:** This may be caused by a **stale cache** entry. Ask your administrator to clear the query cache via **Admin → Tables → Clear Stale Cache**. Then re-submit your query.

---

### Q: The PDF viewer is not showing the cited document.

**A:** Ensure you are using a **desktop or laptop browser** (the PDF viewer is hidden on mobile). If the issue persists, the source document may not be linked correctly — contact your administrator to verify the file was ingested properly.

---

### Q: Voice input is not working.

**A:** Ensure that:
1. Your browser has **microphone permission** granted for this site.
2. You are using a supported browser (Chrome recommended for best speech recognition).
3. You are speaking clearly and in **Indian English**.

---

### Q: The map is not loading.

**A:** The map requires an internet connection to load the base map tiles. Check your network connection. If the base map loads but no data appears, the selected dataset may not have state-level data — try a different dataset.

---

### Q: I uploaded a file but it shows "failed" status.

**A:** Check the **Logs Viewer** (Admin → Logs) for error details. Common causes:
- The file is password-protected
- The file format is not supported
- The file is corrupted

Re-upload a clean, unprotected copy of the file.

---

### Q: How do I add a new user account?

**A:** User account management is handled at the infrastructure level and is not available through the icarKno UI in the current version. Contact your system administrator.

---

## 10. Glossary

| Term | Definition |
|---|---|
| **Knowledge Agent** | The AI-powered conversational interface that answers questions from indexed documents |
| **Chunk** | A segment of a source document (text paragraph, table, or image) stored in the search index |
| **Elasticsearch** | The search engine that powers fast retrieval of relevant document chunks |
| **PostgreSQL** | The relational database storing document metadata, cache, and structured data |
| **Citation** | A reference number `[n]` in an AI response linking to the source document and page |
| **Choropleth Map** | A map where geographic areas (states) are colored based on a data value |
| **Session ID** | A unique identifier for your current conversation session |
| **Query Cache** | A database of previously processed queries stored to speed up repeated questions |
| **LLM Structurer** | An AI model that enriches raw table data with semantic context during ingestion |
| **OCR** | Optical Character Recognition — used to extract text from scanned or image-based PDFs |
| **Agent Trace** | The detailed log of steps, timing, and retrieved content that produced an AI response |
| **Emailing Agent** | A specialized AI mode that outputs structured formal emails instead of research answers |
| **Report Agent** | A specialized AI mode that generates downloadable multi-section reports |
| **Visual Assets** | Charts, graphs, and images extracted from source documents during ingestion |
| **Timeseries** | Structured time-based data points extracted from tables and documents |

---

*For technical support, contact your system administrator or the Carnot Research team.*

---

*© 2026 Carnot Research. icarKno™ is a trademark of Carnot Research. All rights reserved.*
