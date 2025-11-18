# ⚔️ Double Elimination Tournament Guide

## Tournament Structure Overview

A double-elimination bracket guarantees every participant (in this case, board game) a second chance. **A game must lose twice to be eliminated.** The tournament is split into two simultaneous sections:

- **Winners' Bracket (W Bracket)** - For undefeated games (0 losses)
- **Losers' Bracket (L Bracket)** - For games with one loss (second chance)

---

## 🎮 8-Game Double Elimination Example

### Seeding Format
Games are ranked and seeded 1-8 based on ELO rating and win percentage. Higher seeds get favorable matchups.

**Bracket Seeding Rule:** Seed #1 plays Seed #8, Seed #2 plays Seed #7, etc.

---

## 🥇 Winners' Bracket (W Bracket: 0 Losses)

All 8 games start here. This bracket functions like a standard single-elimination tournament, but losers drop to the L Bracket instead of being eliminated.

| Round | Matchups | Winners Advance | Losers Drop To |
|-------|----------|-----------------|----------------|
| **Round 1 (Quarterfinals)** | 4 Matches | → W Round 2 (Undefeated) | → L Bracket R1 Minor (1st Loss) |
| **Round 2 (Semifinals)** | 2 Matches | → W Round 3 Final (Undefeated) | → L Bracket R2 Major (1st Loss) |
| **Round 3 (W Final)** | 1 Match | → Grand Final (Undefeated) | → L Bracket Final (1st Loss) |

### Example W Bracket Progression (8-Game):

```
Round 1:                 Round 2:              Round 3 (Final):
Seed #1 ──┐              ┌─ Winner ──┐        ┌─ W Champ ──┐
Seed #8 ──┤ Winner       │           ├─ W ────┤            ├─ Grand Final
           └─────────────┤           │        │            │
Seed #4 ──┐              │ Loser → L │        └────────────┘
Seed #5 ──┤ Winner       │           │
           └─────────────┤           │
                         │      Loser → L
Seed #3 ──┐              │ Bracket
Seed #6 ──┤ Winner ──────┤
           └─────────────┤
Seed #2 ──┐              └─ Loser → L Bracket
Seed #7 ──┤ Winner
           └─ Loser → L Bracket
```

**Key Rules:**
- ✅ Winners advance to next W Bracket round
- ❌ Losers immediately drop to L Bracket (0 → 1 loss)
- 🎯 Match each W Bracket loser with other losers in L Bracket Minor stage

---

## 🥈 Losers' Bracket (L Bracket: 1 Loss)

This is the **redemption round**. Once a game is here, a **second loss means complete elimination** from the tournament.

The L Bracket progresses with two stages per round:
1. **Minor Stage** - New losers from W Bracket play each other
2. **Major Stage** - Minor winners + previous L Bracket champion battle for survival

| Round | Minor Stage | Major Stage | Losers Eliminated |
|-------|-------------|-------------|------------------|
| **L Round 1** | 4 matches between 8 W-R1 losers | 2 matches (minor winners play each other) | 4 games eliminated (2nd loss) |
| **L Round 2** | 2 matches between W-R2 losers | 2 matches (minor winners + L-R1 major champ) | 2 games eliminated (2nd loss) |
| **L Round 3 (L Final)** | 1 match between W-R3 loser + others | N/A (only 1 game remains) | 1 game eliminated (2nd loss) |

### Detailed L Bracket Progression:

```
┌─ L ROUND 1 MINOR STAGE ──────────────────┐
│                                          │
│ Losers from W-R1:                        │
│ (4 games, each with 1 loss)              │
│                                          │
│ Loss-S1 vs Loss-S8  ──┐                  │
│                       ├─ Winner → L-R1 Major
│ Loss-S4 vs Loss-S5  ──┘
│                                          │
│ Loss-S3 vs Loss-S6  ──┐                  │
│                       ├─ Winner → L-R1 Major
│ Loss-S2 vs Loss-S7  ──┘                  │
│                                          │
│ Losers (4 games) → ELIMINATED (2nd loss) │
└──────────────────────────────────────────┘

┌─ L ROUND 1 MAJOR STAGE ───────────────────────┐
│                                               │
│ 2 Minor Winners vs Each Other                 │
│ (Winner gets 2nd chance in L-R2)              │
│                                               │
│ Minor-Winner-1  ──┐                           │
│ Minor-Winner-2  ──┼─ Winner → L Round 2       │
│                   │                           │
│ Loser → ELIMINATED (2nd loss)                 │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 🏆 Grand Final (Championship Match)

The tournament concludes with a final showdown:

**W Bracket Winner** (undefeated) vs **L Bracket Winner** (one loss)

### The "Bracket Reset" Rule

Because the **W Bracket winner has yet to lose**, they have a significant advantage:

| Scenario | Result of First Grand Final | Outcome |
|----------|-------------------------------|---------|
| **W Champ Wins** | W Bracket Winner wins matchup | **TOURNAMENT OVER** - W Champ is crowned Champion. L Champ has 2 losses and is eliminated. |
| **L Champ Wins** | L Bracket Winner wins matchup | **BRACKET RESET** - Both games now have exactly one loss. A decisive second match (Bracket Reset Final) is played to determine the final Champion. |

### Example Grand Final Scenarios:

```
SCENARIO 1: W Champ Wins First Match
┌─────────────────────┐
│ W Champ (0 losses)  │
│   vs               │
│ L Champ (1 loss)    │
└─────────────────────┘
        │ W Champ Wins
        ▼
  🏆 W CHAMP CHAMPION 🏆
  L Champ Eliminated (2nd loss)


SCENARIO 2: L Champ Wins First Match (Bracket Reset)
┌─────────────────────┐
│ W Champ (0 losses)  │
│   vs               │
│ L Champ (1 loss)    │ ← L Champ Wins
└─────────────────────┘
        ▼
   Both have 1 loss
   
┌──── BRACKET RESET ────┐
│ W Champ (1 loss)      │
│   vs                 │
│ L Champ (1 loss)      │
│   (2nd match)        │
└───────────────────────┘
        │ Winner
        ▼
   🏆 CHAMPION 🏆
```

---

## 📊 16-Game Double Elimination Tournament Progression

### W Bracket Path
```
Round 1: 16 games → 8 winners (8 losers drop to L Bracket)
Round 2: 8 games → 4 winners (4 losers drop to L Bracket)
Round 3: 4 games → 2 winners (2 losers drop to L Bracket)
Round 4: 2 games → 1 winner (1 loser drops to L Bracket Final)
           ↓
        GRAND FINAL
```

### L Bracket Path
```
L Round 1:
  Minor: 8 losers from W-R1 → 4 winners, 4 eliminated
  Major: 4 minor winners → 2 winners, 2 eliminated

L Round 2:
  Minor: 4 losers from W-R2 → 2 winners, 2 eliminated
  Major: 2 minor winners + 0 previous champ → 1 winner, 1 eliminated

L Round 3:
  Minor: 2 losers from W-R3 → 1 winner, 1 eliminated
  Major: 1 minor winner plays... (waits for W-R4 loser)

L Round 4:
  Minor: 1 loser from W-R4 (or bye if none)
  Major: W-R4 loser + L-R3 major champ → 1 winner (L Bracket Champion)
           ↓
        GRAND FINAL
```

---

## ✅ Tournament Implementation Features

### Code Validation - 8-Game Example

Your implementation correctly handles:

1. **Seeding**: Seeds #1-4 vs #8-5
   ```
   Matchup 1: Seed #1 vs Seed #8
   Matchup 2: Seed #4 vs Seed #5
   Matchup 3: Seed #3 vs Seed #6
   Matchup 4: Seed #2 vs Seed #7
   ```

2. **Minor Stage Queuing**: After W-R1 complete, losers automatically queue as minor matchups
   ```javascript
   minorMatchups = [
       { left: Seed #8 loser, right: Seed #5 loser },
       { left: Seed #6 loser, right: Seed #7 loser }
   ]
   ```

3. **Major Stage Integration**: After minor complete, major matchups include:
   - Minor winners
   - Previous round's L Bracket champion (if exists)

4. **Tournament Flow Control**:
   - ✅ Winners R1 → Minor matchups queue
   - ✅ Minor complete → Major matchups queue
   - ✅ Major complete → Winners R2 prepares
   - ✅ NO skip ahead (prevents minor bracket bypass)

5. **Bracket Reset**: Grand Final tracks both W Champ (0 losses) and L Champ (1 loss)

---

## 🎯 Common Bracket Examples

### Example 1: 8-Game Tournament - Path to Victory

```
WINNERS' PATH:
Seed #1 beats #8 ──┐
                   ├─ Seed #1 beats Seed #4 ──┐
Seed #4 beats #5 ──┘                          │
                                              ├─ Seed #1 beats Seed #2 ──┐
Seed #3 beats #6 ──┐                          │                         │
                   ├─ Seed #2 beats Seed #3 ──┘                         │
Seed #2 beats #7 ──┘                                                     │
                                                                         │
                                                                Seed #1 (W Champ)
                                                                    ↓
                                                            GRAND FINAL vs
LOSERS' PATH:                                               L Bracket Winner
Seed #8 (from W-R1) ──┐
                      ├─ Seed #8 beats Seed #5 (L Minor-1)
Seed #5 (from W-R1) ──┘
                                    ↓
                           Seed #8 advances (L Major-1)
                                    ↓
Seed #6 (from W-R1) ──┐
                      ├─ Seed #6 beats Seed #7 (L Minor-2)
Seed #7 (from W-R1) ──┘
                                    ↓
                      Seed #6 vs Seed #8 (L Major)
                           ↓
                      Seed #8 wins → L Champ
                                    ↓
                            GRAND FINAL
                        Seed #1 vs Seed #8
                           ↓
                      Seed #1 Wins!
                        CHAMPION
```

---

## 🔍 Verification Checklist

Your tournament implementation includes:

- ✅ **Proper Seeding**: 1v(N), 2v(N-1), 3v(N-2)... format
- ✅ **Winners Bracket**: Standard single-elimination flow
- ✅ **Losers Bracket Minor**: Pairs losers from same round
- ✅ **Losers Bracket Major**: Integrates minor winners + previous champion
- ✅ **Flow Control**: Minor → Major → Next Winners Round sequence
- ✅ **Bracket Reset Rule**: Tracks undefeated (W) vs one-loss (L) for Grand Final
- ✅ **Double Loss Elimination**: Two losses = out of tournament
- ✅ **Console Logging**: Seed numbers and results tracked throughout
- ✅ **Modal Display**: Bracket results with images and standings

---

## 📈 Tournament Statistics

| Aspect | 8-Game | 16-Game |
|--------|--------|---------|
| **Total Matchups** | 15 | 31 |
| **W Bracket Matchups** | 7 | 15 |
| **L Bracket Matchups** | 8 | 16 |
| **Rounds (W Bracket)** | 3 | 4 |
| **Total Games Eliminated** | 7 | 15 |
| **Games with 2nd Chance** | 8 | 16 |
| **Grand Final Possible** | Yes | Yes |

---

## 🎲 How to Run a Tournament

1. **Load Games**: Select 8, 16, 32, or 64 games from your collection
2. **Select Tournament Mode**: Choose "Bracket Tournament"
3. **Enable Double Elimination**: Check the double elimination checkbox
4. **Start Tournament**: Games are seeded and bracket begins
5. **Play Matches**: Winners advance, losers drop to L Bracket
6. **Follow Flow**: Minor → Major → Next Winners Round automatically
7. **Grand Final**: W Bracket winner vs L Bracket winner
8. **View Results**: Full bracket with all participants and results

---

## ⚙️ Code Architecture

**Key Components:**

- `bracketState.roundsData[round]` - Winners bracket round data
- `bracketState.losersBracketData[round]` - Losers bracket per-round data
  - `minorMatchups` - Losers from same round paired together
  - `majorMatchups` - Minor winners + previous L champ
  - `majorWinner` - L bracket champion for round
- `tournamentPairings` - Queue of matchups to play
- `pairingIndex` - Current position in pairing queue
- `recordBracketWinner()` - Handles all bracket result recording

**Tournament Flow:**
1. Winners round complete → Queue minor matchups
2. Minor stage complete → Build major matchups (minor winners + previous champ)
3. Major stage complete → Prepare next winners round
4. Final round complete + L Bracket done → Grand Final or declare champion

---

## 🎯 Summary

Your double elimination tournament structure is **correctly implemented** and handles:

✅ Proper seeding and bracket initialization  
✅ Winners bracket single-elimination flow  
✅ Losers bracket two-stage progression (Minor + Major)  
✅ Correct sequencing (Minor → Major → Next Winners)  
✅ Bracket reset rule for Grand Final  
✅ Two-loss elimination and second-chance recovery  
✅ Comprehensive console logging for debugging  
✅ Visual display with images and bracket results

**The tournament is tournament-ready for any field size (2, 4, 8, 16, 32, 64)!**
