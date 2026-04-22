export interface ChangelogUpdate {
  date: string;
  author: string;
  title: string;
  version: string;
  status: string;
  content: string;
}

export const CHANGELOG_DATA: ChangelogUpdate[] = [
  {
    date: "22/04/2026 03:26",
    author: "horsemeninteractive",
    title: "THE FINAL CALIBRATION (DECLARATION PROTOCOLS & SEASON 1 PREVIEW)",
    version: "v0.10.1",
    status: "PRE-LAUNCH STABILIZATION",
    content: `The Secretariat has authorized v0.10.1, a precision update focused on terminology fluency and the expansion of the Legislative Phase. This version also prepares the local architecture for the imminent Season 1 transition on May 2nd.

### 📜 LEGISLATIVE PHASE: PEEK DECLARATION
* **Mechanic:** Following a 'Policy Peek' Executive Action, players (both Human and AI) enter a formal Declaration Phase.
* **Utility:** Operatives may now publicly declare their findings, disseminate disinformation, or maintain silence.
* **AI Update:** AI Delegates have been programmed to utilize this phase for strategic signaling.

### ⚖️ TERMINOLOGY: DIRECTIVE FLUENCY
* **Standardization:** 'Policy Styles' have been formally relabelled as 'Directive Styles' across all modules.
* **Legacy Removal:** This concludes the transition away from archaic terminology to ensure unique Secretariat branding.

### 📊 INTELLIGENCE: SEASON 1 PREVIEW
* **Access:** A new 'Season 1 Preview' tab is active within the Profile's Pass interface.
* **Content:** All upcoming Free and Premium Pass assets are now integrated and available for pre-launch inspection.

### ⚙️ SYSTEM LOGIC & TRANSLATION
* **AI Refinement:** Removed a legacy 1% 'Critical Error' chance where AI would accidentally discard unintended directives. (Credit: edithson).
* **Localization:** All new declaration strings and item keys have been propagated across all 8 supported locales.`
  },
  {
    date: "18/04/2026 22:14",
    author: "horsemeninteractive",
    title: "THE HOUSE MANDATE (SEASONAL ARCHITECTURE & RULESET FLEXIBILITY)",
    version: "v0.10.0",
    status: "PRE-RELEASE CANDIDATE (BETA SEASON 0)",
    content: `The Secretariat has authorized the v0.10.0 'House' update, the final major structural expansion prior to the v1.0.0 Global Launch on May 2nd. This update introduces full seasonal cycles, deep host customization, and social accountability protocols.

### 🏠 SYSTEM: HOUSE GAME MODE
* **Authority:** Hosts can now calibrate the Directive Deck (Civil/State ratio) and toggle advanced logic.
* **Configuration:** Selective activation of Title Roles, Personal Agendas, and Crisis Cards.
* **Transparency:** Integrated 'HOUSE' header indicator for real-time ruleset verification by all Delegates.

### 📅 SYSTEM: SEASONAL ROLLOVER ARCHITECTURE
* **Beta Season 0:** Snapshot logic active. Season 1 transition scheduled for May 2nd.
* **Persistence:** Implementation of ELO resets, seasonal rewards, and historical leaderboard archives.
* **Spectators:** Dedicated Leaderboard added for the Observer Floor (Betting Accuracy).

### 🤝 SOCIAL: COMMENDATIONS & PROGRESS
* **Recognition:** Post-game 'Endorsements' added (MVP, Deceiver, Honorable).
* **Engagement:** Daily Login Streak counter and dynamic XP/IP Multiplier banners active in the Lobby.
* **Clans:** Fully localized Clan Challenges integrated for cross-regional coordination.

### 🖥️ UI: ANALYTICAL & CONDUCT PROTOCOLS
* **Heatmaps:** Visual Vote History Heatmap added to identify factional blocks and voting trends.
* **Governance:** Formal 'Vote-to-Kick' UI implemented for chamber maintenance.
* **Cinematic:** Restored the 'Big Plays' highlight reel to the post-game debrief.`
  },
  {
    date: "15/04/2026 20:57",
    author: "horsemeninteractive",
    title: "THE GREAT RECONSTRUCTION (DEFECTOR PROTOCOLS & REPLAY ARCHIVE)",
    version: "v0.9.15",
    status: "TOTAL LOCALIZATION ACTIVE",
    content: `The Secretariat has initiated the most ambitious system update to date. v0.9.15 introduces the Defector role, a complete Match Reconstruction archive, and full international deployment across 8 global regions.

### 🎭 FACTION IDENTITY: THE DEFECTOR
* **Replacement:** The Herald role has been decommissioned.
* **Ability:** Flip Vote. The Defector possesses the unique authority to invert a final vote tally.
* **Integration:** Documentation, onboarding, and dossiers updated to reflect the new operative.

### ⏪ FEATURE: MATCH RECONSTRUCTION
* **Function:** 'Reconstruct' button enabled in Match History for step-by-step game replays.
* **Logic:** Resolved 'match_id' persistence error; historical data now correctly anchors to playback.
* **UI:** Integrated localized error handling for corrupted or pre-v0.9.15 legacy data.

### 💎 VISUAL REFINEMENT: THE DIAMOND SHIFT
* **Branding:** Overseer icon replaced. The Hollow Diamond is now the symbol of Authority.
* **Motion:** Added dedicated card-flip animations to the voting phase for increased tactile feedback.
* **Polish:** Glassmorphism effects fully deployed across Credits, Profile, and Social modals.

### 🌐 UNIVERSAL LANGUAGE PROTOCOL (I18N)
* **Translation:** 100% localization complete for 8 languages (EN, DE, ES, FR, IT, PT, RU, ZH).
* **Narrator:** AI Narrator vocal expansion; full coverage for all game-loop events.`
  },
  {
    date: "10/04/2026 15:49",
    author: "horsemeninteractive",
    title: "THE GLASS MANDATE (UI REFRACTION & SYSTEM STABILITY)",
    version: "v0.9.14",
    status: "VISUAL & LOGIC CALIBRATION",
    content: `The Secretariat has initiated a complete aesthetic overhaul, moving away from flat-state optics to a high-fidelity 'Glassmorphism' interface. v0.9.14 refines the Delegates' first-contact experience and stabilizes critical logic loops.

### 🪟 VISUAL IDENTITY: GLASSMORPHISM 1.0
* **Interface:** Frosted glass layers with dynamic blur effects integrated across all UI containers.
* **Environment:** New high-resolution default background image for the Assembly Floor.
* **Themes:** Overhauled Dark and Light modes to utilize translucent depth.

### 🚀 SYSTEMS: INTELLIGENCE LANDING PAGE
* **Briefing:** Implemented a public-facing landing page detailing the world of the Interim Period.
* **Logic:** Dynamic session-check; authenticated Delegates bypass the briefing to enter the Chamber directly.

### 🎼 AUDIO: THE PENDULUM MOTIF
* **Soundscape:** New default theme music featuring the 'Call and Response' cello/dubstep motif.
* **UI Sounds:** New loading screens and audio cues for Authentication and Resource Loading phases.`
  },
  {
    date: "04/04/2026 20:50",
    author: "horsemeninteractive",
    title: "THE CRISIS PROTOCOLS (EXPANDED TITLES & EVENT DYNAMICS)",
    version: "v0.9.13",
    status: "TACTICAL EXPANSION",
    content: `The Secretariat has authorized the induction of four elite Title Roles and the deployment of the 'Crisis' Operational Mode. v0.9.13 introduces high-variance environmental factors and advanced information-gathering utility.

### 🎖️ NEW TITLE ROLES
* **The Archivist:** Private access to the global Discard Pile following policy enactment.
* **The Herald:** Forced assertion. Designate a player to confirm or deny a faction claim.
* **The Quorum:** Reactive emergency re-vote following a failed government ballot.
* **The Cipher:** Transmission of a single anonymous private message during the Legislative Phase.

### 🌋 GAME MODE: CRISIS
* **Mechanic:** Event Cards. A new environmental modifier is drawn at the start of every round.
* **Tiers:** Disruption, Pressure, and Escalation categories for varied tactical impact.`
  },
  {
    date: "03/04/2026 12:14",
    author: "horsemeninteractive",
    title: "THE SYNDICATE PROTOCOLS (CLANS, REFERRALS, & COLLECTIVE EFFORT)",
    version: "v0.9.12",
    status: "SOCIAL EXPANSION",
    content: `The Secretariat has authorized the formation of sanctioned 'Clans' and the deployment of the Personnel Acquisition framework. v0.9.12 focuses on collective identity and recruitment.

### 🤝 CLAN SYSTEM (THE SYNDICATE)
* **Capacity:** Groups of up to 16 delegates with full customization suites.
* **Hierarchy:** Owner, Officer, and Member ranks with specific permissions.
* **Clan XP:** 25% of all player-earned XP is contributed toward the Clan's standing.

### 🎁 REFERRAL INITIATIVE
* **Incentive:** Both the recruiter and recruit receive 150CP upon the recruit reaching Level 15 within a single season.
* **Access:** Unique referral links added to the Profile > Referrals tab.`
  },
  {
    date: "02/04/2026 13:42",
    author: "horsemeninteractive",
    title: "THE REVEAL PROTOCOLS (VISUAL RECAPS, WEBRTC STABILITY, & CHALLENGES)",
    version: "v0.9.11",
    status: "CINEMATIC ENHANCEMENT",
    content: `The Secretariat has authorized the implementation of the post-action 'Game Brief' sequence and a total stabilization of the WebRTC visual array.

### 🎬 CINEMATIC GAME BRIEF
* **Sequential Reveal:** Roles and Personal Agendas are now unveiled with high-fidelity animations.
* **Performance Highlights:** Key plays and turning points are visualized prior to the final summary.

### 🎯 BUREAU OF CHALLENGES
* **Triple-Tier Tasks:** Daily, Weekly, and Seasonal objectives are now live.
* **Reward Logistics:** Successful completion yields both Experience (XP) and Influence Points (IP).`
  },
  {
    date: "01/04/2026 16:10",
    author: "horsemeninteractive",
    title: "THE STRUCTURAL MANDATE (ARCHITECTURE, AI EXPANSION, & MODULARITY)",
    version: "v0.9.10",
    status: "ARCHITECTURAL EVOLUTION",
    content: `The Secretariat has authorized a total reorganization of the Assembly's core logic. v0.9.10 marks the transition from a monolithic engine to a modular, delegated hierarchy.

### 🏗️ ARCHITECTURAL STRATIFICATION
* **Domain Consolidation:** Centralized core logic within specialized domain spaces.
* **Service/Utility Split:** Clear separation between pure functions and stateful async services.
* **Modularized Engine:** Split functionality into specialized Managers (Round, Execution, etc.).

### 🤖 EXPANDED AI LINGUISTICS
* **Immersion:** 150+ new thematic chat phrases integrated for varied conversational protocols.
* **Speech Control:** Implemented dedicated volume sliders for Text-to-Speech output.`
  },
  {
    date: "26/03/2026 11:43",
    author: "horsemeninteractive",
    title: "THE CLARITY INITIATIVE (UI UNIFICATION, BOT LOGIC, & RECOVERY)",
    version: "v0.9.9",
    status: "INTERFACE STABILIZATION",
    content: `The Secretariat has authorized a massive overhaul of the visual information layer and user autonomy protocols.

### 👁️ LIVE DECLARATION INDICATORS
* **Visibility:** Real-time status badges added to all Playercards for instant role/stance recognition.
* **Efficiency:** Eliminates the need for manual Round History checks for core declarations.

### 🛠️ UNIFIED ACTIONBAR
* **Migration:** All Power and Ability modals moved into the Actionbar context.
* **Persistence:** Players can now check logs and chat while a modal is active.

### 🛡️ IDENTITY SOVEREIGNTY
* **Recovery:** Set a secure secondary email for password resets and account changes.
* **Flexibility:** Change your public alias within the Profile screen.`
  },
  {
    date: "20/03/2026 15:24",
    author: "horsemeninteractive",
    title: "THE COMMENDATION PROTOCOLS (MEDALS, METRICS, & SECURITY)",
    version: "v0.9.8",
    status: "SYSTEM HARDENING",
    content: `The Secretariat has authorized the implementation of the formal Recognition Framework and a total reinforcement of the digital perimeter.

### 🏅 ACHIEVEMENT & COMMENDATION SYSTEM
* **Medals:** 25 initial 'Medals' active with Gold, Silver, and Bronze classifications.
* **Pinning:** Feature up to 3 priority achievements on public Profile Cards.

### 🕵️ INTELLIGENCE LOG
* **Recently Played:** Stores the last 20 delegates encountered for rapid identification and reconciliation.

### 🔒 SECURITY HARDENING
* **Rate Limiting:** Quantico-standard Rate Limiting across all vital endpoints.
* **JWT Secret Rotation:** Automated 30-day expiration cycle.`
  },
  {
    date: "16/03/2026 23:19",
    author: "horsemeninteractive",
    title: "THE COMMANDER PROTOCOLS (FILTERS, PRIVACY, & AUTHORITY)",
    version: "v0.9.7",
    status: "COMMANDER DEPLOYMENT",
    content: `The Secretariat has authorized a massive expansion of the Assembly’s operational infrastructure.

### 🎮 THE COMMAND CENTER (LOBBY FILTERS)
* **Matchmaker:** Advanced filtering by Casual/Ranked, Joinable Only, and Spectate Mode.
* **Quick Join:** AI-weighted matchmaking finding the optimal seat in seconds.

### 🗝️ SOVEREIGNTY & PRIVACY
* **Security:** Three-tier room security: Public, Friends Only, and Private (4-character cipher).

### ⚡ HOST AUTHORITY SUITE
* **Tactical Kick:** Remove disruptive delegates directly from player cards.
* **Room Lockdown:** Close entry to new joiners instantly.`
  },
  {
    date: "15/03/2026 20:54",
    author: "horsemeninteractive",
    title: "THE GREAT CALIBRATION (THEMES, TIERS, & PASSES)",
    version: "v0.9.6",
    status: "PEAK INTEGRATION",
    content: `The Secretariat has authorized a total aesthetic and competitive overhaul.

### 🎨 VISUAL SPECTRUM
* **Theming:** Full design-token implementation with Dark/Light mode toggle.
* **Architecture:** Translucent glass depth replaces flat color blocks.

### 🏆 RANK TIERS & DIVISIONS
* **Hierarchy:** Bronze, Silver, Gold, Platinum, Diamond with sub-divisions (III, II, I).
* **Integration:** Visible across Profile, Friends List, Leaderboards, and Summaries.

### 🎫 THE SEASON PASS
* **Progression:** 50 levels of rewards with a redesigned node-based tracking interface.
* **Claim Mechanic:** Manual claiming for cosmetic rewards and Cabinet Points (CP).`
  },
  {
    date: "15/03/2026 15:23",
    author: "horsemeninteractive",
    title: "SOCIAL GLOBALIZATION & UI OVERHAUL",
    version: "v0.9.5",
    status: "FREQUENCIES UNLOCKED",
    content: `The Secretariat has expanded the communications grid and introduced a full visual overhaul of the social interface.

### 🌍 PERSISTENT SOCIAL NETWORK
* **Globalization:** Friend requests and invitations now transmit globally across all game states.
* **Search:** Direct Username Search feature within the Friends pane.

### 👤 FRIENDS PANE REFACTOR
* **Visualization:** High-fidelity avatars, frames, and real-time level/ELO tracking.`
  },
  {
    date: "15/04/2026 15:02",
    author: "horsemeninteractive",
    title: "ONBOARDING & ANALYTICS DEPLOYMENT",
    version: "v0.9.4",
    status: "RECONSTRUCTION COMPLETE",
    content: `The Secretariat has authorized new educational protocols and historical data archives.

### 🎓 ONBOARDING PROTOCOL
* **Mandates:** Automated click-through modal for first-time users explaining core rules.
* **Tactical Reference:** Persistent 'How to Play' directory added to the Lobby Header.
* **Action Bar Co-Pilot:** Contextual info explaining game phases for the first 5 matches.

### 📜 MATCH HISTORY ARCHIVE
* **Transparency:** Dedicated tab logging all previous session results with advanced analysis breakdowns.`
  },
  {
    date: "15/03/2026 10:47",
    author: "horsemeninteractive",
    title: "PERSONAL AGENDAS & DATA INTEGRITY",
    version: "v0.9.3",
    status: "SECURED",
    content: `The Secretariat has issued individualized mandates and significant security hardening.

### 🎯 PERSONAL AGENDA SYSTEM
* **Missions:** 20 secret secondary missions granting Bonus XP and IP upon completion.
* **Intelligence:** Real-time Deck and Discard counter added to the trackers.

### 🛡️ PROTOCOL HARDENING
* **Anti-Cheat:** Activated Row Level Security (RLS) on all Supabase tables.
* **Validation:** Database triggers implemented to prevent unauthorized match manipulation.`
  },
  {
    date: "14/03/2026 02:22",
    author: "horsemeninteractive",
    title: "LOGIC STABILIZATION & SEQUENCE CORRECTION",
    version: "v0.9.2",
    status: "CALIBRATION COMPLETE",
    content: `The Secretariat has identified and corrected several processing anomalies within the Assembly sequence.

### ⚖️ BALANCING
* **AI Calibration:** Massive overhaul to Synthetic Delegate logic to address skewed win rates. AI is now significantly more effective at protecting State interests.

### 🔧 FIXED
* **Special Election:** Resolved logic loops in Presidential order reversion.
* **Handler Sync:** Fixed bug granting triple consecutive terms.
* **Interdiction:** Resolved timing edge cases for Chancellor nominations.`
  },
  {
    date: "13/03/2026 21:00",
    author: "horsemeninteractive",
    title: "ENGINE RECONSTRUCTION & GLOBAL ALIGNMENT",
    version: "v0.9.1",
    status: "CORE STABILIZED",
    content: `The Secretariat has authorized a total overhaul of the underlying logic processors.

### ⚙️ CORE ENGINE REBUILD
* **Stability:** Rewrote server and engine logic from the ground up to eliminate stale states and hangs.

### ⚖️ THE GLOBAL SWING METER
* **Tracking:** Real-time lobby indicator tracking the tug-of-war between Civil and State victories. Every match impacts the global balance.

### 🗣️ LINGUISTIC DATABASES
* **Variety:** Doubled chat categories and increased AI population to 50 unique units.`
  },
  {
    date: "12/03/2026 20:14",
    author: "horsemeninteractive",
    title: "COMPETITIVE INFRASTRUCTURE & ROLES",
    version: "v0.9.0",
    status: "MAJOR MILESTONE DEPLOYED",
    content: `The Secretariat has authorized a massive expansion of Assembly protocols.

### 🎭 TITLE ROLE SYSTEM
* **New Powers:** Introduced Broker, Assassin, Strategist, Handler, Auditor, and Interdictor roles with unique independent powers.

### 📊 RANKED FRAMEWORK
* **Leaderboards:** Global tracking for ELO, Win %, and Games Played with top-3 medal highlights.`
  },
  {
    date: "11/03/2026 01:08",
    author: "horsemeninteractive",
    title: "LOGIC & LOGISTICS OVERHAUL",
    version: "v0.8.10",
    status: "SYNTHETIC RECALIBRATION",
    content: `The Secretariat has optimized synthetic intelligence and inventory distribution.

### 🤖 STRATIFIED AI LOGIC
* **Difficulty:** Implementation of 3 distinct Bot "Suspicion Models" (Low, Medium, High).

### 🎒 INVENTORY MANAGEMENT
* **Organization:** Dedicated 'Inventory' tab added to Profile UI; equipping is now separate from the Market.
* **Shop Rotation:** Market assets can now rotate without affecting existing player inventory.`
  },
  {
    date: "10/03/2026 18:29",
    author: "horsemeninteractive",
    title: "SOCIAL PLATFORM PROTOCOL",
    version: "v0.8.9",
    status: "ARCHITECTURAL DEPLOYMENT",
    content: `The Secretariat has enabled cross-delegate communication and tracking.

### 👥 RELATIONSHIP DATABASE
* **Friends List:** Send, Accept, or Reject requests.
* **Live Intelligence:** Tracking friend status (Lobby, Room, Idle) and direct join/summon features.

### 👤 DYNAMIC PLAYER MODALS
* **Stats:** Access ELO, Win/Loss ratios, and career stats by selecting player cards in-session.`
  },
  {
    date: "09/03/2026 09:08",
    author: "horsemeninteractive",
    title: "THE GREAT CLIENT-SIDE REFACTOR",
    version: "v0.8.8",
    status: "ARCHITECTURAL DEPLOYMENT",
    content: `The Secretariat has authorized a complete structural overhaul of the Assembly's core logic.

### 🧱 MODULAR DECONSTRUCTION
* **Logical Hierarchy:** Decommissioned the monolithic App.tsx in favor of specialized modules (UI, Logic, Network).
* **Efficiency:** Streamlined data movement between the Secretariat (Server) and Delegates (Clients).`
  },
  {
    date: "09/03/2026 04:54",
    author: "horsemeninteractive",
    title: "SYNCHRONIZATION PROTOCOL",
    version: "v0.8.7",
    status: "TECHNICAL DEPLOYMENT",
    content: `The Secretariat has implemented a version-checking architecture to ensure tactical data uniformity.

### 🛡️ STABILITY ENFORCEMENT
* **Validation:** Background version monitoring to prevent "Desync Crises" and state corruption.
* **Alerts:** Non-intrusive notifications when a new refresh is required.`
  },
  {
    date: "08/03/2026 23:01",
    author: "horsemeninteractive",
    title: "THE UNIVERSAL PIVOT",
    version: "v0.8.6",
    status: "CORE REBRAND DEPLOYED",
    content: `The Secretariat has finalized the transition to a standalone, near-future identity.

### 🌎 THE CRISIS RECONSTRUCTION
* **Setting:** The Defining event that established the State of Emergency.
* **Terminology:** Transitioned to 'Civil', 'State', 'Directives', and 'Overseer' as the official standards.

### 🎨 VISUAL IDENTIFICATION
* **Iconography:** New Scale of Justice (Civil) and All-Seeing Eye (State/Overseer) identifiers.`
  },
  {
    date: "08/03/2026 07:20",
    author: "horsemeninteractive",
    title: "REVENUE & REWARDS FRAMEWORK",
    version: "v0.8.5",
    status: "UI DEPLOYMENT",
    content: `The Secretariat has authorized the first visual overhaul of the Assembly's economic systems.

### ⚡ THE TRINITY IS COMPLETE
* **Currency:** ELO (Standing), IP (Influence), and CP (Cabinet Points) now tracked in the topbar.

### 🎫 ASSEMBLY PASS (BETA SKELETON)
* **Progression:** Initial preview of the seasonal reward timeline for Free and Premium tracks.`
  },
  {
    date: "08/03/2026 00:07",
    author: "horsemeninteractive",
    title: "REQUISITION & INTERFACE",
    version: "v0.8.1",
    status: "LIVE UPDATES",
    content: `The Secretariat has authorized several new upgrades to personalize the Delegate experience.

### ✨ NEW FEATURES
* **Emoji Protocols:** Dedicated picker added to chat for enhanced expression.
* **The Cosmetic Bureau:** Initial launch of Background Music, Soundpacks, and Backgrounds in the store.`
  },
  {
    date: "08/03/2026 00:06",
    author: "horsemeninteractive",
    title: "INITIAL BETA RELEASE",
    version: "v0.8.0",
    status: "STABLE DEPLOYMENT",
    content: `The High Council is officially in session. We have successfully transitioned into the initial Beta phase.

### 🛠️ CORE SYSTEMS
* **Assembly Protocol:** Full implementation of game logic.
* **Lobby Architecture:** Secure room creation and matchmaking.
* **Voice Link:** Integrated WebRTC communication.`
  }
];
