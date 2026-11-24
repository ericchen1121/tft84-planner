# Eightfold — TFT Lineup Explorer

A simple Traditional Chinese / English web app for visualizing every TFT lineup that fits your rules. Open the website at **https://ericchen1121.github.io/tft84-planner/**, download **[index.html](index.html)**, or serve `dist/` with any static host. The complete application is a single HTML file; no account, backend, npm installation, or API key is required to use it.

## 繁體中文 / English

新訪客預設使用繁體中文，右上角可切換 English；瀏覽器會記住語言偏好。介面、羈絆選單、轉職加成、卡片、棋盤詳情與 CSV 都支援語言切換。搜尋同時接受中英文羈絆名稱，且切換語言不會重設搜尋條件或修改計算用的原始名稱。

以下 20 個羈絆譯名來自使用者提供的 TFT PBE 截圖與補充。**未提供譯名的羈絆及棋子名稱保留英文**；不自行補上推測譯名。對照集中在 `src/i18n.mjs`，方便後續補充。

| English | 繁體中文 |
|---|---|
| Heartsteel | 心鋼之聲 |
| Frontman | 主唱 |
| Classical | 古典樂 |
| Collab | 合作 |
| Swiftstriker | 迅捷先鋒 |
| Hitmaker | 金曲製造機 |
| Encore | 要不要來首安可曲 |
| Juggernaut | 重裝戰士 |
| Beach Pop | 海灘流行樂 |
| Pentakill | 殺五社 |
| Slayer | 殺戮者 |
| Rock | 搖滾樂 |
| Manager | 經紀人 |
| EDM | 電子舞曲 |
| Choreographer | 編舞者 |
| Jazz | 爵士樂 |
| Gu Feng | 國風 |
| Hyperpop | 超能流行 |
| Ionic Spark | 離子火花 |
| Prodigy | 不世之才 |

## Features

- Champion portraits with cost colors, active-trait icons and member counts.
- Adjustable population, four-cost minimum, five-cost maximum, synergy score, frontline count and four-cost backline count.
- Unique traits included by default; minimum score **16**.
- Champion-pool exclusions, match-specific extra traits, and Sona's featured trait.
- **Emblems / Trait +1:** select a trait and add +1, +2 or more board-wide trait counts; multiple different traits can be boosted.
- Exact search in background workers, with progress, stop and explicit partial-result status.
- Search/filter/sort all results and export the filtered results as UTF-8 CSV.
- Illustrative hex-board view for each lineup.
- Responsive layout for desktop and mobile, keyboard-accessible controls and native dialogs.
- All verified default lineups embedded for immediate browsing.

## Use without installing anything

1. Download `dist/index.html` to your computer.
2. Open it in a current Chrome, Edge, Firefox or Safari.
3. Change criteria and choose **Find lineups**. Use **Export CSV** to save results.

All scripts, the source data and the verified preset are embedded in that file. Portraits, trait icons and the optional web font load from external websites; initials and system fonts appear when unavailable. The source page does not expose images for Rakan, Smeech or Sona, so those champions use initials.

## Search rules

Default conditions are exactly 8 population, at least 4 four-cost champions, no more than 1 five-cost champion, synergy score at least 16, at least 5 champions with attack range ≤2, and at least 2 four-cost ranged marksmen/casters. Jhin's ranged ammo-specialist role is included. Seven-cost units are allowed; unlock history and shop access are not simulated. Baron Nashor takes 2 population. The Akali variants are mutually exclusive.

Default scoring uses the **highest reached breakpoint** of each trait. Three Arcanists reach the first 2/4/6 breakpoint and score 2. A unique trait activated at 1 contributes 1, and an inactive trait contributes 0. The solver assumes each K/DA champion is two-star. K/DA gives 2/3/4/5/6/7 points at 3/5/7/10/13/15 stars in every scoring mode, capped at 7. Two champions contribute four stars and score 2. A +1 K/DA bonus adds one star to the total. Other scoring methods are available under Advanced options.

### Emblems / Trait +1

Under **Search criteria**, choose a trait and click **+1**. Repeat to increase that trait or add a different trait. Use the row's minus button to reduce a bonus; a zero bonus removes the row. **Reset** removes every bonus.

Bonuses are added to each board's trait counts **before activation and scoring**. For example, 2 champions in a trait that needs 3 plus a +1 bonus activate a count of 3, contributing 3 points in the default scoring method. The bonus consumes no population and does not change frontline or four-cost counts. Active-trait badges show the resulting count and a separate `+1` bonus tag; the tooltip explains the split. CSV output includes a `trait_bonuses` column and the adjusted active-trait counts.

These are board-wide count bonuses, not assigned emblem carriers. Specify bonuses actually available in your game; the app does not validate whether a selected trait has an obtainable emblem, carrier item slots, or carrier eligibility. For an explicit champion assignment, use Advanced options → Extra trait assignments instead. Do not enter the same emblem in both places.

Solver settings use `trait_bonuses`, for example `{"Frontman":1,"Arcanist":2}`. Counts must be integers from 0 through 16. Unique-trait bonuses follow the Count unique traits toggle. Any positive bonus triggers a fresh complete search rather than incorrectly reusing the unmodified preset.

Frontline is a range-based rule, not a judgment of tank strength. Aurora has source range 2 and Sona source range 0, so they count as frontline under the default rule. Board placement is illustrative and not optimized. Lineup order is not a combat-strength ranking.

Match-specific Collab assignments and Sona's featured trait must be set explicitly. Otherwise only traits printed in the source roster count. The roster is a **2026-11-18 snapshot** of Set 19, containing 94 entries and 47 traits, not a live update feed.

## Development

Node.js 20 or newer is sufficient. There are no third-party dependencies.

```sh
npm run build
npm test
npm run dev
```

The local preview URL is printed by `npm run dev`. The application lives in `src/`; `tools/build.mjs` embeds everything in identical root `index.html` and `dist/index.html` outputs. Data lives in `dist/units.json`, artwork references in `dist/artwork.json`, and the verified packed preset in `dist/preset.bin`.

### Validation

```sh
npm test
npm run benchmark
```

The test suite compares **58 independent brute-force cases** with the optimized solver, including unique-trait switches, all scoring methods, weighted population, mutually exclusive units, match-specific traits, trait bonuses and timeout behavior. Bonus cases cover activation across a threshold, multiple different bonuses, scores above population, preactivated bonuses, and zero/invalid values. It also independently checks every default preset lineup and its score, all DOM ID references, embedded artwork mappings and main/worker script syntax.

Run `node tools/benchmark.mjs --emblem` for a full-card-pool Frontman +1 search, including independent validation of every emitted lineup and its adjusted score.

The full four-worker JavaScript search checks that the embedded preset contains every default lineup and its score. The preset is ready for browsing as soon as the app loads.

Preset score distribution: 16 → 58,460; 17 → 9,202; 18 → 1,042; 19 → 62.

Browser visual/interaction QA was unavailable in the creation environment because its local-preview connection was blocked. Logic, data, build, selectors, script syntax and worker result parity were verified. Live browser appearance and interactions still need browser QA.

## Hosting

The repository includes a root `index.html` and `.nojekyll` for the existing branch-based GitHub Pages configuration:

1. In **Settings → Pages**, choose **Deploy from a branch**.
2. Select **main** and **/(root)**, then **Save**.
3. After deployment, open **https://ericchen1121.github.io/tft84-planner/**.

The publishing-folder menu only offers `/(root)` and `/docs`; `dist` and `src` are not options in this mode. You do not need to find or select them. After source edits, run `npm run build` and commit both generated HTML files; new commits to the configured branch automatically publish the root entry point.

Alternatively, select **GitHub Actions** as the Pages source and manually run **Deploy GitHub Pages** to build, test and deploy `dist/`. The two publishing methods use the same generated app. GitHub Pages availability depends on the account plan and repository configuration; the CI workflow tests source changes without changing Pages settings.

## Data and artwork

Source: [tactics.tools Set Update](https://tactics.tools/info/set-update). Champion artwork belongs to Riot Games. Artwork URLs are exact links observed in the reference page; three champions have no image link in that page. No Riot or tactics.tools credentials or private API endpoints are used.


## Champion Info / 棋子圖鑑

The existing Solver and Info tabs preserve solver settings and results when switching. Info contains all 94 champions sorted by cost descending, bilingual name search, and cost/trait/unlock filters. Names follow MetaTFT's Taiwan locale: 86 translated names, remaining names unchanged. Portraits include 91 original mappings and 3 additional MetaTFT images.

Info now displays full ability text with numeric values, mana, star-level ordering and highlighted numeric sequences. Population labels are omitted throughout Info. Unlock conditions are visible directly on the cards. Click a card for the same full description in a dialog. Content follows the source language, with English taking precedence when a translation is incomplete or materially different (notably Vladimir and Rakan's loss streak).

Source: https://www.metatft.com/new-set, captured 2026-11-19. Every champion has full text; 9 entries still contain source placeholders or dynamic counters: Kobuko, Ziggs, Gragas, Viego, Jinx, Shyvana, Nunu & Willump, Teemo and Sona. They are explicitly marked unavailable / dependent on the current board. No missing numeric values are guessed. Repeated tooltip echoes are normalized. Damage/healing displayed by the source is not a simulator for arbitrary item or stat configurations.

The current MetaTFT Info snapshot lists 32 unlockable entries. Info filters use that display snapshot. Solver data supplies the unlock flags shown in lineup results.

Each card and dialog reserves **5 circular recommended-item positions**. Recommendations are intentionally empty, as requested. Future recommendations can be set as item IDs in each unit's `recommended_items` array in `dist/info.json`; the renderer resolves images from `dist/items.json`. This is a list of suggested alternatives, not five equipped items, and does not affect solving.

The equipment catalog was captured only after explicitly switching https://www.metatft.com/items to **PBE / 19.1**. All 143 observed item links had `set=TFTSet19`; the catalog records mode, patch, set, exact item ID, label and image URL. This includes components, standard/radiant/artifact items, emblems and special items. The observed Prodigy item currently has the upstream ID `TFT_Emblem_CHANGEME`; it is kept with its actual source label rather than renamed or invented. The catalog does not expand the solver's user-approved emblem whitelist.

All display data is embedded in the standalone build; the website makes no runtime metadata fetch.

## Required trait tiers / 必要羈絆等級

In Solver, choose a trait and an actual activation breakpoint (for example Classical 4), then Add. All added requirements must be satisfied. At least this tier accepts higher tiers; Exactly this active tier permits extra members below the next breakpoint (Classical 4 accepts counts 4–5, and rejects 6). The mode applies to every required trait. Emblem bonuses, champion extra-trait assignments and Sona's featured trait contribute to the requirement. Disabling unique-trait scoring does not disable required-trait checks.

Default rules plus trait requirements instantly filter the complete verified preset. Custom rules use the exact worker search, with suffix membership bounds and upper-tier pruning. Required tiers never contribute extra score by themselves. Removing a requirement or Reset restores unrestricted searching after pressing Find lineups. The executed requirements are shown with the result context.

### Criteria layout and multiple selection

All search criteria now span the page above the results, with a responsive grid for numeric inputs and grouped panels for emblem bonuses and required traits. Advanced options and the search action remain in the same top panel. No left sidebar is used.

Required traits use a searchable checkbox list, sharing the same 28 allowed traits as the emblem bonus picker. Every selected trait has its own tier selector. Selecting another trait or changing its tier preserves the other selections. Searching only changes visible choices; all checked requirements remain active. Selected chips and a count show the full selection. Clear selected traits clears only required traits, while Reset clears all criteria. The Info tab is labeled 資訊 in Traditional Chinese and Info in English.

## Windows in-game floating overlay

The `desktop-layout` branch includes a Windows desktop application, with the existing solver inside an always-on-top window. Collapse it to a draggable floating icon, click the icon to restore, or use Alt+Shift+T. Collapsing resizes the same visible native window to a 64×64 icon without reloading the solver, preserving inputs, results and running workers. Drag the title bar to move the panel, resize its edges, and use × to quit. Right-click the icon to quit. Window positions persist across launches.

Use borderless/windowed game mode. Exclusive fullscreen is not supported. This is an ordinary desktop window, without game memory access, hooks or input automation. Game/anti-cheat compatibility has not been established. The program is unsigned.

For a ready-to-run Windows x64 download, open this branch's **Build Windows Overlay** GitHub Actions run and download the `Eightfold-TFT-Overlay-win-x64` artifact. Extract both ZIP layers if needed, then launch `Eightfold.exe`; keep all files beside it. The workflow packages official Electron binaries after SHA-256 verification and runs a native window smoke test. [繁體中文使用說明](desktop/README.zh-TW.md).

Development: Node.js 24, `npm install`, `npm run build`, `npm start`. Tests: `npm test`, `npm run test:overlay`, `npm run smoke:overlay`. Windows packaging: `npm run package:win`. A browser opening `index.html` alone does not provide the floating window or icon.

## Desktop web layout

This branch adapts the existing solver to desktop browsers. The top navigation is compact, task text and controls are larger, and wide monitors show three lineup cards per row (four on ultrawide screens). At narrower laptop widths, the result grid uses two columns. The criteria panel remains above the results.

Trait settings are grouped in a collapsible section so the default screen can show results sooner. Its summary shows the number of required traits and emblem bonuses. All criteria can also be collapsed into a compact toolbar without losing inputs, results or an ongoing search. The Info / 資訊 view and all solver rules remain available.

Build and verify with `npm run build` and `npm test`. For desktop use, download this branch's root `index.html` and open it in a recent Chrome or Edge; the standalone file embeds data, workers and the verified preset. Portraits and item images require internet. For local preview run `npm run dev`. Browser-local search does not require a server backend. This branch is kept separate from the main GitHub Pages source.


### Overlay 1.0.4

Collapse and restore now reuse one opaque, resizable native window, instead of transferring from the solver to a transparent secondary window. The native window remains visible while compact. Its topmost level is refreshed without focusing it when a borderless foreground window activates. The system tray provides Open, Collapse and Quit as recovery paths. The regression suite clicks the actual titlebar minus button and icon through 20 foreground-switch cycles, checks the same visible HWND and solver frame, and checks dragging and the tray. Actual TFT compatibility still requires testing on the player’s computer.

## PBE data refresh — 2026-11-21

Recommendations cover all 94 solver units using MetaTFT PBE / 19.1, last three days, with artifacts excluded. Ranking follows MetaTFT unit-detail scores before filtering to normal craftable items. The five displayed items are alternatives. Ahri uses the exact `DA_19_Ahri` identity and Seraphine uses `DA_Seraphine19_Indie`; both now have recommendations. Source request parameters, ranked rows and counts are retained in `dist/item-recommendations.json`. Run `npm run refresh:pbe` to fetch and rebuild; failed source validation stops the refresh.

The Taiwan PBE lookup adds eight champion translations and eighteen trait translations, and corrects Hyperpop to 超流行 and Gu Feng to 古風. Both Akali variants retain their suffixes. Still-untranslated source names retain their existing labels. Only display metadata changes; unit IDs, canonical trait keys, preset results, abilities and solver rules remain intact.

Team-code audit: all 91 mapped IDs still agree with the current lookup and the original eight-unit client sample remains exact. Graves, Nasus and Mordekaiser still share 449 in MetaTFT. The checked CommunityDragon PBE planner file contains sets 17 and 18, with no set-19 mapping. These three remain explicitly omitted with the existing red copy label and named warning. No guessed replacement IDs are introduced. See `dist/team-code-audit.json`.

## Augment library / 海克斯圖鑑

The third tab lists all 371 augment entries in the MetaTFT Set 19 PBE / 19.1 lookup snapshot dated 2026-11-21 (101 Silver, 147 Gold, 123 Prismatic). Search names/effects/traits in either language; combine tier, stage and general/trait filters; browse 24 cards per page and open full descriptions in a dialog. Keyboard tab navigation, direct #augments links and language switching preserve the solver and filters.

348 names and 349 descriptions have official Traditional Chinese text in the source. Each missing field independently falls back to English. Values resolve curve-table placeholders including percentages and stage-range columns. Nine entries have conflicting source curve values, one has a missing source value, and four have dynamic game fields; unconfirmed values are explicit rather than guessed. Round metadata is copied from the source; entries without listed rounds remain visible. Distinct tiers/stages/curves can share an API name, so composite identities retain every variant.

Run npm run refresh:augments to fetch and rebuild this dataset. dist/augments.json retains raw text and curve data for audit; the standalone HTML only embeds display fields. This is a reference library and does not apply augment effects to the solver.

## Equipment library and augment tier icons

The Equipment tab retains all 159 source entries: 36 normal, 36 radiant, 22 emblem, 33 artifact, 10 component, 4 support and 18 special entries. It has bilingual effect/name/component search, category/craftability/component filters, 24-card pages and detail dialogs. All 55 explicit recipes show ingredient icons plus a result icon; repeated ingredients remain duplicated. Radiant from/upgrade links are navigation only, never inferred component recipes. Source text, tags, stats and curves remain auditable in dist/equipment.json; run npm run refresh:equipment to update.

Actual augment artwork is tinted by rarity in cards and dialogs: grayscale silver, warm gold, and the original saturated prismatic colors. The tier name and border remain visible as additional cues.

## Augment effect tags

All 371 variants now have reviewed multi-label categories, shared with the web UI: ten colors, any/all tag filters, and equipment subtypes. Champion resource grants and Tactician health are separate categories. Prismatic trait quests are separate from augment rarity; hero upgrades require champion ability/role changes. `dist/augment-tags.json` records variant identities, reviewed description hashes, and MetaTFT reference categories. New or changed effects require review before building. These are editorial classifications based on the source effects, not official Riot labels.

## Lineup simulator

The Simulator tab adds a 4 × 7 hex board with 94 champions, 1–4 stars, position swaps, and three augment slots. Click champions to add them, or drag them onto a hex. Select a placed champion to change stars or click an empty hex to move. Drag a champion or equipped item to the lower palette to remove it. Pointer-based dragging supports edge scrolling and cleans up capture/ghosts on cancel, lost capture, or window blur; click and keyboard controls remain available.

Equipment can be clicked onto the selected champion or dragged onto any placed champion. The board enforces three item slots, three-slot Thief’s Gloves, unique equipment and redundant emblem restrictions. Matching components combine from the source recipe table; equipment transfers are atomic. Emblems update trait counts. Traits count distinct champion identities, with K/DA using the highest star level for each identity. Sona’s featured band and per-game Collab assignments are editable. Population includes Baron’s two slots. This is a lineup planner: augment rewards are placed manually and combat/quest completion is not simulated.

Augment selection supports bilingual name/effect/category search plus effect-label and rarity filters. Selections persist independently in all three slots, and the same exact augment cannot be selected twice. Local storage preserves the board and selections; an in-memory 40-step undo history covers edits and clearing. Saved state is validated against the current roster and equipment catalog before restoring.
