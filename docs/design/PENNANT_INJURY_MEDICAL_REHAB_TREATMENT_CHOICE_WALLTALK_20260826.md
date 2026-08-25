# Pennant injury / medical / rehab / treatment-choice wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the owner wall-talk on injury, fatigue, medical uncertainty, rehab, recurrence, return-to-play, treatment choice, surgery versus conservative management, player consent, and medical reputation. It supplements the existing information/deployment, grievance/relationship, finance, lifecycle, and international-tournament design. It creates no new canonical PW IDs.

## 1. Injury is a continuous health system, not a binary random event

Do not model health as only `healthy / injured / recovered`.

Distinguish at least:

- latent physical health;
- acute fatigue;
- accumulated workload;
- local tissue stress by body region;
- symptoms / soreness / pain;
- functional readiness;
- actual healing state;
- recurrence / reinjury susceptibility;
- club medical belief about each of the above.

True health state is not directly visible to the user or CPU club.

## 2. Injury can arise through different mechanisms

Important high-level mechanisms include:

- acute trauma: collision, hit-by-pitch, sprint, slide, sudden throwing injury, etc.;
- overload / overuse: cumulative pitching, rapid workload increase, catching load, repeated tissue stress;
- minor / subclinical issue: tightness, inflammation, discomfort, small strain that may not immediately require roster removal;
- chronic / degenerative issue: age/history-related conditions that may not reset to zero after one recovery event;
- disease / non-baseball illness: a separate temporary-availability pathway.

Avoid both `fixed pitch count -> injury` and completely memoryless independent injury rolls.

## 3. Injury risk is a hazard, not an injury gauge

Conceptually, injury probability depends on exposure and current conditions such as:

- competitive / training exposure;
- local mechanical load;
- recent and accumulated workload;
- recovery state;
- prior injury/surgery history;
- age / individual physical characteristics;
- mechanics;
- role/position;
- chance.

Exact coefficients remain a research/calibration problem. Do not hard-code a visible deterministic injury meter.

## 4. Fatigue and injury are different

Fatigue may raise injury risk, but fatigue is not equivalent to damage.

Separate:

- whole-body fatigue;
- local tissue load (e.g. shoulder/elbow/hamstring);
- acute psychological stress load;
- accumulated mental fatigue;
- individual recovery.

The existing pitcher day-state / stress design remains in force.

## 5. Symptoms, diagnosis, and true pathology differ

A player can feel pain while the precise pathology remains uncertain.

Medical staff may begin with hypotheses and confidence ranges rather than knowing the true state immediately.

User-facing reports should be qualitative/ranged, for example:

`右肘内側に損傷の疑い。現時点では復帰まで数週間以上を見込むが、追加検査で判断が変わる可能性があります。`

Do not expose an omniscient `18 days until fully healed` timer by default.

## 6. Diagnosis updates over time

New information can come from:

- symptom progression;
- physical examination;
- imaging/tests;
- throwing/running response;
- rehab checkpoints;
- second opinions;
- specialist consultation.

Estimated severity, return window and treatment recommendation may change as evidence changes.

## 7. Treatment is a decision problem, not an automatic lookup

A diagnosis may permit multiple medically plausible treatment paths.

A treatment-choice object should compare options using distributions, not one guaranteed outcome.

Possible general pathways include:

- rest / activity restriction + rehabilitation;
- conservative / nonoperative management;
- adjunct treatments where appropriate;
- surgery;
- repair versus reconstruction where anatomy/tissue permits;
- delayed surgery after an unsuccessful conservative attempt;
- role/position change to reduce physical demand.

Only clinically plausible choices should be generated for the specific injury; do not offer every treatment for every condition.

## 8. Real-world anchor: Okugawa-type decision

A useful real-world design anchor is Yakult pitcher Yasunobu Okugawa's 2022 right-elbow case: public reporting states that Tommy John reconstruction was among the options considered, he consulted multiple medical institutions, reviewed MRI findings and rehabilitation paths with/without surgery, heard from teammates with surgical experience, and ultimately chose a nonoperative rehabilitation path.

This example is a **design anchor for multi-option medical decision-making**, not a request to hard-code Okugawa's exact outcome/probabilities into the simulation.

## 9. UCL injury illustrates why treatment depends on anatomy and goals

For UCL-type throwing injuries, treatment choice should be influenced by factors such as:

- tear severity/location;
- tissue quality;
- instability/function;
- acute vs chronic nature;
- prior surgery;
- player age;
- role/position;
- desire to continue high-level throwing;
- season timing;
- career stage;
- uncertainty in diagnosis and outcomes.

Possible pathways can include conservative rehabilitation, UCL reconstruction (Tommy John), and—when the injury pattern/tissue is suitable—repair/internal-brace type surgery. These are not interchangeable universal buttons.

## 10. Treatment options carry different outcome distributions

For each option, staff/player beliefs should estimate at least:

- probability of successful symptom/function recovery;
- time to basic function;
- time to throwing/running progression;
- time to return to roster/play;
- time to return to prior performance level;
- recurrence/failure probability;
- probability of later conversion to another treatment;
- permanent-performance-impact distribution;
- surgical/medical complication risk;
- confidence/uncertainty.

Do not reduce the comparison to `days until return`.

## 11. Return to play and return to performance are separate

A player can be medically cleared and appear in games before returning to previous performance.

Track conceptually:

1. biological/medical healing;
2. functional baseball activity;
3. return to practice/rehab competition;
4. return to official games;
5. return to prior or new stable performance level.

This allows post-injury ramp-up without arbitrary temporary base-rating penalties.

## 12. Surgery does not guarantee full recovery or performance

Surgery may solve structural instability while still carrying:

- long rehabilitation;
- uncertainty in return timing;
- incomplete return to prior performance;
- setbacks;
- reinjury/revision risk.

Do not encode `Tommy John -> guaranteed + healthy elbow` or `surgery always best`.

## 13. Conservative treatment is not simply the weak option

Nonoperative treatment may be rational when:

- pathology is potentially manageable without reconstruction;
- player/doctor beliefs support a reasonable chance of return;
- surgery carries large time/uncertainty costs;
- career timing or personal preference matters;
- the player wants to exhaust nonoperative paths first.

However, conservative management can fail or delay eventual surgery. That tradeoff must remain real.

## 14. PRP/adjunct treatments remain evidence-uncertain options

Some injuries may allow adjunct treatments such as PRP in addition to rest/rehab. These should only appear when medically plausible and should not be magic recovery consumables.

Treatment effectiveness can have wider uncertainty when medical evidence is weak or evolving.

## 15. Player consent matters

For invasive treatment, the player is not a passive asset that the club can force into surgery.

The club/medical staff can recommend, explain risks, obtain specialists/second opinions, and manage roster availability, but the player can prefer one medically plausible treatment over another.

This creates meaningful player agency without allowing the player to override medical reality.

## 16. Player and club can value the same treatment differently

Example tension:

- player wants to avoid surgery and pursue rehab;
- club prefers a more definitive long-term structural solution;
- player is near FA and values returning sooner;
- club has the player under a long contract and values long-horizon risk reduction;
- contender wants short-term availability;
- rebuilding club can tolerate a long rehab.

The final treatment decision should reflect rights/consent and negotiation, not a single omniscient optimization function.

## 17. Career timing changes medical preferences

Relevant context can include:

- age and career stage;
- contract/FA/posting timing;
- championship/postseason context;
- role security;
- remaining career goals;
- family/personal preference;
- prior treatment/surgery experience;
- trust in the medical staff.

A 21-year-old cornerstone and a 38-year-old veteran may rationally choose different paths for the same expected medical outcomes.

## 18. Second opinions are an information mechanic

Second opinion should not be a button that reveals truth.

It can:

- provide a different medical model/interpretation;
- narrow or shift diagnosis probability;
- introduce a treatment option not emphasized by the first doctor;
- increase confidence when independent opinions agree;
- create genuine disagreement when evidence is uncertain.

Different doctors should not disagree randomly; disagreement should arise from uncertainty, evidence, specialization, and evolving medical knowledge.

## 19. Medical staff quality primarily improves information and process

Better staff/facilities may improve:

- early detection;
- diagnostic accuracy/speed;
- workload-risk assessment;
- treatment selection quality;
- rehabilitation planning;
- return-to-play decision quality;
- communication/information integration.

Treatment/rehab quality may also affect outcomes, but avoid a simple `medical level 5 -> heal 20% faster` universal buff.

## 20. Rehabilitation is a staged process

Conceptually, rehab can move through stages such as:

- protect/heal;
- restore mobility/strength;
- rebuild general physical function;
- sport-specific movement;
- progressive throwing/running/load;
- rehab games / controlled competition;
- major-league/first-team readiness.

Setbacks can move a player backward or pause progression.

The normal user should not micromanage every rehab session.

## 21. Critical rehab decisions can interrupt automation

Important decision points can include:

- continue conservative treatment or switch to surgery;
- begin throwing/running progression;
- accelerate or hold a rehab stage;
- activate for official games;
- accept limited role / reduced load;
- seek another specialist opinion.

Everything else can be delegated under medical-policy settings.

## 22. Early return is a risk-performance tradeoff

Returning before full readiness may affect:

- pain/symptoms;
- available force/output;
- range of motion;
- mechanics;
- command/movement/speed;
- movement confidence;
- fatigue cost;
- recurrence/reinjury risk.

Do not implement a direct generic `injured player = all abilities -10` modifier.

## 23. Full clearance does not mean zero recurrence risk

A successfully recovered player may retain altered susceptibility depending on:

- injury type;
- tissue outcome;
- previous recurrence;
- mechanics;
- future workload;
- age;
- return progression.

At the same time, `injury history -> permanently doomed` is also wrong. Risk remains probabilistic.

## 24. Permanent change only occurs when the underlying body/mechanics changes

Minor injury may leave latent baseball skill almost unchanged and only affect current readiness.

A major injury can instead lead to:

- incomplete restoration of physical capability;
- mechanics change;
- velocity/mobility/range change;
- changed role or position;
- compensation that improves one dimension while sacrificing another.

Permanent rating changes should emerge from these actual underlying changes, not from an injury-event penalty table.

## 25. Delayed surgery is a real path

A player can choose conservative management, return or attempt to return, then later choose surgery if symptoms/instability recur or recovery stalls.

The game should preserve the whole decision history:

`injury -> conservative rehab -> partial return -> recurrence/stall -> revised diagnosis -> surgery -> rehab`.

This is especially important for long-term career stories.

## 26. Timing surgery itself can be strategic

When medically plausible, a player/team may consider:

- immediate surgery;
- attempting conservative treatment first;
- finishing a season/limited period before planned surgery;
- waiting for offseason.

The game must not let competitive incentives override states that are medically ineligible for play, but within medically possible options timing can matter.

## 27. Player symptom reporting is imperfect

A player may report symptoms early, late, incompletely, or seek a second opinion depending on context such as:

- career/roster pressure;
- postseason stakes;
- contract timing;
- prior injury experience;
- trust in club staff;
- personal risk preference.

Do not reduce this to one `toughness` stat.

## 28. Medical disagreement can create HEALTH grievances

Examples:

- player believes the club is rushing return;
- player believes the club is too conservative and blocking a career opportunity;
- club ignores repeated symptoms;
- player wants a second opinion but the organization handles it poorly;
- treatment promise/communication changes without explanation.

Consequences flow into trust, reputation, FA/retention and trade/exit intent, not directly into base ability.

## 29. Medical reputation emerges from history

Players/agents may form a reputation of a club based on outcomes and treatment such as:

- early detection;
- honest uncertainty communication;
- honoring second opinions;
- safe return management;
- repeated reinjury patterns;
- veteran treatment;
- willingness to invest in specialists/rehab.

Reputation is noisy and can lag actual current medical quality.

## 30. CPU clubs have the same uncertainty

CPU teams must not read true tissue state, exact recovery date, or guaranteed treatment outcome.

CPU medical decisions can differ because of:

- staff information quality;
- risk tolerance;
- competitive context;
- player relationship/trust;
- contract horizon;
- interpretation of the same uncertain evidence.

Bad medical/management behavior should arise from mistaken diagnosis/risk integration rather than deliberate random stupidity.

## 31. Medical information matters in trade/FA/contract markets

A medical exam can change beliefs and therefore:

- trade price/package;
- willingness to complete a trade;
- contract length/value;
- insurance/financial assumptions where the league system supports them;
- role expectations.

Medical review can lead to renegotiation or collapse, but never reveals guaranteed future injury outcomes.

## 32. Injury history is permanent career history

Persist at least meaningful injuries/treatment decisions such as:

- injury type/body region;
- date/context;
- initial diagnosis uncertainty;
- treatment path;
- surgery/procedure where applicable;
- rehab milestones/setbacks;
- return date;
- recurrence;
- role/position/mechanics change linked to the injury.

This should be visible in retrospective player/club/league history without forcing daily medical micromanagement.

## 33. Medical science evolves over a 100-year world

Treatment availability and beliefs should not freeze at 2026.

Long-run medical innovation can change:

- detection quality;
- procedure options;
- rehab protocols;
- expected outcome distributions;
- return-to-play standards;
- workload/early-warning knowledge.

Innovation must diffuse over time rather than become permanent exclusive club magic. New treatments should be bounded by plausible medical-innovation primitives and evidence/uncertainty, not random future miracle cures.

## 34. User-facing treatment screen stays compact

For a major injury, show a short comparison instead of hidden truth.

Example concept:

| Option | Staff view |
|---|---|
| Conservative rehab | shorter initial commitment; meaningful chance of return without surgery; risk of failure/recurrence and later surgery |
| UCL reconstruction (TJ) | long absence; stronger structural treatment for appropriate injury; return/performance still uncertain |
| Repair/internal brace | only if injury/tissue pattern is suitable; potentially shorter rehab; long-term evidence may carry wider uncertainty |

Also show:

- medical recommendation;
- player preference;
- confidence/range;
- main risk/tradeoff;
- next review point.

Do not expose exact hidden success percentages unless the game's information policy later explicitly supports approximate probabilities.

## 35. Future QA

Future implementation/research should test scenarios such as:

- same UCL symptoms but different tear pattern/tissue -> different option set;
- conservative treatment succeeds without surgery;
- conservative treatment stalls and later converts to surgery;
- surgery returns player to games before full performance;
- player/club disagree on surgery due to different career horizons;
- second opinion narrows uncertainty without revealing truth;
- strong medical department detects issue earlier but does not magically heal faster;
- early return raises risk through physical state rather than direct ability penalty;
- repeated mishandling creates medical/trust reputation effects;
- CPU cannot read exact healing/reinjury probabilities;
- long-run medical innovation changes available choices without guaranteed linear improvement.

## 36. Guardrails

- No binary `injured -> fixed days -> fully healthy` core model.
- No universal one-number injury susceptibility determining every body part/injury.
- No deterministic injury gauge.
- No surgery-as-guaranteed-cure assumption.
- No conservative-treatment-as-automatically-worse assumption.
- No forcing invasive treatment without player agency/consent in the normal model.
- No second-opinion button that reveals latent truth.
- No generic injury-to-base-rating debuff.
- No magical medical-staff recovery-speed buff as the main effect.
- No omniscient CPU medical information.
- No implementation from this document yet.

## 37. Real-world evidence anchors used only for design shape

- Public reporting on Yasunobu Okugawa's 2022 right-elbow treatment documents consideration of Tommy John surgery, consultation with multiple medical institutions, comparison of surgical/non-surgical rehab pathways, teammate input, and eventual choice of nonoperative rehabilitation.
- AAOS UCL guidance describes treatment choice as dependent on athlete goals, age, activity level, desire to continue competitive throwing, position/position-change willingness, and season timing; nonsurgical management and reconstruction are both pathways, while repair may be appropriate depending on tear type and tissue quality.
- Recent MLB UCL-surgery research reinforces the distinction between return to play and return to prior performance.

These sources inform architecture only. They do not set simulation probabilities or prescribe medical care.
