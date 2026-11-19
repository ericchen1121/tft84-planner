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
- All **68,766** verified default lineups embedded for immediate browsing.

## Use without installing anything

1. Download `dist/index.html` to your computer.
2. Open it in a current Chrome, Edge, Firefox or Safari.
3. Change criteria and choose **Find lineups**. Use **Export CSV** to save results.

All scripts, the source data and the verified preset are embedded in that file. Portraits, trait icons and the optional web font load from external websites; initials and system fonts appear when unavailable. The source page does not expose images for Rakan, Smeech or Sona, so those champions use initials.

## Search rules

Default conditions are exactly 8 population, at least 3 four-cost champions, no more than 1 five-cost champion, synergy score at least 16, at least 5 champions with attack range ≤2, and at least 2 four-cost ranged marksmen/casters. Jhin's ranged ammo-specialist role is included. Seven-cost units are allowed; unlock history and shop access are not simulated. Baron Nashor takes 2 population. The Akali variants are mutually exclusive.

The default score adds the **member counts of active traits**, including one-champion unique traits. A 3-member trait with a 2/4/6 threshold contributes 3; a unique trait activated at 1 contributes 1; an inactive trait contributes 0. Other scoring methods are available under Advanced options.

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

The full four-worker JavaScript search produced 68,766 lineups in **27.398 seconds** in the test runtime. Every lineup and score matched the independently checked C# results exactly. This measures the JavaScript engine and worker protocol in Node, not a browser UI benchmark; hardware and browser speed will vary. The default preset appears immediately, without rerunning search.

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

The header tabs separate the existing **Solver / 求解器** from **Info**. Info includes all 94 roster entries, sorted by cost descending, with cost/trait/unlock filters and bilingual name search. Click a card to read ability mechanics, mana, role, range, population and unlock requirements. Switching tabs preserves solver inputs and results; `#info` links directly to the library.

`dist/info.json` contains display-only metadata. On 2026-11-19, MetaTFT's Taiwan locale supplied 78 localized names and 59 ability descriptions with Chinese text. Chinese ability summaries paraphrase those descriptions; unavailable translations retain English. Variant suffixes distinguish Akali's forms. English mechanics, mana and unlock conditions retain the existing tactics.tools snapshot; this change does not alter solver balance data or its verified preset. Skill summaries intentionally omit star-level scaling and unpublished numeric placeholders. Sixteen unlock conditions also have Chinese summaries; other unlock conditions retain English.

Sources: https://www.metatft.com/new-set and https://tactics.tools/info/set-update . Info is embedded in the standalone build and requires no runtime data fetch.
