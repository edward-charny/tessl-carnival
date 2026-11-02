---
name: ux-review
description: Review a Tessl Carnival change from the player's point of view (usability, visual design and accessibility) before opening its pull request. Use for any change to what players see or do, such as colours, fonts, drawing, layout, text or controls.
---

# UX review

You advocate for the player. Evaluate the change as someone walking the midway and playing a game, and fix what you find before you open the pull request. Stay inside the issue: note anything outside it in the pull request instead.

## What to check

**Usability (Nielsen's heuristics):**

- Visibility of status: can players tell where they are, what's open, and what their score is?
- Recognition over recall: are controls (WASD, arrows, click, **E**) shown when needed?
- Consistency: does a new or changed piece look like it belongs with the rest of the carnival?
- User control: can players always get back to the midway?
- Error prevention and recovery: does nothing break, or trap the player?

**Visual design:**

- Hierarchy: the things to look at (open booths, the player, signs) are the most prominent.
- Contrast: figures separate from the ground, the path reads at a glance, and nothing important relies on colour alone.
- Repetition: colours, fonts and sizes come from `theme` and `palette`.

**Accessibility (WCAG 2.1 AA):**

- Text contrast is at least 4.5:1 for normal text and 3:1 for large text. Compute the ratio for every text colour pair the change touches.
- Key non-text objects should aim for 3:1 against what's behind them (WCAG 1.4.11).
- Everything works with the keyboard, with no keyboard traps.
- Nothing relies on red against green alone.
- Motion stays gentle: no flashing more than 3 times a second.

## Output

Put this in the pull request description:

```
## UX review

### Works well
- ...

### Issues found and fixed
- ...

### Contrast
| Pair | Ratio |
| ---- | ----- |

### Follow-ups (outside this issue)
- ...
```

## Mindset

Ask: could a new player understand this? Could someone with low vision or colour blindness use it? What happens when things go wrong? Is this the simplest path to having fun?
