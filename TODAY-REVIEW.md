# HAHN requirements comparison — October 4, 2026

Reviewed the available indexed conversations from this morning, the current thread and supplied outside-thread messages, and the current Project Context, Multiplayer/Card Trading Requirements, Rebuild Blueprint, and Option 8 Design Direction. The retrieval service supplies relevant conversation evidence; it does not expose a complete verbatim export of every project conversation. This review does not claim every original word was available.

| Agreed requirement | Build comparison and correction |
|---|---|
| Children: character + six-digit code, no email | Corrected. Independent child profiles, keyed code digests, server-issued expiring sessions, rate limits, character selection/login. Live separate-session test passed. |
| Parent QR automatically identifies the child; parent owns email login | Corrected. Locally rendered private QR opens the matching child invite. Verified adult email + child confirmation creates the guardian link; linked parent may reset the code. No child login code in QR. |
| Entire screens fit; options can move into folders | Home now has four folders: Arcade, My Hero, Adventures, Academy. Fixed viewport with safe-area padding; long content uses Previous/Next pages. Phone viewport checks: 320×568, 393×852, 430×932; wider-screen paging checked at 1024×768. Actual iPhone Safari still needs device confirmation. |
| Email confirmation returns to the app | Frontend uses explicit production redirect. Supabase’s configured Site URL/redirect allowlist still needs dashboard correction; screenshot shows localhost:3000. Connected management tools lack auth-config mutation. Existing confirmed account can sign in directly. |
| No duplicate profile error | Profile initialization uses upsert and stable adult-user mapping; repeated loads do not insert competing profiles. Existing account ID/progress is preserved. |
| Grades 5–6 only; grade at first setup | Retained. Competitive trivia requires teacher-verified matching grade. |
| Option 8 Arcade Energy, Ana central and close to provided likeness | Retained artwork and blue/violet/gold glowing cards; layout compacted around Ana. |
| Exactly ten boy and ten girl finished heroes; no mix/match Character Lab | Retained. Character selection now pages four at a time. Two authored outfit collections; Nexus pins supported as collectibles. Nexus pins now use per-hero fitted anchor positions. |
| Outfit/accessory/dorm/Nexling customization | Outfit variants and owned cosmetics persist. Dorm layout/decoration and friend invite visits implemented. Nexus pins render at hero-specific anchors; the Nexling star charm is shown beside its growth display. |
| Every multiplayer game server based | Existing eight engines retained, private codes, turn validation, redacted hands/answers, reconnect. Escape and private drawing retained. Live independent child sessions were tested for stable card ownership and synchronized private Memory moves; two physical device acceptance remains outstanding. |
| Atomic cross-device trading; exact consent, warning, extreme block | Retained. Confirmation resets on edits; rarity-based ratio warning >1.5 and block ≥3. Those numerical rules are implementation defaults, not an earlier approved numerical decision. |
| Parents approve chores; teachers assign class missions; 500/week cap | Retained transactional awards; QR guardian workflow corrected. |
| Weekly recap, streak feedback, First Keeper welcome | Recap added to Rewards; personal Surge visible after five correct answers; First Keeper welcome restored for new child heroes. Full streak artwork sequence is not yet restored. |
| Separate First Keeper and Sensei | Retained story panels; First Keeper mentor now uses the corresponding story image. |
| Dorm friends, moderated drawing, Chronicle, Escape | Retained; hidden reported drawings are redacted on server. Sensei can view report snapshots and restore/hide. |
| Seven Nexlings, growing into guardians | Retained. Catalog specialties explained; active combat abilities remain deferred with skill balancing. |
| Classroom houses fair across grade and size | Retained equal grade-task credit, personal boosts excluded, per-student caps and verified-roster average. Historical fixed-roster snapshot rules remain unresolved. |
| Weekly Trivia Night, RSVP, reminders, tournament cards | Thursday 7 PM America/Detroit, grade-separated events and RSVP; winner cards once/event. Phone push is still blocked by automatic approval review; in-app announcements remain available. |
| Personal Surge; skill paths; mentors; rare shared Sensei portal | Saved progression retained. Skill battle abilities and advanced mentor lore unlocking remain incomplete; portal shared progress is implemented. |
| Sports Festival / Nexus Pass excluded; raids deferred; wars unapproved | Not added. |
| Contact the Sensei / bug reporting | In-app private bug reports added so children need no email; info@detcorddigital.com remains available to adults in Settings; drawing reporting retained. |
| How to Nexus opens at top | Restored as paged help starting on its first page. |
| Do Not Press / siren / Rickroll | Restored synthesized 9.5-second siren and existing Rickroll image on deliberate tap; no autoplay. |
| ODIN hands visible without horizontal scrolling | Responsive wrapping card grid retained; dynamically chooses columns up to ten. Extreme hands still need physical-device usability review. |
| Spot-the-Difference wrong-tap warnings / complete sets | Existing five-set server game retained. A three-miss comparison warning is restored. |
| No monetization, DMs, photo uploads, short skirts | Retained. Generated aliases; guesses are not exposed as chat. |
| Analytics requested on website | Existing public website analytics preserved. No child identity, QR token, code or gameplay answers sent to analytics. |
| Preserve existing app/progress until migration acceptance | Original homepage and /_nexus-test/ preserved. Old local balances are not blindly imported as competitive points; explicit legacy migration remains unresolved. |

Validation: TypeScript/build; eight engine tests; React interaction tests; live child API tests (no email, wrong-code rejection, cross-session saves, welcome reward once, adult-role rejection, hidden answers, revocation); transactional SQL reward/access checks; generated mobile screenshots inspected. Temporary QA child records were removed. No outgoing test emails were sent.

Push source stays under server/pending and is not deployed. Auth settings needed: Site URL https://hahnheroes.com/rebuild/; allow https://hahnheroes.com/rebuild/** and the hosted Site /rebuild/** URL. Never publish authentication/session secrets.
