# Pennant World Simulation Master — Second-Pass Addendum

Status: **CANONICAL HUMAN-READABLE ADDENDUM**
Date: 2026-08-24

This file supplements `PENNANT_WORLD_SIMULATION_MASTER_20260824.md` after the strict second-pass completeness audit. For current design, read **both** files.

Canonical granular source remains the two PW ledgers:
- `PW-001..PW-235` base;
- `PW-236..PW-260` second-pass addendum.

---

## A. Trade and transaction market

The original project explicitly targets weak CPU trades/FA/roster construction, but the first master did not give trades their own module.

Required design direction:
- trade value combines current ability, future uncertainty, age, contract, role, roster surplus, positional need, competitive window, and player preferences where relevant;
- CPU should identify good players blocked in another organization and actively make offers;
- a deep team cannot indefinitely hide every useful prospect in the minors without receiving market pressure;
- active draft is a distinct movement route rather than being collapsed into ordinary trade/FA/release;
- detailed trade deadline, multi-player/package, no-trade/consent, waiver, and other transaction rules remain OPEN for later wall-talk.

---

## B. Foreign-player market must query the living global world

Foreign scouting is not a card generator.

Flow:

```text
Global Baseball World
  ↓
real/generated players with actual career state
  ↓
club scout/network discovery
  ↓
imperfect evaluation
  ↓
NPB / MLB / KBO / CPBL / other clubs compete
  ↓
player chooses based on contract + career values
```

Implications:
- early discovery can be an advantage;
- another league can outbid or offer a more attractive path;
- a player found in AA/AAA can stay in the US and later reach MLB rather than becoming an NPB candidate by fiat;
- foreign-player "NPB adaptation" should emerge from skill/context/role/environment, not one magic hidden rating.

---

## C. National-team player agency

Tournament selection and tournament meaning were already present, but the player's own participation decision was missing.

Open design:
- willingness can depend on national-team pride, health, career stage, overseas exposure value, club situation, and personality;
- for the user-controlled club, consider an option between player-agency-first and user-final-authority behavior;
- this is separate from the OFF/LIGHT/REALISTIC physical-load toggle.

---

## D. Long-run baseball skill scale

If worldwide training, AI, biomechanics, scouting, and participation improve for decades, the absolute level of baseball may rise.

Open research problem:

```text
absolute baseball skill
        vs
PowerPro-like displayed rating / era-relative scale
```

Do not allow the entire league display to drift toward 90 simply because future absolute baseball quality improves. At the same time, do not erase genuine era-level changes. This must be reconciled with the appraisal/engine architecture later.

---

## E. Real-world club programs as initial conditions

Examples such as Carp Academy or SoftBank multi-team development may be represented at the 2026 start as existing organizational assets.

They are **not permanent franchise magic**:
- rivals may imitate them;
- staff can leave;
- funding can change;
- the originating club can expand, alter, or dismantle them;
- successful mechanisms can diffuse through the league.

---

## F. Ownership, resources, expectations

All CPU clubs seriously pursue winning, but ownership/management can differ in:
- short-term vs long-term horizon;
- willingness to invest;
- risk tolerance;
- patience with rebuilds;
- innovation appetite.

Resource differences may remain, but money should expand strategic options rather than directly buy wins.

Outcome evaluation should be expectation-relative:
- a rebuilding club finishing third can be a success;
- a dynasty finishing second can be disappointing.

Long-term losing must trigger attempted reform, but reform may fail. No automatic catch-up.

---

## G. Additional development/staff/contract ideas retained

- focused development competes for finite coaching/training attention and players respond differently;
- staff can have career ladders (coach → farm manager → manager etc.); not every retired player remains in baseball;
- clubs can attempt pre-FA extensions and negotiate role/future posting expectations;
- agents may differ in negotiation timing, market creation, and public messaging as well as price bargaining;
- repeated success with discarded/failed players can create an emergent "reclamation" reputation;
- large-contract/media expectations affect psychological/organizational context, not direct hidden stat penalties.

---

## H. Governance additions

Rule evolution must also be able to cover:
- foreign-player limits;
- first-team registration numbers;
- controlled/development-player roster rules;
- other roster-registration systems.

The user-controlled club may participate in league proposals/votes/lobbying, subject to later UI design.

---

## I. All-Star / international relationship carryover

All-Star and national-team events can create:
- cross-club relationships;
- knowledge transfer;
- later familiarity;
- potentially weak future career/FA-network effects.

This must remain subtle rather than becoming a guaranteed friendship bonus.

---

## J. Bounded prospect universe

For scalable global simulation, do not instantiate every amateur player in the world.

Individualize and persist:
- draft-range players;
- notable international/youth prospects;
- surrounding candidates needed for uncertainty and later re-entry.

The rest can remain population-level until they become relevant.

This preserves both computational feasibility and long-term personal history.
